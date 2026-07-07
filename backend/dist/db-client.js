"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnection = getConnection;
exports.executeQuery = executeQuery;
exports.executeProcedure = executeProcedure;
exports.isSimulationMode = isSimulationMode;
const mssql_1 = __importDefault(require("mssql"));
const dotenv_1 = __importDefault(require("dotenv"));
// Cargar variables de entorno en el backend
dotenv_1.default.config();
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
let pool = null;
async function getConnection() {
    if (!pool) {
        try {
            console.log("🔌 Conectando a SQL Server...");
            console.log(`📊 Servidor: ${dbConfig.server}`);
            console.log(`📊 Base de datos: ${dbConfig.database}`);
            console.log(`📊 Usuario: ${dbConfig.user}`);
            pool = await mssql_1.default.connect(dbConfig);
            console.log("✅ Conexión a SQL Server establecida");
        }
        catch (error) {
            console.error("❌ Error de conexión a SQL Server:", error);
            throw error;
        }
    }
    return pool;
}
async function executeQuery(query, params = []) {
    try {
        const connection = await getConnection();
        const request = connection.request();
        // Agregar parámetros si existen
        params.forEach((param, index) => {
            request.input(`p${index}`, param);
        });
        const result = await request.query(query);
        return result;
    }
    catch (error) {
        console.error('❌ Error executing query:', error);
        throw error;
    }
}
async function executeProcedure(procedureName, inputs = {}) {
    try {
        const connection = await getConnection();
        const request = connection.request();
        // Agregar parámetros de entrada para el procedimiento almacenado
        for (const [name, param] of Object.entries(inputs)) {
            request.input(name, param.type, param.value);
        }
        console.log(`🚀 Ejecutando SP: ${procedureName}`);
        const result = await request.execute(procedureName);
        return result;
    }
    catch (error) {
        console.error(`❌ Error al ejecutar SP ${procedureName}:`, error);
        throw error;
    }
}
function isSimulationMode() {
    const mode = process.env.DB_MODE || 'simulation';
    console.log(`🔧 Modo de conexión: ${mode === 'real' ? 'REAL (SQL Server)' : 'SIMULACIÓN'}`);
    return mode !== 'real';
}
