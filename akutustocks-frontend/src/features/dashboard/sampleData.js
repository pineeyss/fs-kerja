// DATA CONTOH (PRD aturan bisnis no. 12) — bukan data aktual Akutusocks.
export const STOCK_BY_WAREHOUSE = [
  { name: "Gudang 1", id: "wh-1", total: 476 },
  { name: "Gudang 2", id: "wh-2", total: 363 },
  { name: "Gudang 3", id: "wh-3", total: 234 },
];

const days7 = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const FLOW = {
  7: days7.map((d, i) => ({ label: d, masuk: [40, 90, 60, 120, 95, 30, 85][i], keluar: [55, 70, 45, 40, 60, 25, 15][i] })),
  30: ["Mgg 1", "Mgg 2", "Mgg 3", "Mgg 4"].map((d, i) => ({ label: d, masuk: [310, 420, 380, 450][i], keluar: [280, 310, 350, 330][i] })),
};

export const NEAR_MIN = [
  { name: "Pop Mart Crybaby Crying Again", qty: 0, min: 6 },
  { name: "Stanley Quencher H2.0 40oz", qty: 3, min: 6 },
  { name: "Pokémon Booster Box Surging Sparks", qty: 3, min: 4 },
  { name: "Pop Mart Labubu Plush Keychain", qty: 5, min: 8 },
  { name: "Funko Pop! Spider-Man", qty: 8, min: 10 },
];

export const ATTENTION_ROWS = [
  { id: 1, name: "Pop Mart Crybaby Crying Again", code: "BLD-003", warehouseId: "wh-3", warehouse: "Gudang 3", checkedAt: "2026-10-31", qty: 0, min: 6, status: "OUT" },
  { id: 2, name: "Stanley Quencher H2.0 40oz", code: "TMB-001", warehouseId: "wh-3", warehouse: "Gudang 3", checkedAt: "2026-11-10", qty: 1, min: 6, status: "LOW" },
  { id: 3, name: "Pokémon Booster Box Surging Sparks", code: "TCG-001", warehouseId: "wh-3", warehouse: "Gudang 3", checkedAt: "2026-11-03", qty: 2, min: 4, status: "LOW" },
  { id: 4, name: "Pop Mart Labubu Plush Keychain", code: "KEY-001", warehouseId: "wh-2", warehouse: "Gudang 2", checkedAt: "2026-11-08", qty: 6, min: 8, status: "LOW" },
  { id: 5, name: "Funko Pop! Spider-Man", code: "ACT-001", warehouseId: "wh-1", warehouse: "Gudang 1", checkedAt: "2026-11-15", qty: 8, min: 10, status: "LOW" },
];
