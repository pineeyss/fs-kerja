import { productsDb } from "./productsDb";

// DATA CONTOH riwayat aktivitas stok (read-only). Bukan data aktual Akutusocks.
const WH = [
  { id: "wh-1", code: "G1", name: "Gudang 1" },
  { id: "wh-2", code: "G2", name: "Gudang 2" },
  { id: "wh-3", code: "G3", name: "Gudang 3" },
];
const USERS = [
  { id: "u-3", name: "Rina Contoh", role: "staff" },
  { id: "u-4", name: "Dimas Contoh", role: "staff" },
  { id: "u-2", name: "Anita Contoh", role: "spv" },
];
const HOUR = 3600 * 1000;
const STATUSES = ["ACCEPTED", "SUBMITTED", "REJECTED", "ACCEPTED"];
const REASON = {
  IN: "Restock dari supplier",
  OUT: "Penjualan toko",
  TRANSFER: "Pemerataan stok antar gudang",
  PHYSICAL_COUNT: "Hitung fisik rutin",
  ADJUSTMENT: "Koreksi selisih hasil hitung fisik",
};

const rows = [];
let n = 0;
const base = Date.now();

function push(commitId, i, user, type, product, wh, before, after, reason) {
  const staff = user.role === "staff";
  const status = staff ? STATUSES[i % STATUSES.length] : null;
  rows.push({
    id: `h-${n++}`,
    commit_id: commitId,
    created_at: new Date(base - (i * 18 + 2) * HOUR).toISOString(),
    user: { id: user.id, name: user.name, role: user.role },
    activity_type: type,
    product: { id: product.id, code: product.code, name: product.name, category: product.category },
    warehouse: wh,
    qty_before: before,
    qty_after: after,
    reason,
    status,
    review_note:
      status === "REJECTED" ? "Jumlah tidak sesuai bukti. Lakukan penyesuaian baru dengan alasan yang jelas." : status === "ACCEPTED" ? "Sudah diperiksa." : null,
    follow_up_commit_id: null,
    reviewed_at: null,
    reviewed_by: status === "ACCEPTED" || status === "REJECTED" ? "Anita Contoh" : null,
  });
}

for (let i = 0; i < 36; i++) {
  const product = productsDb[i % productsDb.length];
  const user = USERS[i % USERS.length];
  const wh = WH[i % 3];
  const before = 8 + ((i * 5) % 14);
  const kind = i % 6;
  if (kind === 0) push(`c-${i}`, i, user, "IN", product, wh, before, before + 5 + (i % 7), REASON.IN);
  else if (kind === 1) push(`c-${i}`, i, user, "OUT", product, wh, before, Math.max(0, before - 1 - (i % 4)), REASON.OUT);
  else if (kind === 2) {
    const to = WH[(i + 1) % 3];
    const qty = 2 + (i % 3);
    push(`c-${i}`, i, user, "TRANSFER_OUT", product, wh, before, before - qty, `${REASON.TRANSFER} (ke ${to.name})`);
    push(`c-${i}`, i, user, "TRANSFER_IN", product, to, before + 3, before + 3 + qty, `${REASON.TRANSFER} (dari ${wh.name})`);
  } else if (kind === 3) push(`c-${i}`, i, user, "PHYSICAL_COUNT", product, wh, before, before - 1, REASON.PHYSICAL_COUNT);
  else if (kind === 4) push(`c-${i}`, i, user, "ADJUSTMENT", product, wh, before, before - 1, REASON.ADJUSTMENT);
  else push(`c-${i}`, i, user, "IN", product, wh, before, before + 10, REASON.IN);
}

export const historyDb = rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
