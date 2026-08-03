import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ERRORES_INFRAESTRUCTURA = [
  "softland no disponible",
  "softland error",
  "servidor no responde",
  "servidor no disponible",
  "server unavailable",
  "internal server error",
  "error interno del servidor",
  "servicio rpa no responde",
  "rpa no disponible",
  "api no responde",
  "servicio no disponible",
  "sistema no disponible",
  "base de datos caída",
  "sql server no disponible",
  "database error",
  "error de base de datos",
  "timeout",
  "request timeout",
  "gateway timeout",
  "network error",
  "socket hang up",
  "econnrefused",
  "enotfound",
  "502", "503", "504", "500"
];

const NO_INFRAESTRUCTURA = [
  "sii",
  "dte",
  "reclamar",
  "aceptado",
  "registrado previamente",
  "evento registrado",
  "acuso recibo",
  "desviación",
  "límite permitido",
  "reglas de negocio",
  "cumple con todas",
  "documento aprobado",
  "documento rechazado",
  "documento cumple",
  "aprobado exitosamente",
  "rechazado debido",
  "folio",
  "recibido",
  "asignado",
  "gestionando",
  "resuelto",
  "incompleto",
  "serv. técnico",
  "anulado",
  "re-abierto",
  "pendiente",
  "despachado",
  "finalizado",
  "soporte telefonico",
  "por coordinar",
  "presupuesto pendiente",
  "chequeo pendiente",
  "reporte completado",
  "llamadas sin solucion",
  "habilitacion por coordinar",
  "incompleto tecnico",
  "terminado",
  "despachada historico",
  "incompleto por repuesto",
  "confirmacion de equipo",
  "manual",
  "estado",
  "incidencia",
  "llamada",
  "sast"
];

export const isInfraestructuraError = (motivo: string): boolean => {
  if (!motivo) return false;
  const motivoLower = motivo.toLowerCase();
  
  for (const term of NO_INFRAESTRUCTURA) {
    if (motivoLower.includes(term)) {
      return false;
    }
  }
  
  return ERRORES_INFRAESTRUCTURA.some(term => motivoLower.includes(term));
};

