import { api, USE_MOCK } from "./client";
import { mockOk, mockFail } from "./mock/helpers";
import { productsDb } from "./mock/productsDb";
import { historyDb } from "./mock/historyDb";
import { notificationsDb } from "./mock/notificationsDb";
import { mockCurrentUser } from "./mock/users";
import { groupCommits } from "./mock/commits";
import { upsertCase, WH as WH_FULL } from "./mock/discrepanciesDb";
import { ACTIVITY_TYPE } from "@/lib/constants";

/*
 * ASUMSI (belum disepakati). Satu permintaan = satu commit atomik (semua item berhasil atau tidak sama sekali):
 *   POST /commits { related_commit_id?: uuid, message?: string,
 *                   items: [ { activity_type, product_id, warehouse_id, quantity, reason? } ] }
 *   -> 201 data: commit (bentuk sama seperti GET /commits) + discrepancies_created (jumlah kasus selisih, untuk PHYSICAL_COUNT)
 *   Arti `quantity` per activity_type:
 *     IN / OUT / TRANSFER_IN / TRANSFER_OUT : jumlah yang ditambah/dikurangi (bilangan bulat > 0)
 *     ADJUSTMENT                            : jumlah stok SETELAH penyesuaian (>= 0); reason wajib
 *     PHYSICAL_COUNT                        : hasil hitung fisik (>= 0); TIDAK mengubah stok sistem, hanya pembanding
 *   Perpindahan = dua item (TRANSFER_OUT di gudang asal + TRANSFER_IN di gudang tujuan), jumlah sama.
 *   Backend menghitung qty_before / qty_after. Stok tidak boleh negatif:
 *     409 INSUFFICIENT_STOCK, errors: [{ field: 'quantity', message: 'Jumlah barang keluar melebihi stok tersedia di gudang ini.' }]
 *   Aktivitas Staff otomatis berstatus SUBMITTED dan langsung memengaruhi stok (PRD 6.2).
 *   related_commit_id dipakai penyesuaian yang menindaklanjuti aktivitas yang ditolak SPV.
 */
const WHS = { "wh-1": { id: "wh-1", code: "G1", name: "Gudang 1" }, "wh-2": { id: "wh-2", code: "G2", name: "Gudang 2" }, "wh-3": { id: "wh-3", code: "G3", name: "Gudang 3" } };

export async function createCommit({ items, related_commit_id = null, message = "" }) {
  if (USE_MOCK) {
    const me = mockCurrentUser();
    const now = Date.now();
    const prepared = [];
    for (const it of items) {
      const p = productsDb.find((x) => x.id === it.product_id && !x.deleted_at);
      const st = p?.stocks.find((s) => s.warehouse_id === it.warehouse_id);
      if (!p || !st) return mockFail(404, "NOT_FOUND", "Barang atau gudang tidak ditemukan.");
      const before = st.quantity;
      const q = it.quantity;
      const plus = it.activity_type === "IN" || it.activity_type === "TRANSFER_IN";
      const minus = it.activity_type === "OUT" || it.activity_type === "TRANSFER_OUT";
      const after = plus ? before + q : minus ? before - q : q;
      if (after < 0) return mockFail(409, "INSUFFICIENT_STOCK", "Jumlah barang keluar melebihi stok tersedia di gudang ini.", [{ field: "quantity", message: "Jumlah barang keluar melebihi stok tersedia di gudang ini." }]);
      prepared.push({ it, p, st, before, after });
    }
    const commitId = `c-${now}`;
    let diffs = 0;
    const rows = prepared.map(({ it, p, st, before, after }, k) => {
      if (it.activity_type === "PHYSICAL_COUNT") {
        st.last_checked_at = new Date(now).toISOString();
        if (after !== before) {
          diffs += 1;
          upsertCase({ product: p, warehouse: WH_FULL[it.warehouse_id], source: "PHYSICAL_COUNT", sys: before, cmp: after });
        }
      } else st.quantity = after;
      return {
        id: `h-${now}-${k}`, commit_id: commitId, created_at: new Date(now).toISOString(),
        user: { id: me.id, name: me.name, role: me.role }, activity_type: it.activity_type,
        product: { id: p.id, code: p.code, name: p.name, category: p.category }, warehouse: WHS[it.warehouse_id],
        qty_before: before, qty_after: after, reason: it.reason ?? "",
        status: me.role === "staff" ? "SUBMITTED" : null, review_note: null, reviewed_by: null, reviewed_at: null, follow_up_commit_id: null,
      };
    });
    historyDb.unshift(...rows);
    if (related_commit_id) historyDb.filter((r) => r.commit_id === related_commit_id).forEach((r) => (r.follow_up_commit_id = commitId));
    if (diffs) notificationsDb.spv.unshift({ id: `n-d${now}`, type: "DISCREPANCY_NEW", message: `${diffs} selisih baru dari stok opname oleh ${me.name}.`, ref_id: commitId, is_read: false, created_at: new Date(now).toISOString() });
    if (me.role === "staff")
      notificationsDb.spv.unshift({ id: `n-${now}`, type: "ACTIVITY_SUBMITTED", message: `${me.name} mengajukan aktivitas ${ACTIVITY_TYPE[items[0].activity_type] ?? "stok"} (${prepared[0].p.name}).`, ref_id: commitId, is_read: false, created_at: new Date(now).toISOString() });
    const res = await mockOk({ ...groupCommits(rows)[0], discrepancies_created: diffs }, { message: "Transaksi dicatat", ms: 600 });
    return res.data;
  }
  return (await api.post("/commits", { items, related_commit_id, message })).data.data;
}
