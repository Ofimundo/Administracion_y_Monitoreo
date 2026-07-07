"use strict";
// backend/src/process-state.ts
// Estado compartido entre los endpoints de API para controlar la ejecución de procesos
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcesoActivo = getProcesoActivo;
exports.setProcesoActivo = setProcesoActivo;
exports.getProcesoDetenidoPorUsuario = getProcesoDetenidoPorUsuario;
exports.setProcesoDetenidoPorUsuario = setProcesoDetenidoPorUsuario;
exports.getProcesoActual = getProcesoActual;
exports.setProcesoActual = setProcesoActual;
exports.getTiempoInicioProceso = getTiempoInicioProceso;
exports.marcarInicioProceso = marcarInicioProceso;
exports.marcarFinProceso = marcarFinProceso;
exports.debeDetenerseProceso = debeDetenerseProceso;
exports.solicitarDetencionProceso = solicitarDetencionProceso;
exports.resetearEstadoProceso = resetearEstadoProceso;
exports.getEstadoCompleto = getEstadoCompleto;
let procesoActivo = false;
let procesoDetenidoPorUsuario = false;
let procesoActual = null;
let tiempoInicioProceso = null;
function getProcesoActivo() {
    return procesoActivo;
}
function setProcesoActivo(activo) {
    procesoActivo = activo;
    if (!activo) {
        procesoActual = null;
        tiempoInicioProceso = null;
    }
}
function getProcesoDetenidoPorUsuario() {
    return procesoDetenidoPorUsuario;
}
function setProcesoDetenidoPorUsuario(detenido) {
    procesoDetenidoPorUsuario = detenido;
}
function getProcesoActual() {
    return procesoActual;
}
function setProcesoActual(procesoId) {
    procesoActual = procesoId;
}
function getTiempoInicioProceso() {
    return tiempoInicioProceso;
}
function marcarInicioProceso(procesoId = "facturas") {
    procesoActivo = true;
    procesoDetenidoPorUsuario = false;
    procesoActual = procesoId;
    tiempoInicioProceso = new Date();
    console.log(`[ProcessState] Proceso "${procesoId}" iniciado en ${tiempoInicioProceso.toISOString()}`);
}
function marcarFinProceso() {
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
function debeDetenerseProceso() {
    return procesoDetenidoPorUsuario;
}
function solicitarDetencionProceso() {
    procesoDetenidoPorUsuario = true;
    console.log(`[ProcessState] Solicitud de detención registrada para proceso "${procesoActual}"`);
}
function resetearEstadoProceso() {
    procesoActivo = false;
    procesoDetenidoPorUsuario = false;
    procesoActual = null;
    tiempoInicioProceso = null;
    console.log("[ProcessState] Estado de proceso reseteado completamente");
}
function getEstadoCompleto() {
    const isActivo = getProcesoActivo();
    return {
        procesoActivo: isActivo,
        procesoDetenidoPorUsuario,
        procesoActual,
        tiempoInicioProceso: tiempoInicioProceso?.toISOString() || null,
        tiempoEjecucionSegundos: tiempoInicioProceso
            ? Math.round((new Date().getTime() - tiempoInicioProceso.getTime()) / 1000)
            : 0,
        estado: isActivo ? "ejecutando" : (procesoDetenidoPorUsuario ? "detenido" : "completado"),
    };
}
