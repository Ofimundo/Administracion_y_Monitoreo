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

const ERRORES_INFRAESTRUCTURA = [
  "error de conexión", "timeout", "servidor no responde", "softland no disponible",
  "sii no responde", "connection failed", "failed to connect", "could not connect",
  "connection refused", "network error", "500", "503", "502", "504",
  "no se pudo conectar", "softland error", "sii error", "error de red"
];

async function check() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log("🔌 Connected. Checking each keyword individually...");

    for (const keyword of ERRORES_INFRAESTRUCTURA) {
      const result = await pool.request().query(`
        SELECT COUNT(1) as count
        FROM [RPA].[aceptacion_rechazo_bitacora]
        WHERE motivo LIKE '%${keyword}%'
      `);
      const count = result.recordset[0].count;
      if (count > 0) {
        console.log(`Keyword: "${keyword}" -> Matched: ${count} rows`);
        const sample = await pool.request().query(`
          SELECT TOP 3 motivo, estado
          FROM [RPA].[aceptacion_rechazo_bitacora]
          WHERE motivo LIKE '%${keyword}%'
        `);
        console.table(sample.recordset);
      }
    }

    await sql.close();
  } catch (error) {
    console.error("❌ check failed:", error);
  }
}

check();
