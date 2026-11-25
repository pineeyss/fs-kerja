import { productsDb } from "./productsDb";

// DATA CONTOH kasus selisih. Bukan data aktual Akutusocks.
export const WH = { "wh-1": { id: "wh-1", code: "G1", name: "Gudang 1" }, "wh-2": { id: "wh-2", code: "G2", name: "Gudang 2" }, "wh-3": { id: "wh-3", code: "G3", name: "Gudang 3" } };
const DAY = 24 * 3600 * 1000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();
const prod = (code) => {
  const p = productsDb.find((x) => x.code === code);
  return { id: p.id, code: p.code, name: p.name };
};

const base = (id, code, wh, source, sys, cmp, status, days, extra = {}) => ({
  id, product: prod(code), warehouse: wh ? WH[wh] : null, source,
  qty_system: sys, qty_compare: cmp, difference: cmp - sys, status, note: null,
  created_at: ago(days), updated_at: ago(Math.max(0, days - 1)),
  qty_recount: null, recounted_by: null, recounted_at: null, validated_by: null, validated_at: null, ...extra,
});

export const discrepanciesDb = [
  base("sel-0001", "TMB-001", "wh-3", "PHYSICAL_COUNT", 1, 3, "OPEN", 0.3),
  base("sel-0002", "TCG-001", null, "KASIR_PINTAR", 9, 8, "OPEN", 1),
  base("sel-0003", "KEY-001", null, "KASIR_PINTAR", 19, 21, "OPEN", 1),
  base("sel-0004", "BAG-001", "wh-2", "PHYSICAL_COUNT", 1, 0, "OPEN", 2),
  base("sel-0005", "JBZ-001", null, "KASIR_PINTAR", 55, 58, "IN_PROGRESS", 4, { note: "Dicek ulang oleh Staff di Gudang 1 dan 2.", qty_recount: 56, recounted_by: "Rina Contoh", recounted_at: ago(2) }),
  base("sel-0006", "EYE-002", "wh-1", "PHYSICAL_COUNT", 3, 2, "IN_PROGRESS", 5, { note: "Menunggu bukti serah terima." }),
  base("sel-0007", "ACT-001", null, "KASIR_PINTAR", 25, 24, "RESOLVED", 9, { note: "Satu unit terjual belum tercatat. Sudah disesuaikan.", qty_recount: 24, recounted_by: "Dimas Contoh", recounted_at: ago(7), validated_by: "Anita Contoh", validated_at: ago(6) }),
  base("sel-0008", "PRF-001", "wh-2", "PHYSICAL_COUNT", 15, 14, "RESOLVED", 12, { note: "Salah hitung pada pemeriksaan pertama.", validated_by: "Anita Contoh", validated_at: ago(10) }),
].sort((a, b) => b.created_at.localeCompare(a.created_at));

let seq = 0;
/** Buat atau perbarui kasus selisih yang masih terbuka untuk barang + cakupan + sumber yang sama. */
export function upsertCase({ product, warehouse, source, sys, cmp }) {
  if (cmp === sys) return { created: false, touched: false };
  const open = discrepanciesDb.find((d) => d.status !== "RESOLVED" && d.product.id === product.id && (d.warehouse?.id ?? null) === (warehouse?.id ?? null) && d.source === source);
  const now = new Date().toISOString();
  if (open) {
    Object.assign(open, { qty_system: sys, qty_compare: cmp, difference: cmp - sys, updated_at: now });
    return { created: false, touched: true };
  }
  discrepanciesDb.unshift({
    id: `sel-${Date.now()}-${seq++}`, product: { id: product.id, code: product.code, name: product.name }, warehouse: warehouse ?? null, source,
    qty_system: sys, qty_compare: cmp, difference: cmp - sys, status: "OPEN", note: null, created_at: now, updated_at: now,
    qty_recount: null, recounted_by: null, recounted_at: null, validated_by: null, validated_at: null,
  });
  return { created: true, touched: true };
}
