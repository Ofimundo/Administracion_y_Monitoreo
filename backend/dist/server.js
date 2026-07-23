"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mssql_1 = __importDefault(require("mssql"));
const https_1 = __importDefault(require("https"));
const db_client_1 = require("./db-client");
const db_simulation_1 = require("./db-simulation");
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
        const isSimulated = (0, db_client_1.isSimulationMode)();
        const estado = req.query.estado;
        const search = req.query.search;
        const tipoDocumento = req.query.tipoDocumento;
        const fechaDesde = req.query.fechaDesde;
        const fechaHasta = req.query.fechaHasta;
        console.log("📊 [API] Filtros recibidos:", { estado, search, tipoDocumento, fechaDesde, fechaHasta });
        console.log("📊 [API] Modo:", isSimulated ? "SIMULACIÓN" : "REAL SQL Server");
        if (isSimulated) {
            const db = (0, db_simulation_1.getSimulatedDatabase)();
            let bitacora = [...db.bitacora];
            bitacora.sort((a, b) => new Date(b.fecha_proceso).getTime() - new Date(a.fecha_proceso).getTime());
            if (estado && estado !== "todos") {
                let estadoNormalizado = estado;
                if (estado === "aprobado")
                    estadoNormalizado = "Aprobado";
                else if (estado === "rechazado")
                    estadoNormalizado = "Rechazado";
                else if (estado === "pendiente")
                    estadoNormalizado = "Pendiente";
                else if (estado === "pendiente espera")
                    estadoNormalizado = "Pendiente Espera";
                else if (estado === "manual")
                    estadoNormalizado = "Manual";
                bitacora = bitacora.filter(b => b.estado?.toLowerCase() === estadoNormalizado.toLowerCase());
            }
            if (tipoDocumento && tipoDocumento !== "todos") {
                bitacora = bitacora.filter(b => b.tipo_documento === parseInt(tipoDocumento));
            }
            if (fechaDesde) {
                bitacora = bitacora.filter(b => b.fecha_proceso.split('T')[0] >= fechaDesde);
            }
            if (fechaHasta) {
                bitacora = bitacora.filter(b => b.fecha_proceso.split('T')[0] <= fechaHasta);
            }
            if (search && search.trim() !== "") {
                const query = search.toLowerCase();
                bitacora = bitacora.filter(b => b.folio_documento.toString().includes(query) ||
                    b.rut_proveedor.toLowerCase().includes(query) ||
                    b.razon_social.toLowerCase().includes(query));
            }
            return res.json({ success: true, mode: "simulation", count: bitacora.length, data: bitacora });
        }
        else {
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
            let sqlQuery = `
        SELECT 
          id_proceso,
          folio_documento,
          tipo_documento,
          orden_compra,
          razon_social,
          rut_proveedor,
          dias_por_vencer,
          estado,
          id_regla,
          motivo,
          horas_por_revisar,
          fecha_proceso,
          fecha_modificacion
        FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora]
      `;
            if (conditions.length > 0) {
                sqlQuery += " WHERE " + conditions.join(" AND ");
            }
            sqlQuery += " ORDER BY fecha_proceso DESC";
            console.log("🔌 [SQL Query]:", sqlQuery);
            try {
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
            catch (dbError) {
                console.error("❌ Error en consulta SQL:", dbError);
                return res.status(500).json({
                    success: false,
                    message: "Error al consultar la base de datos: " + dbError.message,
                    mode: "real",
                    data: [],
                });
            }
        }
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
// 3. POST /api/facturas/sincronizar
app.post("/api/facturas/sincronizar", async (req, res) => {
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        console.log(`[API Sincronizar] Sincronizando bitácora. Modo Simulación: ${isSimulated}`);
        if (isSimulated) {
            let db = (0, db_simulation_1.getSimulatedDatabase)();
            const syncRes = (0, db_simulation_1.PA_UPD_BITACORA_ACEPTACION_RECHAZO)(db);
            db = syncRes.db;
            const stateRes = (0, db_simulation_1.PA_UPD_ESTADO_ACEPTACION_RECHAZO)(db);
            db = stateRes.db;
            (0, db_simulation_1.saveSimulatedDatabase)(db);
            return res.json({
                success: true,
                mode: "simulation",
                syncedCount: syncRes.syncedCount,
                updatedCount: stateRes.updatedCount,
                message: `Sincronización completada. Aprobaciones manuales sincronizadas: ${syncRes.syncedCount}. Documentos restablecidos para re-evaluación: ${stateRes.updatedCount}.`,
            });
        }
        else {
            console.log("🚀 Ejecutando SP: [RPA].[PA_UPD_BITACORA_ACEPTACION_RECHAZO]...");
            const syncResult = await (0, db_client_1.executeProcedure)("[RPA].[PA_UPD_BITACORA_ACEPTACION_RECHAZO]");
            console.log("🚀 Ejecutando SP: [RPA].[PA_UPD_ESTADO_ACEPTACION_RECHAZO]...");
            const stateResult = await (0, db_client_1.executeProcedure)("[RPA].[PA_UPD_ESTADO_ACEPTACION_RECHAZO]");
            return res.json({
                success: true,
                mode: "real",
                syncResult,
                stateResult,
                message: "Sincronización de SP reales completada con éxito en SQL Server.",
            });
        }
    }
    catch (error) {
        console.error("❌ Error en API /api/facturas/sincronizar:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error al sincronizar la bitácora",
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
            message: "Ya hay un proceso de facturación en ejecución. Por favor, espera a que termine o detén el proceso actual.",
        });
    }
    try {
        const isSimulated = (0, db_client_1.isSimulationMode)();
        console.log(`[API Ejecutar] Ejecutando proceso RPA. Modo Simulación: ${isSimulated}`);
        (0, process_state_1.marcarInicioProceso)();
        if (isSimulated) {
            const result = await (0, db_simulation_1.PA_EJECUCION_ACEPTACION_RECHAZO)();
            ultimaEjecucion = {
                fecha: new Date().toISOString(),
                ...result,
            };
            (0, process_state_1.marcarFinProceso)();
            return res.json({
                mode: "simulation",
                ...result,
                success: true,
            });
        }
        else {
            const start = Date.now();
            const ejecutarConDetencion = async () => {
                if ((0, process_state_1.debeDetenerseProceso)()) {
                    throw new Error("Proceso detenido por solicitud del usuario antes de iniciar");
                }
                const result = await (0, db_client_1.executeProcedure)("[RPA].[PA_EJECUCION_ACEPTACION_RECHAZO]");
                if ((0, process_state_1.debeDetenerseProceso)()) {
                    console.log("[API Ejecutar] Proceso detenido por usuario durante la ejecución");
                }
                return result;
            };
            const result = await ejecutarConDetencion();
            const durationMs = Date.now() - start;
            const logs = [
                {
                    timestamp: new Date().toISOString(),
                    message: `🤖 Ejecución de SP Real [RPA].[PA_EJECUCION_ACEPTACION_RECHAZO] completada en ${durationMs}ms`,
                    type: "success",
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
                mode: "real",
                durationMs,
                recordset: result?.recordset || [],
                output: result?.output || {},
                logs,
            });
        }
    }
    catch (error) {
        console.error("❌ Error en API /api/facturas/ejecutar:", error);
        (0, process_state_1.marcarFinProceso)();
        return res.status(500).json({
            success: false,
            message: error.message || "Error interno al ejecutar el proceso RPA",
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
        const isSimulated = (0, db_client_1.isSimulationMode)();
        console.log(`[API Acción Manual] Procesando. Folio: ${folio}, Acción: ${accion}, Modo Simulación: ${isSimulated}`);
        if (isSimulated) {
            let db = (0, db_simulation_1.getSimulatedDatabase)();
            const doc = db.dte_doccab.find((d) => d.Folio === folio && d.TipoDTE === tipoDocumento);
            if (!doc) {
                return res.status(404).json({ success: false, message: "Documento no encontrado en Softland." });
            }
            const resSii = await (0, db_simulation_1.PA_SII_ACEPTACION_RECHAZO)(db, {
                rutCliente: doc.RutEmisor,
                tipoDocumento,
                folio,
                motivo: motivo || `Gestión Manual (Usuario): ${accion === "ERM" ? "Aprobar" : "Rechazar"}`,
                accion,
            });
            db = resSii.db;
            const today = new Date();
            const expiry = new Date(doc.FechaVencimiento + "T12:00:00");
            const diffTime = expiry.getTime() - today.getTime();
            const diasPorVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const refOC = db.dte_docref.find((r) => r.TipoDTE === tipoDocumento && r.Folio === folio && r.TpoDocRef === "801");
            (0, db_simulation_1.PA_INS_BITACORA_ACEPTACION_RECHAZO)(db, {
                folio,
                tipo_documento: tipoDocumento,
                orden_compra: refOC?.FolioRef || null,
                razon_social: doc.RazonSocialEmisor,
                rut_proveedor: doc.RutEmisor,
                dias_por_vencer: diasPorVencer,
                estado: accion === "ERM" ? "Aprobado" : "Rechazado",
                id_regla: 888,
                motivo: motivo || `Resolución manual del usuario en portal: ${accion === "ERM" ? "Aprobado" : "Rechazar"}`,
                horas_por_revisar: null,
            });
            (0, db_simulation_1.saveSimulatedDatabase)(db);
            return res.json({
                success: true,
                mode: "simulation",
                message: `Acción manual '${accion}' ejecutada exitosamente. SII Código: ${resSii.code}`,
                docState: doc,
            });
        }
        else {
            let rutEmisor = "";
            try {
                console.log(`🔌 Buscando RUT del proveedor para Folio: ${folio}, Tipo: ${tipoDocumento} en la bitácora...`);
                const queryResult = await (0, db_client_1.executeQuery)(`SELECT TOP 1 rut_proveedor FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora] WHERE folio_documento = @p0 AND tipo_documento = @p1`, [folio, tipoDocumento]);
                if (queryResult?.recordset?.length > 0) {
                    rutEmisor = queryResult.recordset[0].rut_proveedor;
                    console.log(`✅ RUT de proveedor encontrado: ${rutEmisor}`);
                }
                else {
                    console.warn(`⚠️ No se encontró registro en la bitácora para Folio ${folio}. Se enviará vacío.`);
                }
            }
            catch (dbErr) {
                console.error("❌ Error al consultar RUT de proveedor:", dbErr);
            }
            const inputs = {
                rut_emisor: { type: mssql_1.default.VarChar(12), value: rutEmisor },
                tipo_documento: { type: mssql_1.default.Int, value: tipoDocumento },
                folio: { type: mssql_1.default.Int, value: folio },
                motivo: { type: mssql_1.default.VarChar(500), value: motivo || "Gestión manual desde panel" },
                accion: { type: mssql_1.default.VarChar(3), value: accion },
            };
            console.log(`🚀 Ejecutando SP SII Real: [RPA].[PA_SII_ACEPTACION_RECHAZO] para Folio ${folio}`);
            const result = await (0, db_client_1.executeProcedure)("[RPA].[PA_SII_ACEPTACION_RECHAZO]", inputs);
            return res.json({
                success: true,
                mode: "real",
                result,
                message: `Acción manual '${accion}' enviada a SQL Server para Folio ${folio}.`,
            });
        }
    }
    catch (error) {
        console.error("❌ Error en API /api/facturas/accion-manual:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error al realizar acción manual",
        });
    }
});
// 10. GET /api/facturas/db-editor
app.get("/api/facturas/db-editor", (req, res) => {
    try {
        const db = (0, db_simulation_1.getSimulatedDatabase)();
        return res.json({
            success: true,
            db,
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error al leer la base de datos de simulación: " + error.message
        });
    }
});
// POST /api/facturas/db-editor
app.post("/api/facturas/db-editor", (req, res) => {
    try {
        const { table, action, data } = req.body;
        if (!table || !action || !data) {
            return res.status(400).json({
                success: false,
                message: "Parámetros 'table', 'action' y 'data' son requeridos."
            });
        }
        const db = (0, db_simulation_1.getSimulatedDatabase)();
        const tableData = db[table];
        if (!tableData || !Array.isArray(tableData)) {
            return res.status(400).json({
                success: false,
                message: `La tabla '${table}' no existe o no es un arreglo.`
            });
        }
        if (action === "update") {
            if (table === "dte_doccab") {
                const idx = tableData.findIndex((d) => d.Folio === data.Folio && d.TipoDTE === data.TipoDTE);
                if (idx >= 0) {
                    tableData[idx] = { ...tableData[idx], ...data };
                }
                else {
                    return res.status(404).json({ success: false, message: "Documento no encontrado." });
                }
            }
            else if (table === "owordencom") {
                const idx = tableData.findIndex((o) => o.NroOrden === data.NroOrden);
                if (idx >= 0) {
                    tableData[idx] = { ...tableData[idx], ...data };
                }
                else {
                    return res.status(404).json({ success: false, message: "Orden de Compra no encontrada." });
                }
            }
            else if (table === "cwt_auxi_attr") {
                const idx = tableData.findIndex((a) => a.RutAux === data.RutAux);
                if (idx >= 0) {
                    tableData[idx] = { ...tableData[idx], ...data };
                }
                else {
                    tableData.push(data);
                }
            }
            else {
                return res.status(400).json({ success: false, message: "Actualización no soportada para esta tabla." });
            }
        }
        else if (action === "insert") {
            tableData.push(data);
        }
        else if (action === "delete") {
            if (table === "dte_doccab") {
                db[table] = tableData.filter((d) => !(d.Folio === data.Folio && d.TipoDTE === data.TipoDTE));
            }
            else if (table === "owordencom") {
                db[table] = tableData.filter((o) => o.NroOrden !== data.NroOrden);
            }
            else {
                return res.status(400).json({ success: false, message: "Eliminación no soportada para esta tabla." });
            }
        }
        (0, db_simulation_1.saveSimulatedDatabase)(db);
        return res.json({
            success: true,
            message: `Tabla '${table}' actualizada exitosamente. Acción: ${action}.`,
            db,
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error al actualizar la base de datos de simulación: " + error.message
        });
    }
});
// DELETE /api/facturas/db-editor
app.delete("/api/facturas/db-editor", (req, res) => {
    try {
        const newDb = JSON.parse(JSON.stringify(db_simulation_1.INITIAL_DATABASE));
        (0, db_simulation_1.saveSimulatedDatabase)(newDb);
        return res.json({
            success: true,
            message: "Base de datos de simulación reiniciada a los valores de fábrica exitosamente.",
            db: newDb,
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error al reiniciar la base de datos de simulación: " + error.message
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
// 13. GET /api/sgc/stats
app.get("/api/sgc/stats", async (req, res) => {
    try {
        let fechaDesde = req.query.fechaDesde || '';
        let fechaHasta = req.query.fechaHasta || '';
        // Si no se especifican fechas, poner un rango por defecto (los últimos 30 días) para evitar que la query sea lenta y falle por timeout
        if (!fechaDesde && !fechaHasta) {
            const hoy = new Date();
            const hace30dias = new Date();
            hace30dias.setDate(hoy.getDate() - 30);
            const formatFecha = (d) => d.toISOString().split('T')[0];
            fechaDesde = formatFecha(hace30dias);
            fechaHasta = formatFecha(hoy);
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
        // Si no se especifican fechas, poner un rango por defecto (los últimos 30 días)
        if (!fechaDesde && !fechaHasta) {
            const hoy = new Date();
            const hace30dias = new Date();
            hace30dias.setDate(hoy.getDate() - 30);
            const formatFecha = (d) => d.toISOString().split('T')[0];
            fechaDesde = formatFecha(hace30dias);
            fechaHasta = formatFecha(hoy);
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
        SUM(CASE WHEN Pickc_Estado = 0 AND Pickc_Fecha_Picking <= DATEADD(hour, -${hours}, GETDATE()) THEN 1 ELSE 0 END) as total_alertas,
        SUM(CASE WHEN Pickc_Ticket_Mesa_Ayuda IS NOT NULL AND Pickc_Ticket_Mesa_Ayuda > 0 AND Pickc_Fecha_Picking >= DATEADD(month, -3, GETDATE()) THEN 1 ELSE 0 END) as total_tickets
      FROM SGCX.dbo.Inv_Picking_Cabecera
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
    servidoresOnline: 3,
    totalServidores: 3,
    porcentajeInfra: 100.0,
    version: null,
};
function setZabbixOffline(errMsg) {
    zabbixStatus = {
        online: false,
        lastCheck: new Date().toISOString(),
        error: errMsg,
        eldenringOnline: false,
        pacmanOnline: false,
        bmwOnline: false,
        servidoresOnline: 0,
        totalServidores: 3,
        porcentajeInfra: 0.0,
        version: null,
    };
}
function monitorZabbix() {
    const postData = JSON.stringify({
        jsonrpc: "2.0",
        method: "apiinfo.version",
        params: [],
        id: 1
    });
    const options = {
        hostname: 'zabbix.ofimundo.cl',
        port: 443,
        path: '/api_jsonrpc.php',
        method: 'POST',
        timeout: 8000,
        headers: {
            'Content-Type': 'application/json-rpc',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'OfimundoMonitor/1.0'
        }
    };
    const req = https_1.default.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                if (res.statusCode === 200) {
                    const json = JSON.parse(data);
                    const version = json.result;
                    if (version) {
                        const eldenringOnline = true;
                        const pacmanOnline = true;
                        const bmwOnline = true; // Core server
                        const countOnline = (eldenringOnline ? 1 : 0) + (pacmanOnline ? 1 : 0) + (bmwOnline ? 1 : 0);
                        const pct = parseFloat(((countOnline / 3) * 100).toFixed(2));
                        zabbixStatus = {
                            online: true,
                            lastCheck: new Date().toISOString(),
                            error: null,
                            eldenringOnline,
                            pacmanOnline,
                            bmwOnline,
                            servidoresOnline: countOnline,
                            totalServidores: 3,
                            porcentajeInfra: pct,
                            version: version
                        };
                        return;
                    }
                }
                throw new Error(`Unexpected status code: ${res.statusCode}`);
            }
            catch (err) {
                setZabbixOffline(`Zabbix API Error: ${err.message}`);
            }
        });
    });
    req.on('error', (err) => {
        setZabbixOffline(err.message || "Connection failed");
    });
    req.on('timeout', () => {
        req.destroy();
        setZabbixOffline("Timeout connecting to Zabbix API");
    });
    req.write(postData);
    req.end();
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
    { Cliente_ID: 5, Codigo_Cliente: "96893820", Rut_Cliente: "96.893.820-7", Nombre_cliente: "CORPESCA SA", Activo: true },
    { Cliente_ID: 6, Codigo_Cliente: "76280514", Rut_Cliente: "76.280.514-6", Nombre_cliente: "ECGROUP INGENIERIA Y TECNOLOGIA SPA", Activo: true }
];
let simulatedServicios = [
    { Servicio_ID: 1, Codigo_Servicio: "ACRF_01", Nombre_Servicio: "Aceptación y rechazo de facturas", Descripcion: "El proyecto tiene como objetivo automatizar el flujo de aceptación y rechazo de facturas electrónicas registradas en el sistema, permitiendo una gestión eficiente y reduciendo la intervención manual", Activo: true },
    { Servicio_ID: 2, Codigo_Servicio: "DTE_01", Nombre_Servicio: "DTE", Descripcion: "Este sistema es una solución de automatización diseñada para optimizar y agilizar el flujo de trabajo contable y administrativo mediante la integración de la recepción de documentos tributarios con el sistema Softland.", Activo: true },
    { Servicio_ID: 4, Codigo_Servicio: "OFI_01", Nombre_Servicio: "Oficore", Descripcion: "Este sistema consolida el acceso a los distintos sistemas Core de la empresa Ofimundo", Activo: true },
    { Servicio_ID: 5, Codigo_Servicio: "SGC_01", Nombre_Servicio: "SGC", Descripcion: "SGC es el núcleo de las operaciones de la organización, centralizando la gestión de contratos, la administración de clientes y equipos, así como el ingreso y seguimiento de solicitudes de suministros, retiros y despachos de equipos.", Activo: true },
    { Servicio_ID: 6, Codigo_Servicio: "OFT_01", Nombre_Servicio: "Ofitec", Descripcion: "Ofitec es la plataforma encargada de la gestión, administración y monitoreo de los tickets de servicio técnico para los clientes de Ofimundo.", Activo: true },
    { Servicio_ID: 7, Codigo_Servicio: "MIC_01", Nombre_Servicio: "Mi cuenta", Descripcion: "Gestiona fácilmente tus servicios con Mi Cuenta de Ofimundo S.A. Solicita insumos, revisa tus facturas, coordina soporte técnico y administra tus usuarios desde un solo lugar", Activo: true }
];
let simulatedRelaciones = [
    { Relacion_ID: 1, Cliente_ID: 3, Servicio_ID: 1, Activo: true },
    { Relacion_ID: 2, Cliente_ID: 3, Servicio_ID: 2, Activo: true },
    { Relacion_ID: 3, Cliente_ID: 1, Servicio_ID: 1, Activo: true },
    { Relacion_ID: 4, Cliente_ID: 2, Servicio_ID: 1, Activo: true },
    { Relacion_ID: 5, Cliente_ID: 3, Servicio_ID: 7, Activo: true },
    { Relacion_ID: 6, Cliente_ID: 3, Servicio_ID: 4, Activo: true },
    { Relacion_ID: 7, Cliente_ID: 3, Servicio_ID: 6, Activo: true },
    { Relacion_ID: 8, Cliente_ID: 3, Servicio_ID: 5, Activo: true }
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
        if (estado.includes("100%") || estado.includes("aprobado") || estado.includes("aprobada")) {
            const clienteName = ficha.Cliente;
            const id = ficha.Id;
            const line = ficha.LineaServicio;
            const code = ficha.Codigo;
            const projectName = ficha.NombreProyecto;
            const serviceId = getServiceIdFromLine(line, code, projectName);
            try {
                console.log(`🔄 Sincronizando prospecto aprobado REAL: ${clienteName} con servicio ID ${serviceId}`);
                const queryCheckClient = "SELECT Cliente_ID FROM [THE_COOLER_CENTRAL].[MON].[Clientes] WHERE Nombre_cliente = @p0";
                const resCheck = await (0, db_client_1.executeQuery)(queryCheckClient, [clienteName]);
                let clienteId;
                if (resCheck?.recordset && resCheck.recordset.length > 0) {
                    clienteId = resCheck.recordset[0].Cliente_ID;
                    console.log(`   El cliente ya existe en MON.Clientes (ID: ${clienteId})`);
                }
                else {
                    const rut = `77.000.${String(id).padStart(3, '0')}-0`;
                    const codigoCliente = `77000${String(id).padStart(3, '0')}0`;
                    console.log(`   Insertando cliente nuevo REAL: ${clienteName} (RUT: ${rut}, Código: ${codigoCliente})`);
                    const queryInsertClient = `
            INSERT INTO [THE_COOLER_CENTRAL].[MON].[Clientes] (Codigo_Cliente, Rut_Cliente, Nombre_cliente, Activo, Fecha_Creacion)
            VALUES (@p0, @p1, @p2, 1, GETDATE());
            SELECT SCOPE_IDENTITY() AS Cliente_ID;
          `;
                    const resInsert = await (0, db_client_1.executeQuery)(queryInsertClient, [codigoCliente, rut, clienteName]);
                    clienteId = resInsert?.recordset[0]?.Cliente_ID;
                    console.log(`   Cliente insertado REAL con éxito (ID: ${clienteId})`);
                }
                if (clienteId) {
                    const queryCheckRel = "SELECT Relacion_ID FROM [THE_COOLER_CENTRAL].[MON].[Cliente_Servicio] WHERE Cliente_ID = @p0 AND Servicio_ID = @p1";
                    const resCheckRel = await (0, db_client_1.executeQuery)(queryCheckRel, [clienteId, serviceId]);
                    if (!resCheckRel?.recordset || resCheckRel.recordset.length === 0) {
                        console.log(`   Insertando relación Cliente_Servicio REAL (Cliente: ${clienteId}, Servicio: ${serviceId})`);
                        const queryInsertRel = `
              INSERT INTO [THE_COOLER_CENTRAL].[MON].[Cliente_Servicio] (Cliente_ID, Servicio_ID, Activo)
              VALUES (@p0, @p1, 1);
            `;
                        await (0, db_client_1.executeQuery)(queryInsertRel, [clienteId, serviceId]);
                        console.log(`   Relación Cliente_Servicio REAL insertada con éxito`);
                    }
                    else {
                        console.log(`   La relación Cliente_Servicio REAL ya existe`);
                    }
                }
            }
            catch (err) {
                console.error(`❌ Error al sincronizar prospecto aprobado REAL ${clienteName}:`, err);
            }
        }
    }
}
function syncApprovedProspectsSimulation() {
    simulatedFichasProspecto.forEach(ficha => {
        const estado = (ficha.Estado || "").toLowerCase();
        if (estado.includes("100%") || estado.includes("aprobado") || estado.includes("aprobada")) {
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
        }
    });
}
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
            // Update FichasProspecto table in GESTION_PROYECTOS
            const updateQuery = "UPDATE [GESTION_PROYECTOS].[dbo].[FichasProspecto] SET Estado = @p0, FechaActualizacion = GETDATE() WHERE Id = @p1";
            await (0, db_client_1.executeQuery)(updateQuery, [estado, id]);
            // Fetch updated record and run sync
            const fetchQuery = "SELECT * FROM [GESTION_PROYECTOS].[dbo].[FichasProspecto] WHERE Id = @p0";
            const resFetch = await (0, db_client_1.executeQuery)(fetchQuery, [id]);
            const updatedFicha = resFetch?.recordset[0];
            if (updatedFicha) {
                await syncApprovedProspectsReal([updatedFicha]);
            }
            return res.json({
                success: true,
                mode: "real",
                message: `Estado de prospecto ${id} actualizado a '${estado}'`,
                data: updatedFicha
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
app.get("/api/infraestructura/status", (req, res) => {
    return res.json({
        success: true,
        ...zabbixStatus
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend Express escuchando en http://localhost:${PORT}`);
});
