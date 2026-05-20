// app/api/facturas/ejecutar/route.ts
import { NextResponse } from "next/server";
import { isSimulationMode, executeProcedure } from "@/lib/db-client";
import { PA_EJECUCION_ACEPTACION_RECHAZO } from "@/lib/db-simulation";
import sql from "mssql";

// Cache para almacenar el log de la última ejecución en memoria del servidor
let ultimaEjecucion: any = null;

export async function GET() {
  return NextResponse.json({
    success: true,
    ultimaEjecucion: ultimaEjecucion || {
      mensaje: "No se ha realizado ninguna ejecución en esta sesión.",
      fecha: null,
    },
  });
}

export async function POST() {
  try {
    const isSimulated = isSimulationMode();
    console.log(`[API Ejecutar] Ejecutando proceso RPA. Modo Simulación: ${isSimulated}`);

    if (isSimulated) {
      // 1. MODO SIMULACIÓN: Correr motor de reglas local en TypeScript
      const result = await PA_EJECUCION_ACEPTACION_RECHAZO();
      ultimaEjecucion = {
        fecha: new Date().toISOString(),
        ...result,
      };
      
      return NextResponse.json({
        success: true,
        mode: "simulation",
        ...result,
      });
    } else {
      // 2. MODO REAL: Llamar al procedimiento almacenado en SQL Server
      const start = Date.now();
      
      // El SP principal no requiere parámetros obligatorios de entrada, recorre todo
      const result = await executeProcedure("[RPA].[PA_EJECUCION_ACEPTACION_RECHAZO]");
      
      const durationMs = Date.now() - start;
      const logs = [
        {
          timestamp: new Date().toISOString(),
          message: `🤖 Ejecución de SP Real [RPA].[PA_EJECUCION_ACEPTACION_RECHAZO] completada en ${durationMs}ms`,
          type: "success" as const,
        },
      ];

      ultimaEjecucion = {
        fecha: new Date().toISOString(),
        success: true,
        processedCount: result?.recordset?.length || 0,
        approvedCount: 0, // En SQL Server el SP actualiza tablas internamente
        rejectedCount: 0,
        pendingCount: 0,
        manualCount: 0,
        logs,
        sentMails: [],
      };

      return NextResponse.json({
        success: true,
        mode: "real",
        durationMs,
        recordset: result?.recordset || [],
        outputs: result?.outputs || {},
        logs,
      });
    }
  } catch (error: any) {
    console.error("❌ Error en API /api/facturas/ejecutar:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Error interno al ejecutar el proceso RPA",
      },
      { status: 500 }
    );
  }
}
