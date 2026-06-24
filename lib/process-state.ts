// lib/process-state.ts
// Estado compartido entre los endpoints de API para controlar la ejecución de procesos

let procesoActivo = false;
let procesoDetenidoPorUsuario = false;
let procesoActual: string | null = null;
let tiempoInicioProceso: Date | null = null;

export function getProcesoActivo(): boolean {
  return procesoActivo;
}

export function setProcesoActivo(activo: boolean): void {
  procesoActivo = activo;
  if (!activo) {
    procesoActual = null;
    tiempoInicioProceso = null;
  }
}

export function getProcesoDetenidoPorUsuario(): boolean {
  return procesoDetenidoPorUsuario;
}

export function setProcesoDetenidoPorUsuario(detenido: boolean): void {
  procesoDetenidoPorUsuario = detenido;
}

export function getProcesoActual(): string | null {
  return procesoActual;
}

export function setProcesoActual(procesoId: string | null): void {
  procesoActual = procesoId;
}

export function getTiempoInicioProceso(): Date | null {
  return tiempoInicioProceso;
}

export function marcarInicioProceso(procesoId: string = "facturas"): void {
  procesoActivo = true;
  procesoDetenidoPorUsuario = false;
  procesoActual = procesoId;
  tiempoInicioProceso = new Date();
  console.log(`[ProcessState] Proceso "${procesoId}" iniciado en ${tiempoInicioProceso.toISOString()}`);
}

export function marcarFinProceso(): void {
  if (procesoActivo) {
    const duracion = tiempoInicioProceso 
      ? Math.round((new Date().getTime() - tiempoInicioProceso.getTime()) / 1000)
      : 0;
    console.log(`[ProcessState] Proceso "${procesoActual}" finalizado. Duración: ${duracion} segundos`);
  }
  procesoActivo = false;
  procesoDetenidoPorUsuario = false;
  procesoActual = null;
  tiempoInicioProceso = null;
}

export function debeDetenerseProceso(): boolean {
  return procesoDetenidoPorUsuario;
}

export function solicitarDetencionProceso(): void {
  procesoDetenidoPorUsuario = true;
  console.log(`[ProcessState] Solicitud de detención registrada para proceso "${procesoActual}"`);
}

export function resetearEstadoProceso(): void {
  procesoActivo = false;
  procesoDetenidoPorUsuario = false;
  procesoActual = null;
  tiempoInicioProceso = null;
  console.log("[ProcessState] Estado de proceso reseteado completamente");
}

export function getEstadoCompleto() {
  return {
    procesoActivo,
    procesoDetenidoPorUsuario,
    procesoActual,
    tiempoInicioProceso: tiempoInicioProceso?.toISOString() || null,
    tiempoEjecucionSegundos: tiempoInicioProceso 
      ? Math.round((new Date().getTime() - tiempoInicioProceso.getTime()) / 1000)
      : 0,
  };
}