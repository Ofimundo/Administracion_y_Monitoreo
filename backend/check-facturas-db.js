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
    console.log("🔌 Connected to database. Querying bitacora details...");

    // 1. Column names
    console.log("\n--- Columns in [RPA].[aceptacion_rechazo_bitacora] ---");
    const colsResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'RPA' AND TABLE_NAME = 'aceptacion_rechazo_bitacora'
    `);
    console.table(colsResult.recordset);

    // 2. Distinct states
    console.log("\n--- Unique values in 'estado' column ---");
    const statesResult = await pool.request().query(`
      SELECT estado, COUNT(1) as count
      FROM [RPA].[aceptacion_rechazo_bitacora]
      GROUP BY estado
    `);
    console.table(statesResult.recordset);

    // 3. Sample of records where estado is 'Error' or contains error keywords
    console.log("\n--- Sample motives of records that contain error keywords ---");
    const errorSample = await pool.request().query(`
      SELECT TOP 10 estado, motivo, COUNT(1) as count
      FROM [RPA].[aceptacion_rechazo_bitacora]
      WHERE motivo LIKE '%error%' OR motivo LIKE '%timeout%' OR motivo LIKE '%servidor%' OR estado LIKE '%error%'
      GROUP BY estado, motivo
    `);
    console.table(errorSample.recordset);

    await sql.close();
  } catch (error) {
    console.error("❌ check failed:", error);
  }
}

check();
