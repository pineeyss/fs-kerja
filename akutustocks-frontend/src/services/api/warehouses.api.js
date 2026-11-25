import { api, USE_MOCK } from "./client";
import { mockOk } from "./mock/helpers";

// DATA CONTOH: nama/kode gudang final belum disepakati (architecture.md bagian 17 no. 2).
const SAMPLE_WAREHOUSES = [
  { id: "wh-1", code: "G1", name: "Gudang 1" },
  { id: "wh-2", code: "G2", name: "Gudang 2" },
  { id: "wh-3", code: "G3", name: "Gudang 3" },
];

/* ASUMSI: GET /warehouses -> data: [{ id, code, name }] */
export async function listWarehouses() {
  if (USE_MOCK) return (await mockOk(SAMPLE_WAREHOUSES, { ms: 150 })).data;
  return (await api.get("/warehouses")).data.data;
}
