// lib/db-client.ts
import sql from 'mssql';

// Configuración de conexión a SQL Server
const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'THE_COOLER_SGCX',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: false, // Cambiar a true si usas Azure o certificados SSL
    trustServerCertificate: true, // Para conexiones locales
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool: sql.ConnectionPool | null = null;

export async function getConnection() {
  if (!pool) {
    try {
      console.log("🔌 Conectando a SQL Server...");
      console.log(`📊 Servidor: ${dbConfig.server}`);
      console.log(`📊 Base de datos: ${dbConfig.database}`);
      console.log(`📊 Usuario: ${dbConfig.user}`);
      
      pool = await sql.connect(dbConfig);
      console.log("✅ Conexión a SQL Server establecida");
    } catch (error) {
      console.error("❌ Error de conexión a SQL Server:", error);
      throw error;
    }
  }
  return pool;
}

export async function executeQuery(query: string, params: any[] = []) {
  try {
    const connection = await getConnection();
    const request = connection.request();
    
    // Agregar parámetros si existen
    params.forEach((param, index) => {
      request.input(`p${index}`, param);
    });
    
    const result = await request.query(query);
    return result;
  } catch (error) {
    console.error('❌ Error executing query:', error);
    throw error;
  }
}

export function isSimulationMode() {
  const mode = process.env.NEXT_PUBLIC_DB_MODE || 'simulation';
  console.log(`🔧 Modo de conexión: ${mode === 'real' ? 'REAL (SQL Server)' : 'SIMULACIÓN'}`);
  return mode !== 'real';
}