import { api, USE_MOCK } from "./client";
import { mockOk, mockFail } from "./mock/helpers";
import { notificationsDb } from "./mock/notificationsDb";
import { historyDb } from "./mock/historyDb";
import { mockCurrentUser } from "./mock/users";
import { groupCommits } from "./mock/commits";

/*
 * ASUMSI (belum disepakati; ikut ERD stock_commits + stock_commit_items):
 *   GET /commits?page&limit&status&search&needs_action&activity_type&date_from&date_to
 *     Staff hanya menerima commit miliknya (dibatasi backend); SPV menerima commit Staff.
 *     activity_type: IN|OUT|TRANSFER|PHYSICAL_COUNT|ADJUSTMENT (TRANSFER mencakup TRANSFER_IN/OUT). date_*: YYYY-MM-DD.
 *     search mencakup: id aktivitas, nama staff, kode/nama barang, alasan.
 *   PATCH /commits/:id/review { status: 'ACCEPTED'|'REJECTED', review_note } -> data: commit (SPV saja)
 *     409 ALREADY_REVIEWED bila sudah diperiksa. Penolakan TIDAK membatalkan stok (PRD 6.3).
 *     status: SUBMITTED | ACCEPTED | REJECTED. needs_action=true -> hanya REJECTED yang belum punya penyesuaian lanjutan.
 *   commit: { id, created_at, status, review_note, reviewed_by, reviewed_at, follow_up_commit_id,
 *             user:{id,name,role}, items:[{ id, activity_type, qty_before, qty_after, reason,
 *                                           product:{id,code,name,category}, warehouse:{id,code,name} }] }
 *   follow_up_commit_id = id commit penyesuaian yang merujuk commit ini lewat related_commit_id (null bila belum ada).
 */
/** Kode tampilan aktivitas, mis. ACT-12345 (diturunkan dari id). */
export function activityCode(id) {
  return `ACT-${String(id).replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase().padStart(5, "0")}`;
}

export async function listActivities({ page = 1, limit = 5, status = "all", search = "", needs_action = false, activity_type = "all", date_from = "", date_to = "" } = {}) {
  if (USE_MOCK) {
    const me = mockCurrentUser();
    const q = search.trim().toLowerCase();
    const commits = groupCommits(historyDb.filter((r) => (me?.role === "staff" ? r.user.id === me.id : r.user.role === "staff")))
      .filter(
        (c) =>
          (status === "all" || c.status === status) &&
          (!needs_action || (c.status === "REJECTED" && !c.follow_up_commit_id)) &&
          c.status !== null &&
          (activity_type === "all" || c.items.some((i) => (activity_type === "TRANSFER" ? i.activity_type.startsWith("TRANSFER") : i.activity_type === activity_type))) &&
          (!date_from || new Date(c.created_at).getTime() >= new Date(`${date_from}T00:00:00`).getTime()) &&
          (!date_to || new Date(c.created_at).getTime() <= new Date(`${date_to}T23:59:59.999`).getTime()) &&
          (!q || activityCode(c.id).toLowerCase().includes(q) || c.user.name.toLowerCase().includes(q) || c.items.some((i) => [i.product.name, i.product.code, i.reason].some((x) => x.toLowerCase().includes(q))))
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const total = commits.length;
    const res = await mockOk(commits.slice((page - 1) * limit, page * limit), { meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, ms: 250 });
    return { data: res.data, meta: res.meta };
  }
  const params = { page, limit };
  if (status !== "all") params.status = status;
  if (search.trim()) params.search = search.trim();
  if (needs_action) params.needs_action = true;
  if (activity_type !== "all") params.activity_type = activity_type;
  if (date_from) params.date_from = date_from;
  if (date_to) params.date_to = date_to;
  const res = await api.get("/commits", { params });
  return { data: res.data.data, meta: res.data.meta };
}

export async function reviewActivity(id, { status, review_note }) {
  if (USE_MOCK) {
    const rows = historyDb.filter((r) => r.commit_id === id);
    if (!rows.length) return mockFail(404, "NOT_FOUND", "Aktivitas tidak ditemukan.");
    if (rows[0].status !== "SUBMITTED") return mockFail(409, "ALREADY_REVIEWED", "Aktivitas ini sudah diperiksa.");
    const me = mockCurrentUser();
    rows.forEach((r) => Object.assign(r, { status, review_note: review_note || null, reviewed_by: me?.name ?? "SPV", reviewed_at: new Date().toISOString() }));
    notificationsDb.staff.unshift({ id: `n-${Date.now()}`, type: "ACTIVITY_REVIEWED", message: `Aktivitas Anda ${status === "ACCEPTED" ? "diterima" : "ditolak"} oleh ${me?.name ?? "SPV"}.${status === "REJECTED" ? " Lihat catatan dan buat penyesuaian." : ""}`, ref_id: id, is_read: false, created_at: new Date().toISOString() });
    return (await mockOk(groupCommits(rows)[0], { message: "Keputusan tersimpan" })).data;
  }
  return (await api.patch(`/commits/${id}/review`, { status, review_note })).data.data;
}
