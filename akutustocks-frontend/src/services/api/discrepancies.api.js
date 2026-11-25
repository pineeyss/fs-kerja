import { api, USE_MOCK } from "./client";
import { mockOk, mockFail } from "./mock/helpers";
import { discrepanciesDb } from "./mock/discrepanciesDb";
import { mockCurrentUser } from "./mock/users";

/*
 * ASUMSI (mengikuti ERD discrepancies; selisih = pembanding - sistem):
 *   GET   /discrepancies?page&limit&status&source&search -> data: [case], meta
 *   PATCH /discrepancies/:id { status: 'IN_PROGRESS'|'RESOLVED', note }  -> data: case
 *   case: { id, status, source: 'KASIR_PINTAR'|'PHYSICAL_COUNT', qty_system, qty_compare, difference, note,
 *           created_at, updated_at, qty_recount, recounted_by, recounted_at, validated_by, validated_at,
 *           product:{id,code,name}, warehouse:{id,code,name} | null (null = perbandingan tingkat total) }
 *   status: OPEN -> IN_PROGRESS -> RESOLVED (OPEN boleh langsung RESOLVED). Berbeda dari status aktivitas Staff.
 *   NB: API Contract v0.1 memakai nama status lain (belum_dicek, dst.); perlu disamakan.
 */
export async function listDiscrepancies({ page = 1, limit = 10, status = "all", source = "all", search = "" } = {}) {
  if (USE_MOCK) {
    const q = search.trim().toLowerCase();
    const rows = discrepanciesDb.filter((d) => (status === "all" || d.status === status) && (source === "all" || d.source === source) && (!q || d.product.name.toLowerCase().includes(q) || d.product.code.toLowerCase().includes(q)));
    const total = rows.length;
    const res = await mockOk(rows.slice((page - 1) * limit, page * limit).map((d) => ({ ...d })), { meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, ms: 250 });
    return { data: res.data, meta: res.meta };
  }
  const params = { page, limit };
  if (status !== "all") params.status = status;
  if (source !== "all") params.source = source;
  if (search.trim()) params.search = search.trim();
  const res = await api.get("/discrepancies", { params });
  return { data: res.data.data, meta: res.data.meta };
}

const ALLOWED = { OPEN: ["IN_PROGRESS", "RESOLVED"], IN_PROGRESS: ["RESOLVED"], RESOLVED: [] };

export async function updateDiscrepancy(id, { status, note }) {
  if (USE_MOCK) {
    const d = discrepanciesDb.find((x) => x.id === id);
    if (!d) return mockFail(404, "NOT_FOUND", "Kasus tidak ditemukan.");
    if (!ALLOWED[d.status].includes(status)) return mockFail(409, "INVALID_TRANSITION", "Status kasus tidak dapat diubah ke pilihan tersebut.");
    d.status = status;
    if (note) d.note = note;
    d.updated_at = new Date().toISOString();
    if (status === "RESOLVED") {
      d.validated_by = mockCurrentUser()?.name ?? "SPV";
      d.validated_at = d.updated_at;
    }
    return (await mockOk({ ...d }, { message: "Status kasus diperbarui" })).data;
  }
  return (await api.patch(`/discrepancies/${id}`, { status, note })).data.data;
}
