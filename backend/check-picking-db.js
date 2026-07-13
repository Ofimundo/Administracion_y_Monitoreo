const sql = require('mssql');
require('dotenv').config({ path: 'c:/Users/marrano/OneDrive - Ofimundo/Escritorio/Margarita Arraño/Proyectos/Administracion_y_Monitoreo/Administracion_y_Monitoreo/backend/.env' });

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

async function check() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log("Connected to SGCX");

    // 1. Get max date in database
    const maxDateResult = await pool.request().query(`
      SELECT MAX(Pickc_Fecha_Picking) as max_date 
      FROM dbo.Inv_Picking_Cabecera
    `);
    const maxDate = maxDateResult.recordset[0].max_date;
    console.log("📅 Max date in database:", maxDate);

    // 2. Count records around max date vs GETDATE()
    const countsResult = await pool.request().query(`
      SELECT 
        (SELECT COUNT(DISTINCT Pickc_Folio_Picking) FROM dbo.Inv_Picking_Cabecera WHERE Pickc_Fecha_Picking >= DATEADD(hour, -24, GETDATE())) as vol_24h_getdate,
        (SELECT COUNT(DISTINCT Pickc_Folio_Picking) FROM dbo.Inv_Picking_Cabecera WHERE Pickc_Fecha_Picking >= DATEADD(day, -7, GETDATE())) as vol_semana_getdate,
        (SELECT COUNT(DISTINCT Pickc_Folio_Picking) FROM dbo.Inv_Picking_Cabecera WHERE Pickc_Fecha_Picking >= DATEADD(day, -30, GETDATE())) as vol_mes_getdate,
        
        -- Relative to max date in database
        (SELECT COUNT(DISTINCT Pickc_Folio_Picking) FROM dbo.Inv_Picking_Cabecera WHERE Pickc_Fecha_Picking >= DATEADD(hour, -24, '${maxDate.toISOString()}')) as vol_24h_maxdate,
        (SELECT COUNT(DISTINCT Pickc_Folio_Picking) FROM dbo.Inv_Picking_Cabecera WHERE Pickc_Fecha_Picking >= DATEADD(day, -7, '${maxDate.toISOString()}')) as vol_semana_maxdate,
        (SELECT COUNT(DISTINCT Pickc_Folio_Picking) FROM dbo.Inv_Picking_Cabecera WHERE Pickc_Fecha_Picking >= DATEADD(day, -30, '${maxDate.toISOString()}')) as vol_mes_maxdate
    `);
    console.table(countsResult.recordset);

    await sql.close();
  } catch (error) {
    console.error("❌ check failed:", error);
  }
}

check();
