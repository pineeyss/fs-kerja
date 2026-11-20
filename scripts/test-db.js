const pool = require('../src/config/db');

pool
  .query('SELECT NOW() AS waktu')
  .then((r) => console.log('Koneksi berhasil:', r.rows[0].waktu))
  .catch((e) => console.error('Koneksi gagal:', e.message))
  .finally(() => pool.end());
