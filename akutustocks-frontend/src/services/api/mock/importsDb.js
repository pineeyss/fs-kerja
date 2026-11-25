const DAY = 24 * 3600 * 1000;
// DATA CONTOH riwayat import. Bukan data aktual Akutusocks.
export const importsDb = [
  { id: "imp-2", filename: "kasir-pintar-2026-11-21.csv", uploaded_by: "Anita Contoh", total_rows: 18, matched_count: 15, mismatch_count: 3, not_found_count: 0, created_at: new Date(Date.now() - 1 * DAY).toISOString() },
  { id: "imp-1", filename: "kasir-pintar-2026-11-14.csv", uploaded_by: "Anita Contoh", total_rows: 17, matched_count: 16, mismatch_count: 1, not_found_count: 0, created_at: new Date(Date.now() - 8 * DAY).toISOString() },
];
