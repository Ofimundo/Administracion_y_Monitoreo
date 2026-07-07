const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  server: process.env.DB_SERVER || '192.168.1.14\\OFIMUNDO_DEV',
  database: process.env.DB_DATABASE || 'THE_COOLER_SGCX',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 15000,
  requestTimeout: 15000,
};

async function check() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log("🔌 Connected. Checking exact matches...");

    const result = await pool.request().query(`
      SELECT estado, motivo, COUNT(1) as qty
      FROM [RPA].[aceptacion_rechazo_bitacora]
      GROUP BY estado, motivo
    `);

    const records = result.recordset;
    const technicalErrors = [
      "error de conexión", "timeout", "servidor no responde",
      "softland no disponible", "sii no responde", "connection failed",
      "failed to connect", "could not connect", "connection refused",
      "network error", "500", "503", "no se pudo conectar",
      "softland error", "sii error", "error de red"
    ];

    let matchedCount = 0;
    const matchesList = [];

    records.forEach(rec => {
      const motivo = rec.motivo || "";
      const matched = technicalErrors.some(term => motivo.toLowerCase().includes(term.toLowerCase()));
      if (matched) {
        matchedCount += rec.qty;
        matchesList.push({ estado: rec.estado, motivo: motivo, qty: rec.qty });
      }
    });

    console.log(`Total records: ${records.reduce((sum, r) => sum + r.qty, 0)}`);
    console.log(`Matched records: ${matchedCount} (${Math.round(matchedCount / records.reduce((sum, r) => sum + r.qty, 0) * 100)}%)`);
    console.log("\n--- Matched Records ---");
    console.table(matchesList);

    await sql.close();
  } catch (error) {
    console.error("❌ check failed:", error);
  }
}

check();
