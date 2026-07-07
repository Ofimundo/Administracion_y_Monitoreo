const sql = require('mssql');
require('dotenv').config();

// Connecting with the credentials in .env
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

async function run() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log("🔌 Connected as 'marrano'. Attempting to map login 'monitoreo' to 'OFITEC' database...");

    const query = `
      USE [OFITEC];
      IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'monitoreo')
      BEGIN
        CREATE USER [monitoreo] FOR LOGIN [monitoreo];
      END
      ALTER ROLE [db_datareader] ADD MEMBER [monitoreo];
    `;

    await pool.request().query(query);
    console.log("✅ Successfully mapped and granted read permission to 'monitoreo' on 'OFITEC' database!");
    await sql.close();
  } catch (error) {
    console.error("❌ Failed to grant permissions:", error.message);
    console.log("\nYou should run the following SQL script in SQL Server Management Studio (SSMS) as 'sa' or an Administrator:\n");
    console.log(`
      USE [OFITEC];
      IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'monitoreo')
      BEGIN
        CREATE USER [monitoreo] FOR LOGIN [monitoreo];
      END
      ALTER ROLE [db_datareader] ADD MEMBER [monitoreo];
    `);
  }
}

run();
