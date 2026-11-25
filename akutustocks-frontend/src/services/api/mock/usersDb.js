// DATA CONTOH dalam memori (hilang saat halaman dimuat ulang). Bukan data aktual Akutusocks.
const day = 24 * 3600 * 1000;
const ago = (d) => new Date(Date.now() - d * day).toISOString();

export const usersDb = [
  { id: "u-1", name: "Pemilik Contoh", email: "owner@contoh.test", role: "owner", is_active: true, created_at: ago(40), activation_expires_at: null, deleted_at: null },
  { id: "u-2", name: "Anita Contoh", email: "spv@contoh.test", role: "spv", is_active: true, created_at: ago(36), activation_expires_at: null, deleted_at: null },
  { id: "u-3", name: "Rina Contoh", email: "staff@contoh.test", role: "staff", is_active: true, created_at: ago(30), activation_expires_at: null, deleted_at: null },
  { id: "u-4", name: "Dimas Contoh", email: "dimas@contoh.test", role: "staff", is_active: true, created_at: ago(28), activation_expires_at: null, deleted_at: null },
  { id: "u-5", name: "Salsa Contoh", email: "salsa@contoh.test", role: "staff", is_active: false, created_at: ago(1), activation_expires_at: new Date(Date.now() + 23 * 3600 * 1000).toISOString(), deleted_at: null },
];

// Tambahan akun contoh agar paginasi (10 per halaman) bisa dicoba
["Bima", "Citra", "Dewi", "Eko", "Fajar", "Gita", "Hana", "Indra", "Joko", "Kirana"].forEach((n, i) => {
  usersDb.push({
    id: `u-${6 + i}`,
    name: `${n} Contoh`,
    email: `${n.toLowerCase()}@contoh.test`,
    role: i % 4 === 0 ? "spv" : "staff",
    is_active: i % 5 !== 4,
    created_at: ago(20 - i),
    activation_expires_at: i % 5 !== 4 ? null : new Date(Date.now() + (6 + i) * 3600 * 1000).toISOString(),
    deleted_at: null,
  });
});
