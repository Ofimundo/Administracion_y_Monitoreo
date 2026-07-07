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
    console.log("🔌 Connected. Listing all database rows where motivo contains 'error', 'denied', or 'fail'...");

    const result = await pool.request().query(`
      SELECT motivo, estado, COUNT(1) as count
      FROM [RPA].[aceptacion_rechazo_bitacora]
      WHERE motivo LIKE '%error%' OR motivo LIKE '%denied%' OR motivo LIKE '%fail%' OR motivo LIKE '%fallo%'
      GROUP BY motivo, estado
    `);

    console.table(result.recordset);
    await sql.close();
  } catch (error) {
    console.error("❌ check failed:", error);
  }
}

check();
