import { ACTIVITY_STATUS, ACTIVITY_TYPE } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";

export const fmtDateTime = (iso) =>
  new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Selisih bertanda, mis. "+5" atau "-3" (tidak mengandalkan warna saja). */
export function deltaText(before, after) {
  const d = after - before;
  return d > 0 ? `+${d}` : String(d);
}

export function downloadHistoryCsv(rows) {
  downloadCsv(
    "riwayat-aktivitas.csv",
    ["Waktu", "Pengguna", "Jenis Aktivitas", "Kode", "Barang", "Gudang", "Jumlah Sebelum", "Jumlah Sesudah", "Selisih", "Alasan", "Status Pelaporan", "Catatan SPV"],
    rows.map((r) => [
      fmtDateTime(r.created_at),
      r.user.name,
      ACTIVITY_TYPE[r.activity_type] ?? r.activity_type,
      r.product.code,
      r.product.name,
      r.warehouse.name,
      r.qty_before,
      r.qty_after,
      deltaText(r.qty_before, r.qty_after),
      r.reason,
      r.status ? ACTIVITY_STATUS[r.status]?.label : "Tidak perlu dilaporkan",
      r.review_note ?? "",
    ])
  );
}
