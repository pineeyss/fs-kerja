import { api, USE_MOCK } from "./client";
import { mockOk, mockFail } from "./mock/helpers";
import { notificationsDb } from "./mock/notificationsDb";
import { mockCurrentUser } from "./mock/users";

/*
 * ASUMSI (ikut kolom ERD notifications: type, message, ref_id, is_read, created_at):
 *   GET   /notifications?page&limit&category&is_read&date_from&search -> data: [notification], meta { page, limit, total, totalPages }
 *     category: activity (ACTIVITY_*) | discrepancy | schedule | stock ; is_read: true|false ; date_from: YYYY-MM-DD
 *   PATCH /notifications/:id/read ; PATCH /notifications/read-all
 * type: ACTIVITY_SUBMITTED | ACTIVITY_REVIEWED | DISCREPANCY_NEW | CHECK_SCHEDULE | LOW_STOCK
 * Backend hanya mengirim notifikasi milik pengguna yang login.
 */
export const NOTIF_CATEGORY = {
  activity: ["ACTIVITY_SUBMITTED", "ACTIVITY_REVIEWED"],
  discrepancy: ["DISCREPANCY_NEW"],
  schedule: ["CHECK_SCHEDULE"],
  stock: ["LOW_STOCK"],
};
/** Jenis yang menuntut tindakan (bila belum dibaca). ACTIVITY_REVIEWED hanya informasi. */
export const ACTIONABLE = ["ACTIVITY_SUBMITTED", "DISCREPANCY_NEW", "CHECK_SCHEDULE", "LOW_STOCK"];

const mine = () => notificationsDb[mockCurrentUser()?.role ?? "staff"] ?? [];

export async function listNotifications({ page = 1, limit = 10, category = "all", is_read, date_from = "", search = "", unread } = {}) {
  const read = unread ? false : is_read; // `unread: true` dipertahankan untuk badge
  if (USE_MOCK) {
    const q = search.trim().toLowerCase();
    const from = date_from ? new Date(`${date_from}T00:00:00`).getTime() : null;
    const rows = mine()
      .filter((n) => (category === "all" || NOTIF_CATEGORY[category]?.includes(n.type)) && (read === undefined || n.is_read === read) && (from === null || new Date(n.created_at).getTime() >= from) && (!q || n.message.toLowerCase().includes(q)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const total = rows.length;
    const res = await mockOk(rows.slice((page - 1) * limit, page * limit).map((n) => ({ ...n })), { meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, ms: 150 });
    return { data: res.data, meta: res.meta };
  }
  const params = { page, limit };
  if (category !== "all") params.category = category;
  if (read !== undefined) params.is_read = read;
  if (date_from) params.date_from = date_from;
  if (search.trim()) params.search = search.trim();
  const res = await api.get("/notifications", { params });
  return { data: res.data.data, meta: res.data.meta };
}

export async function markNotificationRead(id) {
  if (USE_MOCK) {
    const n = mine().find((x) => x.id === id);
    if (!n) return mockFail(404, "NOT_FOUND", "Notifikasi tidak ditemukan.");
    n.is_read = true;
    return (await mockOk(null, { ms: 100 })).data;
  }
  return (await api.patch(`/notifications/${id}/read`)).data.data;
}

export async function markAllNotificationsRead() {
  if (USE_MOCK) {
    mine().forEach((n) => (n.is_read = true));
    return (await mockOk(null, { ms: 100 })).data;
  }
  return (await api.patch("/notifications/read-all")).data.data;
}
