import { api, USE_MOCK } from "./client";
import { mockOk } from "./mock/helpers";
import { historyDb } from "./mock/historyDb";
import { mockCurrentUser } from "./mock/users";

/*
 * ASUMSI (belum disepakati; mengikuti ERD stock_commits + stock_commit_items):
 *   GET /commits?page&limit&search&activity_type&status&warehouse_id&date_from&date_to
 *     -> data: [ { id, created_at, status, review_note, reviewed_by?, user: { id, name, role },
 *                  items: [ { id, activity_type, qty_before, qty_after, reason,
 *                             product: { id, code, name, category }, warehouse: { id, code, name } } ] } ],
 *        meta: { page, limit, total, totalPages }
 *   status: SUBMITTED | ACCEPTED | REJECTED (null untuk aktivitas Owner/SPV yang tidak perlu dilaporkan)
 *   activity_type: IN | OUT | TRANSFER_OUT | TRANSFER_IN | PHYSICAL_COUNT | ADJUSTMENT
 *   Staff hanya menerima riwayat miliknya (dibatasi backend).
 * Frontend meratakan setiap item menjadi satu baris riwayat (flatten).
 */

function flatten(commit) {
  return (commit.items ?? []).map((it) => ({
    id: it.id,
    commit_id: commit.id,
    created_at: commit.created_at,
    user: commit.user,
    activity_type: it.activity_type,
    product: it.product,
    warehouse: it.warehouse,
    qty_before: it.qty_before,
    qty_after: it.qty_after,
    reason: it.reason,
    status: commit.status ?? null,
    review_note: commit.review_note ?? null,
    reviewed_by: commit.reviewed_by ?? null,
  }));
}

export async function listHistory({ page = 1, limit = 10, search = "", activity_type = "all", status = "all", warehouse_id = "all", date_from = "", date_to = "" } = {}) {
  if (USE_MOCK) {
    const q = search.trim().toLowerCase();
    const from = date_from ? new Date(`${date_from}T00:00:00`).getTime() : null;
    const to = date_to ? new Date(`${date_to}T23:59:59.999`).getTime() : null;
    const me = mockCurrentUser();
    const rows = historyDb.filter((r) => {
      if (me?.role === "staff" && r.user.id !== me.id) return false; // Staff hanya melihat riwayat miliknya
      const t = new Date(r.created_at).getTime();
      return (
        (activity_type === "all" || r.activity_type === activity_type) &&
        (status === "all" || r.status === status) &&
        (warehouse_id === "all" || r.warehouse.id === warehouse_id) &&
        (from === null || t >= from) &&
        (to === null || t <= to) &&
        (!q || [r.product.name, r.product.code, r.user.name, r.reason].some((x) => x.toLowerCase().includes(q)))
      );
    });
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const res = await mockOk(rows.slice((page - 1) * limit, page * limit), { meta: { page, limit, total, totalPages }, ms: 300 });
    return { data: res.data, meta: res.meta };
  }
  const params = { page, limit };
  if (search.trim()) params.search = search.trim();
  if (activity_type !== "all") params.activity_type = activity_type;
  if (status !== "all") params.status = status;
  if (warehouse_id !== "all") params.warehouse_id = warehouse_id;
  if (date_from) params.date_from = date_from;
  if (date_to) params.date_to = date_to;
  const res = await api.get("/commits", { params });
  return { data: res.data.data.flatMap(flatten), meta: res.data.meta };
}

/** Ambil semua halaman (untuk ekspor CSV), maksimal 100 halaman. */
export async function fetchAllHistory(filters = {}) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const r = await listHistory({ ...filters, page, limit: 10 });
    all.push(...r.data);
    totalPages = r.meta?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages && page <= 100);
  return all;
}
