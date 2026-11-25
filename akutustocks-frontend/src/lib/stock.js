/**
 * Status stok per barang (total semua gudang vs batas minimum).
 * Aturan sementara: habis bila total <= 0; menipis bila total <= min_stock.
 * (Mockup Laporan: total 5 dengan min 5 = Menipis.) Konfirmasi ke PIC.
 */
export function stockStatus(total, min) {
  if (total <= 0) return "OUT";
  if (total <= min) return "LOW";
  return "OK";
}

/** Ringkas data produk dari API: total, qty per gudang, tanggal pengecekan terakhir. */
export function summarizeProduct(p) {
  const stocks = p.stocks ?? [];
  const byWarehouse = Object.fromEntries(stocks.map((s) => [s.warehouse_id, s.quantity]));
  const total = stocks.reduce((sum, s) => sum + (s.quantity ?? 0), 0);
  const dates = stocks.map((s) => s.last_checked_at).filter(Boolean).sort();
  return { ...p, byWarehouse, total, lastChecked: dates.at(-1) ?? null, status: stockStatus(total, p.min_stock ?? 0) };
}
