import { api, USE_MOCK } from "./client";
import { mockOk } from "./mock/helpers";
import { productsDb } from "./mock/productsDb";
import { historyDb } from "./mock/historyDb";

/*
 * ASUMSI (belum disepakati): satu endpoint ringkasan agar frontend tidak menarik seluruh riwayat.
 *   GET /reports/stock-summary?days=30&warehouse_id=&category=
 *   -> data: {
 *        totals: { skus, units, in_units, out_units, in_change_pct, out_change_pct },   // *_change_pct vs periode sebelumnya, null bila tidak ada pembanding
 *        by_warehouse: [ { warehouse_id, code, name, units, empty_skus } ],
 *        flow: [ { date: 'YYYY-MM-DD', in, out } ],        // harian bila days <= 31, mingguan bila lebih
 *        top_moved: [ { product: { code, name }, moved_units } ],   // 5 barang dengan mutasi masuk+keluar terbanyak
 *        by_category: [ { category, units } ],
 *        transfers: [ { from: { code, name }, to: { code, name }, count, units } ],
 *        reconciliation: { source: 'KASIR_PINTAR', matched, different, not_found, last_audited_at, differences: [ { name, diff } ] } | null
 *      }
 * "Masuk" = activity_type IN, "Keluar" = OUT. Perpindahan, stok fisik, dan penyesuaian tidak dihitung sebagai masuk/keluar.
 */

const WHS = [
  { id: "wh-1", code: "G1", name: "Gudang 1" },
  { id: "wh-2", code: "G2", name: "Gudang 2" },
  { id: "wh-3", code: "G3", name: "Gudang 3" },
];
const DAY = 24 * 3600 * 1000;
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

function computeMock({ days = 30, warehouse_id = "all", category = "all" }) {
  const now = Date.now();
  const products = productsDb.filter((p) => !p.deleted_at && (category === "all" || p.category === category));
  const qtyOf = (p, wid) => p.stocks.find((s) => s.warehouse_id === wid)?.quantity ?? 0;

  const by_warehouse = WHS.map((w) => ({
    warehouse_id: w.id,
    code: w.code,
    name: w.name,
    units: products.reduce((s, p) => s + qtyOf(p, w.id), 0),
    empty_skus: products.filter((p) => qtyOf(p, w.id) === 0).length,
  }));

  const scopedQty = (p) => (warehouse_id === "all" ? p.stocks.reduce((s, x) => s + x.quantity, 0) : qtyOf(p, warehouse_id));
  const scoped = warehouse_id === "all" ? products : products.filter((p) => qtyOf(p, warehouse_id) > 0);

  const inScope = (r) => (category === "all" || r.product.category === category) && (warehouse_id === "all" || r.warehouse.id === warehouse_id);
  const rowsBetween = (from, to) => historyDb.filter((r) => inScope(r) && new Date(r.created_at).getTime() >= from && new Date(r.created_at).getTime() < to);
  const cur = rowsBetween(now - days * DAY, now + DAY);
  const prev = rowsBetween(now - 2 * days * DAY, now - days * DAY);
  const sum = (rows, type) => rows.filter((r) => r.activity_type === type).reduce((s, r) => s + Math.abs(r.qty_after - r.qty_before), 0);
  const pct = (c, p) => (p > 0 ? Math.round(((c - p) / p) * 100) : null);
  const in_units = sum(cur, "IN");
  const out_units = sum(cur, "OUT");

  // tren: harian (<= 31 hari) atau mingguan
  const step = days <= 31 ? 1 : 7;
  const buckets = [];
  for (let t = now - days * DAY; t <= now; t += step * DAY) buckets.push({ start: t, date: dayKey(t), in: 0, out: 0 });
  cur.forEach((r) => {
    const t = new Date(r.created_at).getTime();
    const b = [...buckets].reverse().find((x) => t >= x.start);
    if (!b) return;
    if (r.activity_type === "IN") b.in += r.qty_after - r.qty_before;
    if (r.activity_type === "OUT") b.out += r.qty_before - r.qty_after;
  });

  const moved = new Map();
  cur.filter((r) => r.activity_type === "IN" || r.activity_type === "OUT").forEach((r) => {
    const k = r.product.code;
    moved.set(k, { product: { code: r.product.code, name: r.product.name }, moved_units: (moved.get(k)?.moved_units ?? 0) + Math.abs(r.qty_after - r.qty_before) });
  });

  const catMap = new Map();
  scoped.forEach((p) => catMap.set(p.category, (catMap.get(p.category) ?? 0) + scopedQty(p)));

  const pairs = new Map();
  cur.filter((r) => r.activity_type.startsWith("TRANSFER")).forEach((r) => {
    const g = pairs.get(r.commit_id) ?? {};
    g[r.activity_type === "TRANSFER_OUT" ? "from" : "to"] = r.warehouse;
    g.units = Math.abs(r.qty_after - r.qty_before);
    pairs.set(r.commit_id, g);
  });
  const routes = new Map();
  [...pairs.values()].filter((g) => g.from && g.to).forEach((g) => {
    const k = `${g.from.code}>${g.to.code}`;
    const o = routes.get(k) ?? { from: { code: g.from.code, name: g.from.name }, to: { code: g.to.code, name: g.to.name }, count: 0, units: 0 };
    o.count += 1;
    o.units += g.units;
    routes.set(k, o);
  });

  return {
    totals: { skus: scoped.length, units: scoped.reduce((s, p) => s + scopedQty(p), 0), in_units, out_units, in_change_pct: pct(in_units, sum(prev, "IN")), out_change_pct: pct(out_units, sum(prev, "OUT")) },
    by_warehouse,
    flow: buckets.map(({ date, in: i, out }) => ({ date, in: i, out })),
    top_moved: [...moved.values()].sort((a, b) => b.moved_units - a.moved_units).slice(0, 5),
    by_category: [...catMap.entries()].map(([category, units]) => ({ category, units })).sort((a, b) => b.units - a.units),
    transfers: [...routes.values()].sort((a, b) => b.count - a.count),
    // DATA CONTOH: menunggu modul Import Kasir Pintar
    reconciliation: { source: "KASIR_PINTAR", matched: 35, different: 3, not_found: 1, last_audited_at: new Date(now - DAY).toISOString(), differences: [{ name: "Stanley Quencher", diff: 2 }, { name: "Pokémon Booster Box", diff: -1 }, { name: "Crocs Jibbitz", diff: 3 }] },
  };
}

export async function getReportSummary(params = {}) {
  if (USE_MOCK) return (await mockOk(computeMock(params), { ms: 400 })).data;
  const q = { days: params.days ?? 30 };
  if (params.warehouse_id && params.warehouse_id !== "all") q.warehouse_id = params.warehouse_id;
  if (params.category && params.category !== "all") q.category = params.category;
  return (await api.get("/reports/stock-summary", { params: q })).data.data;
}
