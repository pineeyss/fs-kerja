import { api, USE_MOCK } from "./client";
import { mockOk, mockFail } from "./mock/helpers";
import { productsDb } from "./mock/productsDb";

/*
 * ASUMSI (API Contract v0.1 belum merinci payload; ikut kolom ERD `products` + `stocks`):
 *   GET    /products        -> data: [ { id, code, name, category, image_url, min_stock, deleted_at,
 *                                        stocks: [ { warehouse_id, quantity, last_checked_at } ] } ]
 *   POST   /products        {code,name,category,min_stock, image?}  (multipart/form-data bila ada foto)
 *   PATCH  /products/:id    {code,name,category,min_stock, image?}
 *   DELETE /products/:id    soft delete
 * Pencarian/filter/halaman dilakukan di klien. Jika backend memakai paginasi, ubah di sini + ProductsPage.
 * Cara upload foto belum disepakati (Supabase Storage vs lewat backend) — hanya bagian toFormData() yang perlu diubah.
 */

function toBody({ image, removeImage, ...fields }) {
  if (removeImage) fields.remove_image = true; // kontrak: remove_image=true untuk menghapus foto
  if (!image) return fields;
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  fd.append("image", image);
  return fd;
}

export async function listProducts() {
  if (USE_MOCK) return (await mockOk(productsDb.filter((p) => !p.deleted_at).map((p) => ({ ...p })), { ms: 300 })).data;
  return (await api.get("/products")).data.data;
}

function dupCheck(code, exceptId) {
  const dup = productsDb.some((p) => p.code.toLowerCase() === code.toLowerCase() && !p.deleted_at && p.id !== exceptId);
  return dup ? mockFail(409, "CODE_EXISTS", "Kode barang sudah terdaftar.", [{ field: "code", message: "Kode barang sudah terdaftar di katalog." }]) : null;
}

export async function createProduct(values) {
  if (USE_MOCK) {
    const dup = dupCheck(values.code);
    if (dup) return dup;
    const p = {
      id: `p-${Date.now()}`,
      code: values.code,
      name: values.name,
      category: values.category,
      min_stock: values.min_stock,
      image_url: values.image ? URL.createObjectURL(values.image) : null,
      deleted_at: null,
      // Stok awal selalu 0: jumlah hanya berubah lewat transaksi stok (PRD aturan bisnis no. 3)
      stocks: ["wh-1", "wh-2", "wh-3"].map((w) => ({ warehouse_id: w, quantity: 0, last_checked_at: null })),
    };
    productsDb.unshift(p);
    return (await mockOk(p, { message: "Barang dibuat" })).data;
  }
  return (await api.post("/products", toBody(values))).data.data;
}

export async function updateProduct(id, values) {
  if (USE_MOCK) {
    const p = productsDb.find((x) => x.id === id);
    if (!p) return mockFail(404, "NOT_FOUND", "Barang tidak ditemukan.");
    const dup = dupCheck(values.code, id);
    if (dup) return dup;
    Object.assign(p, { code: values.code, name: values.name, category: values.category, min_stock: values.min_stock });
    if (values.image) p.image_url = URL.createObjectURL(values.image);
    if (values.removeImage) p.image_url = null;
    return (await mockOk({ ...p })).data;
  }
  return (await api.patch(`/products/${id}`, toBody(values))).data.data;
}

export async function deleteProduct(id) {
  if (USE_MOCK) {
    const p = productsDb.find((x) => x.id === id);
    if (!p) return mockFail(404, "NOT_FOUND", "Barang tidak ditemukan.");
    p.deleted_at = new Date().toISOString();
    return (await mockOk(null)).data;
  }
  return (await api.delete(`/products/${id}`)).data.data;
}
