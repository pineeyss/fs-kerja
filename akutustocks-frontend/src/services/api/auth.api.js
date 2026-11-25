import { api, USE_MOCK } from "./client";
import { mockOk, mockFail } from "./mock/helpers";
import { SAMPLE_USERS, publicUser } from "./mock/users";

/*
 * ASUMSI bentuk response backend (API Contract v0.1 belum merinci payload):
 *   POST /auth/login -> { success, message, data: { token, user: { id, name, email, role } } }
 *   GET  /auth/me    -> { success, message, data: { id, name, email, role } }
 * Jika berbeda, cukup sesuaikan file ini.
 */

export async function login({ email, password }) {
  if (USE_MOCK) {
    const u = SAMPLE_USERS.find((x) => x.email === email.trim().toLowerCase() && x.password === password);
    if (!u) return mockFail(401, "INVALID_CREDENTIALS", "Email atau password salah.");
    const res = await mockOk({ token: `mock:${u.id}`, user: publicUser(u) }, { message: "Login berhasil" });
    return res.data;
  }
  const res = await api.post("/auth/login", { email, password });
  return res.data.data;
}

export async function getMe() {
  if (USE_MOCK) {
    const token = localStorage.getItem("akutustocks_token") ?? "";
    const u = SAMPLE_USERS.find((x) => `mock:${x.id}` === token);
    if (!u) return mockFail(401, "UNAUTHORIZED", "Sesi tidak valid.");
    const res = await mockOk(publicUser(u), { ms: 200 });
    return res.data;
  }
  const res = await api.get("/auth/me");
  return res.data.data;
}

/*
 * KESEPAKATAN API SEMENTARA:
 *   GET  /auth/activation?token=...  -> validasi token; data: { name, email }  (error bila tidak valid / kedaluwarsa)
 *   POST /auth/activate { token, password } -> mengaktifkan akun
 * ASUMSI: payload activate hanya { token, password } (konfirmasi password dicek di frontend).
 */
export async function getActivation(token) {
  if (USE_MOCK) {
    if (!token || token === "kedaluwarsa")
      return mockFail(400, "TOKEN_INVALID", "Tautan aktivasi tidak valid atau sudah kedaluwarsa.");
    return (await mockOk({ name: "Salsa Contoh", email: "salsa@contoh.test" }, { ms: 350 })).data;
  }
  return (await api.get("/auth/activation", { params: { token } })).data.data;
}

export async function activate({ token, password }) {
  if (USE_MOCK) {
    if (!token || token === "kedaluwarsa")
      return mockFail(400, "TOKEN_INVALID", "Tautan aktivasi tidak valid atau sudah kedaluwarsa.");
    return (await mockOk(null, { message: "Akun aktif" })).data;
  }
  return (await api.post("/auth/activate", { token, password })).data.data;
}

/*
 * PATCH /auth/password { current_password, new_password } -> data null.
 * Password lama salah HARUS dibalas 400 (bukan 401, karena 401 dianggap sesi habis) dengan
 * errors: [{ field: 'current_password', message }].
 */
export async function changePassword({ current_password, new_password }) {
  if (USE_MOCK) {
    const token = localStorage.getItem("akutustocks_token") ?? "";
    const u = SAMPLE_USERS.find((x) => `mock:${x.id}` === token);
    if (!u) return mockFail(401, "UNAUTHORIZED", "Sesi tidak valid.");
    if (u.password !== current_password)
      return mockFail(400, "INVALID_PASSWORD", "Password lama salah.", [{ field: "current_password", message: "Password lama salah." }]);
    u.password = new_password;
    return (await mockOk(null, { message: "Password diubah" })).data;
  }
  return (await api.patch("/auth/password", { current_password, new_password })).data.data;
}
