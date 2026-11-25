const H = 3600 * 1000;
const ago = (h) => new Date(Date.now() - h * H).toISOString();

// DATA CONTOH notifikasi per role. Bukan data aktual Akutusocks.
export const notificationsDb = {
  spv: [
    { id: "n-s1", type: "ACTIVITY_SUBMITTED", message: "Rina Contoh mengajukan aktivitas Barang Masuk (Funko Pop! Spider-Man).", ref_id: "c-0", is_read: false, created_at: ago(0.2) },
    { id: "n-s2", type: "DISCREPANCY_NEW", message: "Selisih baru: Stanley Quencher H2.0 di Gudang 3 (+2 unit) dari stok opname.", ref_id: "sel-0001", is_read: false, created_at: ago(0.6) },
    { id: "n-s3", type: "CHECK_SCHEDULE", message: "Jadwal pemeriksaan stok Gudang 2 jatuh tempo. Ada aktivitas Staff yang belum divalidasi.", ref_id: null, is_read: false, created_at: ago(1.5) },
    { id: "n-s4", type: "LOW_STOCK", message: "Stok Pop Mart Crybaby Crying Again habis di semua gudang (0 unit, minimum 6).", ref_id: "p-7", is_read: false, created_at: ago(2) },
    { id: "n-s5", type: "ACTIVITY_SUBMITTED", message: "Dimas Contoh mengajukan perpindahan 3 unit Stanley Quencher dari Gudang 3 ke Gudang 1.", ref_id: "c-2", is_read: false, created_at: ago(3) },
    { id: "n-s6", type: "ACTIVITY_REVIEWED", message: "Aktivitas Barang Keluar oleh Dimas Contoh telah Anda terima.", ref_id: "c-1", is_read: true, created_at: ago(27) },
    { id: "n-s7", type: "DISCREPANCY_NEW", message: "Hasil import kasir-pintar-2026-11-21.csv menghasilkan 3 kasus selisih.", ref_id: "imp-2", is_read: true, created_at: ago(30) },
    { id: "n-s8", type: "LOW_STOCK", message: "Stok Stanley Classic Legendary mendekati batas minimum (sisa 18 unit, minimum 20).", ref_id: "p-13", is_read: true, created_at: ago(33) },
    { id: "n-s9", type: "CHECK_SCHEDULE", message: "Pemeriksaan fisik bulanan Oktober untuk Gudang 1 telah ditutup.", ref_id: null, is_read: true, created_at: ago(90) },
    { id: "n-s10", type: "ACTIVITY_REVIEWED", message: "Aktivitas Penyesuaian oleh Rina Contoh telah Anda tolak.", ref_id: "c-6", is_read: true, created_at: ago(110) },
    { id: "n-s11", type: "DISCREPANCY_NEW", message: "Selisih baru: Crocs Jibbitz Hello Kitty Pack (+3 unit) dari import Kasir Pintar.", ref_id: "sel-0005", is_read: true, created_at: ago(140) },
  ],
  staff: [
    { id: "n-t1", type: "ACTIVITY_REVIEWED", message: "Aktivitas Barang Masuk Anda diterima oleh Anita Contoh.", ref_id: "c-0", is_read: false, created_at: ago(3) },
    { id: "n-t2", type: "ACTIVITY_REVIEWED", message: "Aktivitas Barang Masuk Anda ditolak. Lihat catatan SPV dan buat penyesuaian.", ref_id: "c-2", is_read: false, created_at: ago(20) },
    { id: "n-t3", type: "CHECK_SCHEDULE", message: "Jadwal pemeriksaan stok Gudang 1 jatuh tempo minggu ini.", ref_id: null, is_read: true, created_at: ago(60) },
  ],
  owner: [
    { id: "n-o1", type: "LOW_STOCK", message: "4 barang berstatus Stok Menipis dan 1 barang Habis.", ref_id: null, is_read: false, created_at: ago(6) },
    { id: "n-o2", type: "DISCREPANCY_NEW", message: "3 kasus selisih terbuka perlu ditindaklanjuti.", ref_id: null, is_read: true, created_at: ago(30) },
  ],
};
