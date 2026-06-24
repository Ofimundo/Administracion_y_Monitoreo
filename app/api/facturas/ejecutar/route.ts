// app/api/facturas/ejecutar/route.ts (ACTUALIZADO)
import { NextResponse } from "next/server";
import { isSimulationMode, executeProcedure } from "@/lib/db-client";
import { PA_EJECUCION_ACEPTACION_RECHAZO } from "@/lib/db-simulation";
import { marcarInicioProceso, marcarFinProceso, debeDetenerseProceso } from "./detener/route";

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
  // Verificar si ya hay un proceso activo
  if (procesoActivo) {
    return NextResponse.json({
      success: false,
      message: "Ya hay un proceso de facturación en ejecución. Por favor, espera a que termine o detén el proceso actual.",
    }, { status: 409 });
  }

  try {
    const isSimulated = isSimulationMode();
    console.log(`[API Ejecutar] Ejecutando proceso RPA. Modo Simulación: ${isSimulated}`);

    // Marcar inicio del proceso
    marcarInicioProceso();

    if (isSimulated) {
      // 1. MODO SIMULACIÓN: Correr motor de reglas local en TypeScript
      const result = await PA_EJECUCION_ACEPTACION_RECHAZO();
      
      ultimaEjecucion = {
        fecha: new Date().toISOString(),
        ...result,
      };
      
      // Marcar fin del proceso
      marcarFinProceso();
      
      return NextResponse.json({
        success: true,
        mode: "simulation",
        ...result,
      });
    } else {
      // 2. MODO REAL: Llamar al procedimiento almacenado en SQL Server
      const start = Date.now();
      
      // Función para ejecutar el SP con verificación de detención
      const ejecutarConDetencion = async () => {
        // Verificar si se solicitó detener antes de ejecutar
        if (debeDetenerseProceso()) {
          throw new Error("Proceso detenido por solicitud del usuario antes de iniciar");
        }
        
        const result = await executeProcedure("[RPA].[PA_EJECUCION_ACEPTACION_RECHAZO]");
        
        // Verificar nuevamente después de la ejecución
        if (debeDetenerseProceso()) {
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
          type: "success" as const,
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

      // Marcar fin del proceso
      marcarFinProceso();

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
    
    // Marcar fin del proceso en caso de error
    marcarFinProceso();
    
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Error interno al ejecutar el proceso RPA",
      },
      { status: 500 }
    );
  }
}

// Importar la variable desde el módulo detener
import { procesoActivo } from "./detener/route";