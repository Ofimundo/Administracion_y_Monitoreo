const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  server: process.env.DB_SERVER || '192.168.1.14\\OFIMUNDO_DEV',
  database: 'master',
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

async function run() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log("🔌 Connected as 'marrano'. Attempting to map login 'monitoreo' to SGCX and CONTROLGESTION databases...");

    // Grant read permissions to monitoreo in SGCX
    const querySgcx = `
      USE [SGCX];
      IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'monitoreo')
      BEGIN
        CREATE USER [monitoreo] FOR LOGIN [monitoreo];
      END
      ALTER ROLE [db_datareader] ADD MEMBER [monitoreo];
    `;
    console.log("Executing on SGCX...");
    await pool.request().query(querySgcx);
    console.log("✅ Success on SGCX!");

    // Grant read permissions to monitoreo in CONTROLGESTION
    const queryControl = `
      USE [CONTROLGESTION];
      IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'monitoreo')
      BEGIN
        CREATE USER [monitoreo] FOR LOGIN [monitoreo];
      END
      ALTER ROLE [db_datareader] ADD MEMBER [monitoreo];
    `;
    console.log("Executing on CONTROLGESTION...");
    await pool.request().query(queryControl);
    console.log("✅ Success on CONTROLGESTION!");

    await sql.close();
  } catch (error) {
    console.error("❌ Failed to grant permissions:", error.message);
    console.log("\nYou should run the following SQL script in SQL Server Management Studio (SSMS) as 'sa' or an Administrator:\n");
    console.log(`
      USE [SGCX];
      IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'monitoreo')
      BEGIN
        CREATE USER [monitoreo] FOR LOGIN [monitoreo];
      END
      ALTER ROLE [db_datareader] ADD MEMBER [monitoreo];

      USE [CONTROLGESTION];
      IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'monitoreo')
      BEGIN
        CREATE USER [monitoreo] FOR LOGIN [monitoreo];
      END
      ALTER ROLE [db_datareader] ADD MEMBER [monitoreo];
    `);
  }
}

run();
