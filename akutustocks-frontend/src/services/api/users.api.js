import { api, USE_MOCK } from "./client";
import { mockOk, mockFail } from "./mock/helpers";
import { usersDb } from "./mock/usersDb";

/*
 * KESEPAKATAN API SEMENTARA dengan backend:
 *   GET /users?page=1&limit=10 -> { data: [user], meta: { page, limit, total, totalPages } }
 * ASUMSI (belum disepakati, perlu dikonfirmasi): query opsional `search` (nama/email),
 *   `role` (owner|spv|staff), `status` (active|pending). Tanpa `status`, akun yang dinonaktifkan tidak ditampilkan.
 * Bentuk user mengikuti kolom ERD: { id, name, email, role, is_active, created_at, activation_expires_at, deleted_at }
 *   POST /users {name,email,role} | PATCH /users/:id | DELETE /users/:id (soft delete) | POST /users/:id/resend-activation
 */

export async function listUsers({ page = 1, limit = 10, search = "", role = "all", status = "all" } = {}) {
  if (USE_MOCK) {
    const q = search.trim().toLowerCase();
    const rows = usersDb.filter(
      (u) =>
        !u.deleted_at &&
        (role === "all" || u.role === role) &&
        (status === "all" || (status === "active" ? u.is_active : !u.is_active)) &&
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const res = await mockOk(rows.slice((page - 1) * limit, page * limit).map((u) => ({ ...u })), {
      meta: { page, limit, total, totalPages },
      ms: 300,
    });
    return { data: res.data, meta: res.meta };
  }
  const params = { page, limit };
  if (search.trim()) params.search = search.trim();
  if (role !== "all") params.role = role;
  if (status !== "all") params.status = status;
  const res = await api.get("/users", { params });
  return { data: res.data.data, meta: res.data.meta };
}

/** Ambil semua halaman (untuk ekspor CSV) dengan limit standar 10, maksimal 100 halaman. */
export async function fetchAllUsers(filters = {}) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const r = await listUsers({ ...filters, page, limit: 10 });
    all.push(...r.data);
    totalPages = r.meta?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages && page <= 100);
  return all;
}

export async function createUser(payload) {
  if (USE_MOCK) {
    if (usersDb.some((u) => u.email === payload.email.toLowerCase() && !u.deleted_at))
      return mockFail(409, "EMAIL_EXISTS", "Email sudah dipakai akun lain.", [{ field: "email", message: "Email sudah dipakai akun lain." }]);
    const user = {
      id: `u-${Date.now()}`,
      ...payload,
      email: payload.email.toLowerCase(),
      is_active: false,
      created_at: new Date().toISOString(),
      activation_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      deleted_at: null,
    };
    usersDb.push(user);
    return (await mockOk(user, { message: "Akun dibuat" })).data;
  }
  return (await api.post("/users", payload)).data.data;
}

export async function updateUser(id, payload) {
  if (USE_MOCK) {
    const u = usersDb.find((x) => x.id === id);
    if (!u) return mockFail(404, "NOT_FOUND", "Akun tidak ditemukan.");
    Object.assign(u, payload, { email: payload.email.toLowerCase() });
    return (await mockOk({ ...u })).data;
  }
  return (await api.patch(`/users/${id}`, payload)).data.data;
}

export async function deactivateUser(id) {
  if (USE_MOCK) {
    const u = usersDb.find((x) => x.id === id);
    if (!u) return mockFail(404, "NOT_FOUND", "Akun tidak ditemukan.");
    u.deleted_at = new Date().toISOString();
    return (await mockOk(null)).data;
  }
  return (await api.delete(`/users/${id}`)).data.data;
}

export async function resendActivation(id) {
  if (USE_MOCK) {
    const u = usersDb.find((x) => x.id === id);
    if (!u) return mockFail(404, "NOT_FOUND", "Akun tidak ditemukan.");
    u.activation_expires_at = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    return (await mockOk(null)).data;
  }
  return (await api.post(`/users/${id}/resend-activation`)).data.data;
}
