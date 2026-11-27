import { api, USE_MOCK } from "./client";
import { mockOk, mockFail } from "./mock/helpers";
import { productsDb } from "./mock/productsDb";
import { importsDb } from "./mock/importsDb";
import { upsertCase, WH } from "./mock/discrepanciesDb";
import { notificationsDb } from "./mock/notificationsDb";
import { mockCurrentUser } from "./mock/users";
import { parseDelimited } from "@/lib/csvParse";

/*
 * ASUMSI (struktur kolom ekspor Kasir Pintar BELUM dikonfirmasi PIC):
 *   POST /imports/preview  (multipart: file)  -> data: {
 *       import_id, filename, total_rows, columns_ok, column_errors: [string], found_columns: [string],
 *       preview: [{ row, code, name, qty, warehouse }],
 *       items: [{ row, code, name, qty, warehouse_label, scope: {id,code,name}|null,
 *                 status: 'SAME'|'DIFFERENT'|'UNMATCHED'|'CANDIDATE', issue,
 *                 product: {id,code,name}|null, system_qty, difference,
 *                 candidates: [{ product: {id,code,name}, system_qty }] }] }
 *     Validasi backend: tipe (.csv/.xlsx), ukuran (<= 2 MB), kolom wajib. Pencocokan utama lewat KODE barang;
 *     kecocokan nama/kategori hanya berstatus CANDIDATE dan WAJIB dikonfirmasi SPV (FR-19).
 *   POST /imports/:id/confirm { mappings: [{ row, product_id }] } -> data: { batch, discrepancies_created, discrepancies_updated }
 *     Menyimpan batch + item + kasus selisih. TIDAK mengubah stok sistem (PRD aturan 9).
 *   GET  /imports?page&limit -> data: [{ id, filename, uploaded_by, total_rows, matched_count, mismatch_count, not_found_count, created_at, items? }], meta
 * Selisih = stok pembanding (Kasir Pintar) - stok sistem. Tanpa kolom gudang, perbandingan di tingkat TOTAL (PRD aturan 10).
 */
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 2000;
const ALIASES = {
  code: ["kode_barang", "kode", "sku", "kode_sku", "kode_produk"],
  name: ["nama_barang", "nama", "nama_produk", "produk"],
  qty: ["stok", "qty", "jumlah", "stok_kasir", "stock"],
  warehouse: ["gudang", "warehouse", "lokasi"],
};
const norm = (h) => String(h).trim().toLowerCase().replace(/[\s-]+/g, "_");
const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const stash = new Map();

const sysQty = (p, scope) => (scope ? p.stocks.find((s) => s.warehouse_id === scope.id)?.quantity ?? 0 : p.stocks.reduce((s, x) => s + x.quantity, 0));
const pub = (p) => ({ id: p.id, code: p.code, name: p.name });

function buildItem(r, i, idx) {
  const get = (k) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");
  const code = get("code");
  const name = get("name");
  const qtyRaw = get("qty").replace(/\s/g, "");
  const whRaw = get("warehouse");
  const qty = /^\d+$/.test(qtyRaw) ? Number(qtyRaw) : null;
  const item = { row: i + 2, code, name, qty, warehouse_label: whRaw, scope: null, status: "UNMATCHED", issue: "", product: null, system_qty: null, difference: null, candidates: [] };

  if (qty === null) return { ...item, issue: "Jumlah stok tidak valid (harus bilangan bulat ≥ 0)." };
  if (whRaw) {
    const w = Object.values(WH).find((x) => [x.code, x.name].some((v) => v.toLowerCase() === whRaw.toLowerCase()));
    if (!w) return { ...item, issue: `Gudang «${whRaw}» tidak dikenal.` };
    item.scope = w;
  }
  const byCode = code ? productsDb.find((p) => !p.deleted_at && p.code.toLowerCase() === code.toLowerCase()) : null;
  if (byCode) {
    const s = sysQty(byCode, item.scope);
    return { ...item, product: pub(byCode), system_qty: s, difference: qty - s, status: qty === s ? "SAME" : "DIFFERENT" };
  }
  const s = slug(name);
  if (s.length >= 5) {
    const cands = productsDb
      .filter((p) => !p.deleted_at && (slug(p.name) === s || (slug(p.name).length >= 5 && (slug(p.name).includes(s) || s.includes(slug(p.name))))))
      .slice(0, 3)
      .map((p) => ({ product: pub(p), system_qty: sysQty(p, item.scope) }));
    if (cands.length) return { ...item, status: "CANDIDATE", candidates: cands, issue: "Kode tidak ditemukan; nama mirip dengan barang di sistem." };
  }
  return { ...item, issue: code ? "Kode barang tidak ditemukan di sistem." : "Kode barang kosong." };
}

