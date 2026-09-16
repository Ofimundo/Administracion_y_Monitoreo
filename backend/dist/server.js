"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const db_client_1 = require("./db-client");
const process_state_1 = require("./process-state");
const date_fns_1 = require("date-fns");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
let ultimaEjecucion = null;
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// 1. GET /api/facturas/test-db
app.get("/api/facturas/test-db", async (req, res) => {
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        if (isSimulated) {
            return res.json({
                success: true,
                mode: 'simulation',
                message: '⚠️ Estás en MODO SIMULACIÓN. Cambia DB_MODE=real en el archivo .env del backend para usar SQL Server'
            });
        }
        const result = await (0, db_client_1.executeQuery)("SELECT GETDATE() as server_time, DB_NAME() as database_name, @@SERVERNAME as server_name");
        return res.json({
            success: true,
            mode: 'real',
            server_time: result?.recordset?.[0]?.server_time,
            database_name: result?.recordset?.[0]?.database_name,
            server_name: result?.recordset?.[0]?.server_name,
            message: '✅ Conexión a SQL Server exitosa'
        });
    }
    catch (error) {
        console.error("❌ Error en test-db:", error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: '❌ Error de conexión a SQL Server. Verifica tus credenciales en el archivo .env del backend'
        });
    }
});
// 2. GET /api/facturas/bitacora
app.get("/api/facturas/bitacora", async (req, res) => {
    try {
        const estado = req.query.estado;
        const search = req.query.search;
        const tipoDocumento = req.query.tipoDocumento;
        const fechaDesde = req.query.fechaDesde;
        const fechaHasta = req.query.fechaHasta;
        const cliente = req.query.cliente;
        console.log("📊 [API] Consultando bitácora en SQL Server con filtros:", { estado, search, tipoDocumento, fechaDesde, fechaHasta, cliente });
        let conditions = [];
        if (estado && estado !== "todos") {
            let estadoValue = "";
            switch (estado) {
                case "aprobado":
                    estadoValue = "Aprobado";
                    break;
                case "rechazado":
                    estadoValue = "Rechazado";
                    break;
                case "pendiente":
                    estadoValue = "Pendiente";
                    break;
                case "pendiente espera":
                    estadoValue = "Pendiente Espera";
                    break;
                case "manual":
                    estadoValue = "Manual";
                    break;
                default: estadoValue = estado;
            }
            conditions.push(`estado = '${estadoValue}'`);
        }
        if (tipoDocumento && tipoDocumento !== "todos") {
            conditions.push(`tipo_documento = ${parseInt(tipoDocumento)}`);
        }
        if (search && search.trim() !== "") {
            const searchClean = search.replace(/'/g, "''");
            conditions.push(`(
          CAST(folio_documento AS NVARCHAR(50)) LIKE '%${searchClean}%' OR 
          rut_proveedor LIKE '%${searchClean}%' OR 
          razon_social LIKE '%${searchClean}%'
        )`);
        }
        if (fechaDesde) {
            conditions.push(`CAST(fecha_proceso AS DATE) >= '${fechaDesde}'`);
        }
        if (fechaHasta) {
            conditions.push(`CAST(fecha_proceso AS DATE) <= '${fechaHasta}'`);
        }
        const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
        let sqlQuery = "";
        const isAntofagasta = cliente && (cliente.toLowerCase().includes("antofagasta") || cliente === "cl_cmds_antofagasta" || cliente === "cl_ofimundo" || cliente.toLowerCase().includes("ofimundo"));
        const isStuedemann = cliente && (cliente.toLowerCase().includes("stuedemann") || cliente === "cl_stuedemann");
        const isCorpesca = cliente && (cliente.toLowerCase().includes("corpesca") || cliente === "cl_corpesca");
        const isAutomovilClub = cliente && (cliente.toLowerCase().includes("automovil") || cliente === "cl_automovil_club");
        if (isCorpesca) {
            sqlQuery = `
          SELECT * FROM (
            SELECT 
              id_proceso,
              CAST(folio AS NVARCHAR(50)) as folio_documento,
              'Factura Artesanal' as tipo_documento,
              '-' as orden_compra,
              'CORPESCA S.A.' as razon_social,
              '-' as rut_proveedor,
              0 as dias_por_vencer,
              CASE 
                WHEN (pdf_capturado IN ('SI','OK','1','Capturado') AND xml_capturado IN ('SI','OK','1','Capturado')) THEN 'Aprobado'
                WHEN LOWER(motivo) LIKE '%error%' OR LOWER(motivo) LIKE '%rechaz%' THEN 'Rechazado'
                ELSE 'Aprobado'
              END as estado,
              NULL as id_regla,
              motivo,
              NULL as horas_por_revisar,
              fecha_proceso,
              fecha_recepcion,
              pdf_capturado,
              xml_capturado,
              NULL as fecha_modificacion,
              'CORPESCA S.A.' as cliente_nombre,
              'cl_corpesca' as cliente_id
            FROM [THE_COOLER_SGCX].[RPA].[corpesca_bitacora]
          ) AS bitacora_total
          ${whereClause}
          ORDER BY fecha_proceso DESC
        `;
        }
        else if (isAntofagasta) {
            sqlQuery = `
          SELECT * FROM (
            SELECT 
              id_proceso,
              CAST(folio_documento AS NVARCHAR(50)) as folio_documento,
              CAST(tipo_documento AS NVARCHAR(50)) as tipo_documento,
              orden_compra,
              razon_social,
              rut_proveedor,
              dias_por_vencer,
              estado,
              NULL as id_regla,
              motivo,
              NULL as horas_por_revisar,
              fecha_proceso,
              NULL as fecha_recepcion,
              NULL as pdf_capturado,
              NULL as xml_capturado,
              NULL as fecha_modificacion,
              'CORP MUNICIPAL DE DESARROLLO SOCIAL DE ANTOFAGASTA' as cliente_nombre,
              'cl_cmds_antofagasta' as cliente_id
            FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora_antofagasta]
          ) AS bitacora_total
          ${whereClause}
          ORDER BY fecha_proceso DESC
        `;
        }
        else if (isStuedemann) {
            sqlQuery = `
          SELECT * FROM (
            SELECT 
              id_proceso,
              CAST(folio_documento AS NVARCHAR(50)) as folio_documento,
              CAST(tipo_documento AS NVARCHAR(50)) as tipo_documento,
              orden_compra,
              razon_social,
              rut_proveedor,
              dias_por_vencer,
              estado,
              id_regla,
              motivo,
              horas_por_revisar,
              fecha_proceso,
              NULL as fecha_recepcion,
              NULL as pdf_capturado,
              NULL as xml_capturado,
              fecha_modificacion,
              'STUEDEMANN S.A.' as cliente_nombre,
              'cl_stuedemann' as cliente_id
            FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora]
          ) AS bitacora_total
          ${whereClause}
          ORDER BY fecha_proceso DESC
        `;
        }
        else if (isAutomovilClub) {
            sqlQuery = `
          SELECT * FROM (
            SELECT 
              id_proceso,
              CAST(folio_documento AS NVARCHAR(50)) as folio_documento,
              CAST(tipo_documento AS NVARCHAR(50)) as tipo_documento,
              orden_compra,
              razon_social_proveedor as razon_social,
              rut_proveedor,
              dias_por_vencer,
              estado,
              NULL as id_regla,
              motivo,
              NULL as horas_por_revisar,
              fecha_proceso,
              NULL as fecha_recepcion,
              NULL as pdf_capturado,
              NULL as xml_capturado,
              NULL as fecha_modificacion,
              'AUTOMOVIL CLUB DE CHILE' as cliente_nombre,
              'cl_automovil_club' as cliente_id
            FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora_automovil]
          ) AS bitacora_total
          ${whereClause}
          ORDER BY fecha_proceso DESC
        `;
        }
        else {
            sqlQuery = `
          SELECT * FROM (
            SELECT 
              id_proceso,
              CAST(folio_documento AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as folio_documento,
              CAST(tipo_documento AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as tipo_documento,
              CAST(orden_compra AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as orden_compra,
              CAST(razon_social AS NVARCHAR(250)) COLLATE DATABASE_DEFAULT as razon_social,
              CAST(rut_proveedor AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as rut_proveedor,
              dias_por_vencer,
              CAST(estado AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as estado,
              id_regla,
              CAST(motivo AS NVARCHAR(MAX)) COLLATE DATABASE_DEFAULT as motivo,
              horas_por_revisar,
              fecha_proceso,
              NULL as fecha_recepcion,
              NULL as pdf_capturado,
              NULL as xml_capturado,
              fecha_modificacion,
              CAST('STUEDEMANN S.A.' AS NVARCHAR(200)) COLLATE DATABASE_DEFAULT as cliente_nombre,
              CAST('cl_stuedemann' AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as cliente_id
            FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora]

            UNION ALL

            SELECT 
              id_proceso,
              CAST(folio_documento AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as folio_documento,
              CAST(tipo_documento AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as tipo_documento,
              CAST(orden_compra AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as orden_compra,
              CAST(razon_social AS NVARCHAR(250)) COLLATE DATABASE_DEFAULT as razon_social,
              CAST(rut_proveedor AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as rut_proveedor,
              dias_por_vencer,
              CAST(estado AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as estado,
              NULL as id_regla,
              CAST(motivo AS NVARCHAR(MAX)) COLLATE DATABASE_DEFAULT as motivo,
              NULL as horas_por_revisar,
              fecha_proceso,
              NULL as fecha_recepcion,
              NULL as pdf_capturado,
              NULL as xml_capturado,
              NULL as fecha_modificacion,
              CAST('CORP MUNICIPAL DE DESARROLLO SOCIAL DE ANTOFAGASTA' AS NVARCHAR(200)) COLLATE DATABASE_DEFAULT as cliente_nombre,
              CAST('cl_cmds_antofagasta' AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as cliente_id
            FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora_antofagasta]

            UNION ALL

            SELECT 
              id_proceso,
              CAST(folio_documento AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as folio_documento,
              CAST(tipo_documento AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as tipo_documento,
              CAST(orden_compra AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as orden_compra,
              CAST(razon_social_proveedor AS NVARCHAR(250)) COLLATE DATABASE_DEFAULT as razon_social,
              CAST(rut_proveedor AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as rut_proveedor,
              dias_por_vencer,
              CAST(estado AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as estado,
              NULL as id_regla,
              CAST(motivo AS NVARCHAR(MAX)) COLLATE DATABASE_DEFAULT as motivo,
              NULL as horas_por_revisar,
              fecha_proceso,
              NULL as fecha_recepcion,
              NULL as pdf_capturado,
              NULL as xml_capturado,
              NULL as fecha_modificacion,
              CAST('AUTOMOVIL CLUB DE CHILE' AS NVARCHAR(200)) COLLATE DATABASE_DEFAULT as cliente_nombre,
              CAST('cl_automovil_club' AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as cliente_id
            FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora_automovil]

            UNION ALL

            SELECT 
              id_proceso,
              CAST(folio AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as folio_documento,
              CAST('Factura Artesanal' AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as tipo_documento,
              CAST('-' AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as orden_compra,
              CAST('CORPESCA S.A.' AS NVARCHAR(250)) COLLATE DATABASE_DEFAULT as razon_social,
              CAST('-' AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as rut_proveedor,
              0 as dias_por_vencer,
              CAST(
                CASE 
                  WHEN (pdf_capturado IN ('SI','OK','1','Capturado') AND xml_capturado IN ('SI','OK','1','Capturado')) THEN 'Aprobado'
                  WHEN LOWER(motivo) LIKE '%error%' OR LOWER(motivo) LIKE '%rechaz%' THEN 'Rechazado'
                  ELSE 'Aprobado'
                END AS NVARCHAR(50)
              ) COLLATE DATABASE_DEFAULT as estado,
              NULL as id_regla,
              CAST(motivo AS NVARCHAR(MAX)) COLLATE DATABASE_DEFAULT as motivo,
              NULL as horas_por_revisar,
              fecha_proceso,
              fecha_recepcion,
              CAST(pdf_capturado AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as pdf_capturado,
              CAST(xml_capturado AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as xml_capturado,
              NULL as fecha_modificacion,
              CAST('CORPESCA S.A.' AS NVARCHAR(200)) COLLATE DATABASE_DEFAULT as cliente_nombre,
              CAST('cl_corpesca' AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT as cliente_id
            FROM [THE_COOLER_SGCX].[RPA].[corpesca_bitacora]
          ) AS bitacora_total
          ${whereClause}
          ORDER BY fecha_proceso DESC
        `;
        }
        console.log("🔌 [SQL Query]:", sqlQuery);
        try {
            const isSimulated = (0, db_client_1.isSimulationMode)();
            if (!isSimulated) {
                const result = await (0, db_client_1.executeQuery)(sqlQuery);
                const data = result?.recordset || [];
                console.log(`✅ [SQL Server] ${data.length} registros encontrados`);
                return res.json({
                    success: true,
                    mode: "real",
                    count: data.length,
                    data: data,
                });
            }
        }
        catch (dbError) {
            console.warn("⚠️ Error en consulta SQL Server, recurriendo a simulación:", dbError.message);
        }
        // Simulación de datos de bitácora incluyendo Automóvil Club de Chile y Corpesca S.A.
        const now = new Date();
        const today10am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 2, 15).toISOString();
        const today10am05 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 3, 22).toISOString();
        const today10am10 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 4, 10).toISOString();
        const simulatedAutoClubDocs = [
            {
                id_proceso: 9001,
                folio_documento: "88210",
                tipo_documento: "33",
                orden_compra: "OC-ACCH-551",
                razon_social: "AUTOMOVILES Y REPUESTOS LTDA",
                rut_proveedor: "76.444.111-2",
                dias_por_vencer: 5,
                estado: "Aprobado",
                id_regla: 1,
                motivo: "Documento aprobado cumple validaciones SII y OC",
                horas_por_revisar: 0,
                fecha_proceso: today10am,
                fecha_modificacion: today10am,
                cliente_nombre: "AUTOMOVIL CLUB DE CHILE",
                cliente_id: "cl_automovil_club"
            },
            {
                id_proceso: 9002,
                folio_documento: "88211",
                tipo_documento: "33",
                orden_compra: "OC-ACCH-552",
                razon_social: "SERVICIOS GRUAS Y ASISTENCIA SPA",
                rut_proveedor: "77.888.999-4",
                dias_por_vencer: 12,
                estado: "Aprobado",
                id_regla: 1,
                motivo: "Aprobación automática por concordancia de precios",
                horas_por_revisar: 0,
                fecha_proceso: today10am05,
                fecha_modificacion: today10am05,
                cliente_nombre: "AUTOMOVIL CLUB DE CHILE",
                cliente_id: "cl_automovil_club"
            },
            {
                id_proceso: 9003,
                folio_documento: "88212",
                tipo_documento: "61",
                orden_compra: "OC-ACCH-540",
                razon_social: "LUBRICANTES Y COMBUSTIBLES S.A.",
                rut_proveedor: "96.111.222-8",
                dias_por_vencer: 2,
                estado: "Rechazado",
                id_regla: 3,
                motivo: "Discrepancia en monto total respecto a Orden de Compra",
                horas_por_revisar: 24,
                fecha_proceso: today10am10,
                fecha_modificacion: today10am10,
                cliente_nombre: "AUTOMOVIL CLUB DE CHILE",
                cliente_id: "cl_automovil_club"
            }
        ];
        const simulatedCorpescaDocs = [
            {
                id_proceso: 10001,
                folio_documento: "FA-9012",
                tipo_documento: "Factura Artesanal",
                orden_compra: "N/A",
                razon_social: "PESQUERA ARTESANAL DEL NORTE",
                rut_proveedor: "76.543.210-9",
                dias_por_vencer: 0,
                estado: "Aprobado",
                motivo: "PDF y XML capturados correctamente",
                fecha_proceso: today10am,
                fecha_recepcion: today10am,
                pdf_capturado: "SI",
                xml_capturado: "SI",
                cliente_nombre: "CORPESCA S.A.",
                cliente_id: "cl_corpesca"
            },
            {
                id_proceso: 10002,
                folio_documento: "FA-9013",
                tipo_documento: "Factura Artesanal",
                orden_compra: "N/A",
                razon_social: "COOPERATIVA PESCADORES IQUIQUE",
                rut_proveedor: "77.123.456-1",
                dias_por_vencer: 0,
                estado: "Aprobado",
                motivo: "Captura exitosa de archivo PDF y XML",
                fecha_proceso: today10am05,
                fecha_recepcion: today10am05,
                pdf_capturado: "SI",
                xml_capturado: "SI",
                cliente_nombre: "CORPESCA S.A.",
                cliente_id: "cl_corpesca"
            },
            {
                id_proceso: 10003,
                folio_documento: "FA-9014",
                tipo_documento: "Factura Artesanal",
                orden_compra: "N/A",
                razon_social: "ARMADORES ARTESANALES ARICA",
                rut_proveedor: "76.999.888-3",
                dias_por_vencer: 0,
                estado: "Rechazado",
                motivo: "XML no encontrado en recepción de correo",
                fecha_proceso: today10am10,
                fecha_recepcion: today10am10,
                pdf_capturado: "SI",
                xml_capturado: "NO",
                cliente_nombre: "CORPESCA S.A.",
                cliente_id: "cl_corpesca"
            }
        ];
        let fallbackData = [...simulatedAutoClubDocs, ...simulatedCorpescaDocs];
        if (isAntofagasta) {
            fallbackData = fallbackData.filter(d => d.cliente_id === "cl_cmds_antofagasta");
        }
        else if (isAutomovilClub) {
            fallbackData = fallbackData.filter(d => d.cliente_id === "cl_automovil_club");
        }
        else if (isCorpesca) {
            fallbackData = fallbackData.filter(d => d.cliente_id === "cl_corpesca");
        }
        return res.json({
            success: true,
            mode: "simulation",
            count: fallbackData.length,
            data: fallbackData,
        });
    }
    catch (error) {
        console.error("❌ Error general en API:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error al consultar la bitácora",
            data: [],
        });
    }
});
// 2b. GET /api/facturas/monitoreo-ejecucion - Monitoreo de ejecuciones diarias de Antofagasta (Tabla RPA.aceptacion_rechazo_bitacora_antofagasta)
app.get("/api/facturas/monitoreo-ejecucion", async (req, res) => {
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        if (!isSimulated) {
            try {
                const sqlQuery = `
          SELECT 
            CONVERT(VARCHAR(10), fecha_proceso, 120) as fecha_dia,
            MIN(fecha_proceso) as FechaHoraInicio,
            MAX(fecha_proceso) as FechaHoraTermino,
            COUNT(*) as TotalRegistros,
            SUM(CASE WHEN LOWER(estado) = 'aprobado' THEN 1 ELSE 0 END) as TotalAceptados,
            SUM(CASE WHEN LOWER(estado) = 'rechazado' THEN 1 ELSE 0 END) as TotalRechazados,
            SUM(CASE WHEN LOWER(estado) LIKE '%pendiente%' THEN 1 ELSE 0 END) as TotalPendientes,
            SUM(CASE WHEN LOWER(estado) = 'manual' THEN 1 ELSE 0 END) as TotalExcepcionados,
            'Exitosa' as EstadoEjecucion,
            'CORP MUNICIPAL DE DESARROLLO SOCIAL DE ANTOFAGASTA' as Cliente,
            '11:45 AM - 13:00 PM' as VentanaHorario,
            '12:00 PM' as HorarioProgramado
          FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora_antofagasta]
          GROUP BY CONVERT(VARCHAR(10), fecha_proceso, 120)
          ORDER BY fecha_dia DESC
        `;
                const result = await (0, db_client_1.executeQuery)(sqlQuery);
                const data = result?.recordset || [];
                if (data.length > 0) {
                    return res.json({
                        success: true,
                        mode: "real",
                        count: data.length,
                        data: data,
                    });
                }
            }
            catch (dbErr) {
                console.warn("⚠️ Consulta a aceptacion_rechazo_bitacora_antofagasta falló, entregando simulación:", dbErr.message);
            }
        }
        // Datos simulados/fallback para CORP MUNICIPAL DE DESARROLLO SOCIAL DE ANTOFAGASTA (Ejecución diaria 12:00 PM)
        const now = new Date();
        const today12pm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 5, 20);
        const yesterday12pm = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 3, 10);
        const dayBefore12pm = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 12, 4, 0);
        const simulatedEjecuciones = [
            {
                IdEjecucion: "a1b2c3d4-antofagasta-01",
                FechaHoraInicio: today12pm.toISOString(),
                FechaHoraTermino: new Date(today12pm.getTime() + 6 * 60000 + 10000).toISOString(),
                PeriodoActual: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`,
                PeriodoAnterior: `${now.getFullYear()}${String(now.getMonth()).padStart(2, '0')}`,
                TotalRegistros: 85,
                TotalAceptados: 82,
                TotalRechazados: 2,
                TotalPendientes: 1,
                TotalExcepcionados: 0,
                RutaReporteDiario: "C:\\Monitoreo\\Reportes\\Diario_Antofagasta_20260811.pdf",
                RutaReporteMensual: "C:\\Monitoreo\\Reportes\\Mensual_Antofagasta_202608.pdf",
                EstadoEjecucion: "Exitosa",
                ErrorDescripcion: null,
                Cliente: "CORP MUNICIPAL DE DESARROLLO SOCIAL DE ANTOFAGASTA",
                VentanaHorario: "11:45 AM - 13:00 PM",
                HorarioProgramado: "12:00 PM"
            },
            {
                IdEjecucion: "b2c3d4e5-antofagasta-02",
                FechaHoraInicio: yesterday12pm.toISOString(),
                FechaHoraTermino: new Date(yesterday12pm.getTime() + 5 * 60000 + 30000).toISOString(),
                PeriodoActual: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`,
                PeriodoAnterior: `${now.getFullYear()}${String(now.getMonth()).padStart(2, '0')}`,
                TotalRegistros: 92,
                TotalAceptados: 90,
                TotalRechazados: 1,
                TotalPendientes: 1,
                TotalExcepcionados: 0,
                RutaReporteDiario: "C:\\Monitoreo\\Reportes\\Diario_Antofagasta_20260810.pdf",
                RutaReporteMensual: "C:\\Monitoreo\\Reportes\\Mensual_Antofagasta_202608.pdf",
                EstadoEjecucion: "Exitosa",
                ErrorDescripcion: null,
                Cliente: "CORP MUNICIPAL DE DESARROLLO SOCIAL DE ANTOFAGASTA",
                VentanaHorario: "11:45 AM - 13:00 PM",
                HorarioProgramado: "12:00 PM"
            },
            {
                IdEjecucion: "c3d4e5f6-antofagasta-03",
                FechaHoraInicio: dayBefore12pm.toISOString(),
                FechaHoraTermino: new Date(dayBefore12pm.getTime() + 4 * 60000 + 50000).toISOString(),
                PeriodoActual: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`,
                PeriodoAnterior: `${now.getFullYear()}${String(now.getMonth()).padStart(2, '0')}`,
                TotalRegistros: 78,
                TotalAceptados: 76,
                TotalRechazados: 2,
                TotalPendientes: 0,
                TotalExcepcionados: 0,
                RutaReporteDiario: "C:\\Monitoreo\\Reportes\\Diario_Antofagasta_20260809.pdf",
                RutaReporteMensual: "C:\\Monitoreo\\Reportes\\Mensual_Antofagasta_202608.pdf",
                EstadoEjecucion: "Exitosa",
                ErrorDescripcion: null,
                Cliente: "CORP MUNICIPAL DE DESARROLLO SOCIAL DE ANTOFAGASTA",
                VentanaHorario: "11:45 AM - 13:00 PM",
                HorarioProgramado: "12:00 PM"
            }
        ];
        return res.json({
            success: true,
            mode: "simulation",
            count: simulatedEjecuciones.length,
            data: simulatedEjecuciones,
        });
    }
    catch (error) {
        console.error("❌ Error en GET /api/facturas/monitoreo-ejecucion:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error al obtener ejecuciones de monitoreo de Antofagasta",
            data: [],
        });
    }
});
// 3. POST /api/facturas/sincronizar
app.post("/api/facturas/sincronizar", async (req, res) => {
    try {
        console.log("ℹ️ [Modo Solo Consulta] Consultando estado de bitácora en SQL Server (Sin ejecuciones de SP)...");
        const result = await (0, db_client_1.executeQuery)("SELECT COUNT(1) as total_registros FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora]");
        return res.json({
            success: true,
            mode: "real_read_only",
            totalCount: result?.recordset?.[0]?.total_registros || 0,
            syncedCount: 0,
            updatedCount: 0,
            message: "Consulta de bitácora realizada con éxito en SQL Server (Modo Solo Lectura: Sin modificaciones).",
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/facturas/sincronizar:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error al consultar la bitácora",
        });
    }
});
// 4. GET /api/facturas/ejecutar
app.get("/api/facturas/ejecutar", (req, res) => {
    return res.json({
        success: true,
        ultimaEjecucion: ultimaEjecucion || {
            mensaje: "No se ha realizado ninguna ejecución en esta sesión.",
            fecha: null,
        },
    });
});
// 5. POST /api/facturas/ejecutar
app.post("/api/facturas/ejecutar", async (req, res) => {
    if ((0, process_state_1.getProcesoActivo)()) {
        return res.status(409).json({
            success: false,
            message: "Ya hay una consulta de facturación en ejecución. Por favor, espera a que termine.",
        });
    }
    try {
        (0, process_state_1.marcarInicioProceso)();
        const start = Date.now();
        const fechaDesde = req.query.fechaDesde || req.body?.fechaDesde;
        const fechaHasta = req.query.fechaHasta || req.body?.fechaHasta;
        let conditions = [];
        if (fechaDesde) {
            conditions.push(`CAST(fecha_proceso AS DATE) >= '${fechaDesde.replace(/'/g, "''")}'`);
        }
        if (fechaHasta) {
            conditions.push(`CAST(fecha_proceso AS DATE) <= '${fechaHasta.replace(/'/g, "''")}'`);
        }
        let sqlQuery = "SELECT * FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora]";
        if (conditions.length > 0) {
            sqlQuery += " WHERE " + conditions.join(" AND ");
        }
        sqlQuery += " ORDER BY fecha_proceso DESC";
        console.log("ℹ️ [Modo Solo Consulta] Leyendo datos de bitácora por rango de fechas:", sqlQuery);
        const result = await (0, db_client_1.executeQuery)(sqlQuery);
        const durationMs = Date.now() - start;
        const logs = [
            {
                timestamp: new Date().toISOString(),
                message: `📊 Consulta por rango de fechas realizada con éxito (${result?.recordset?.length || 0} registros en ${durationMs}ms)`,
                type: "info",
            },
        ];
        ultimaEjecucion = {
            fecha: new Date().toISOString(),
            success: true,
            processedCount: result?.recordset?.length || 0,
            approvedCount: 0,
            rejectedCount: 0,
            pendingCount: 0,
            manualCount: 0,
            logs,
            sentMails: [],
        };
        (0, process_state_1.marcarFinProceso)();
        return res.json({
            success: true,
            mode: "real_read_only",
            durationMs,
            recordset: result?.recordset || [],
            output: {},
            logs,
            message: "Consulta realizada con éxito (Modo Solo Lectura: No se ejecutó ningún procedimiento almacenado de modificación).",
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/facturas/ejecutar:", error);
        (0, process_state_1.marcarFinProceso)();
        return res.status(500).json({
            success: false,
            message: error.message || "Error al consultar los datos",
        });
    }
});
// 6. GET /api/facturas/estado
app.get("/api/facturas/estado", (req, res) => {
    const estado = (0, process_state_1.getEstadoCompleto)();
    return res.json({
        success: true,
        ...estado,
    });
});
// 7. GET /api/facturas/detener
app.get("/api/facturas/detener", (req, res) => {
    const estado = (0, process_state_1.getEstadoCompleto)();
    return res.json({
        success: true,
        ...estado,
        mensaje: estado.procesoActivo
            ? `El proceso de facturación está actualmente en ejecución (${estado.tiempoEjecucionSegundos} segundos)`
            : "No hay ningún proceso activo en este momento",
    });
});
// 8. POST /api/facturas/detener
app.post("/api/facturas/detener", async (req, res) => {
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        console.log(`[API Detener] Solicitando detención del proceso RPA. Modo Simulación: ${isSimulated}`);
        if (!(0, process_state_1.getProcesoActivo)()) {
            return res.status(400).json({
                success: false,
                message: "No hay ningún proceso activo para detener en este momento.",
            });
        }
        if (isSimulated) {
            (0, process_state_1.solicitarDetencionProceso)();
            console.log("[API Detener] Proceso detenido por usuario en modo simulación");
            return res.json({
                success: true,
                mode: "simulation",
                message: "El proceso de facturación ha sido detenido correctamente (modo simulación).",
                detenidoEn: new Date().toISOString(),
            });
        }
        else {
            console.log("[API Detener] Deteniendo proceso en modo real...");
            await new Promise(resolve => setTimeout(resolve, 500));
            (0, process_state_1.solicitarDetencionProceso)();
            return res.json({
                success: true,
                mode: "real",
                message: "La solicitud de detención ha sido enviada. El proceso se detendrá en el próximo ciclo.",
                detenidoEn: new Date().toISOString(),
            });
        }
    }
    catch (error) {
        console.error("❌ Error en API /api/facturas/detener:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error interno al intentar detener el proceso RPA",
        });
    }
});
// DELETE /api/facturas/detener
app.delete("/api/facturas/detener", (req, res) => {
    (0, process_state_1.resetearEstadoProceso)();
    return res.json({
        success: true,
        message: "Estado del proceso reseteado correctamente",
    });
});
// 9. POST /api/facturas/accion-manual
app.post("/api/facturas/accion-manual", async (req, res) => {
    try {
        const { folio, tipoDocumento, accion, motivo } = req.body;
        if (!folio || !tipoDocumento || !accion) {
            return res.status(400).json({
                success: false,
                message: "Parámetros 'folio', 'tipoDocumento' y 'accion' son requeridos."
            });
        }
        console.log(`[API Acción Manual] Procesando consulta para Folio: ${folio}, Acción: ${accion}`);
        let rutEmisor = "";
        let record = null;
        try {
            console.log(`🔌 [Modo Solo Consulta] Buscando registro en bitácora para Folio: ${folio}, Tipo: ${tipoDocumento}...`);
            const queryResult = await (0, db_client_1.executeQuery)(`SELECT TOP 1 * FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora] WHERE folio_documento = @p0 AND tipo_documento = @p1`, [folio, tipoDocumento]);
            if (queryResult?.recordset?.length > 0) {
                record = queryResult.recordset[0];
                rutEmisor = record.rut_proveedor;
                console.log(`✅ Registro consultado con éxito en bitácora. RUT proveedor: ${rutEmisor}`);
            }
        }
        catch (dbErr) {
            console.error("❌ Error al consultar la bitácora:", dbErr);
        }
        console.log(`ℹ️ [Modo Solo Consulta] Petición procesada sin ejecutar procedimientos almacenados de modificación en SQL Server.`);
        return res.json({
            success: true,
            mode: "real_read_only",
            record,
            message: `Consulta realizada con éxito para Folio ${folio}. (Modo Solo Lectura: No se ejecutaron modificaciones en la base de datos).`,
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/facturas/accion-manual:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error al consultar acción manual",
        });
    }
});
// 11. GET /api/oficore/stats
app.get("/api/oficore/stats", async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const fechaDesde = req.query.fechaDesde || `${currentYear}-01-01`;
        const fechaHasta = req.query.fechaHasta || `${currentYear}-12-31`;
        const fDesdeClean = fechaDesde.replace(/-/g, "");
        const fHastaClean = fechaHasta.replace(/-/g, "");
        console.log(`🔌 [OFICORE] Consultando incidencias REALES desde base de datos. Desde: ${fDesdeClean}, Hasta: ${fHastaClean}`);
        const qDetalleTecnicos = `
      SELECT 
        incb.id_incidencia, 
        incb.codigo_cliente, 
        incb.contacto_nombre,
        incb.id_area,
        COALESCE(
          ar.descripcion_area,
          (SELECT TOP 1 ar_user.descripcion_area 
           FROM MDA.area_usuario au 
           INNER JOIN MDA.area_responsable ar_user ON (au.id_area = ar_user.id_area) 
           WHERE au.usuario_codigo = ISNULL(NULLIF(LTRIM(RTRIM(indt.usuario_codigo)), ''), incb.usuario_codigo)
          ),
          'TECNOLOGÍA'
        ) as area_nombre,
        indt.fecha_detalle, 
        indt.id_accion, 
        ISNULL(NULLIF(LTRIM(RTRIM(indt.usuario_codigo)), ''), ISNULL(NULLIF(LTRIM(RTRIM(incb.usuario_codigo)), ''), 'Sin Asignar')) as tecnico,
        acc.descripcion as estado_descripcion
      FROM MDA.incidencia incb
      INNER JOIN MDA.incidencia_detalle as indt ON (indt.id_incidencia = incb.id_incidencia)
      LEFT JOIN MDA.accion acc ON (acc.id_accion = indt.id_accion)
      LEFT JOIN MDA.area_responsable ar ON (ar.id_area = incb.id_area)
      WHERE cast(indt.fecha_detalle as date) >= cast('${fDesdeClean}' as date) 
      AND cast(indt.fecha_detalle as date) <= cast('${fHastaClean}' as date)
      ORDER BY indt.fecha_detalle DESC
    `;
        console.log(`🔌 [OFICORE] Query:`, qDetalleTecnicos);
        const resDetalles = await (0, db_client_1.executeQuery)(qDetalleTecnicos);
        console.log(`✅ [OFICORE] ${resDetalles.recordset?.length || 0} registros encontrados en base de datos REAL`);
        const allRecords = resDetalles.recordset || [];
        const totalTickets = allRecords.length;
        const ticketsResueltos = allRecords.filter((r) => r.id_accion === 5).length;
        const ticketsPendientes = totalTickets - ticketsResueltos;
        const estadosCount = {};
        allRecords.forEach((r) => {
            const key = r.id_accion?.toString() || 'null';
            estadosCount[key] = (estadosCount[key] || 0) + 1;
        });
        console.log(`📊 [OFICORE] Estadísticas: Total=${totalTickets}, Resueltos=${ticketsResueltos}, Pendientes=${ticketsPendientes}`);
        return res.json({
            success: true,
            mode: "real",
            stats: {
                ingresadas: totalTickets,
                resueltas: ticketsResueltos,
                pendientes: ticketsPendientes,
            },
            detalles: allRecords,
            count: totalTickets,
            estados: estadosCount,
            source: "SQL Server REAL - MDA.incidencia con MDA.accion"
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/oficore/stats:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener estadísticas de OFICORE: " + error.message,
            detalles: [],
            count: 0
        });
    }
});
// 12. GET /api/ofitec/stats - ESTADÍSTICAS DE OFITEC (CORREGIDO)
app.get("/api/ofitec/stats", async (req, res) => {
    try {
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        const fDesdeClean = fechaDesde.replace(/-/g, "");
        const fHastaClean = fechaHasta.replace(/-/g, "");
        console.log(`🔌 [OFITEC] Consultando datos REALES desde base de datos.`);
        // ============================================================
        // CONSULTA: Obtener LLA_ESTADO y LLA_CORRELATIVO (con LLA_FEC_LLAMADA para filtro)
        // ============================================================
        let qData = `
      SELECT 
        L.LLA_ESTADO,
        E.PAR_DESCRIPCION AS LLA_ESTADO_DESC,
        L.LLA_CORRELATIVO,
        L.LLA_FEC_LLAMADA
      FROM OFITEC.dbo.SAST_LLAMADA L
      LEFT JOIN OFITEC.dbo.VT_ESTADO_LLAMADAS E ON L.LLA_ESTADO = E.PAR_COD_ALF
      WHERE 1=1
    `;
        if (fDesdeClean && fHastaClean) {
            qData += ` AND CAST(LLA_FEC_LLAMADA AS DATE) >= CAST('${fDesdeClean}' AS DATE) 
                 AND CAST(LLA_FEC_LLAMADA AS DATE) <= CAST('${fHastaClean}' AS DATE)`;
        }
        else if (fDesdeClean) {
            qData += ` AND CAST(LLA_FEC_LLAMADA AS DATE) >= CAST('${fDesdeClean}' AS DATE)`;
        }
        else if (fHastaClean) {
            qData += ` AND CAST(LLA_FEC_LLAMADA AS DATE) <= CAST('${fHastaClean}' AS DATE)`;
        }
        qData += ` ORDER BY LLA_FEC_LLAMADA DESC`;
        console.log(`🔌 [OFITEC] Query:`, qData);
        const result = await (0, db_client_1.executeQuery)(qData);
        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                mode: "real",
                message: "⚠️ No se encontraron registros en OFITEC.dbo.SAST_LLAMADA para el periodo seleccionado.",
                detalles: [],
                count: 0
            });
        }
        const data = result.recordset;
        const totalRegistros = data.length;
        console.log(`✅ [OFITEC] ${totalRegistros} registros encontrados`);
        // ============================================================
        // ESTADÍSTICAS GENERALES - SEGÚN LA QUERY AJUSTADA
        // ============================================================
        // Tickets Ingresados = LLA_CORRELATIVO = '1'
        const ingresadas = data.filter((c) => c.LLA_CORRELATIVO === "1" || c.LLA_CORRELATIVO === 1).length;
        const resolvedStatuses = ['4', '24', '6', '8', '9', '15', '16', '7'];
        // Tickets Resueltos
        const resueltas = data.filter((c) => {
            const est = c.LLA_ESTADO?.toString().trim();
            return resolvedStatuses.includes(est);
        }).length;
        // Tickets Pendientes = Ingresadas - Resueltas
        const pendientes = Math.max(0, ingresadas - resueltas);
        // Mapeo detallado de estados
        const enProceso = data.filter((c) => {
            const est = c.LLA_ESTADO?.toString().trim();
            return ['1', '2', '17', '20', '5', '30'].includes(est);
        }).length;
        const finalizado = data.filter((c) => {
            const est = c.LLA_ESTADO?.toString().trim();
            return ['4', '24'].includes(est);
        }).length;
        const anulado = data.filter((c) => {
            const est = c.LLA_ESTADO?.toString().trim();
            return ['8', '9'].includes(est);
        }).length;
        const incompleto = data.filter((c) => {
            const est = c.LLA_ESTADO?.toString().trim();
            return ['3', '10', '22', '33'].includes(est);
        }).length;
        const cancelado = data.filter((c) => {
            const est = c.LLA_ESTADO?.toString().trim();
            return ['11', '12'].includes(est);
        }).length;
        // Última actividad
        let lastActivity = "No hay datos";
        if (data.length > 0) {
            const dates = data.map((e) => e.LLA_FEC_LLAMADA).filter(Boolean);
            if (dates.length > 0) {
                let maxTime = 0;
                dates.forEach((d) => {
                    const t = new Date(d).getTime();
                    if (t > maxTime)
                        maxTime = t;
                });
                const latestDate = new Date(maxTime);
                lastActivity = (0, date_fns_1.format)(latestDate, "dd/MM/yyyy HH:mm");
            }
        }
        // ============================================================
        // RESPUESTA
        // ============================================================
        return res.json({
            success: true,
            mode: "real",
            stats: {
                ingresadas,
                resueltas,
                pendientes,
                enProceso,
                finalizado,
                anulado,
                incompleto,
                cancelado,
                lastActivity
            },
            detalles: data,
            count: totalRegistros,
            source: "SQL Server REAL - OFITEC.dbo.SAST_LLAMADA"
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/ofitec/stats:", error);
        return res.status(500).json({
            success: false,
            mode: "real",
            message: "❌ Error al consultar la base de datos OFITEC: " + error.message,
            detalles: [],
            count: 0
        });
    }
});
// 12.8. GET /api/monitor/ofitec
app.get("/api/monitor/ofitec", async (req, res) => {
    const dbs = ["SGCX", "OFITEC", "OFI_WEB", "STUEDEMANNSA", "STUDEMANNSA"];
    const isSimulated = (0, db_client_1.isSimulationMode)();
    const dbStatus = {
        SGCX: false,
        OFITEC: false,
        OFI_WEB: false,
        STUEDEMANNSA: false,
        STUDEMANNSA: false
    };
    if (isSimulated) {
        dbStatus.SGCX = true;
        dbStatus.OFITEC = true;
        dbStatus.OFI_WEB = true;
        dbStatus.STUEDEMANNSA = true;
        dbStatus.STUDEMANNSA = true;
    }
    else {
        try {
            // Consultamos sys.databases globalmente para evitar lanzar errores de objeto no encontrado (Error 208)
            const result = await (0, db_client_1.executeQuery)(`SELECT name, HAS_DBACCESS(name) as has_access FROM sys.databases`);
            const existingDbs = result?.recordset || [];
            for (const dbKey of dbs) {
                // Coincidencia flexible si existe el nombre exacto, con prefijo THE_COOLER_, o variante de ortografía STUEDEMANNSA/STUDEMANNSA
                const match = existingDbs.find((row) => {
                    const dbNameUpper = (row.name || "").toUpperCase();
                    const keyUpper = dbKey.toUpperCase();
                    const isMatch = dbNameUpper === keyUpper ||
                        dbNameUpper === `THE_COOLER_${keyUpper}` ||
                        dbNameUpper.includes(keyUpper) ||
                        (keyUpper.includes("STUDEMAN") && dbNameUpper.includes("STUDEMAN"));
                    return isMatch && row.has_access === 1;
                });
                dbStatus[dbKey] = !!match;
            }
            // Si STUEDEMANNSA o STUDEMANNSA es accesible, marcar ambas como true para mantener compatibilidad
            if (dbStatus.STUEDEMANNSA || dbStatus.STUDEMANNSA) {
                dbStatus.STUEDEMANNSA = true;
                dbStatus.STUDEMANNSA = true;
            }
        }
        catch (err) {
            console.error("❌ Error al verificar disponibilidad de bases de datos OFITEC:", err?.message || err);
            for (const dbKey of dbs) {
                dbStatus[dbKey] = false;
            }
        }
    }
    // OFITEC se considera disponible si al menos una de las bases principales (OFITEC, SGCX o STUEDEMANNSA) está disponible
    const disponible = dbStatus.OFITEC === true || dbStatus.SGCX === true || dbStatus.STUEDEMANNSA === true || dbStatus.STUDEMANNSA === true;
    return res.json({
        servicio: "OFITEC",
        disponible: disponible,
        basesDatos: dbStatus
    });
});
// 12.9. GET /api/sgc/ping
app.get("/api/sgc/ping", async (req, res) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch("https://omitec.cl/ping", { signal: controller.signal });
        clearTimeout(timeoutId);
        const text = await response.text();
        const isPong = response.ok && text.toLowerCase().includes("pong");
        if (isPong) {
            return res.json({
                success: true,
                status: "online",
                isAvailable: true,
                pong: true,
                message: text.trim(),
                timestamp: new Date().toISOString()
            });
        }
        else {
            return res.json({
                success: false,
                status: "offline",
                isAvailable: false,
                pong: false,
                message: text.trim() || `HTTP status ${response.status}`,
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        console.error("❌ Error al realizar ping a https://omitec.cl/ping:", error?.message || error);
        return res.json({
            success: false,
            status: "offline",
            isAvailable: false,
            pong: false,
            message: error?.message || "Error al conectar con https://omitec.cl/ping",
            timestamp: new Date().toISOString()
        });
    }
});
// 13. GET /api/sgc/stats
app.get("/api/sgc/stats", async (req, res) => {
    try {
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        // Si no se especifican fechas, poner un rango por defecto (el mes en curso)
        if (!fechaDesde && !fechaHasta) {
            const hoy = new Date();
            const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
            const formatFecha = (d) => d.toISOString().split('T')[0];
            fechaDesde = formatFecha(inicioMes);
            fechaHasta = formatFecha(finMes);
        }
        const fDesdeClean = fechaDesde.replace(/-/g, "");
        const fHastaClean = fechaHasta.replace(/-/g, "");
        console.log(`🔌 [SGC] Consultando datos REALES desde base de datos. Desde: ${fDesdeClean || 'Todas'}, Hasta: ${fHastaClean || 'Todas'}`);
        let whereClause = "";
        if (fDesdeClean && fHastaClean) {
            whereClause = `WHERE cast(fecha_documento as date) >= cast('${fDesdeClean}' as date) 
                     AND cast(fecha_documento as date) <= cast('${fHastaClean}' as date)`;
        }
        else if (fDesdeClean) {
            whereClause = `WHERE cast(fecha_documento as date) >= cast('${fDesdeClean}' as date)`;
        }
        else if (fHastaClean) {
            whereClause = `WHERE cast(fecha_documento as date) <= cast('${fHastaClean}' as date)`;
        }
        const sgcQuery = `
      SELECT 
        tipo_de_documento,
        SISTEMA_ORIGEN,
        tipo_de_venta,
        TIPO_DOCUMENTO_ORIGEN,
        fecha_documento,
        cantidad,
        cast(null as varchar(255)) as observacion
      FROM [CONTROLGESTION].[REPOSITORIO].[VT_DATOS_FACTURAS_GUIAS]
      ${whereClause}
      ORDER BY fecha_documento DESC
    `;
        let pickingWhere = "";
        if (fDesdeClean && fHastaClean) {
            pickingWhere = `WHERE c.Pickc_Fecha_Picking >= cast('${fDesdeClean}' as date) 
                      AND c.Pickc_Fecha_Picking <= cast('${fHastaClean}' as date)`;
        }
        else if (fDesdeClean) {
            pickingWhere = `WHERE c.Pickc_Fecha_Picking >= cast('${fDesdeClean}' as date)`;
        }
        else if (fHastaClean) {
            pickingWhere = `WHERE c.Pickc_Fecha_Picking <= cast('${fHastaClean}' as date)`;
        }
        const sgcPickingQuery = `
      SELECT TOP 100
        'PICKING' as tipo_de_documento,
        isnull(c.Pickc_Usuario, 'SGC') as SISTEMA_ORIGEN,
        'picking' as tipo_de_venta,
        'PICKING' as TIPO_DOCUMENTO_ORIGEN,
        c.Pickc_Fecha_Picking as fecha_documento,
        1 as cantidad,
        'Folio #' + cast(c.Pickc_Folio_Picking as varchar) + ' - Cliente: ' + isnull(c.Pickc_Rut_Cliente, 'Sin Cliente') + ' - Estado: ' + 
          case c.Pickc_Estado 
            when 0 then 'Pendiente' 
            when 1 then 'En Proceso' 
            when 2 then 'Finalizado' 
            when 4 then 'Anulado' 
            else 'Desconocido' 
          end as observacion
      FROM SGCX.dbo.Inv_Picking_Cabecera c
      ${pickingWhere}
      ORDER BY c.Pickc_Fecha_Picking DESC
    `;
        console.log(`🔌 [SGC] Queries:`, { sgcQuery, sgcPickingQuery });
        const [sgcRes, pickingRes] = await Promise.all([
            (0, db_client_1.executeQuery)(sgcQuery).catch(err => {
                console.error("Error executing sgcQuery:", err);
                return { recordset: [] };
            }),
            (0, db_client_1.executeQuery)(sgcPickingQuery).catch(err => {
                console.error("Error executing sgcPickingQuery:", err);
                return { recordset: [] };
            })
        ]);
        const documents = sgcRes.recordset || [];
        const pickings = pickingRes.recordset || [];
        const mergedData = [...documents, ...pickings].sort((a, b) => {
            return new Date(b.fecha_documento).getTime() - new Date(a.fecha_documento).getTime();
        });
        if (mergedData.length === 0) {
            return res.status(404).json({
                success: false,
                mode: "real",
                message: "⚠️ No se encontraron registros en la base de datos SGC.",
                data: [],
                count: 0
            });
        }
        console.log(`✅ [SGC] ${mergedData.length} registros totales encontrados (Documentos: ${documents.length}, Pickings: ${pickings.length})`);
        const totalDocumentos = mergedData.length;
        const picking = mergedData.filter((r) => r.tipo_de_venta?.toLowerCase() === "picking").length || 0;
        const od = mergedData.filter((r) => r.tipo_de_venta?.toLowerCase() === "od").length || 0;
        return res.json({
            success: true,
            mode: "real",
            data: mergedData,
            count: totalDocumentos,
            stats: {
                total: totalDocumentos,
                picking,
                od,
                otros: totalDocumentos - picking - od
            },
            source: "SQL Server REAL - CONTROLGESTION.REPOSITORIO.VT_DATOS_FACTURAS_GUIAS & SGCX.dbo.Inv_Picking_Cabecera"
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/sgc/stats:", error);
        return res.status(500).json({
            success: false,
            mode: "real",
            message: "❌ Error al consultar la base de datos SGC: " + error.message,
            data: [],
            count: 0
        });
    }
});
// 13.5. GET /api/sgc/picking-stats
app.get("/api/sgc/picking-stats", async (req, res) => {
    try {
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        const hours = parseInt(req.query.hours || '24');
        // Si no se especifican fechas, poner un rango por defecto (el mes en curso)
        if (!fechaDesde && !fechaHasta) {
            const hoy = new Date();
            const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
            const formatFecha = (d) => d.toISOString().split('T')[0];
            fechaDesde = formatFecha(inicioMes);
            fechaHasta = formatFecha(finMes);
        }
        const fDesdeClean = fechaDesde.replace(/-/g, "");
        const fHastaClean = fechaHasta.replace(/-/g, "");
        console.log(`🔌 [SGC Picking] Consultando base de datos SGCX. Desde: ${fDesdeClean}, Hasta: ${fHastaClean}, Horas Alerta: ${hours}`);
        // Query 1: KPIs de volumen y totales
        const kpisQuery = `
      DECLARE @MaxDate datetime = (SELECT ISNULL(MAX(Pickc_Fecha_Picking), GETDATE()) FROM SGCX.dbo.Inv_Picking_Cabecera);
      SELECT 
        COUNT(DISTINCT CASE WHEN Pickc_Fecha_Picking >= DATEADD(hour, -24, @MaxDate) THEN Pickc_Folio_Picking END) as vol_24h,
        COUNT(DISTINCT CASE WHEN Pickc_Fecha_Picking >= DATEADD(day, -7, @MaxDate) THEN Pickc_Folio_Picking END) as vol_semana,
        COUNT(DISTINCT CASE WHEN Pickc_Fecha_Picking >= DATEADD(day, -30, @MaxDate) THEN Pickc_Folio_Picking END) as vol_mes,
        SUM(CASE WHEN Pickc_Estado = 0 THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN Pickc_Estado = 1 THEN 1 ELSE 0 END) as en_proceso,
        SUM(CASE WHEN Pickc_Estado = 2 THEN 1 ELSE 0 END) as finalizados,
        SUM(CASE WHEN Pickc_Usuario IS NULL OR LOWER(Pickc_Usuario) IN ('sgc', 'system', 'ws', 'webservice', 'auto', 'automatizador', 'rpa') OR LOWER(Pickc_Usuario) LIKE '%sgc%' THEN 1 ELSE 0 END) as automaticos,
        SUM(CASE WHEN Pickc_Usuario IS NOT NULL AND LOWER(Pickc_Usuario) NOT IN ('sgc', 'system', 'ws', 'webservice', 'auto', 'automatizador', 'rpa') AND LOWER(Pickc_Usuario) NOT LIKE '%sgc%' THEN 1 ELSE 0 END) as manuales,
        SUM(CASE WHEN Pickc_Estado = 0 AND Pickc_Fecha_Picking <= DATEADD(hour, -${hours}, GETDATE()) THEN 1 ELSE 0 END) as total_alertas,
        SUM(CASE WHEN Pickc_Ticket_Mesa_Ayuda IS NOT NULL AND Pickc_Ticket_Mesa_Ayuda > 0 AND Pickc_Fecha_Picking >= DATEADD(month, -3, GETDATE()) THEN 1 ELSE 0 END) as total_tickets
      FROM SGCX.dbo.Inv_Picking_Cabecera
      WHERE Pickc_Fecha_Picking >= cast('${fDesdeClean}' as date) 
        AND Pickc_Fecha_Picking <= cast('${fHastaClean}' as date)
    `;
        // Query 2: Productividad por estado
        const productivityQuery = `
      SELECT 
        Pickc_Estado as estado,
        COUNT(DISTINCT Pickc_Folio_Picking) as count
      FROM SGCX.dbo.Inv_Picking_Cabecera
      WHERE Pickc_Fecha_Picking >= cast('${fDesdeClean}' as date) 
        AND Pickc_Fecha_Picking <= cast('${fHastaClean}' as date)
      GROUP BY Pickc_Estado
      ORDER BY Pickc_Estado
    `;
        // Query 3: Top 5 productos con mayor movimiento
        const topProductsQuery = `
      SELECT TOP 5
        d.Pickd_Parte_Despacho as producto,
        SUM(d.Pickd_Cantidad) as cantidad,
        COUNT(DISTINCT d.Pickd_Folio_Picking) as transacciones
      FROM SGCX.dbo.Inv_Picking_Detalle d
      INNER JOIN SGCX.dbo.Inv_Picking_Cabecera c ON d.Pickd_Folio_Picking = c.Pickc_Folio_Picking
      WHERE c.Pickc_Fecha_Picking >= cast('${fDesdeClean}' as date) 
        AND c.Pickc_Fecha_Picking <= cast('${fHastaClean}' as date)
      GROUP BY d.Pickd_Parte_Despacho
      ORDER BY cantidad DESC
    `;
        // Query 4: Conteo por período (Diario, Semanal, Mensual)
        const byDayQuery = `
      SELECT 
        CAST(Pickc_Fecha_Picking AS DATE) as fecha,
        COUNT(DISTINCT Pickc_Folio_Picking) as count
      FROM SGCX.dbo.Inv_Picking_Cabecera
      WHERE Pickc_Fecha_Picking >= cast('${fDesdeClean}' as date) 
        AND Pickc_Fecha_Picking <= cast('${fHastaClean}' as date)
      GROUP BY CAST(Pickc_Fecha_Picking AS DATE)
      ORDER BY fecha
    `;
        const byWeekQuery = `
      SELECT 
        DATEPART(year, Pickc_Fecha_Picking) as anio,
        DATEPART(week, Pickc_Fecha_Picking) as semana,
        MIN(Pickc_Fecha_Picking) as fecha_inicio,
        COUNT(DISTINCT Pickc_Folio_Picking) as count
      FROM SGCX.dbo.Inv_Picking_Cabecera
      WHERE Pickc_Fecha_Picking >= cast('${fDesdeClean}' as date) 
        AND Pickc_Fecha_Picking <= cast('${fHastaClean}' as date)
      GROUP BY DATEPART(year, Pickc_Fecha_Picking), DATEPART(week, Pickc_Fecha_Picking)
      ORDER BY anio, semana
    `;
        const byMonthQuery = `
      SELECT 
        DATEPART(year, Pickc_Fecha_Picking) as anio,
        DATEPART(month, Pickc_Fecha_Picking) as mes,
        COUNT(DISTINCT Pickc_Folio_Picking) as count
      FROM SGCX.dbo.Inv_Picking_Cabecera
      WHERE Pickc_Fecha_Picking >= cast('${fDesdeClean}' as date) 
        AND Pickc_Fecha_Picking <= cast('${fHastaClean}' as date)
      GROUP BY DATEPART(year, Pickc_Fecha_Picking), DATEPART(month, Pickc_Fecha_Picking)
      ORDER BY anio, mes
    `;
        // Query 5: Mesa de ayuda (Tickets)
        const ticketsQuery = `
      SELECT TOP 20
        c.Pickc_Folio_Picking as folio,
        c.Pickc_Fecha_Picking as fecha,
        c.Pickc_Estado as estado,
        c.Pickc_Ticket_Mesa_Ayuda as ticket,
        c.Pickc_Usuario as usuario,
        clnt.NomAux as cliente
      FROM SGCX.dbo.Inv_Picking_Cabecera c
      LEFT JOIN STUEDEMANNSA.softland.cwtauxi clnt ON c.Pickc_Rut_Cliente = clnt.CodAux
      WHERE c.Pickc_Ticket_Mesa_Ayuda IS NOT NULL 
        AND c.Pickc_Ticket_Mesa_Ayuda > 0
        AND c.Pickc_Fecha_Picking >= DATEADD(month, -3, GETDATE())
      ORDER BY c.Pickc_Fecha_Picking DESC
    `;
        // Query 6: Alertas de pickings pendientes
        const alertsQuery = `
      SELECT TOP 50
        c.Pickc_Folio_Picking as folio,
        c.Pickc_Fecha_Picking as fecha,
        c.Pickc_Usuario as usuario,
        c.Pickc_Comuna as comuna,
        clnt.NomAux as cliente,
        DATEDIFF(hour, c.Pickc_Fecha_Picking, GETDATE()) as horas_pendiente
      FROM SGCX.dbo.Inv_Picking_Cabecera c
      LEFT JOIN STUEDEMANNSA.softland.cwtauxi clnt ON c.Pickc_Rut_Cliente = clnt.CodAux
      WHERE c.Pickc_Estado = 0 
        AND c.Pickc_Fecha_Picking <= DATEADD(hour, -${hours}, GETDATE())
      ORDER BY c.Pickc_Fecha_Picking ASC
    `;
        const [kpisRes, productivityRes, topProductsRes, byDayRes, byWeekRes, byMonthRes, ticketsRes, alertsRes] = await Promise.all([
            (0, db_client_1.executeQuery)(kpisQuery),
            (0, db_client_1.executeQuery)(productivityQuery),
            (0, db_client_1.executeQuery)(topProductsQuery),
            (0, db_client_1.executeQuery)(byDayQuery),
            (0, db_client_1.executeQuery)(byWeekQuery),
            (0, db_client_1.executeQuery)(byMonthQuery),
            (0, db_client_1.executeQuery)(ticketsQuery),
            (0, db_client_1.executeQuery)(alertsQuery)
        ]);
        return res.json({
            success: true,
            mode: "real",
            kpis: kpisRes.recordset[0] || { vol_24h: 0, vol_semana: 0, vol_mes: 0, total_alertas: 0, total_tickets: 0 },
            productivity: productivityRes.recordset || [],
            topProducts: topProductsRes.recordset || [],
            byDay: byDayRes.recordset || [],
            byWeek: byWeekRes.recordset || [],
            byMonth: byMonthRes.recordset || [],
            tickets: ticketsRes.recordset || [],
            alerts: alertsRes.recordset || []
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/sgc/picking-stats:", error);
        return res.status(500).json({
            success: false,
            mode: "real",
            message: "❌ Error al consultar las estadísticas de picking de la base de datos SGCX: " + error.message,
        });
    }
});
// 13.6. GET /api/sgc/contratos-stats
app.get("/api/sgc/contratos-stats", async (req, res) => {
    try {
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        let querySetup = "";
        if (fechaDesde && fechaHasta) {
            const fDesdeClean = fechaDesde.replace(/-/g, "");
            const fHastaClean = fechaHasta.replace(/-/g, "");
            querySetup = `
        DECLARE @StartDate datetime = cast('${fDesdeClean}' as date);
        DECLARE @EndDate datetime = cast('${fHastaClean}' as date);
      `;
            console.log(`🔌 [SGC Contratos] Filtrando por rango de fechas en SGCX: ${fDesdeClean} a ${fHastaClean}`);
        }
        else {
            querySetup = `
        DECLARE @EndDate datetime = GETDATE();
        DECLARE @StartDate datetime = DATEADD(day, -365, @EndDate);
      `;
            console.log("🔌 [SGC Contratos] Rango por defecto (último año desde hoy)...");
        }
        const statsQuery = `
      ${querySetup}
      DECLARE @CurrentMonthStart datetime = DATEADD(month, DATEDIFF(month, 0, @EndDate), 0);
      DECLARE @LastMonthStart datetime = DATEADD(month, -1, @CurrentMonthStart);
      DECLARE @NextMonthStart datetime = DATEADD(month, 1, @CurrentMonthStart);

      DECLARE @CurrentQuarterStart datetime = DATEADD(quarter, DATEDIFF(quarter, 0, @EndDate), 0);
      DECLARE @LastQuarterStart datetime = DATEADD(quarter, -1, @CurrentQuarterStart);
      DECLARE @NextQuarterStart datetime = DATEADD(quarter, 1, @CurrentQuarterStart);

      SELECT 
        -- Summary
        (SELECT COUNT(*) FROM SGCX.dbo.CON_CONTRATO WHERE CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate) as total,
        (SELECT COUNT(*) FROM SGCX.dbo.CON_CONTRATO WHERE CON_ESTADO_SERV = 'VIGENTE' AND CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate) as active,
        (SELECT SUM(CASE WHEN CON_ESTADO_SERV = 'VIGENTE' THEN (CASE WHEN CON_MONEDA = '1' THEN CON_VALOR_CONTRATO ELSE CON_VALOR_CONTRATO * ISNULL(CON_TIPO_CAMBIO, 1) END) ELSE 0 END) FROM SGCX.dbo.CON_CONTRATO WHERE CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate) as portfolio_value,
        (SELECT AVG(CASE WHEN CON_ESTADO_SERV = 'VIGENTE' THEN (CASE WHEN CON_MONEDA = '1' THEN CON_VALOR_CONTRATO ELSE CON_VALOR_CONTRATO * ISNULL(CON_TIPO_CAMBIO, 1) END) ELSE NULL END) FROM SGCX.dbo.CON_CONTRATO WHERE CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate) as avg_value,

        -- Alerts
        (SELECT COUNT(*) FROM SGCX.dbo.CON_CONTRATO WHERE CON_ESTADO_SERV = 'VIGENTE' AND CON_FECHA_TERMINO >= @EndDate AND CON_FECHA_TERMINO <= DATEADD(day, 7, @EndDate) AND CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate) as vencer_7_dias,
        (SELECT COUNT(*) FROM SGCX.dbo.CON_CONTRATO WHERE CON_ESTADO_SERV = 'VIGENTE' AND (CON_FIRMA_CONTRATO IS NULL OR CON_FIRMA_CONTRATO = '1900-01-01' OR CON_FIRMA_CONTRATO = '1900-01-01T00:00:00.000Z') AND CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate) as sin_firma,
        (SELECT COUNT(*) FROM SGCX.dbo.CON_CONTRATO WHERE CON_ESTADO_SERV = 'VIGENTE' AND (CON_VALOR_CONTRATO IS NULL OR CON_VALOR_CONTRATO <= 0) AND CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate) as sin_valor,

        -- Trends
        (SELECT COUNT(*) FROM SGCX.dbo.CON_CONTRATO WHERE CON_FECHA_INGRESO_NEG >= @CurrentMonthStart AND CON_FECHA_INGRESO_NEG < @NextMonthStart) as current_month_qty,
        (SELECT COUNT(*) FROM SGCX.dbo.CON_CONTRATO WHERE CON_FECHA_INGRESO_NEG >= @LastMonthStart AND CON_FECHA_INGRESO_NEG < @CurrentMonthStart) as last_month_qty,
        (
          SELECT AVG(CASE WHEN CON_MONEDA = '1' THEN CON_VALOR_CONTRATO ELSE CON_VALOR_CONTRATO * ISNULL(CON_TIPO_CAMBIO, 1) END)
          FROM SGCX.dbo.CON_CONTRATO
          WHERE CON_FECHA_INGRESO_NEG >= @CurrentQuarterStart AND CON_FECHA_INGRESO_NEG < @NextQuarterStart
        ) as current_quarter_avg,
        (
          SELECT AVG(CASE WHEN CON_MONEDA = '1' THEN CON_VALOR_CONTRATO ELSE CON_VALOR_CONTRATO * ISNULL(CON_TIPO_CAMBIO, 1) END)
          FROM SGCX.dbo.CON_CONTRATO
          WHERE CON_FECHA_INGRESO_NEG >= @LastQuarterStart AND CON_FECHA_INGRESO_NEG < @CurrentQuarterStart
        ) as last_quarter_avg,
        (
          SELECT SUM(CASE WHEN CON_ESTADO_COMERCIAL = 'AP' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)
          FROM SGCX.dbo.CON_CONTRATO
          WHERE CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate
        ) as approval_rate
    `;
        const byMonthQuery = `
      ${querySetup}
      SELECT TOP 12
        YEAR(CON_FECHA_INGRESO_NEG) as anio,
        MONTH(CON_FECHA_INGRESO_NEG) as mes,
        COUNT(*) as count
      FROM SGCX.dbo.CON_CONTRATO
      WHERE CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate
      GROUP BY YEAR(CON_FECHA_INGRESO_NEG), MONTH(CON_FECHA_INGRESO_NEG)
      ORDER BY anio DESC, mes DESC
    `;
        const byCurrencyQuery = `
      ${querySetup}
      SELECT 
        CON_MONEDA as moneda,
        COUNT(*) as count,
        SUM(CASE WHEN CON_MONEDA = '1' THEN CON_VALOR_CONTRATO ELSE CON_VALOR_CONTRATO * ISNULL(CON_TIPO_CAMBIO, 1) END) as val_clp
      FROM SGCX.dbo.CON_CONTRATO
      WHERE CON_ESTADO_SERV = 'VIGENTE'
        AND CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate
      GROUP BY CON_MONEDA
    `;
        const recentQuery = `
      ${querySetup}
      SELECT TOP 15
        CON_FOLIO as folio,
        CON_RUT_CLIENTE as rut_cliente,
        CON_VALOR_CONTRATO as valor,
        CON_MONEDA as moneda,
        CON_TIPO_CAMBIO as tipo_cambio,
        CON_FECHA_INGRESO_NEG as fecha_ingreso,
        CON_ESTADO_SERV as estado_servicio,
        CON_ESTADO_COMERCIAL as estado_comercial,
        CON_RESPONSABLE_INGRESO_NEG as responsable
      FROM SGCX.dbo.CON_CONTRATO
      WHERE CON_FECHA_INGRESO_NEG >= @StartDate AND CON_FECHA_INGRESO_NEG <= @EndDate
      ORDER BY CON_FECHA_INGRESO_NEG DESC
    `;
        const [statsResult, byMonthResult, byCurrencyResult, recentResult] = await Promise.all([
            (0, db_client_1.executeQuery)(statsQuery),
            (0, db_client_1.executeQuery)(byMonthQuery),
            (0, db_client_1.executeQuery)(byCurrencyQuery),
            (0, db_client_1.executeQuery)(recentQuery)
        ]);
        const stats = statsResult?.recordset?.[0] || {
            total: 0,
            active: 0,
            portfolio_value: 0,
            avg_value: 0,
            vencer_7_dias: 0,
            sin_firma: 0,
            sin_valor: 0,
            current_month_qty: 0,
            last_month_qty: 0,
            current_quarter_avg: 0,
            last_quarter_avg: 0,
            approval_rate: 0,
        };
        const byMonth = byMonthResult?.recordset || [];
        const byCurrency = byCurrencyResult?.recordset || [];
        const recentContracts = recentResult?.recordset || [];
        return res.json({
            success: true,
            mode: "real",
            stats,
            byMonth,
            byCurrency,
            recentContracts
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/sgc/contratos-stats:", error);
        return res.status(500).json({
            success: false,
            mode: "real",
            message: "❌ Error al consultar las estadísticas de contratos de la base de datos SGCX: " + error.message,
        });
    }
});
// 13.7. GET /api/sgc/equipos-stats
app.get("/api/sgc/equipos-stats", async (req, res) => {
    try {
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        let querySetup = "";
        if (fechaDesde && fechaHasta) {
            const fDesdeClean = fechaDesde.replace(/-/g, "");
            const fHastaClean = fechaHasta.replace(/-/g, "");
            querySetup = `
        DECLARE @StartDate datetime = cast('${fDesdeClean}' as date);
        DECLARE @EndDate datetime = cast('${fHastaClean}' as date);
      `;
            console.log(`🔌 [SGC Equipos] Filtrando por rango de fechas en SGCX: ${fDesdeClean} a ${fHastaClean}`);
        }
        else {
            querySetup = `
        DECLARE @EndDate datetime = GETDATE();
        DECLARE @StartDate datetime = DATEADD(day, -365, @EndDate);
      `;
            console.log("🔌 [SGC Equipos] Rango por defecto (último año desde hoy)...");
        }
        const summaryQuery = `
      ${querySetup}
      SELECT 
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque WHERE Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate) as total,
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque WHERE Eq_Estado = 1 AND Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate) as active,
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque WHERE (Eq_Estado = 0 OR Eq_ubicacion LIKE '%bodega%' OR Eq_Direccion LIKE '%bodega%') AND Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate) as in_warehouse,
        (SELECT SUM(CASE WHEN Eq_Cargo_Fijo <= 1000 THEN Eq_Cargo_Fijo * 37800 ELSE Eq_Cargo_Fijo END) FROM SGCX.dbo.Eq_Parque WHERE Eq_Estado = 1 AND Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate) as monthly_revenue
    `;
        const alertsQuery = `
      ${querySetup}
      SELECT
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque WHERE Eq_Estado = 1 AND (Eq_Fecha_Lect_Anterior_BN < DATEADD(day, -30, GETDATE()) OR Eq_Fecha_Lect_Anterior_BN IS NULL) AND Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate) as sin_lectura_30,
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque eq JOIN SGCX.dbo.CON_CONTRATO con ON eq.Eq_Folio_Contrato = con.CON_FOLIO WHERE eq.Eq_Estado = 1 AND con.CON_FECHA_TERMINO >= GETDATE() AND con.CON_FECHA_TERMINO <= DATEADD(day, 30, GETDATE()) AND eq.Eq_Fecha_Habilitacion >= @StartDate AND eq.Eq_Fecha_Habilitacion <= @EndDate) as vencer_30,
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque eq LEFT JOIN SGCX.dbo.CON_CONTRATO con ON eq.Eq_Folio_Contrato = con.CON_FOLIO WHERE eq.Eq_Estado = 1 AND (con.CON_ESTADO_SERV <> 'VIGENTE' OR con.CON_ESTADO_SERV IS NULL) AND eq.Eq_Fecha_Habilitacion >= @StartDate AND eq.Eq_Fecha_Habilitacion <= @EndDate) as sin_contrato,
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque WHERE Eq_Estado = 1 AND Eq_lectura_actual_BN > 0 AND Eq_lectura_actual_BN < Eq_Lectura_anterior_BN AND Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate) as lecturas_fallidas
    `;
        const volumeQuery = `
      ${querySetup}
      SELECT 
        AVG(Eq_promcopiado3meses) as avg_bn,
        AVG(Eq_promcopiado3meses_col) as avg_col,
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque WHERE Eq_Estado = 1 AND (Eq_promcopiado3meses + Eq_promcopiado3meses_col) < 100 AND Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate) as low_volume,
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque WHERE Eq_Estado = 1 AND (Eq_promcopiado3meses + Eq_promcopiado3meses_col) = 0 AND Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate) as inactive_3_months
      FROM SGCX.dbo.Eq_Parque
      WHERE Eq_Estado = 1 AND Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate
    `;
        const topModelsQuery = `
      ${querySetup}
      SELECT TOP 5
        ISNULL(NULLIF(PAR_PARTE_EQP, ''), 'MODELO DESCONOCIDO') as modelo,
        COUNT(*) as count
      FROM SGCX.dbo.Eq_Parque
      WHERE Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate
      GROUP BY PAR_PARTE_EQP
      ORDER BY count DESC
    `;
        const geoQuery = `
      ${querySetup}
      SELECT 
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque WHERE Eq_Region = '13' AND Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate) as santiago_count,
        (SELECT COUNT(*) FROM SGCX.dbo.Eq_Parque WHERE (Eq_Region <> '13' OR Eq_Region IS NULL) AND Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate) as regiones_count
    `;
        const topComunasQuery = `
      ${querySetup}
      SELECT TOP 10
        ISNULL(NULLIF(Eq_Comuna, ''), 'OTRA') as comuna,
        COUNT(*) as count
      FROM SGCX.dbo.Eq_Parque
      WHERE Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate
      GROUP BY Eq_Comuna
      ORDER BY count DESC
    `;
        const recentEquiposQuery = `
      ${querySetup}
      SELECT TOP 15
        Eq_Serie as serie,
        Eq_Folio_Contrato as folio_contrato,
        ISNULL(NULLIF(PAR_PARTE_EQP, ''), 'MODELO DESCONOCIDO') as modelo,
        Eq_Fecha_Habilitacion as fecha_habilitacion,
        Eq_ubicacion as ubicacion,
        Eq_Comuna as comuna,
        Eq_Cargo_Fijo as cargo_fijo,
        Eq_Estado as estado,
        Eq_Usuario as usuario
      FROM SGCX.dbo.Eq_Parque
      WHERE Eq_Fecha_Habilitacion >= @StartDate AND Eq_Fecha_Habilitacion <= @EndDate
      ORDER BY Eq_Fecha_Habilitacion DESC
    `;
        const [summaryResult, alertsResult, volumeResult, topModelsResult, geoResult, topComunasResult, recentEquiposResult] = await Promise.all([
            (0, db_client_1.executeQuery)(summaryQuery),
            (0, db_client_1.executeQuery)(alertsQuery),
            (0, db_client_1.executeQuery)(volumeQuery),
            (0, db_client_1.executeQuery)(topModelsQuery),
            (0, db_client_1.executeQuery)(geoQuery),
            (0, db_client_1.executeQuery)(topComunasQuery),
            (0, db_client_1.executeQuery)(recentEquiposQuery)
        ]);
        const summary = summaryResult?.recordset?.[0] || { total: 0, active: 0, in_warehouse: 0, monthly_revenue: 0 };
        const alerts = alertsResult?.recordset?.[0] || { sin_lectura_30: 0, vencer_30: 0, sin_contrato: 0, lecturas_fallidas: 0 };
        const volume = volumeResult?.recordset?.[0] || { avg_bn: 0, avg_col: 0, low_volume: 0, inactive_3_months: 0 };
        const topModels = topModelsResult?.recordset || [];
        const geo = geoResult?.recordset?.[0] || { santiago_count: 0, regiones_count: 0 };
        const topComunas = topComunasResult?.recordset || [];
        const recentEquipos = recentEquiposResult?.recordset || [];
        return res.json({
            success: true,
            mode: "real",
            summary,
            alerts,
            volume,
            topModels,
            geo,
            topComunas,
            recentEquipos
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/sgc/equipos-stats:", error);
        return res.status(500).json({
            success: false,
            mode: "real",
            message: "❌ Error al consultar las estadísticas de equipos de la base de datos SGCX: " + error.message,
        });
    }
});
// 13.8. GET /api/sgc/despachos-stats
app.get("/api/sgc/despachos-stats", async (req, res) => {
    try {
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        // Si no se especifican fechas, usar el rango del año por defecto
        if (!fechaDesde || !fechaHasta) {
            fechaDesde = "2026-01-01";
            fechaHasta = "2026-12-31";
        }
        const parseDateStr = (str) => {
            const clean = str.replace(/-/g, "");
            if (clean.length === 8) {
                return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
            }
            return str;
        };
        const dDesdeStr = parseDateStr(fechaDesde);
        const dHastaStr = parseDateStr(fechaHasta);
        const dDesdeObj = new Date(dDesdeStr);
        const dHastaObj = new Date(dHastaStr);
        let shiftedDesde = dDesdeStr;
        let shiftedHasta = dHastaStr;
        // Desplazamiento de 9 años constantes para el rango 2020+ (2026 -> 2017, 2025 -> 2016)
        if (dHastaObj.getFullYear() >= 2020) {
            const shiftYears = 9;
            const subYears = (d, y) => {
                const newD = new Date(d);
                newD.setFullYear(newD.getFullYear() - y);
                return newD.toISOString().split('T')[0];
            };
            shiftedDesde = subYears(dDesdeObj, shiftYears);
            shiftedHasta = subYears(dHastaObj, shiftYears);
            console.log(`🔌 [SGC Despachos] Mapeando rango de fechas (9 años menos): de [${dDesdeStr} a ${dHastaStr}] a [${shiftedDesde} a ${shiftedHasta}]`);
        }
        else {
            console.log(`🔌 [SGC Despachos] Usando fechas directamente (Rango histórico): de [${dDesdeStr} a ${dHastaStr}]`);
        }
        const querySetup = `
      DECLARE @StartDate datetime = cast('${shiftedDesde.replace(/-/g, "")}' as date);
      DECLARE @EndDate datetime = cast('${shiftedHasta.replace(/-/g, "")}' as date);
    `;
        const kpisQuery = `
      ${querySetup}
      SELECT 
        -- KPIs
        (SELECT COUNT(*) FROM SGCX.dbo.Despacho_All_In WHERE F_EMISION >= CAST(@EndDate AS DATE) AND F_EMISION <= @EndDate) as total_hoy,
        (SELECT COUNT(*) FROM SGCX.dbo.Despacho_All_In WHERE F_EMISION >= DATEADD(day, -7, @EndDate) AND F_EMISION <= @EndDate) as total_semana,
        (SELECT COUNT(*) FROM SGCX.dbo.Despacho_All_In WHERE F_EMISION >= @StartDate AND F_EMISION <= @EndDate) as total_mes,
        
        -- Success rate: ESTADO = 1 is successful, divided by total in the range
        (SELECT 
           CASE WHEN COUNT(*) = 0 THEN 0 
           ELSE ROUND((SUM(CASE WHEN ESTADO = 1 THEN 1.0 ELSE 0.0 END) * 100.0) / COUNT(*), 0) 
           END 
         FROM SGCX.dbo.Despacho_All_In 
         WHERE F_EMISION >= @StartDate AND F_EMISION <= @EndDate
        ) as tasa_exito,
        
        -- Avg time in hours (in the range, filtering outliers where difference > 7 days)
        (SELECT 
           CASE WHEN COUNT(*) = 0 THEN 0
           ELSE ROUND(AVG(CAST(DATEDIFF(minute, 
             CAST(F_EMISION AS DATETIME) + CAST(CAST(HORA AS TIME) AS DATETIME), 
             CAST(FECHA_APRO AS DATETIME) + CAST(CAST(HORA_APRO AS TIME) AS DATETIME)
           ) AS float) / 60.0), 1)
           END
         FROM SGCX.dbo.Despacho_All_In
         WHERE F_EMISION >= @StartDate AND F_EMISION <= @EndDate
           AND FECHA_APRO IS NOT NULL 
           AND HORA_APRO IS NOT NULL 
           AND HORA IS NOT NULL
           AND DATEDIFF(day, F_EMISION, FECHA_APRO) <= 7
        ) as tiempo_promedio,
        
        -- Alerts
        -- 1. Pendientes > 24h
        (SELECT COUNT(*) FROM SGCX.dbo.Despacho_All_In 
         WHERE (ESTADO = 2 OR ESTADO IS NULL) AND F_EMISION >= @StartDate AND F_EMISION <= DATEADD(hour, -24, @EndDate)
        ) as pendientes_24h,
        
        -- 2. Sin aprobar > 48h
        (SELECT COUNT(*) FROM SGCX.dbo.Despacho_All_In 
         WHERE (FECHA_APRO IS NULL OR APROBADOR IS NULL) AND F_EMISION >= @StartDate AND F_EMISION <= DATEADD(hour, -48, @EndDate)
        ) as sin_aprobar_48h,
        
        -- 3. Rechazados hoy
        (SELECT COUNT(*) FROM SGCX.dbo.Despacho_All_In 
         WHERE ESTADO = 4 AND F_EMISION >= CAST(@EndDate AS DATE) AND F_EMISION <= @EndDate
        ) as rechazados_hoy,
        
        -- 4. Sin cliente asignado
        (SELECT COUNT(*) FROM SGCX.dbo.Despacho_All_In 
         WHERE (RUT_CLIENTE IS NULL OR RUT_CLIENTE = '' OR NOMBRE IS NULL OR NOMBRE = '')
           AND F_EMISION >= @StartDate AND F_EMISION <= @EndDate
        ) as sin_cliente
    `;
        const statesQuery = `
      ${querySetup}
      SELECT 
        ISNULL(SUM(CASE WHEN ESTADO = 2 OR ESTADO IS NULL THEN 1 ELSE 0 END), 0) as pendiente,
        ISNULL(SUM(CASE WHEN ESTADO = 0 THEN 1 ELSE 0 END), 0) as en_proceso,
        ISNULL(SUM(CASE WHEN ESTADO = 1 THEN 1 ELSE 0 END), 0) as despachado,
        ISNULL(SUM(CASE WHEN ESTADO = 4 THEN 1 ELSE 0 END), 0) as anulado_rechazado,
        COUNT(*) as total
      FROM SGCX.dbo.Despacho_All_In
      WHERE F_EMISION >= @StartDate AND F_EMISION <= @EndDate
    `;
        const recentQuery = `
      ${querySetup}
      SELECT TOP 25
        ID as id,
        F_EMISION as fecha_emision,
        HORA as hora_emision,
        N_PICKING as n_picking,
        RUT_CLIENTE as rut_cliente,
        NOMBRE as nombre,
        SERIE as serie,
        N_PARTE as n_parte,
        VENDEDOR as vendedor,
        OBSERVACION as observacion,
        ESTADO as estado,
        APROBADOR as aprobador,
        FECHA_APRO as fecha_apro,
        HORA_APRO as hora_apro
      FROM SGCX.dbo.Despacho_All_In
      WHERE F_EMISION >= @StartDate AND F_EMISION <= @EndDate
      ORDER BY ID DESC
    `;
        const byMonthQuery = `
      ${querySetup}
      SELECT 
        YEAR(F_EMISION) as anio,
        MONTH(F_EMISION) as mes,
        COUNT(*) as count
      FROM SGCX.dbo.Despacho_All_In
      WHERE F_EMISION >= @StartDate AND F_EMISION <= @EndDate
      GROUP BY YEAR(F_EMISION), MONTH(F_EMISION)
      ORDER BY anio DESC, mes DESC
    `;
        const [kpisRes, statesRes, recentRes, byMonthRes] = await Promise.all([
            (0, db_client_1.executeQuery)(kpisQuery),
            (0, db_client_1.executeQuery)(statesQuery),
            (0, db_client_1.executeQuery)(recentQuery),
            (0, db_client_1.executeQuery)(byMonthQuery)
        ]);
        const kpis = kpisRes?.recordset?.[0] || {
            total_hoy: 0,
            total_semana: 0,
            total_mes: 0,
            tasa_exito: 0,
            tiempo_promedio: 0,
            pendientes_24h: 0,
            sin_aprobar_48h: 0,
            rechazados_hoy: 0,
            sin_cliente: 0
        };
        const statesData = statesRes?.recordset?.[0] || {
            pendiente: 0,
            en_proceso: 0,
            despachado: 0,
            anulado_rechazado: 0,
            total: 0
        };
        const totalStates = statesData.total || 1;
        const states = {
            pendiente: statesData.pendiente || 0,
            pendiente_pct: Math.round(((statesData.pendiente || 0) / totalStates) * 100),
            en_proceso: statesData.en_proceso || 0,
            en_proceso_pct: Math.round(((statesData.en_proceso || 0) / totalStates) * 100),
            despachado: statesData.despachado || 0,
            despachado_pct: Math.round(((statesData.despachado || 0) / totalStates) * 100),
            anulado_rechazado: statesData.anulado_rechazado || 0,
            anulado_rechazado_pct: Math.round(((statesData.anulado_rechazado || 0) / totalStates) * 100),
            total: statesData.total || 0
        };
        const recent = recentRes?.recordset || [];
        const byMonth = byMonthRes?.recordset || [];
        return res.json({
            success: true,
            mode: "real",
            kpis,
            alerts: {
                pendientes_24h: kpis.pendientes_24h || 0,
                sin_aprobar_48h: kpis.sin_aprobar_48h || 0,
                rechazados_hoy: kpis.rechazados_hoy || 0,
                sin_cliente: kpis.sin_cliente || 0
            },
            states,
            recent,
            byMonth
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/sgc/despachos-stats:", error);
        return res.status(500).json({
            success: false,
            mode: "real",
            message: "❌ Error al consultar las estadísticas de despachos de la base de datos SGCX: " + error.message,
        });
    }
});
// 13.9. GET /api/sgc/ordenes-retiro-stats
app.get("/api/sgc/ordenes-retiro-stats", async (req, res) => {
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        // Si no se especifican fechas, usar el rango del año por defecto
        if (!fechaDesde || !fechaHasta) {
            fechaDesde = "2026-01-01";
            fechaHasta = "2026-12-31";
        }
        const parseDateStr = (str) => {
            const clean = str.replace(/-/g, "");
            if (clean.length === 8) {
                return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
            }
            return str;
        };
        const dDesdeStr = parseDateStr(fechaDesde);
        const dHastaStr = parseDateStr(fechaHasta);
        const dDesdeObj = new Date(dDesdeStr);
        const dHastaObj = new Date(dHastaStr);
        let shiftedDesde = dDesdeStr;
        let shiftedHasta = dHastaStr;
        // Desplazamiento de 7 años constantes para el rango 2020+ (2026 -> 2019, 2025 -> 2018)
        if (dHastaObj.getFullYear() >= 2020) {
            const shiftYears = 7;
            const subYears = (d, y) => {
                const newD = new Date(d);
                newD.setFullYear(newD.getFullYear() - y);
                return newD.toISOString().split('T')[0];
            };
            shiftedDesde = subYears(dDesdeObj, shiftYears);
            shiftedHasta = subYears(dHastaObj, shiftYears);
            console.log(`🔌 [SGC Retiros] Mapeando rango de fechas (7 años menos): de [${dDesdeStr} a ${dHastaStr}] a [${shiftedDesde} a ${shiftedHasta}]`);
        }
        else {
            console.log(`🔌 [SGC Retiros] Usando fechas directamente (Rango histórico): de [${dDesdeStr} a ${dHastaStr}]`);
        }
        if (isSimulated) {
            // Calcular valores simulados dinámicos según el rango de fechas recibido
            const diffTime = Math.abs(dHastaObj.getTime() - dDesdeObj.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            // Escalar los números simulados proporcionalmente al número de días del filtro
            const total = Math.max(5, Math.round(diffDays * 1.5));
            const esteMes = Math.max(2, Math.round(total * 0.25));
            const hoy = Math.max(0, Math.round(total * 0.02));
            const montoTotal = total * 680000;
            const promedio = 680000;
            const renovaciones = Math.max(1, Math.round(total * 0.25));
            const reservas = Math.max(0, Math.round(total * 0.04));
            const distribution = [
                { nombre: "Fin contrato", pct: 35, count: Math.round(total * 0.35) },
                { nombre: "Renovación", pct: 25, count: renovaciones },
                { nombre: "Venta", pct: 20, count: Math.round(total * 0.20) },
                { nombre: "Cambio equipo", pct: 12, count: Math.round(total * 0.12) },
                { nombre: "Garantía", pct: 8, count: Math.round(total * 0.08) }
            ];
            return res.json({
                success: true,
                mode: "simulation",
                header: {
                    total,
                    esteMes,
                    hoy,
                    montoTotal,
                    promedio,
                    renovaciones,
                    renovacionesPct: total > 0 ? Math.round((renovaciones / total) * 100) : 0,
                    reservas,
                    reservasPct: total > 0 ? Math.round((reservas / total) * 100) : 0
                },
                alerts: {
                    sinContrato: Math.round(total * 0.05),
                    sinCliente: Math.round(total * 0.03),
                    sinFecha: Math.round(total * 0.02),
                    renovacionSinContrato: Math.round(renovaciones * 0.05)
                },
                distribution,
                trends: [
                    `Crecimiento: +12% vs mes anterior`,
                    `Renovaciones: ${total > 0 ? Math.round((renovaciones / total) * 100) : 0}% del total`,
                    `Monto promedio: $${promedio.toLocaleString('es-CL')}`
                ]
            });
        }
        else {
            const statsQuery = `
        DECLARE @StartDate datetime = cast('${shiftedDesde.replace(/-/g, "")}' as date);
        DECLARE @EndDate datetime = cast('${shiftedHasta.replace(/-/g, "")}' as date);

        DECLARE @CurrentMonthStart datetime = DATEADD(month, DATEDIFF(month, 0, @EndDate), 0);
        DECLARE @CurrentMonthEnd datetime = DATEADD(month, 1, @CurrentMonthStart);
        DECLARE @LastMonthStart datetime = DATEADD(month, -1, @CurrentMonthStart);
        DECLARE @LastMonthEnd datetime = @CurrentMonthStart;

        SELECT 
          -- CABECERA (Filtrada por rango)
          (SELECT COUNT(*) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB WHERE ORR_FECHA_ORDEN >= @StartDate AND ORR_FECHA_ORDEN < DATEADD(day, 1, @EndDate)) as total,
          (SELECT COUNT(*) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB WHERE ORR_FECHA_ORDEN >= @CurrentMonthStart AND ORR_FECHA_ORDEN < DATEADD(day, 1, @EndDate)) as este_mes,
          (SELECT COUNT(*) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB WHERE CAST(ORR_FECHA_ORDEN AS DATE) = CAST(@EndDate AS DATE)) as hoy,
          (SELECT ISNULL(SUM(ORR_MONTO), 0) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB WHERE ORR_FECHA_ORDEN >= @StartDate AND ORR_FECHA_ORDEN < DATEADD(day, 1, @EndDate)) as monto_total,
          (SELECT ISNULL(AVG(ORR_MONTO), 0) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB WHERE ORR_FECHA_ORDEN >= @StartDate AND ORR_FECHA_ORDEN < DATEADD(day, 1, @EndDate)) as promedio_monto,
          (SELECT COUNT(*) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB WHERE ORR_RENOVACION = 1 AND ORR_FECHA_ORDEN >= @StartDate AND ORR_FECHA_ORDEN < DATEADD(day, 1, @EndDate)) as renovaciones,
          (SELECT COUNT(*) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB WHERE ORR_RESERVA = 1 AND ORR_FECHA_ORDEN >= @StartDate AND ORR_FECHA_ORDEN < DATEADD(day, 1, @EndDate)) as reservas,

          -- ALERTAS (Filtradas por rango)
          (SELECT COUNT(*) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB o LEFT JOIN SGCX.dbo.CON_CONTRATO c ON o.ORR_FOLIO_CONTRATO = c.CON_FOLIO COLLATE database_default WHERE c.CON_FOLIO IS NULL AND o.ORR_FECHA_ORDEN >= @StartDate AND o.ORR_FECHA_ORDEN < DATEADD(day, 1, @EndDate)) as sin_contrato,
          (SELECT COUNT(*) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB o LEFT JOIN STUEDEMANNSA.softland.cwtauxi clnt ON o.ORR_COD_CLIENTE = clnt.CodAux COLLATE database_default WHERE clnt.CodAux IS NULL AND o.ORR_FECHA_ORDEN >= @StartDate AND o.ORR_FECHA_ORDEN < DATEADD(day, 1, @EndDate)) as sin_cliente,
          (SELECT COUNT(*) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB WHERE ORR_FECHA_ORDEN IS NULL) as sin_fecha,
          (SELECT COUNT(*) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB WHERE ORR_RENOVACION = 1 AND (ORR_FOLIO_CONTRATONUEVO IS NULL OR LTRIM(RTRIM(ORR_FOLIO_CONTRATONUEVO)) = '') AND ORR_FECHA_ORDEN >= @StartDate AND ORR_FECHA_ORDEN < DATEADD(day, 1, @EndDate)) as renovacion_sin_contratonuevo,

          -- TENDENCIAS
          (SELECT COUNT(*) FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB WHERE ORR_FECHA_ORDEN >= @LastMonthStart AND ORR_FECHA_ORDEN < @LastMonthEnd) as last_month_qty
      `;
            const distQuery = `
        DECLARE @StartDate datetime = cast('${shiftedDesde.replace(/-/g, "")}' as date);
        DECLARE @EndDate datetime = cast('${shiftedHasta.replace(/-/g, "")}' as date);

        SELECT 
          c.ORR_TIPORETIRO as id,
          ISNULL(t.TipoRetiro, 'Desconocido') as nombre,
          COUNT(*) as count
        FROM SGCX.dbo.INV_ORDEN_RETIRO_EQ_CAB c
        LEFT JOIN SGCX.dbo.RetiroEq_TipoRetiro t ON c.ORR_TIPORETIRO = t.Id_TipoRetiro
        WHERE c.ORR_FECHA_ORDEN >= @StartDate AND c.ORR_FECHA_ORDEN < DATEADD(day, 1, @EndDate)
        GROUP BY c.ORR_TIPORETIRO, t.TipoRetiro
        ORDER BY count DESC
      `;
            const [statsRes, distRes] = await Promise.all([
                (0, db_client_1.executeQuery)(statsQuery),
                (0, db_client_1.executeQuery)(distQuery)
            ]);
            const s = statsRes.recordset[0] || {};
            const total = s.total || 0;
            const esteMes = s.este_mes || 0;
            const lastMonth = s.last_month_qty || 0;
            // Calcular tendencia de crecimiento MoM
            let growthPct = 0;
            if (lastMonth > 0) {
                growthPct = Math.round(((esteMes - lastMonth) / lastMonth) * 100);
            }
            // Distribución
            const distRaw = distRes.recordset || [];
            const distribution = distRaw.map((d) => {
                let mappedName = d.nombre;
                if (d.id === 3)
                    mappedName = "Fin contrato";
                else if (d.id === 4)
                    mappedName = "Renovación";
                else if (d.id === 2)
                    mappedName = "Cambio equipo";
                else if (d.id === 1)
                    mappedName = "Término de Demos";
                else if (d.id === 6)
                    mappedName = "Retiro de Backup";
                else if (d.id === 5)
                    mappedName = "Litigio Cobranza";
                return {
                    nombre: mappedName,
                    count: d.count,
                    pct: total > 0 ? Math.round((d.count / total) * 100) : 0
                };
            });
            return res.json({
                success: true,
                mode: "real",
                header: {
                    total: total,
                    esteMes: esteMes,
                    hoy: s.hoy || 0,
                    montoTotal: s.monto_total || 0,
                    promedio: Math.round(s.promedio_monto || 0),
                    renovaciones: s.renovaciones || 0,
                    renovacionesPct: total > 0 ? Math.round((s.renovaciones / total) * 100) : 0,
                    reservas: s.reservas || 0,
                    reservasPct: total > 0 ? Math.round((s.reservas / total) * 100) : 0
                },
                alerts: {
                    sinContrato: s.sin_contrato || 0,
                    sinCliente: s.sin_cliente || 0,
                    sinFecha: s.sin_fecha || 0,
                    renovacionSinContrato: s.renovacion_sin_contratonuevo || 0
                },
                distribution,
                trends: [
                    `Crecimiento: ${growthPct >= 0 ? '+' : ''}${growthPct}% vs mes anterior`,
                    `Renovaciones: ${total > 0 ? Math.round((s.renovaciones / total) * 100) : 0}% del total`,
                    `Monto promedio: $${Math.round(s.promedio_monto || 0).toLocaleString('es-CL')}`
                ]
            });
        }
    }
    catch (error) {
        console.error("❌ Error en API /api/sgc/ordenes-retiro-stats:", error);
        return res.status(500).json({
            success: false,
            message: "Error al consultar las órdenes de retiro: " + error.message
        });
    }
});
// 13.10. GET /api/sgc/inyeccion-suministros-stats
app.get(["/api/sgc/inyeccion-suministros-stats", "/api/sgc/inyeccion-stats"], async (req, res) => {
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        console.log(`🔌 [SGC Inyección Suministros] Consultando [THE_COOLER_SGCX].[OIG].[notificaciones]. Modo Simulación: ${isSimulated}`);
        if (!isSimulated) {
            try {
                let whereClause = "";
                if (fechaDesde && fechaHasta) {
                    const parseDateStr = (str) => {
                        const clean = str.replace(/-/g, "");
                        if (clean.length === 8) {
                            return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
                        }
                        return str;
                    };
                    whereClause = `WHERE fecha >= '${parseDateStr(fechaDesde)}' AND fecha <= '${parseDateStr(fechaHasta)} 23:59:59'`;
                }
                const query = `
          SELECT TOP 500
            id_notificacion,
            fecha,
            asunto,
            correos
          FROM [THE_COOLER_SGCX].[OIG].[notificaciones]
          ${whereClause}
          ORDER BY fecha DESC
        `;
                const result = await (0, db_client_1.executeQuery)(query);
                const records = result?.recordset || [];
                if (records.length > 0) {
                    return res.json({
                        success: true,
                        mode: "real",
                        data: records,
                        count: records.length
                    });
                }
            }
            catch (dbErr) {
                console.error("⚠️ Error SQL en OIG.notificaciones, usando datos simulados de respaldo:", dbErr.message);
            }
        }
        // Datos simulados/fallback para desarrollo local o sin conexión SQL directa
        const simulatedData = [
            { id_notificacion: 105, fecha: "2026-08-24T09:15:00", asunto: "Inyección Exitosa Toner HP LaserJet Enterprise M608", correos: "bodega@ofimundo.cl, sistemas@ofimundo.cl" },
            { id_notificacion: 104, fecha: "2026-08-24T08:30:00", asunto: "Notificación de Pedido de Suministro #4591 para Cliente STUEDEMANN S.A.", correos: "despachos@ofimundo.cl, abastecimiento@stuedemann.cl" },
            { id_notificacion: 103, fecha: "2026-08-23T18:45:00", asunto: "Confirmación de Inyección de Suministros Ricoh MP 3055", correos: "soporte@ofimundo.cl" },
            { id_notificacion: 102, fecha: "2026-08-23T14:20:00", asunto: "Alerta de Stock Crítico Suministro Lexmark MS810", correos: "alertas@ofimundo.cl, bodega@ofimundo.cl" },
            { id_notificacion: 101, fecha: "2026-08-22T11:10:00", asunto: "Inyección Exitosa Kit de Mantenimiento Kyocera TaskAlfa", correos: "bodega@ofimundo.cl, contacto@cmds.cl" },
            { id_notificacion: 100, fecha: "2026-08-21T16:05:00", asunto: "Solicitud Automática Suministros Impresora Canon ImageRUNNER", correos: "despachos@ofimundo.cl" }
        ];
        return res.json({
            success: true,
            mode: "simulation",
            data: simulatedData,
            count: simulatedData.length
        });
    }
    catch (error) {
        console.error("❌ Error en API /api/sgc/inyeccion-suministros-stats:", error);
        return res.status(500).json({
            success: false,
            message: "Error al consultar notificaciones de inyección de suministros: " + error.message
        });
    }
});
// 14. GET /api/dte/stats
app.get("/api/dte/stats", async (req, res) => {
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        const fDesdeClean = fechaDesde.replace(/-/g, "");
        const fHastaClean = fechaHasta.replace(/-/g, "");
        console.log(`🔌 [DTE] Consultando datos de DTE. Modo Simulación: ${isSimulated}. Desde: ${fDesdeClean || 'Todas'}, Hasta: ${fHastaClean || 'Todas'}`);
        if (isSimulated) {
            // Mock DTE logs based on the real ones seen in the DB
            const mockLogs = [
                {
                    "id_log": 6,
                    "fecha_inicio_ejecucion": "2026-07-09T15:47:14.060Z",
                    "fecha_fin_ejecucion": "2026-07-09T15:51:28.410Z",
                    "Estado": "EXITOSO"
                },
                {
                    "id_log": 5,
                    "fecha_inicio_ejecucion": "2026-07-09T13:34:19.293Z",
                    "fecha_fin_ejecucion": "2026-07-09T13:38:30.933Z",
                    "Estado": "EXITOSO"
                },
                {
                    "id_log": 4,
                    "fecha_inicio_ejecucion": "2026-07-08T23:04:32.580Z",
                    "fecha_fin_ejecucion": "2026-07-08T23:09:41.040Z",
                    "Estado": "EXITOSO"
                },
                {
                    "id_log": 3,
                    "fecha_inicio_ejecucion": "2026-07-08T13:30:35.593Z",
                    "fecha_fin_ejecucion": "2026-07-08T13:35:51.030Z",
                    "Estado": "EXITOSO"
                },
                {
                    "id_log": 2,
                    "fecha_inicio_ejecucion": "2026-07-07T23:33:01.530Z",
                    "fecha_fin_ejecucion": "2026-07-07T23:36:50.847Z",
                    "Estado": "EXITOSO"
                },
                {
                    "id_log": 1,
                    "fecha_inicio_ejecucion": "2026-07-07T17:16:22.373Z",
                    "fecha_fin_ejecucion": "2026-07-07T17:19:58.370Z",
                    "Estado": "EXITOSO"
                }
            ];
            // Filter by dates if applicable
            let filteredLogs = [...mockLogs];
            if (fDesdeClean) {
                const fromDate = new Date(fechaDesde);
                filteredLogs = filteredLogs.filter(log => new Date(log.fecha_inicio_ejecucion) >= fromDate);
            }
            if (fHastaClean) {
                const toDate = new Date(fechaHasta);
                toDate.setHours(23, 59, 59, 999);
                filteredLogs = filteredLogs.filter(log => new Date(log.fecha_inicio_ejecucion) <= toDate);
            }
            const totalRuns = filteredLogs.length;
            const exitosos = filteredLogs.filter(l => l.Estado === "EXITOSO").length;
            const fallidos = totalRuns - exitosos;
            return res.json({
                success: true,
                mode: "simulation",
                data: filteredLogs,
                detalles: filteredLogs,
                count: totalRuns,
                stats: {
                    total: totalRuns,
                    exitosos,
                    fallidos,
                    lastRun: filteredLogs[0] ? filteredLogs[0].fecha_inicio_ejecucion : null
                },
                source: "SQL Server SIMULADO - THE_COOLER_CENTRAL.BOT.Log_DTE"
            });
        }
        else {
            let whereClause = "";
            if (fDesdeClean && fHastaClean) {
                whereClause = `WHERE CAST(fecha_inicio_ejecucion AS DATE) >= CAST('${fDesdeClean}' AS DATE) 
                       AND CAST(fecha_inicio_ejecucion AS DATE) <= CAST('${fHastaClean}' AS DATE)`;
            }
            else if (fDesdeClean) {
                whereClause = `WHERE CAST(fecha_inicio_ejecucion AS DATE) >= CAST('${fDesdeClean}' AS DATE)`;
            }
            else if (fHastaClean) {
                whereClause = `WHERE CAST(fecha_inicio_ejecucion AS DATE) <= CAST('${fHastaClean}' AS DATE)`;
            }
            const dteQuery = `
        SELECT 
          id_log,
          fecha_inicio_ejecucion,
          fecha_fin_ejecucion,
          Estado
        FROM THE_COOLER_CENTRAL.BOT.Log_DTE
        ${whereClause}
        ORDER BY id_log DESC
      `;
            console.log(`🔌 [DTE] Query:`, dteQuery);
            const result = await (0, db_client_1.executeQuery)(dteQuery);
            const data = result.recordset || [];
            console.log(`✅ [DTE] ${data.length} registros encontrados en base de datos REAL`);
            const totalRuns = data.length;
            const exitosos = data.filter((l) => l.Estado === "EXITOSO").length;
            const fallidos = totalRuns - exitosos;
            return res.json({
                success: true,
                mode: "real",
                data: data,
                detalles: data,
                count: totalRuns,
                stats: {
                    total: totalRuns,
                    exitosos,
                    fallidos,
                    lastRun: data[0] ? data[0].fecha_inicio_ejecucion : null
                },
                source: "SQL Server REAL - THE_COOLER_CENTRAL.BOT.Log_DTE"
            });
        }
    }
    catch (error) {
        console.error("❌ Error en API /api/dte/stats:", error);
        return res.status(500).json({
            success: false,
            mode: (0, db_client_1.isSimulationMode)() ? "simulation" : "real",
            message: "❌ Error al consultar la base de datos DTE: " + error.message,
            data: [],
            detalles: [],
            count: 0
        });
    }
});
// Monitoreo en segundo plano de Zabbix
let zabbixStatus = {
    online: true,
    lastCheck: new Date().toISOString(),
    error: null,
    eldenringOnline: true,
    pacmanOnline: true,
    bmwOnline: true, // Core server
    servidoresOnline: 6,
    totalServidores: 6,
    porcentajeInfra: 100.0,
    version: null,
    servidores: [
        { id: "doom", nombre: "DOOM", ip: "192.168.1.6", cpu: 1.6, ram: 68.2, disk: 79.3, online: true },
        { id: "pacman", nombre: "PACMAN", ip: "192.168.1.14", cpu: 0.6, ram: 80.7, disk: 62.7, online: true },
        { id: "bmw", nombre: "BMW", ip: "192.168.1.x", cpu: 3.0, ram: 42.0, disk: 45.0, online: true, isCore: true },
        { id: "eldenring", nombre: "ELDENRING", ip: "192.168.1.12", cpu: 7.6, ram: 66.3, disk: 58.2, online: true },
        { id: "sekiro", nombre: "SEKIRO", ip: "192.168.1.5", cpu: 0.4, ram: 68.1, disk: 65.2, online: true },
        { id: "zelda", nombre: "ZELDA", ip: "192.168.1.8", cpu: 5.5, ram: 58.0, disk: 52.4, online: true },
    ]
};
function setZabbixOffline(errMsg) {
    const fallbackServidores = [
        { id: "doom", nombre: "DOOM", ip: "192.168.1.6", cpu: 0, ram: 0, disk: 0, online: false },
        { id: "pacman", nombre: "PACMAN", ip: "192.168.1.14", cpu: 0, ram: 0, disk: 0, online: false },
        { id: "bmw", nombre: "BMW", ip: "192.168.1.x", cpu: 0, ram: 0, disk: 0, online: false, isCore: true },
        { id: "eldenring", nombre: "ELDENRING", ip: "192.168.1.12", cpu: 0, ram: 0, disk: 0, online: false },
        { id: "sekiro", nombre: "SEKIRO", ip: "192.168.1.5", cpu: 0, ram: 0, disk: 0, online: false },
        { id: "zelda", nombre: "ZELDA", ip: "192.168.1.8", cpu: 0, ram: 0, disk: 0, online: false },
    ];
    zabbixStatus = {
        online: false,
        lastCheck: new Date().toISOString(),
        error: errMsg,
        eldenringOnline: false,
        pacmanOnline: false,
        bmwOnline: false,
        servidoresOnline: 0,
        totalServidores: 6,
        porcentajeInfra: 0.0,
        version: null,
        servidores: zabbixStatus.servidores && zabbixStatus.servidores.length > 0
            ? zabbixStatus.servidores.map((s) => ({ ...s, online: false }))
            : fallbackServidores
    };
}
function monitorZabbix() {
    const token = process.env.ZABBIX_API_TOKEN || "0266aa954802ff9e23584e1e8f2e5ca8b6302b9582b8af02a4f300b6de27d8d0";
    const versionData = JSON.stringify({
        jsonrpc: "2.0",
        method: "apiinfo.version",
        params: [],
        id: 1
    });
    const versionOptions = {
        hostname: 'zabbix.ofimundo.cl',
        port: 443,
        path: '/api_jsonrpc.php',
        method: 'POST',
        timeout: 8000,
        headers: {
            'Content-Type': 'application/json-rpc',
            'Content-Length': Buffer.byteLength(versionData),
            'User-Agent': 'OfimundoMonitor/1.0'
        }
    };
    const reqVersion = https_1.default.request(versionOptions, (resVersion) => {
        let dataVersion = '';
        resVersion.on('data', (chunk) => { dataVersion += chunk; });
        resVersion.on('end', () => {
            try {
                if (resVersion.statusCode !== 200) {
                    throw new Error(`Zabbix status code: ${resVersion.statusCode}`);
                }
                const jsonVersion = JSON.parse(dataVersion);
                const version = jsonVersion.result;
                const hostsData = JSON.stringify({
                    jsonrpc: "2.0",
                    method: "host.get",
                    params: {
                        filter: {
                            host: ["DOOM", "PACMAN", "BMW", "ELDENRING", "SEKIRO", "ZELDA"]
                        },
                        selectInterfaces: ["ip"],
                        selectItems: ["name", "key_", "lastvalue", "units"]
                    },
                    id: 2
                });
                const hostsOptions = {
                    hostname: 'zabbix.ofimundo.cl',
                    port: 443,
                    path: '/api_jsonrpc.php',
                    method: 'POST',
                    timeout: 8000,
                    headers: {
                        'Content-Type': 'application/json-rpc',
                        'Content-Length': Buffer.byteLength(hostsData),
                        'User-Agent': 'OfimundoMonitor/1.0',
                        'Authorization': `Bearer ${token}`
                    }
                };
                const reqHosts = https_1.default.request(hostsOptions, (resHosts) => {
                    let dataHosts = '';
                    resHosts.on('data', (chunk) => { dataHosts += chunk; });
                    resHosts.on('end', () => {
                        try {
                            if (resHosts.statusCode !== 200) {
                                throw new Error(`Zabbix hosts status code: ${resHosts.statusCode}`);
                            }
                            const jsonHosts = JSON.parse(dataHosts);
                            if (jsonHosts.error) {
                                throw new Error(jsonHosts.error.message || "Error fetching hosts");
                            }
                            const resultHosts = jsonHosts.result || [];
                            const servidores = resultHosts.map((h) => {
                                const ip = h.interfaces?.[0]?.ip || "No IP";
                                const displayIp = h.name === "BMW" ? "192.168.1.x" : ip;
                                const items = h.items || [];
                                // CPU
                                const cpuItem = items.find((i) => i.key_ === "system.cpu.util");
                                const cpu = cpuItem ? parseFloat(cpuItem.lastvalue) : 0.0;
                                // RAM
                                const ramUtilItem = items.find((i) => i.key_ === "vm.memory.util");
                                let ram = 0.0;
                                if (ramUtilItem) {
                                    ram = parseFloat(ramUtilItem.lastvalue);
                                }
                                else {
                                    const ramUsed = items.find((i) => i.key_ === "vm.memory.size[used]");
                                    const ramTotal = items.find((i) => i.key_ === "vm.memory.size[total]");
                                    if (ramUsed && ramTotal && parseFloat(ramTotal.lastvalue) > 0) {
                                        ram = (parseFloat(ramUsed.lastvalue) / parseFloat(ramTotal.lastvalue)) * 100;
                                    }
                                }
                                // Disk
                                let diskItem = items.find((i) => i.key_.includes("C:,pused"));
                                if (!diskItem) {
                                    diskItem = items.find((i) => i.key_.includes("/,pused"));
                                }
                                if (!diskItem) {
                                    diskItem = items.find((i) => (i.key_.includes("vfs.fs.size") || i.key_.includes("vfs.fs.dependent.size")) && i.key_.includes("pused"));
                                }
                                const disk = diskItem ? parseFloat(diskItem.lastvalue) : 0.0;
                                // Online status (agent.ping === 1)
                                const pingItem = items.find((i) => i.key_ === "agent.ping");
                                const online = pingItem ? pingItem.lastvalue === "1" : h.status === "0";
                                return {
                                    id: h.host.toLowerCase(),
                                    nombre: h.name,
                                    ip: displayIp,
                                    cpu: parseFloat(cpu.toFixed(1)),
                                    ram: parseFloat(ram.toFixed(1)),
                                    disk: parseFloat(disk.toFixed(1)),
                                    online,
                                    isCore: h.name === "BMW"
                                };
                            });
                            // Sort servidores to keep a consistent order: DOOM, PACMAN, BMW, ELDENRING, SEKIRO, ZELDA
                            const order = ["DOOM", "PACMAN", "BMW", "ELDENRING", "SEKIRO", "ZELDA"];
                            servidores.sort((a, b) => order.indexOf(a.nombre) - order.indexOf(b.nombre));
                            const countOnline = servidores.filter((s) => s.online).length;
                            const totalServidores = servidores.length || 6;
                            const pct = parseFloat(((countOnline / totalServidores) * 100).toFixed(2));
                            zabbixStatus = {
                                online: true,
                                lastCheck: new Date().toISOString(),
                                error: null,
                                eldenringOnline: servidores.find((s) => s.nombre === "ELDENRING")?.online ?? true,
                                pacmanOnline: servidores.find((s) => s.nombre === "PACMAN")?.online ?? true,
                                bmwOnline: servidores.find((s) => s.nombre === "BMW")?.online ?? true,
                                servidoresOnline: countOnline,
                                totalServidores: totalServidores,
                                porcentajeInfra: pct,
                                version: version,
                                servidores: servidores
                            };
                        }
                        catch (err) {
                            console.error("Error parsing Zabbix hosts:", err);
                            setZabbixOffline(`Error parsing Zabbix hosts: ${err.message}`);
                        }
                    });
                });
                reqHosts.on('error', (err) => {
                    setZabbixOffline(`Hosts request error: ${err.message}`);
                });
                reqHosts.on('timeout', () => {
                    reqHosts.destroy();
                    setZabbixOffline("Hosts request timeout");
                });
                reqHosts.write(hostsData);
                reqHosts.end();
            }
            catch (err) {
                setZabbixOffline(`Zabbix API Error: ${err.message}`);
            }
        });
    });
    reqVersion.on('error', (err) => {
        setZabbixOffline(err.message || "Connection failed");
    });
    reqVersion.on('timeout', () => {
        reqVersion.destroy();
        setZabbixOffline("Timeout connecting to Zabbix API");
    });
    reqVersion.write(versionData);
    reqVersion.end();
}
setInterval(monitorZabbix, 30000);
setTimeout(monitorZabbix, 2000);
function generateMockMiCuentaSolicitudes() {
    const clientesMock = [
        { rut: "76.452.910-K", nombre: "Ofimundo S.A.", email: "abastecimiento@ofimundo.cl", tel: "+56 2 2840 9300" },
        { rut: "96.854.120-3", nombre: "Banco de Chile", email: "operaciones@bancodechile.cl", tel: "+56 2 2630 1100" },
        { rut: "77.104.930-1", nombre: "Constructora Echeverría", email: "ti@echeverria.cl", tel: "+56 2 2480 7700" },
        { rut: "78.291.004-9", nombre: "Clínica Indisa", email: "mesadeayuda@indisa.cl", tel: "+56 2 2362 5000" },
        { rut: "85.120.400-5", nombre: "Universidad de Chile", email: "soporte@uchile.cl", tel: "+56 2 2978 2000" },
    ];
    const seriesMock = [
        { serie: "SN-HP-94820", dir: "Av. Providencia 1234", com: "Providencia", ref: "Piso 4 - Impresora Principal" },
        { serie: "SN-RICOH-10492", dir: "Av. Las Condes 900", com: "Las Condes", ref: "Sucursal Central - Recepción" },
        { serie: "SN-LEX-77210", dir: "Moneda 812", com: "Santiago", ref: "Piso 2 - Contabilidad" },
        { serie: "SN-CANON-3391", dir: "Alameda 3410", com: "Estación Central", ref: "Bodega General" },
        { serie: "SN-EPSON-5582", dir: "Vitacura 4500", com: "Vitacura", ref: "Piso 6 - Gerencia" },
    ];
    const now = new Date();
    const solicitudes = [];
    for (let i = 1; i <= 25; i++) {
        const c = clientesMock[(i - 1) % clientesMock.length];
        const s = seriesMock[(i - 1) % seriesMock.length];
        const fecha = new Date(now.getTime() - i * 1000 * 60 * 60 * 5);
        solicitudes.push({
            CDG_SOLICITUD: 10000 + i,
            FCH_SOLICITUD: fecha.toISOString(),
            CDG_TIPO_SOLICITUD: (i % 3 === 0) ? 2 : 1,
            CDG_USUARIO: 200 + (i % 5),
            CDG_CLIENTE: c.rut,
            CDG_CONTRATO: `CTR-2026-0${(i % 4) + 1}0`,
            NMR_SERIE: s.serie,
            DIR_SERIE: s.dir,
            COM_SERIE: s.com,
            REF_SERIE: s.ref,
            NMB_CONTACTO: c.nombre,
            TEL_CONTACTO: c.tel,
            EMAIL_CONTACTO: c.email
        });
    }
    return solicitudes;
}
// 17. GET /api/mi-cuenta/stats - PORTAL MI CUENTA (SQL Server: [THE_COOLER_MI_CUENTA].[dbo].[SOLICITUDES])
// 17. GET /api/mi-cuenta/stats - PORTAL MI CUENTA (SQL Server: [THE_COOLER_MI_CUENTA].[dbo].[SOLICITUDES])
app.get("/api/mi-cuenta/stats", async (req, res) => {
    try {
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        const cliente = req.query.cliente || '';
        const fDesdeClean = fechaDesde.replace(/-/g, "");
        const fHastaClean = fechaHasta.replace(/-/g, "");
        console.log(`🔌 [PORTAL MI CUENTA] Consultando solicitudes REALES desde [THE_COOLER_MI_CUENTA].[dbo].[SOLICITUDES]`);
        let whereConditions = [];
        if (fDesdeClean) {
            whereConditions.push(`CAST(FCH_SOLICITUD AS DATE) >= CAST('${fDesdeClean}' AS DATE)`);
        }
        if (fHastaClean) {
            whereConditions.push(`CAST(FCH_SOLICITUD AS DATE) <= CAST('${fHastaClean}' AS DATE)`);
        }
        if (cliente) {
            whereConditions.push(`(CDG_CLIENTE LIKE '%${cliente}%' OR NMB_CONTACTO LIKE '%${cliente}%')`);
        }
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";
        const queryMiCuenta = `
      SELECT TOP 500
        CDG_SOLICITUD,
        FCH_SOLICITUD,
        CDG_TIPO_SOLICITUD,
        CDG_USUARIO,
        CDG_CLIENTE,
        CDG_CONTRATO,
        NMR_SERIE,
        DIR_SERIE,
        COM_SERIE,
        REF_SERIE,
        NMB_CONTACTO,
        TEL_CONTACTO,
        EMAIL_CONTACTO
      FROM [THE_COOLER_MI_CUENTA].[dbo].[SOLICITUDES]
      ${whereClause}
      ORDER BY CDG_SOLICITUD DESC
    `;
        console.log(`🔌 [PORTAL MI CUENTA] Query SQL Real:`, queryMiCuenta);
        let result = await (0, db_client_1.executeQuery)(queryMiCuenta);
        let data = result?.recordset || [];
        // Si el filtro por fecha acorta a 0 registros, consultar sin filtro de fecha para garantizar mostrar datos de la BD
        if (data.length === 0 && whereClause !== "") {
            console.log(`⚠️ [PORTAL MI CUENTA] 0 registros encontrados con filtro de fecha. Consultando registros reales sin filtro de fecha...`);
            const fallbackQuery = `
        SELECT TOP 500
          CDG_SOLICITUD,
          FCH_SOLICITUD,
          CDG_TIPO_SOLICITUD,
          CDG_USUARIO,
          CDG_CLIENTE,
          CDG_CONTRATO,
          NMR_SERIE,
          DIR_SERIE,
          COM_SERIE,
          REF_SERIE,
          NMB_CONTACTO,
          TEL_CONTACTO,
          EMAIL_CONTACTO
        FROM [THE_COOLER_MI_CUENTA].[dbo].[SOLICITUDES]
        ORDER BY CDG_SOLICITUD DESC
      `;
            const fallbackResult = await (0, db_client_1.executeQuery)(fallbackQuery);
            data = fallbackResult?.recordset || [];
        }
        console.log(`✅ [PORTAL MI CUENTA] ${data.length} solicitudes encontradas en [THE_COOLER_MI_CUENTA].[dbo].[SOLICITUDES]`);
        const totalTickets = data.length;
        const suministrosSolicitados = data.filter((s) => s.CDG_TIPO_SOLICITUD === 1 || s.NMR_SERIE).length;
        const peticionesMap = {};
        data.forEach((s) => {
            const key = s.CDG_CLIENTE || s.NMB_CONTACTO || "Otros";
            if (!peticionesMap[key]) {
                peticionesMap[key] = {
                    cliente: key,
                    razonSocial: s.NMB_CONTACTO || key,
                    count: 0
                };
            }
            peticionesMap[key].count++;
        });
        const peticionesPorCliente = Object.values(peticionesMap).sort((a, b) => b.count - a.count);
        let lastActivity = "No hay datos";
        if (data.length > 0 && data[0].FCH_SOLICITUD) {
            lastActivity = (0, date_fns_1.format)(new Date(data[0].FCH_SOLICITUD), "dd/MM/yyyy HH:mm");
        }
        return res.json({
            success: true,
            mode: "real",
            stats: {
                ticketsGenerados: totalTickets,
                suministrosSolicitados,
                totalClientes: peticionesPorCliente.length,
                lastActivity
            },
            peticionesPorCliente,
            detalles: data,
            count: totalTickets,
            source: "SQL Server REAL - [THE_COOLER_MI_CUENTA].[dbo].[SOLICITUDES]"
        });
    }
    catch (error) {
        console.error("❌ Error al consultar base de datos [THE_COOLER_MI_CUENTA]:", error);
        return res.status(500).json({
            success: false,
            mode: "error",
            message: `❌ ALERTA DE CONEXIÓN: No se pudo conectar a la base de datos [THE_COOLER_MI_CUENTA] o al servidor SQL Server (${error.message || 'Servidor no disponible'}).`,
            error: error.message
        });
    }
});
// ============================================================
// VARIABLES MUTABLES Y MÉTODOS PARA MONITOREO DE NEGOCIOS
// ============================================================
let simulatedClientes = [
    { Cliente_ID: 1, Codigo_Cliente: "81464600", Rut_Cliente: "81.464.600-9", Nombre_cliente: "AUTOMOVIL CLUB DE CHILE", Activo: true },
    { Cliente_ID: 2, Codigo_Cliente: "71102600", Rut_Cliente: "71.102.600-2", Nombre_cliente: "CORP MUNICIPAL DE DESARROLLO SOCIAL DE ANTOFAGASTA", Activo: true },
    { Cliente_ID: 3, Codigo_Cliente: "96502540", Rut_Cliente: "96.502.540-5", Nombre_cliente: "STUEDEMANN S.A.", Activo: true },
    { Cliente_ID: 4, Codigo_Cliente: "76240125", Rut_Cliente: "76.240.125-8", Nombre_cliente: "CONVATEC MEDICAL CARE DE CHILE SPA", Activo: true },
    { Cliente_ID: 5, Codigo_Cliente: "96893820", Rut_Cliente: "96.893.820-7", Nombre_cliente: "CORPESCA S.A.", Activo: true },
    { Cliente_ID: 6, Codigo_Cliente: "76280514", Rut_Cliente: "76.280.514-6", Nombre_cliente: "ECGROUP INGENIERIA Y TECNOLOGIA SPA", Activo: true }
];
let simulatedServicios = [
    { Servicio_ID: 1, Codigo_Servicio: "ACRF_01", Nombre_Servicio: "Aceptación y rechazo de facturas", Descripcion: "El proyecto tiene como objetivo automatizar el flujo de aceptación y rechazo de facturas electrónicas registradas en el sistema, permitiendo una gestión eficiente y reduciendo la intervención manual", Activo: true },
    { Servicio_ID: 2, Codigo_Servicio: "DTE_01", Nombre_Servicio: "DTE", Descripcion: "Este sistema es una solución de automatización diseñada para optimizar y agilizar el flujo de trabajo contable y administrativo mediante la integración de la recepción de documentos tributarios con el sistema Softland.", Activo: true },
    { Servicio_ID: 4, Codigo_Servicio: "OFI_01", Nombre_Servicio: "Oficore", Descripcion: "Este sistema consolida el acceso a los distintos sistemas Core de la empresa Ofimundo", Activo: true },
    { Servicio_ID: 5, Codigo_Servicio: "SGC_01", Nombre_Servicio: "SGC", Descripcion: "SGC es el núcleo de las operaciones de la organización, centralizando la gestión de contratos, la administración de clientes y equipos, así como el ingreso y seguimiento de solicitudes de suministros, retiros y despachos de equipos.", Activo: true },
    { Servicio_ID: 6, Codigo_Servicio: "OFT_01", Nombre_Servicio: "Ofitec", Descripcion: "Ofitec es la plataforma encargada de la gestión, administración y monitoreo de los tickets de servicio técnico para los clientes de Ofimundo.", Activo: true },
    { Servicio_ID: 7, Codigo_Servicio: "MIC_01", Nombre_Servicio: "Mi cuenta", Descripcion: "Gestiona fácilmente tus servicios con Mi Cuenta de Ofimundo S.A. Solicita insumos, revisa tus facturas, coordina soporte técnico y administra tus usuarios desde un solo lugar", Activo: true },
    { Servicio_ID: 8, Codigo_Servicio: "FAC_ART_01", Nombre_Servicio: "Facturas Artesanales", Descripcion: "Monitoreo y procesamiento automatizado de facturas artesanales para Corpesca S.A., verificando folios, fecha de recepción, captura de PDF y XML.", Activo: true }
];
let simulatedRelaciones = [
    // Servicio 1: Aceptación y rechazo de facturas (ACRF_01)
    { Relacion_ID: 1, Cliente_ID: 1, Servicio_ID: 1, Activo: true },
    { Relacion_ID: 2, Cliente_ID: 2, Servicio_ID: 1, Activo: true },
    { Relacion_ID: 3, Cliente_ID: 3, Servicio_ID: 1, Activo: true },
    { Relacion_ID: 4, Cliente_ID: 4, Servicio_ID: 1, Activo: true },
    { Relacion_ID: 5, Cliente_ID: 5, Servicio_ID: 1, Activo: true },
    { Relacion_ID: 6, Cliente_ID: 6, Servicio_ID: 1, Activo: true },
    // Servicio 2: DTE (DTE_01)
    { Relacion_ID: 8, Cliente_ID: 1, Servicio_ID: 2, Activo: true },
    { Relacion_ID: 9, Cliente_ID: 3, Servicio_ID: 2, Activo: true },
    { Relacion_ID: 10, Cliente_ID: 4, Servicio_ID: 2, Activo: true },
    { Relacion_ID: 11, Cliente_ID: 5, Servicio_ID: 2, Activo: true },
    // Servicio 4: Oficore (OFI_01)
    { Relacion_ID: 13, Cliente_ID: 1, Servicio_ID: 4, Activo: true },
    { Relacion_ID: 14, Cliente_ID: 2, Servicio_ID: 4, Activo: true },
    { Relacion_ID: 15, Cliente_ID: 3, Servicio_ID: 4, Activo: true },
    // Servicio 5: SGC (SGC_01)
    { Relacion_ID: 17, Cliente_ID: 1, Servicio_ID: 5, Activo: true },
    { Relacion_ID: 18, Cliente_ID: 3, Servicio_ID: 5, Activo: true },
    { Relacion_ID: 19, Cliente_ID: 4, Servicio_ID: 5, Activo: true },
    { Relacion_ID: 20, Cliente_ID: 6, Servicio_ID: 5, Activo: true },
    // Servicio 6: Ofitec (OFT_01)
    { Relacion_ID: 22, Cliente_ID: 1, Servicio_ID: 6, Activo: true },
    { Relacion_ID: 23, Cliente_ID: 2, Servicio_ID: 6, Activo: true },
    { Relacion_ID: 24, Cliente_ID: 3, Servicio_ID: 6, Activo: true },
    { Relacion_ID: 25, Cliente_ID: 6, Servicio_ID: 6, Activo: true },
    // Servicio 7: Mi cuenta (MIC_01)
    { Relacion_ID: 27, Cliente_ID: 1, Servicio_ID: 7, Activo: true },
    { Relacion_ID: 28, Cliente_ID: 3, Servicio_ID: 7, Activo: true },
    { Relacion_ID: 29, Cliente_ID: 5, Servicio_ID: 7, Activo: true },
    // Servicio 8: Facturas Artesanales (FAC_ART_01)
    { Relacion_ID: 30, Cliente_ID: 5, Servicio_ID: 8, Activo: true }
];
let simulatedProyectos = [
    {
        Id: 1,
        Codigo: 'proj_01',
        NombreProyecto: 'Proyecto Desarrollo CRM',
        Cliente: 'AUTOMOVIL CLUB DE CHILE',
        Lider: 'MACARENA ALLENDE',
        Estado: 'Activo',
        Avance: 45.0,
        Venta: 12000000,
        HHPlanificadas: 160,
        HHReal: 72,
        FechaInicio: '2026-01-10',
        FechaFin: null,
        Descripcion: 'Implementación del módulo CRM para ventas y soporte de Automóvil Club',
        FechaCreacion: new Date().toISOString(),
        FechaActualizacion: new Date().toISOString()
    }
];
let simulatedFichasProspecto = [
    {
        Id: 11,
        Codigo: 'serv_01',
        NombreProyecto: 'Servidores y otros',
        Estado: '10% Prospecto (Lead)',
        Cliente: 'SERVICIOS DE EXPORTACIONES FRUTICOLAS EXSER LIMITADA',
        GestorComercial: 'DANIELA VALDES',
        ValorServicio: 0,
        TipoCliente: 'Nuevo',
        LineaServicio: 'OFT_01'
    },
    {
        Id: 12,
        Codigo: 'ocrs_01',
        NombreProyecto: 'Ocr Sodexo',
        Estado: '30% En elaboración',
        Cliente: 'SODEXO CHILE SPA',
        GestorComercial: 'MACARENA ALLENDE',
        ValorServicio: 0,
        TipoCliente: 'Nuevo',
        LineaServicio: 'ACRF_01'
    }
];
function getServiceIdFromLine(line, projectCode, projectName) {
    const lineLower = (line || "").toLowerCase();
    const codeLower = (projectCode || "").toLowerCase();
    const nameLower = (projectName || "").toLowerCase();
    if (lineLower.includes("acrf") || lineLower.includes("factura") || codeLower.includes("ocr") || nameLower.includes("ocr")) {
        return 1; // ACRF_01
    }
    if (lineLower.includes("dte") || codeLower.includes("dte") || nameLower.includes("dte")) {
        return 2; // DTE_01
    }
    if (lineLower.includes("oficore") || codeLower.includes("oficore")) {
        return 4; // OFI_01
    }
    if (lineLower.includes("ofitec") || lineLower.includes("soporte") || lineLower.includes("servidor") || codeLower.includes("serv") || nameLower.includes("servidor")) {
        return 6; // OFT_01
    }
    if (lineLower.includes("mic") || lineLower.includes("mi cuenta") || lineLower.includes("mi-cuenta")) {
        return 7; // MIC_01
    }
    return 5; // SGC_01 (default)
}
async function syncApprovedProspectsReal(fichas) {
    for (const ficha of fichas) {
        const estado = (ficha.Estado || "").toLowerCase();
        if (estado.includes("100%") || estado.includes("aprobado") || estado.includes("aprobada") || estado.includes("aceptado por cliente")) {
            const clienteName = ficha.Cliente;
            const id = ficha.Id;
            const line = ficha.LineaServicio;
            const code = ficha.Codigo;
            const projectName = ficha.NombreProyecto;
            const serviceId = getServiceIdFromLine(line, code, projectName);
            try {
                console.log(`ℹ️ [Modo Solo Consulta] Sincronización en modo lectura para prospecto: ${clienteName} con servicio ID ${serviceId}`);
                const queryCheckClient = "SELECT Cliente_ID FROM [THE_COOLER_CENTRAL].[MON].[Clientes] WHERE Nombre_cliente = @p0";
                await (0, db_client_1.executeQuery)(queryCheckClient, [clienteName]);
                const queryCheckProj = "SELECT Id FROM [GESTION_PROYECTOS].[dbo].[Proyectos] WHERE Codigo = @p0";
                await (0, db_client_1.executeQuery)(queryCheckProj, [code]);
            }
            catch (err) {
                console.error(`❌ Error al consultar prospecto ${clienteName}:`, err);
            }
        }
    }
}
function syncApprovedProspectsSimulation() {
    simulatedFichasProspecto.forEach(ficha => {
        const estado = (ficha.Estado || "").toLowerCase();
        if (estado.includes("100%") || estado.includes("aprobado") || estado.includes("aprobada") || estado.includes("aceptado por cliente")) {
            const clienteName = ficha.Cliente;
            const id = ficha.Id;
            const line = ficha.LineaServicio;
            const code = ficha.Codigo;
            const projectName = ficha.NombreProyecto;
            const serviceId = getServiceIdFromLine(line, code, projectName);
            let client = simulatedClientes.find(c => c.Nombre_cliente === clienteName);
            let clienteId;
            if (client) {
                clienteId = client.Cliente_ID;
            }
            else {
                clienteId = Math.max(...simulatedClientes.map(c => c.Cliente_ID), 0) + 1;
                const rut = `77.000.${String(id).padStart(3, '0')}-0`;
                const codigoCliente = `77000${String(id).padStart(3, '0')}0`;
                simulatedClientes.push({
                    Cliente_ID: clienteId,
                    Codigo_Cliente: codigoCliente,
                    Rut_Cliente: rut,
                    Nombre_cliente: clienteName,
                    Activo: true
                });
                console.log(`[Simulation] Created client: ${clienteName} (ID: ${clienteId})`);
            }
            const relationExists = simulatedRelaciones.some(r => r.Cliente_ID === clienteId && r.Servicio_ID === serviceId);
            if (!relationExists) {
                const nextRelId = Math.max(...simulatedRelaciones.map(r => r.Relacion_ID), 0) + 1;
                simulatedRelaciones.push({
                    Relacion_ID: nextRelId,
                    Cliente_ID: clienteId,
                    Servicio_ID: serviceId,
                    Activo: true
                });
                console.log(`[Simulation] Linked client ${clienteName} to service ${serviceId}`);
            }
            // Sincronizar proyecto activo en simulatedProyectos
            const projectExists = simulatedProyectos.some(p => p.Codigo === code);
            if (!projectExists) {
                const nextProjId = Math.max(...simulatedProyectos.map(p => p.Id), 0) + 1;
                simulatedProyectos.push({
                    Id: nextProjId,
                    Codigo: code,
                    NombreProyecto: projectName,
                    Cliente: clienteName,
                    Lider: ficha.GestorComercial || 'Sin Asignar',
                    Estado: 'Activo',
                    Avance: 100.0,
                    Venta: ficha.ValorServicio || 0,
                    HHPlanificadas: 0,
                    HHReal: 0,
                    FechaInicio: new Date().toISOString().split('T')[0],
                    FechaFin: null,
                    Descripcion: '',
                    FechaCreacion: new Date().toISOString(),
                    FechaActualizacion: new Date().toISOString()
                });
                console.log(`[Simulation] Created active project: ${projectName} (ID: ${nextProjId})`);
            }
        }
    });
}
let remoteApiToken = null;
async function getRemoteApiToken() {
    try {
        const data = JSON.stringify({
            email: 'marrano@ofimundo.cl',
            password: '123456'
        });
        const options = {
            hostname: '18.230.23.241',
            port: 3001,
            path: '/api/auth/login',
            method: 'POST',
            timeout: 8000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        return new Promise((resolve) => {
            const req = http_1.default.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        try {
                            const json = JSON.parse(body);
                            if (json.token) {
                                resolve(json.token);
                                return;
                            }
                        }
                        catch (e) { }
                    }
                    resolve(null);
                });
            });
            req.on('error', (err) => {
                console.error("❌ Error de red login remoto:", err.message);
                resolve(null);
            });
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
            req.write(data);
            req.end();
        });
    }
    catch (err) {
        console.error("Error logging in to remote api:", err.message);
        return null;
    }
}
async function fetchRemoteFichasProspecto(token) {
    const options = {
        hostname: '18.230.23.241',
        port: 3001,
        path: '/api/fichas-prospecto',
        method: 'GET',
        timeout: 8000,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };
    return new Promise((resolve) => {
        const req = http_1.default.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(body);
                        resolve(json.data || []);
                    }
                    catch (e) {
                        resolve(null);
                    }
                }
                else {
                    resolve(null);
                }
            });
        });
        req.on('error', (err) => {
            console.error("❌ Error de red al traer fichas remotas:", err.message);
            resolve(null);
        });
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
        req.end();
    });
}
async function syncFichasProspectoWithRemote() {
    console.log("🔄 [SYNC] Iniciando sincronización de Fichas de Prospecto con servidor remoto...");
    if (!remoteApiToken) {
        remoteApiToken = await getRemoteApiToken();
    }
    if (!remoteApiToken) {
        console.error("❌ No se pudo obtener el token para el servidor remoto.");
        return;
    }
    let remoteFichas = await fetchRemoteFichasProspecto(remoteApiToken);
    if (!remoteFichas) {
        console.log("🔄 Reintentando login remoto por posible token vencido...");
        remoteApiToken = await getRemoteApiToken();
        if (remoteApiToken) {
            remoteFichas = await fetchRemoteFichasProspecto(remoteApiToken);
        }
    }
    if (!remoteFichas || !Array.isArray(remoteFichas)) {
        console.error("❌ No se pudieron recuperar las fichas desde el servidor remoto.");
        return;
    }
    console.log(`[SYNC] Recuperadas ${remoteFichas.length} fichas desde el servidor remoto.`);
    const isSimulated = (0, db_client_1.isSimulationMode)();
    if (isSimulated) {
        simulatedFichasProspecto = remoteFichas.map(f => ({
            Id: Number(f.id),
            Codigo: f.codigo,
            NombreProyecto: f.nombreProyecto,
            Estado: f.estado,
            Cliente: f.cliente,
            GestorComercial: f.gestorComercial,
            ValorServicio: f.valorServicio || 0,
            LineaServicio: f.lineaServicio || 'ACRF_01',
            TipoCliente: f.tipoCliente || 'Nuevo'
        }));
        syncApprovedProspectsSimulation();
    }
    else {
        for (const f of remoteFichas) {
            try {
                const queryCheck = "SELECT Id, Estado FROM [GESTION_PROYECTOS].[dbo].[FichasProspecto] WHERE Codigo = @p0";
                await (0, db_client_1.executeQuery)(queryCheck, [f.codigo]);
            }
            catch (err) {
                console.error(`❌ Error consultando ficha prospecto ${f.codigo}:`, err.message);
            }
        }
    }
}
// Iniciar sync remota de fichas cada 60 segundos
setInterval(syncFichasProspectoWithRemote, 60000);
setTimeout(syncFichasProspectoWithRemote, 5000);
// 18. GET /api/mon/services-data - Datos de clientes y servicios reales de THE_COOLER_CENTRAL
app.get("/api/mon/services-data", async (req, res) => {
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        if (isSimulated) {
            // Ejecutar sincronización de aprobados antes de retornar los datos
            syncApprovedProspectsSimulation();
            return res.json({
                success: true,
                mode: "simulation",
                clientes: simulatedClientes,
                servicios: simulatedServicios,
                relaciones: simulatedRelaciones
            });
        }
        else {
            const queryClientes = "SELECT * FROM [THE_COOLER_CENTRAL].[MON].[Clientes] WHERE Activo = 1";
            const queryServicios = "SELECT * FROM [THE_COOLER_CENTRAL].[MON].[Servicios] WHERE Activo = 1";
            const queryRelaciones = "SELECT * FROM [THE_COOLER_CENTRAL].[MON].[Cliente_Servicio] WHERE Activo = 1";
            const [resClientes, resServicios, resRelaciones] = await Promise.all([
                (0, db_client_1.executeQuery)(queryClientes),
                (0, db_client_1.executeQuery)(queryServicios),
                (0, db_client_1.executeQuery)(queryRelaciones)
            ]);
            return res.json({
                success: true,
                mode: "real",
                clientes: resClientes?.recordset || [],
                servicios: resServicios?.recordset || [],
                relaciones: resRelaciones?.recordset || []
            });
        }
    }
    catch (error) {
        console.error("❌ Error en API /api/mon/services-data:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener datos de monitoreo: " + error.message,
            error: error.message
        });
    }
});
// 18a. GET /api/mon/fichas-prospecto - Monitorear prospectos y auto-activar aprobados
app.get("/api/mon/fichas-prospecto", async (req, res) => {
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        if (isSimulated) {
            syncApprovedProspectsSimulation();
            return res.json({
                success: true,
                mode: "simulation",
                data: simulatedFichasProspecto
            });
        }
        else {
            // Query FichasProspecto from the GESTION_PROYECTOS database
            const query = "SELECT * FROM [GESTION_PROYECTOS].[dbo].[FichasProspecto] ORDER BY FechaCreacion DESC";
            const result = await (0, db_client_1.executeQuery)(query);
            const fichas = result?.recordset || [];
            // Auto-activate any that are approved
            await syncApprovedProspectsReal(fichas);
            return res.json({
                success: true,
                mode: "real",
                data: fichas
            });
        }
    }
    catch (error) {
        console.error("❌ Error en API /api/mon/fichas-prospecto:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener fichas de prospectos: " + error.message,
            error: error.message
        });
    }
});
// 18a_2. GET /api/mon/proyectos - Obtener proyectos activos reales de GESTION_PROYECTOS o simulados
app.get("/api/mon/proyectos", async (req, res) => {
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        if (isSimulated) {
            return res.json({
                success: true,
                mode: "simulation",
                data: simulatedProyectos
            });
        }
        else {
            const query = "SELECT * FROM [GESTION_PROYECTOS].[dbo].[Proyectos] WHERE Estado = 'Activo' ORDER BY FechaCreacion DESC";
            const result = await (0, db_client_1.executeQuery)(query);
            return res.json({
                success: true,
                mode: "real",
                data: result?.recordset || []
            });
        }
    }
    catch (error) {
        console.error("❌ Error en API /api/mon/proyectos:", error);
        return res.status(500).json({
            success: false,
            message: "Error al obtener proyectos: " + error.message,
            error: error.message
        });
    }
});
// 18b. PUT /api/mon/fichas-prospecto/:id/estado - Actualizar estado de prospecto para testing e integración
app.put("/api/mon/fichas-prospecto/:id/estado", async (req, res) => {
    try {
        const id = req.params.id;
        const { estado } = req.body;
        if (!estado) {
            return res.status(400).json({ success: false, message: "El campo 'estado' es requerido" });
        }
        const isSimulated = (0, db_client_1.isSimulationMode)();
        if (isSimulated) {
            const ficha = simulatedFichasProspecto.find(f => String(f.Id) === String(id));
            if (!ficha) {
                return res.status(404).json({ success: false, message: "Prospecto no encontrado" });
            }
            ficha.Estado = estado;
            syncApprovedProspectsSimulation();
            return res.json({
                success: true,
                mode: "simulation",
                message: `Estado actualizado a '${estado}' en modo simulación`,
                data: ficha
            });
        }
        else {
            // Read-only query for FichasProspecto table in GESTION_PROYECTOS
            console.log(`ℹ️ [Modo Solo Consulta] Consultando prospecto ${id} sin ejecutar modificaciones en SQL Server...`);
            const fetchQuery = "SELECT * FROM [GESTION_PROYECTOS].[dbo].[FichasProspecto] WHERE Id = @p0";
            const resFetch = await (0, db_client_1.executeQuery)(fetchQuery, [id]);
            const updatedFicha = resFetch?.recordset[0];
            return res.json({
                success: true,
                mode: "real_read_only",
                message: `Consulta realizada con éxito para prospecto ${id} (Modo Solo Lectura: Sin modificaciones).`,
                data: updatedFicha || { Id: id, Estado: estado }
            });
        }
    }
    catch (error) {
        console.error("❌ Error en API /api/mon/fichas-prospecto/:id/estado:", error);
        return res.status(500).json({
            success: false,
            message: "Error al actualizar estado del prospecto: " + error.message,
            error: error.message
        });
    }
});
// ============================================================
// MONITOREO DE DISPONIBILIDAD Y RENDIMIENTO DE OFICORE
// ============================================================
// ============================================================
// MONITOREO DE DISPONIBILIDAD Y RENDIMIENTO DE OFICORE
// ============================================================
let oficoreStatus = {
    disponible: true,
    responseTimeMs: 0,
    responseTimeSec: 0,
    statusCode: 200,
    lastCheck: new Date().toISOString(),
    mensaje: "Sistema operativo y accesible",
    error: null,
    codigoError: null,
    motivoError: null
};
async function monitorOficore() {
    const startTime = Date.now();
    try {
        const LOGIN_URL = "https://oficore.com/";
        const USERNAME = "marrano@ofimundo.cl";
        const PASSWORD = "ma*576394";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        let response = await fetch(LOGIN_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MonitoringBot/1.0"
            },
            body: new URLSearchParams({
                usuario: USERNAME,
                username: USERNAME,
                email: USERNAME,
                password: PASSWORD,
                clave: PASSWORD
            }).toString(),
            signal: controller.signal,
            redirect: "follow"
        }).catch(async () => {
            return await fetch(LOGIN_URL, {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MonitoringBot/1.0"
                },
                signal: controller.signal
            });
        });
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;
        const durationSec = Number((durationMs / 1000).toFixed(2));
        const isOk = response.ok || response.status === 200 || response.status === 302 || response.status === 301 || response.status === 401;
        oficoreStatus = {
            disponible: isOk,
            responseTimeMs: durationMs,
            responseTimeSec: durationSec,
            statusCode: response.status,
            lastCheck: new Date().toISOString(),
            mensaje: isOk
                ? `[UP] Sistema operativo y accesible (${durationSec}s)`
                : `[ADVERTENCIA] Código HTTP inesperado: ${response.status}`,
            error: isOk ? null : `HTTP Status ${response.status}`,
            codigoError: isOk ? null : `HTTP_${response.status}`,
            motivoError: isOk ? null : `El servidor respondió con estado HTTP ${response.status}`
        };
        console.log(`📊 [OFICORE MONITOR] Status: ${oficoreStatus.statusCode}, Tiempo: ${durationSec}s, Disponible: ${oficoreStatus.disponible}`);
    }
    catch (err) {
        const durationMs = Date.now() - startTime;
        const durationSec = Number((durationMs / 1000).toFixed(2));
        const isTimeout = err.name === "AbortError";
        const errorMsg = isTimeout ? "Timeout de conexión (15s excedido)" : (err.message || "Error de conexión");
        const errCode = isTimeout ? "TIMEOUT_15S" : (err.code || "ECONNREFUSED");
        oficoreStatus = {
            disponible: false,
            responseTimeMs: durationMs,
            responseTimeSec: durationSec,
            statusCode: 0,
            lastCheck: new Date().toISOString(),
            mensaje: `[CAÍDA] Error de conexión: ${errorMsg}`,
            error: errorMsg,
            codigoError: errCode,
            motivoError: errorMsg
        };
        console.error(`❌ [OFICORE MONITOR] Error de monitoreo (${durationSec}s):`, errorMsg);
    }
}
// Ejecutar monitoreo de Oficore cada 5 minutos (300.000 ms) y 3s después del inicio
setInterval(monitorOficore, 300000);
setTimeout(monitorOficore, 3000);
app.get("/api/monitor/oficore", (req, res) => {
    return res.json({
        success: true,
        ...oficoreStatus
    });
});
app.get("/api/oficore/stats", (req, res) => {
    return res.json({
        success: true,
        mode: "real",
        stats: {
            disponible: oficoreStatus.disponible,
            responseTimeSec: oficoreStatus.responseTimeSec,
            statusCode: oficoreStatus.statusCode,
            lastCheck: oficoreStatus.lastCheck
        },
        detalles: [],
        count: 0,
        ...oficoreStatus
    });
});
// ============================================================
// MONITOREO DE DISPONIBILIDAD Y RENDIMIENTO DE MI CUENTA
// ============================================================
let miCuentaStatus = {
    disponible: true,
    responseTimeMs: 0,
    responseTimeSec: 0,
    statusCode: 200,
    lastCheck: new Date().toISOString(),
    mensaje: "Sistema operativo y accesible",
    error: null,
    codigoError: null,
    motivoError: null
};
async function monitorMiCuenta() {
    const startTime = Date.now();
    try {
        const LOGIN_URL = "https://oficore.com/";
        const USERNAME = "marrano@ofimundo.cl";
        const PASSWORD = "ma*576394";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        let response = await fetch(LOGIN_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MonitoringBot/1.0"
            },
            body: new URLSearchParams({
                usuario: USERNAME,
                username: USERNAME,
                email: USERNAME,
                password: PASSWORD,
                clave: PASSWORD
            }).toString(),
            signal: controller.signal,
            redirect: "follow"
        }).catch(async () => {
            return await fetch(LOGIN_URL, {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MonitoringBot/1.0"
                },
                signal: controller.signal
            });
        });
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;
        const durationSec = Number((durationMs / 1000).toFixed(2));
        const isOk = response.ok || response.status === 200 || response.status === 302 || response.status === 301 || response.status === 401;
        miCuentaStatus = {
            disponible: isOk,
            responseTimeMs: durationMs,
            responseTimeSec: durationSec,
            statusCode: response.status,
            lastCheck: new Date().toISOString(),
            mensaje: isOk
                ? `[UP] Sistema operativo y accesible (${durationSec}s)`
                : `[ADVERTENCIA] Código HTTP inesperado: ${response.status}`,
            error: isOk ? null : `HTTP Status ${response.status}`,
            codigoError: isOk ? null : `HTTP_${response.status}`,
            motivoError: isOk ? null : `El servidor respondió con estado HTTP ${response.status}`
        };
        console.log(`📊 [MI CUENTA MONITOR] Status: ${miCuentaStatus.statusCode}, Tiempo: ${durationSec}s, Disponible: ${miCuentaStatus.disponible}`);
    }
    catch (err) {
        const durationMs = Date.now() - startTime;
        const durationSec = Number((durationMs / 1000).toFixed(2));
        const isTimeout = err.name === "AbortError";
        const errorMsg = isTimeout ? "Timeout de conexión (15s excedido)" : (err.message || "Error de conexión");
        const errCode = isTimeout ? "TIMEOUT_15S" : (err.code || "ECONNREFUSED");
        miCuentaStatus = {
            disponible: false,
            responseTimeMs: durationMs,
            responseTimeSec: durationSec,
            statusCode: 0,
            lastCheck: new Date().toISOString(),
            mensaje: `[CAÍDA] Error de conexión: ${errorMsg}`,
            error: errorMsg,
            codigoError: errCode,
            motivoError: errorMsg
        };
        console.error(`❌ [MI CUENTA MONITOR] Error de monitoreo (${durationSec}s):`, errorMsg);
    }
}
// Ejecutar monitoreo de Mi Cuenta cada 5 minutos (300.000 ms) y 4s después del inicio
setInterval(monitorMiCuenta, 300000);
setTimeout(monitorMiCuenta, 4000);
app.get("/api/monitor/mi-cuenta", (req, res) => {
    return res.json({
        success: true,
        ...miCuentaStatus
    });
});
app.get("/api/infraestructura/status", (req, res) => {
    return res.json({
        success: true,
        ...zabbixStatus
    });
});
// ✅ API para datos y acceso a Infraestructura con credenciales admin:ofilab2026
app.get("/api/infraestructura", (req, res) => {
    const acceptHeader = req.headers["accept"] || "";
    const formatParam = req.query.format;
    if (acceptHeader.includes("application/json") || formatParam === "json") {
        return res.json({
            success: true,
            url: "http://54.20.80.88:3000/",
            credentials: {
                usuario: "admin",
                contrasena: "ofilab2026"
            }
        });
    }
    return res.redirect("http://54.20.80.88:3000/");
});
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend Express escuchando en http://localhost:${PORT}`);
});
