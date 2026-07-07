// app/api/facturas/sincronizar/route.ts
import { NextResponse } from "next/server";
import { isSimulationMode, executeProcedure } from "@/lib/db-client";
import {
  getSimulatedDatabase,
  saveSimulatedDatabase,
  PA_UPD_BITACORA_ACEPTACION_RECHAZO,
  PA_UPD_ESTADO_ACEPTACION_RECHAZO,
} from "@/lib/db-simulation";

export async function POST() {
  try {
    const isSimulated = isSimulationMode();
    console.log(`[API Sincronizar] Sincronizando bitácora. Modo Simulación: ${isSimulated}`);

    if (isSimulated) {
      // 1. MODO SIMULACIÓN: Correr lógica de sincronización local
      let db = getSimulatedDatabase();

      // Sincronizar cambios manuales de Softland
      const syncRes = PA_UPD_BITACORA_ACEPTACION_RECHAZO(db);
      db = syncRes.db;

      // Restablecer pendientes por asignación que ahora tienen datos
      const stateRes = PA_UPD_ESTADO_ACEPTACION_RECHAZO(db);
      db = stateRes.db;

      // Guardar base de datos actualizada
      saveSimulatedDatabase(db);

      return NextResponse.json({
        success: true,
        mode: "simulation",
        syncedCount: syncRes.syncedCount,
        updatedCount: stateRes.updatedCount,
        message: `Sincronización completada. Aprobaciones manuales sincronizadas: ${syncRes.syncedCount}. Documentos restablecidos para re-evaluación: ${stateRes.updatedCount}.`,
      });
    } else {
      // 2. MODO REAL: Ejecutar SPs reales en SQL Server
      console.log("🚀 Ejecutando SP: [RPA].[PA_UPD_BITACORA_ACEPTACION_RECHAZO]...");
      const syncResult = await executeProcedure("[RPA].[PA_UPD_BITACORA_ACEPTACION_RECHAZO]");
      
      console.log("🚀 Ejecutando SP: [RPA].[PA_UPD_ESTADO_ACEPTACION_RECHAZO]...");
      const stateResult = await executeProcedure("[RPA].[PA_UPD_ESTADO_ACEPTACION_RECHAZO]");

      return NextResponse.json({
        success: true,
        mode: "real",
        syncResult,
        stateResult,
        message: "Sincronización de SP reales completada con éxito en SQL Server.",
      });
    }
  } catch (error: any) {
    console.error("❌ Error en API /api/facturas/sincronizar:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Error al sincronizar la bitácora",
      },
      { status: 500 }
    );
  }
}