export async function previewImport(file) {
  if (USE_MOCK) {
    if (!/\.csv$/i.test(file.name)) return mockFail(400, "FILE_TYPE", "Pada mode data contoh hanya file .csv yang dapat dibaca.");
    if (file.size > MAX_BYTES) return mockFail(400, "FILE_TOO_LARGE", "Ukuran file maksimal 2 MB.");
    const table = parseDelimited(await file.text());
    if (table.length < 2) return mockFail(400, "FILE_EMPTY", "File kosong atau hanya berisi judul kolom.");
    const headers = table[0].map(norm);
    const idx = Object.fromEntries(Object.entries(ALIASES).map(([k, list]) => [k, headers.findIndex((h) => list.includes(h))]));
    const errors = [];
    if (idx.code < 0) errors.push("Kolom kode barang tidak ditemukan (gunakan judul kolom: kode_barang).");
    if (idx.qty < 0) errors.push("Kolom jumlah stok tidak ditemukan (gunakan judul kolom: stok).");
    if (errors.length) return (await mockOk({ import_id: null, filename: file.name, total_rows: 0, columns_ok: false, column_errors: errors, found_columns: table[0], preview: [], items: [] }, { ms: 300 })).data;
    const rows = table.slice(1, MAX_ROWS + 1);
    const items = rows.map((r, i) => buildItem(r, i, idx));
    const id = `imp-${Date.now()}`;
    stash.set(id, { filename: file.name, items });
    const preview = items.slice(0, 5).map((it) => ({ row: it.row, code: it.code, name: it.name, qty: it.qty, warehouse: it.warehouse_label }));
    return (await mockOk({ import_id: id, filename: file.name, total_rows: items.length, columns_ok: true, column_errors: [], found_columns: table[0], preview, items }, { ms: 600 })).data;
  }
  const fd = new FormData();
  fd.append("file", file);
  return (await api.post("/imports/preview", fd)).data.data;
}

export async function confirmImport(importId, mappings = {}) {
  if (USE_MOCK) {
    const s = stash.get(importId);
    if (!s) return mockFail(404, "NOT_FOUND", "Hasil pratinjau sudah kedaluwarsa. Unggah ulang file.");
    const me = mockCurrentUser();
    let same = 0, diff = 0, nf = 0, created = 0, updated = 0;
    const resolvedItems = [];

    for (const it of s.items) {
      let { status, product, system_qty, difference, issue } = it;
      let confirmed = false;
      if (status === "CANDIDATE") {
        const c = it.candidates.find((x) => x.product.id === mappings[it.row]);
        if (c) {
          product = c.product;
          system_qty = c.system_qty;
          difference = it.qty !== null ? it.qty - system_qty : null;
          status = difference === 0 ? "SAME" : "DIFFERENT";
          confirmed = true;
          issue = "";
        } else {
          status = "UNMATCHED";
          issue = issue || "Kandidat belum dikonfirmasi.";
        }
      }
      if (status === "SAME") same++;
      else if (status === "DIFFERENT") {
        diff++;
        const r = upsertCase({ product, warehouse: it.scope, source: "KASIR_PINTAR", sys: system_qty, cmp: it.qty });
        r.created ? created++ : updated++;
      } else nf++;

      resolvedItems.push({
        ...it,
        product,
        system_qty,
        difference,
        status,
        confirmed,
        issue,
      });
    }

    const batch = {
      id: importId,
      filename: s.filename,
      uploaded_by: me?.name ?? "SPV",
      total_rows: s.items.length,
      matched_count: same,
      mismatch_count: diff,
      not_found_count: nf,
      created_at: new Date().toISOString(),
      items: resolvedItems,
    };
    importsDb.unshift(batch);
    stash.delete(importId);
    if (diff) notificationsDb.spv.unshift({ id: `n-${Date.now()}`, type: "DISCREPANCY_NEW", message: `Hasil import ${s.filename} menghasilkan ${diff} kasus selisih.`, ref_id: importId, is_read: false, created_at: new Date().toISOString() });
    return (await mockOk({ batch, discrepancies_created: created, discrepancies_updated: updated }, { message: "Import disimpan", ms: 700 })).data;
  }
  const body = { mappings: Object.entries(mappings).filter(([, v]) => v).map(([row, product_id]) => ({ row: Number(row), product_id })) };
  return (await api.post(`/imports/${importId}/confirm`, body)).data.data;
}

export async function listImports({ page = 1, limit = 5 } = {}) {
  if (USE_MOCK) {
    const total = importsDb.length;
    const res = await mockOk(importsDb.slice((page - 1) * limit, page * limit).map((b) => ({ ...b })), { meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, ms: 200 });
    return { data: res.data, meta: res.meta };
  }
  const res = await api.get("/imports", { params: { page, limit } });
  return { data: res.data.data, meta: res.meta };
}