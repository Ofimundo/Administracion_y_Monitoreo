// app/api/facturas/accion-manual/route.ts
import { NextResponse } from "next/server";
import { isSimulationMode, executeProcedure } from "@/lib/db-client";
import {
  getSimulatedDatabase,
  saveSimulatedDatabase,
  PA_SII_ACEPTACION_RECHAZO,
  PA_INS_BITACORA_ACEPTACION_RECHAZO,
} from "@/lib/db-simulation";
import sql from "mssql";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { folio, tipoDocumento, accion, motivo } = body; // accion: 'ERM' (Aprobar) | 'RFT' (Rechazar)

    if (!folio || !tipoDocumento || !accion) {
      return NextResponse.json(
        { success: false, message: "Parámetros 'folio', 'tipoDocumento' y 'accion' son requeridos." },
        { status: 400 }
      );
    }

    const isSimulated = isSimulationMode();
    console.log(`[API Acción Manual] Procesando. Folio: ${folio}, Acción: ${accion}, Modo Simulación: ${isSimulated}`);

    if (isSimulated) {
      // 1. MODO SIMULACIÓN: Correr API del SII simulada
      let db = getSimulatedDatabase();

      // Encontrar el documento
      const doc = db.dte_doccab.find((d) => d.Folio === folio && d.TipoDTE === tipoDocumento);
      if (!doc) {
        return NextResponse.json({ success: false, message: "Documento no encontrado en Softland." }, { status: 404 });
      }

      // Llamar a la simulación del SII
      const res = await PA_SII_ACEPTACION_RECHAZO(db, {
        rutCliente: doc.RutEmisor,
        tipoDocumento,
        folio,
        motivo: motivo || `Gestión Manual (Usuario): ${accion === "ERM" ? "Aprobar" : "Rechazar"}`,
        accion,
      });
      db = res.db;

      // Calcular días por vencer
      const today = new Date();
      const expiry = new Date(doc.FechaVencimiento + "T12:00:00");
      const diffTime = expiry.getTime() - today.getTime();
      const diasPorVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Buscar si tiene OC referenciada
      const refOC = db.dte_docref.find((r) => r.TipoDTE === tipoDocumento && r.Folio === folio && r.TpoDocRef === "801");

      // Actualizar bitácora
      PA_INS_BITACORA_ACEPTACION_RECHAZO(db, {
        folio,
        tipo_documento: tipoDocumento,
        orden_compra: refOC?.FolioRef || null,
        razon_social: doc.RazonSocialEmisor,
        rut_proveedor: doc.RutEmisor,
        dias_por_vencer: diasPorVencer,
        estado: accion === "ERM" ? "Aprobado" : "Rechazado",
        id_regla: 888, // 888 indica resolución manual en bitácora
        motivo: motivo || `Resolución manual del usuario en portal: ${accion === "ERM" ? "Aprobado" : "Rechazado"}`,
        horas_por_revisar: null,
      });

      // Guardar base de datos
      saveSimulatedDatabase(db);

      return NextResponse.json({
        success: true,
        mode: "simulation",
        message: `Acción manual '${accion}' ejecutada exitosamente. SII Código: ${res.code}`,
        docState: doc,
      });
    } else {
      // 2. MODO REAL: Ejecutar SP real [RPA].[PA_SII_ACEPTACION_RECHAZO] en SQL Server
      const inputs = {
        rut_emisor: { type: sql.VarChar(12), value: "" }, // Necesitamos sacar el RUT de algún lado, idealmente pasarlo o consultarlo
        tipo_documento: { type: sql.Int, value: tipoDocumento },
        folio: { type: sql.Int, value: folio },
        motivo: { type: sql.VarChar(500), value: motivo || "Gestión manual desde panel" },
        accion: { type: sql.VarChar(3), value: accion },
      };

      console.log(`🚀 Ejecutando SP SII Real: [RPA].[PA_SII_ACEPTACION_RECHAZO] para Folio ${folio}`);
      const result = await executeProcedure("[RPA].[PA_SII_ACEPTACION_RECHAZO]", inputs);

      return NextResponse.json({
        success: true,
        mode: "real",
        result,
        message: `Acción manual '${accion}' enviada a SQL Server para Folio ${folio}.`,
      });
    }
  } catch (error: any) {
    console.error("❌ Error en API /api/facturas/accion-manual:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Error al realizar acción manual",
      },
      { status: 500 }
    );
  }
}
