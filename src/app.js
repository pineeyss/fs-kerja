const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'AkutuStocks API berjalan',
    data: { time: new Date().toISOString() },
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: 'Endpoint tidak ditemukan',
  });
});

module.exports = app;
