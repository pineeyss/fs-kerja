export const ROLES = { OWNER: "owner", SPV: "spv", STAFF: "staff" };

export const ROLE_LABEL = {
  owner: "Owner",
  spv: "Supervisor",
  staff: "Staff",
};

/**
 * Backend belum memastikan nilai role (owner / OWNER / admin?).
 * Semua dinormalisasi di sini supaya sisa aplikasi hanya memakai ROLES.
 */
export function normalizeRole(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "admin") return ROLES.OWNER;
  if (v === "supervisor") return ROLES.SPV;
  return Object.values(ROLES).includes(v) ? v : null;
}

/* Status aktivitas Staff (review SPV) — terpisah dari status kasus selisih */
export const ACTIVITY_STATUS = {
  SUBMITTED: { label: "Diajukan", tone: "info" },
  ACCEPTED: { label: "Diterima", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "danger" },
};

/* Status kasus selisih */
export const DISCREPANCY_STATUS = {
  OPEN: { label: "Belum Ditindaklanjuti", tone: "danger" },
  IN_PROGRESS: { label: "Dalam Proses", tone: "warning" },
  RESOLVED: { label: "Selesai", tone: "success" },
};

/* Hasil pencocokan import */
export const MATCH_STATUS = {
  MATCHED: { label: "Cocok", tone: "success" },
  UNMATCHED: { label: "Tidak Ditemukan", tone: "danger" },
  DIFFERENT: { label: "Berbeda Jumlah", tone: "warning" },
};

/* Jenis aktivitas stok (activity_type). ASUMSI nilai — konfirmasi dengan backend. */
export const ACTIVITY_TYPE = {
  IN: "Barang Masuk",
  OUT: "Barang Keluar",
  TRANSFER_OUT: "Pindah Keluar",
  TRANSFER_IN: "Pindah Masuk",
  PHYSICAL_COUNT: "Stok Fisik",
  ADJUSTMENT: "Penyesuaian",
};

/* Sumber pembanding kasus selisih */
export const DISCREPANCY_SOURCE = {
  KASIR_PINTAR: "Kasir Pintar",
  PHYSICAL_COUNT: "Stok Fisik",
};

/* Hasil pencocokan baris import */
export const IMPORT_ROW_STATUS = {
  SAME: { label: "Jumlah Sesuai", tone: "success" },
  DIFFERENT: { label: "Berbeda Jumlah", tone: "warning" },
  UNMATCHED: { label: "Tidak Ditemukan", tone: "danger" },
  CANDIDATE: { label: "Perlu Konfirmasi", tone: "info" },
};
