const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  server: process.env.DB_SERVER || '192.168.1.14\\OFIMUNDO_DEV',
  database: 'SGCX',
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

async function explore() {
  try {
    const pool = await sql.connect(dbConfig);
    
    // Select top 1 row to see columns
    const columnsResult = await pool.request().query(`
      SELECT TOP 1 *
      FROM dbo.Eq_Parque
    `);
    console.log("📋 Eq_Parque sample row:");
    console.log(columnsResult.recordset[0]);

    await sql.close();
  } catch (error) {
    console.error("❌ explore failed:", error);
  }
}

explore();
