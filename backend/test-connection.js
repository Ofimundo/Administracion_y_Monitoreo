const sql = require('mssql');

const dbConfig = {
  server: '192.168.1.14\\OFIMUNDO_DEV',
  database: 'THE_COOLER_SGCX',
  user: 'marrano',
  password: '123456',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 10000,
  requestTimeout: 10000,
};

async function test() {
  try {
    console.log("Connecting as marrano...");
    const pool = await sql.connect(dbConfig);
    console.log("✅ Connection SUCCESSFUL as marrano!");
    await sql.close();
  } catch (err) {
    console.error("❌ Connection FAILED:", err.message);
  }
}

test();
