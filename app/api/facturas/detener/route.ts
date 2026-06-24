// app/api/facturas/detener/route.ts
import { NextResponse } from "next/server";
import { isSimulationMode } from "@/lib/db-client";
import { 
  getProcesoActivo, 
  solicitarDetencionProceso,
  getEstadoCompleto,
  resetearEstadoProceso
} from "@/lib/process-state";

export async function GET() {
  const estado = getEstadoCompleto();
  return NextResponse.json({
    success: true,
    ...estado,
    mensaje: estado.procesoActivo 
      ? `El proceso de facturación está actualmente en ejecución (${estado.tiempoEjecucionSegundos} segundos)` 
      : "No hay ningún proceso activo en este momento",
  });
}

export async function POST() {
  try {
    const isSimulated = isSimulationMode();
    console.log(`[API Detener] Solicitando detención del proceso RPA. Modo Simulación: ${isSimulated}`);

    // Verificar si hay un proceso activo para detener
    if (!getProcesoActivo()) {
      return NextResponse.json({
        success: false,
        message: "No hay ningún proceso activo para detener en este momento.",
      }, { status: 400 });
    }

    if (isSimulated) {
      // MODO SIMULACIÓN
      solicitarDetencionProceso();
      
      console.log("[API Detener] Proceso detenido por usuario en modo simulación");
      
      return NextResponse.json({
        success: true,
        mode: "simulation",
        message: "El proceso de facturación ha sido detenido correctamente (modo simulación).",
        detenidoEn: new Date().toISOString(),
      });
    } else {
      // MODO REAL
      console.log("[API Detener] Deteniendo proceso en modo real...");
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      solicitarDetencionProceso();
      
      return NextResponse.json({
        success: true,
        mode: "real",
        message: "La solicitud de detención ha sido enviada. El proceso se detendrá en el próximo ciclo.",
        detenidoEn: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error("❌ Error en API /api/facturas/detener:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Error interno al intentar detener el proceso RPA",
      },
      { status: 500 }
    );
  }
}

// Endpoint para resetear el estado (útil para pruebas)
export async function DELETE() {
  resetearEstadoProceso();
  return NextResponse.json({
    success: true,
    message: "Estado del proceso reseteado correctamente",
  });
}