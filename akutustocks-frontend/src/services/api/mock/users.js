// DATA CONTOH — bukan akun aktual Akutusocks. id selaras dengan mock/usersDb.js.
export const SAMPLE_USERS = [
  { id: "u-1", name: "Pemilik Contoh", email: "owner@contoh.test", password: "contoh123", role: "owner" },
  { id: "u-2", name: "Anita Contoh", email: "spv@contoh.test", password: "contoh123", role: "spv" },
  { id: "u-3", name: "Rina Contoh", email: "staff@contoh.test", password: "contoh123", role: "staff" },
];

export const publicUser = ({ password, ...rest }) => rest;

/** Pengguna yang sedang login pada mode contoh (dari token mock). */
export function mockCurrentUser() {
  const t = localStorage.getItem("akutustocks_token") ?? "";
  return SAMPLE_USERS.find((u) => `mock:${u.id}` === t) ?? null;
}
