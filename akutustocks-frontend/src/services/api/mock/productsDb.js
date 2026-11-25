// DATA CONTOH dalam memori. Bukan data aktual Akutusocks.
const WH = ["wh-1", "wh-2", "wh-3"];
const rows = [
  ["ACT-001", "Funko Pop! Spider-Man", "Action Figure", 12, 8, 5, 10, "2026-11-15"],
  ["PRF-001", "HMNS Eau de Parfum Orion 30ml", "Parfum", 20, 15, 12, 15, "2026-11-10"],
  ["TMB-001", "Stanley Quencher H2.0 40oz", "Tumbler", 5, 3, 1, 6, "2026-11-10"],
  ["KEY-001", "Pop Mart Labubu Plush Keychain", "Gantungan Kunci", 9, 6, 4, 8, "2026-11-08"],
  ["TCG-001", "Pokémon Booster Box Surging Sparks", "Kartu Pokémon", 4, 3, 2, 4, "2026-11-03"],
  ["JBZ-001", "Crocs Jibbitz Hello Kitty Pack", "Jibbitz", 25, 18, 12, 20, "2026-11-20"],
  ["BLD-003", "Pop Mart Crybaby Crying Again", "Blind Box", 0, 0, 0, 6, "2026-10-31"],
  ["BLD-002", "Pop Mart Skullpanda The Warmth", "Blind Box", 5, 0, 0, 6, "2026-10-31"],
  ["ACT-003", "S.H.Figuarts Son Goku", "Action Figure", 3, 0, 2, 5, "2026-10-28"],
  ["EYE-002", "Oakley Holbrook", "Kacamata", 3, 1, 0, 5, "2026-10-30"],
  ["BAG-001", "Herschel Little America", "Tas", 2, 1, 0, 4, "2026-11-01"],
  ["PRF-002", "HMNS Eau de Parfum Libra 30ml", "Parfum", 14, 10, 9, 12, "2026-11-12"],
  ["TMB-002", "Stanley Classic Legendary 1.4L", "Tumbler", 7, 6, 5, 6, "2026-11-12"],
  ["KEY-002", "Pop Mart Hirono Keychain", "Gantungan Kunci", 11, 9, 8, 8, "2026-11-14"],
  ["JBZ-002", "Crocs Jibbitz Sanrio Pack", "Jibbitz", 18, 14, 9, 15, "2026-11-18"],
  ["TCG-002", "Pokémon Elite Trainer Box", "Kartu Pokémon", 6, 5, 3, 5, "2026-11-05"],
  ["ACT-004", "Funko Pop! Iron Man", "Action Figure", 10, 7, 6, 8, "2026-11-16"],
  ["EYE-003", "Ray-Ban Wayfarer", "Kacamata", 8, 4, 3, 5, "2026-11-09"],
];

export const productsDb = rows.map(([code, name, category, a, b, c, min, checked], i) => ({
  id: `p-${i + 1}`,
  code,
  name,
  category,
  image_url: null,
  min_stock: min,
  deleted_at: null,
  stocks: [a, b, c].map((q, k) => ({ warehouse_id: WH[k], quantity: q, last_checked_at: `${checked}T09:00:00.000Z` })),
}));
