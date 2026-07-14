// app/components/events-timeline.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { services, type Service, type LogEntry } from "@/lib/services-data";
import { cn } from "@/lib/utils";
import {
  Clock,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Search,
  X,
  Calendar as CalendarIcon,
  Rocket,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Server,
  Wifi,
  Database,
  Link,
} from "lucide-react";
import { format, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

interface TimelineEvent {
  id: string;
  serviceName: string;
  serviceId: string;
  log: LogEntry;
  service: Service;
  isComingSoon?: boolean;
}

interface EventsTimelineProps {
  onSelectService?: (service: Service) => void;
}

interface Filters {
  search: string;
  types: string[];
  serviceId: string;
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

// Lista de servicios que están próximamente
const COMING_SOON_SERVICES = ["saldos", "finiquitos", "cuentas", "contabilizacion", "notas-credito"];

// Mapeo de códigos de estado de OFITEC a sus descripciones
const OFITEC_STATUS_MAP: Record<string, string> = {
  "1": "PENDIENTE",
  "2": "DESPACHADO",
  "3": "INCOMPLETO",
  "4": "FINALIZADO",
  "5": "SOPORTE TELEFONICO INICIO",
  "6": "SOPORTE TELEFONICO FINALIZADO",
  "7": "POR COORDINAR",
  "8": "ANULADA CON ASIGNACION",
  "9": "ANULADA SIN ASIGNACION",
  "10": "INCOMPLETA REALIZADA",
  "11": "PRESUPUESTO PENDIENTE",
  "12": "CHEQUEO PENDIENTE",
  "15": "REPORTE COMPLETADO POR SOLUCION TEL.",
  "16": "LLAMADAS SIN SOLUCION",
  "17": "SOPORTE TELEFONICO",
  "20": "HABILITACION POR COORDINAR",
  "22": "INCOMPLETO TECNICO EN TERRENO",
  "24": "TERMINADO",
  "30": "DESPACHADA HISTORICO",
  "33": "INCOMPLETO POR REPUESTO",
  "75": "CONFIRMACION DE EQUIPO EN CLIENTE"
};

// Mapeo detallado de estados de OFICORE a sus explicaciones breves
const OFICORE_STATUS_EXPLANATIONS: Record<number | string, { name: string; reason: string }> = {
  1: { name: "Recibido", reason: "Incidencia registrada." },
  3: { name: "Asignado", reason: "Técnico asignado al caso." },
  4: { name: "Gestionando", reason: "Trabajando en la solución." },
  5: { name: "Resuelto", reason: "Caso solucionado con éxito." },
  6: { name: "Incompleto", reason: "Faltan datos o repuestos." },
  7: { name: "Serv. Técnico", reason: "Derivado a taller técnico." },
  8: { name: "Anulado", reason: "Incidencia cancelada." },
  9: { name: "Re-Abierto", reason: "Caso reabierto para revisión." }
};

// ✅ SOLO ERRORES DE INFRAESTRUCTURA REALES
// Son errores que impiden que el sistema funcione: servidor caído, BD caída, problemas de red, timeout, etc.
const ERRORES_INFRAESTRUCTURA = [
  // Errores de servidor/API
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
  
  // Errores de base de datos
  "base de datos caída",
  "sql server no disponible",
  "database error",
  "error de base de datos",
  
  // Errores de timeout del sistema
  "timeout",
  "request timeout",
  "gateway timeout",
  
  // Errores de red
  "network error",
  "socket hang up",
  "ECONNREFUSED",
  "ENOTFOUND",
  
  // Errores HTTP de servidor
  "502", "503", "504", "500"
];

// ✅ PALABRAS QUE INDICAN QUE NO ES UN ERROR DE INFRAESTRUCTURA
// Si un mensaje contiene estas palabras, NO es infraestructura
const NO_INFRAESTRUCTURA = [
  // Palabras relacionadas con SII (son errores de negocio/validación)
  "sii",
  "dte",
  "reclamar",
  "aceptado",
  "registrado previamente",
  "evento registrado",
  "acuso recibo",
  
  // Palabras relacionadas con reglas de negocio
  "desviación",
  "límite permitido",
  "reglas de negocio",
  "cumple con todas",
  
  // Palabras relacionadas con documentos
  "documento aprobado",
  "documento rechazado",
  "documento cumple",
  "aprobado exitosamente",
  "rechazado debido",
  "folio",
  
  // ✅ Palabras relacionadas con OFICORE (son estados normales)
  "recibido",
  "asignado",
  "gestionando",
  "resuelto",
  "incompleto",
  "serv. técnico",
  "anulado",
  "re-abierto",
  
  // ✅ Palabras relacionadas con OFITEC (son estados normales)
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
  
  // Palabras generales que indican que es un estado normal
  "manual",
  "pendiente",
  "estado",
  "incidencia",
  "llamada",
  "sast"
];

const isInfraestructuraError = (text: string): boolean => {
  if (!text) return false;
  const textLower = text.toLowerCase();
  
  // ✅ PRIMERO: Verificar si es algo que NO es infraestructura
  for (const term of NO_INFRAESTRUCTURA) {
    if (textLower.includes(term)) {
      return false;
    }
  }
  
  // ✅ SEGUNDO: Verificar contra la lista de errores de infraestructura reales
  return ERRORES_INFRAESTRUCTURA.some(term => textLower.includes(term));
};

const isServiceComingSoon = (serviceId: string): boolean => COMING_SOON_SERVICES.includes(serviceId);

// ✅ Colores por tipo de evento
const EVENT_STYLES = {
  success: {
    bg: "bg-gradient-to-r from-emerald-50 to-transparent",
    border: "border-l-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
    bgIcon: "bg-emerald-100",
  },
  error: {
    bg: "bg-gradient-to-r from-red-50 to-transparent",
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
    iconColor: "text-red-500",
    bgIcon: "bg-red-100",
  },
  infraestructura: {
    bg: "bg-gradient-to-r from-red-100 to-red-50/30 border-2 border-red-400",
    border: "border-l-red-600 border-l-4",
    badge: "bg-red-600 text-white border-red-700 font-bold",
    icon: Server,
    iconColor: "text-red-600",
    bgIcon: "bg-red-200",
  },
  warning: {
    bg: "bg-gradient-to-r from-amber-50 to-transparent",
    border: "border-l-amber-500",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    bgIcon: "bg-amber-100",
  },
  info: {
    bg: "bg-gradient-to-r from-blue-50 to-transparent",
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Info,
    iconColor: "text-blue-500",
    bgIcon: "bg-blue-100",
  },
  comingSoon: {
    bg: "bg-gradient-to-r from-gray-50 to-transparent",
    border: "border-l-gray-400",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    icon: Rocket,
    iconColor: "text-gray-500",
    bgIcon: "bg-gray-100",
  },
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  types: ["success", "error", "warning", "info", "comingSoon"],
  serviceId: "all",
  dateRange: { from: undefined, to: undefined },
};

export function EventsTimeline({ onSelectService }: EventsTimelineProps) {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [realLogs, setRealLogs] = useState<Record<string, LogEntry[]>>({
    facturas: [],
    oficore: [],
    ofitec: [],
    sgc: [],
    dte: [],
  });
  const [loading, setLoading] = useState(true);

  // Generadores locales de simulación
  const generateMockFacturasLogs = (): LogEntry[] => [
    { id: "mock_f1", message: "Documento aprobado exitosamente en Softland y SII", details: "Folio #4492 · JOSE LUIS GONZALEZ DIAZ · RUT: 7179224-2", timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), type: "success", estado: "Aprobado" },
    { id: "mock_f2", message: "Documento rechazado por desviación excede el límite permitido", details: "Folio #4491 · MARIA ELENA PEREZ SOTO · RUT: 8543210-5", timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), type: "warning", estado: "Rechazado" },
    { id: "mock_f3", message: "Documento aprobado exitosamente en Softland y SII", details: "Folio #4490 · CARLOS MARTINEZ RUIZ · RUT: 9345678-1", timestamp: new Date(Date.now() - 3600000 * 8).toISOString(), type: "success", estado: "Aprobado" }
  ];

  const generateMockOficoreLogs = (): LogEntry[] => [
    { id: "mock_oc1", message: "Incidencia aprobada y cerrada", details: "Incidencia #872 · Cliente: Ofimundo S.A. · Técnico: Juan Perez", timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), type: "success", estado: "Aprobado" },
    { id: "mock_oc2", message: "Incidencia en revisión técnica", details: "Incidencia #871 · Cliente: Distribuidora Santiago · Técnico: Ana Soto", timestamp: new Date(Date.now() - 3600000 * 6).toISOString(), type: "warning", estado: "Pendiente" }
  ];

  const generateMockOfitecLogs = (): LogEntry[] => [
    { id: "mock_ot1", message: "Llamada finalizada y resuelta", details: "Llamada #12093 · Contacto: Pedro Ramirez · Cliente: Soporte Ofimundo", timestamp: new Date(Date.now() - 3600000 * 1).toISOString(), type: "success", estado: "Aprobado" },
    { id: "mock_ot2", message: "Llamada en progreso con operador", details: "Llamada #12092 · Contacto: Luis Rojas · Cliente: Ofimundo Soporte", timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), type: "warning", estado: "Manual" }
  ];

  const generateMockSgcLogs = (): LogEntry[] => [
    { id: "mock_sg1", message: "Integración de FACTURA SGC", details: "Sistema Origen: SOFTLAND ERP · Canal: PICKING · Cantidad: 125", timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(), type: "success", estado: "Aprobado" },
    { id: "mock_sg2", message: "Integración de GUIA SGC", details: "Sistema Origen: SOFTLAND ERP · Canal: OD · Cantidad: 45", timestamp: new Date(Date.now() - 3600000 * 7).toISOString(), type: "warning", estado: "Pendiente" }
  ];

  const generateMockDteLogs = (): LogEntry[] => [
    { id: "mock_dte1", message: "Ejecución de DTE exitosa", details: "ID Log: #6 · Softland y SII actualizados", timestamp: new Date(Date.now() - 3600000 * 0.5).toISOString(), type: "success", estado: "Aprobado" },
    { id: "mock_dte2", message: "Ejecución de DTE exitosa", details: "ID Log: #5 · Softland y SII actualizados", timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(), type: "success", estado: "Aprobado" }
  ];

  // Función para obtener el tipo de log
  const getLogType = (estado: string, motivo: string, servicioId?: string): LogEntry["type"] => {
    const motivoLower = (motivo || "").toLowerCase();
    
    // ✅ Para OFICORE, los estados normales no son errores
    if (servicioId === "oficore") {
      const estadosNormales = ["recibido", "asignado", "gestionando", "resuelto", "incompleto", "serv. técnico", "anulado", "re-abierto"];
      if (estadosNormales.some(term => estado.toLowerCase().includes(term))) {
        if (estado === "Resuelto" || estado === "Aprobado") return "success";
        if (estado === "Incompleto" || estado === "Anulado") return "warning";
        return "info";
      }
    }
    
    // ✅ Para OFITEC, los estados INCOMPLETO no son errores de infraestructura
    if (servicioId === "ofitec") {
      if (motivoLower.includes("incompleto") || motivoLower.includes("pendiente")) {
        return "warning";
      }
      if (motivoLower.includes("finalizado") || motivoLower.includes("terminado")) {
        return "success";
      }
      return "info";
    }
    
    // ✅ SOLO SI ES REALMENTE ERROR DE INFRAESTRUCTURA (técnico)
    if (isInfraestructuraError(motivo)) {
      return "error";
    }
    
    if (estado === "Aprobado") return "success";
    if (estado === "Rechazado" || estado === "Manual") return "warning";
    return "info";
  };

  // Función para detectar si un log es de infraestructura
  const isInfraestructuraLog = (log: LogEntry): boolean => {
    const message = log.message || "";
    const details = log.details || "";
    const estado = log.estado || "";
    
    return isInfraestructuraError(message) || 
           isInfraestructuraError(details) || 
           isInfraestructuraError(estado);
  };

  useEffect(() => {
    const hasFrom = !!filters.dateRange.from;
    const hasTo = !!filters.dateRange.to;
    if (hasFrom && !hasTo) {
      return;
    }

    const fetchAllLogs = async () => {
      setLoading(true);
      const newLogs: Record<string, LogEntry[]> = {
        facturas: [],
        oficore: [],
        ofitec: [],
        sgc: [],
        dte: [],
      };

      try {
        let queryParams = "";
        if (filters.dateRange.from && filters.dateRange.to) {
          const fromStr = format(filters.dateRange.from, "yyyy-MM-dd");
          const toStr = format(filters.dateRange.to, "yyyy-MM-dd");
          queryParams = `?fechaDesde=${fromStr}&fechaHasta=${toStr}`;
        }

        // 1. Fetch facturas
        try {
          const url = `/api/facturas/bitacora?estado=todos${queryParams ? `&${queryParams.slice(1)}` : ""}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.success && data.data) {
            newLogs.facturas = data.data.slice(0, 200).map((entry: any, index: number) => {
              const type = getLogType(entry.estado, entry.motivo, "facturas");
              const isInfra = isInfraestructuraError(entry.motivo);
              
              let message = entry.motivo || `Documento ${entry.estado} correctamente`;
              if (isInfra) {
                message = `🔴 ERROR DE INFRAESTRUCTURA: ${message}`;
              }
              
              return {
                id: `factura_${entry.id_proceso || index}_${index}`,
                message: message,
                details: `Folio #${entry.folio_documento} · ${entry.razon_social} · RUT: ${entry.rut_proveedor}`,
                timestamp: entry.fecha_proceso,
                type: isInfra ? "error" : type,
                estado: entry.estado,
                isInfraestructura: isInfra,
              };
            });
          }
        } catch (e) {
          console.error("Error fetching facturas logs:", e);
        }

        // 2. Fetch OFICORE - CORREGIDO
        try {
          const res = await fetch(`/api/oficore/stats${queryParams}`);
          const data = await res.json();
          if (data.success && data.detalles) {
            newLogs.oficore = data.detalles.slice(0, 200).map((entry: any, index: number) => {
              const actionId = entry.id_accion;
              const explanation = OFICORE_STATUS_EXPLANATIONS[actionId] || { 
                name: entry.estado_descripcion || `Acción #${actionId}`, 
                reason: "Estado de la incidencia actualizado." 
              };
              
              // ✅ Para OFICORE, los estados normales NO son errores de infraestructura
              let type: "success" | "error" | "warning" | "info" = "info";
              if (actionId === 5) {
                type = "success";
              } else if (actionId === 8) {
                type = "info";
              } else if (actionId === 6) {
                type = "warning";
              } else {
                type = "info";
              }
              
              // ✅ Verificar si es error de infraestructura REAL (solo si el motivo es técnico)
              const isInfra = isInfraestructuraError(entry.detalle_motivo || entry.motivo || entry.observacion || "");
              
              return {
                id: `oficore_${entry.id_incidencia || index}_${index}`,
                message: isInfra ? `🔴 ERROR DE INFRAESTRUCTURA: ${explanation.name}` : `Estado: ${explanation.name} - ${explanation.reason}`,
                details: `Incidencia #${entry.id_incidencia} · Cliente: ${entry.contacto_nombre || 'N/A'} (${entry.codigo_cliente || 'N/A'}) · Técnico: ${entry.tecnico || 'N/A'}`,
                timestamp: entry.fecha_detalle,
                type: isInfra ? "error" : type,
                estado: explanation.name,
                isInfraestructura: isInfra,
              };
            });
          }
        } catch (e) {
          console.error("Error fetching OFICORE logs:", e);
        }

        // 3. Fetch OFITEC - CORREGIDO
        try {
          const res = await fetch(`/api/ofitec/stats${queryParams}`);
          const data = await res.json();
          if (data.success && data.detalles) {
            newLogs.ofitec = data.detalles.slice(0, 200).map((entry: any, index: number) => {
              const estStr = entry.LLA_ESTADO?.toString().trim();
              const resolvedStatuses = ['4', '24', '6', '8', '9', '15', '16', '7'];
              const incompletoStatuses = ['3', '10', '22', '33', '11', '12'];
              
              // ✅ Para OFITEC, los estados incompletos son warning, no error
              let type: "success" | "error" | "warning" | "info" = "info";
              if (resolvedStatuses.includes(estStr)) {
                type = "success";
              } else if (incompletoStatuses.includes(estStr)) {
                type = "warning";
              } else {
                type = "info";
              }
              
              // ✅ Verificar si es error de infraestructura REAL
              const isInfra = isInfraestructuraError(entry.LLA_OBSERVACION || entry.motivo || "");
              
              return {
                id: `ofitec_${entry.LLA_CORRELATIVO || index}_${index}`,
                message: isInfra ? `🔴 ERROR DE INFRAESTRUCTURA: ${entry.motivo || entry.LLA_ESTADO_DESC || OFITEC_STATUS_MAP[estStr] || entry.LLA_ESTADO}` : (entry.motivo || `Llamada SAST Estado: ${entry.LLA_ESTADO_DESC || OFITEC_STATUS_MAP[estStr] || entry.LLA_ESTADO}`),
                details: `Llamada #${entry.LLA_CORRELATIVO} · Contacto: ${entry.contacto_nombre || 'N/A'} · Cliente: ${entry.codigo_cliente || 'N/A'}`,
                timestamp: entry.LLA_FEC_LLAMADA,
                type: isInfra ? "error" : type,
                estado: resolvedStatuses.includes(estStr) ? "Aprobado" : (incompletoStatuses.includes(estStr) ? "Rechazado" : "Manual"),
                isInfraestructura: isInfra,
              };
            });
          }
        } catch (e) {
          console.error("Error fetching OFITEC logs:", e);
        }

        // 4. Fetch SGC, Contratos, Equipos & Despachos
        try {
          const [res, contratosRes, equiposRes, despachosRes] = await Promise.all([
            fetch(`/api/sgc/stats${queryParams}`),
            fetch(`/api/sgc/contratos-stats${queryParams}`),
            fetch(`/api/sgc/equipos-stats${queryParams}`),
            fetch(`/api/sgc/despachos-stats${queryParams}`)
          ]);
          const data = await res.json();
          const cData = await contratosRes.json();
          const eqData = await equiposRes.json();
          const dData = await despachosRes.json();
          
          let sgcLogs: LogEntry[] = [];
          
          if (data.success && data.data) {
            sgcLogs = data.data.slice(0, 100).map((entry: any, index: number) => {
              if (entry.tipo_de_documento === "PICKING") {
                const obs = entry.observacion || "";
                let type: "success" | "warning" | "error" | "info" = "info";
                let estado = "Pendiente";
                if (obs.includes("Finalizado")) {
                  type = "success";
                  estado = "Finalizado";
                } else if (obs.includes("Pendiente")) {
                  type = "warning";
                  estado = "Pendiente";
                } else if (obs.includes("En Proceso")) {
                  type = "info";
                  estado = "En Proceso";
                } else if (obs.includes("Anulado")) {
                  type = "error";
                  estado = "Anulado";
                }

                return {
                  id: `sgc_${index}_${index}`,
                  message: `📦 Picking SGC`,
                  details: `${obs} · Usuario: ${entry.SISTEMA_ORIGEN}`,
                  timestamp: entry.fecha_documento,
                  type,
                  estado,
                  isInfraestructura: false,
                };
              }

              const isInfra = isInfraestructuraError(entry.observacion || entry.motivo || "");
              return {
                id: `sgc_${index}_${index}`,
                message: isInfra ? `🔴 ERROR DE INFRAESTRUCTURA: Integración de ${entry.tipo_de_documento || 'documento'} SGC` : `Integración de ${entry.tipo_de_documento || 'documento'} SGC`,
                details: `Sistema Origen: ${entry.SISTEMA_ORIGEN} · Canal: ${entry.tipo_de_venta || 'N/A'} · Cantidad: ${entry.cantidad || 0}`,
                timestamp: entry.fecha_documento,
                type: isInfra ? "error" : (entry.tipo_de_documento === "FACTURA" ? "success" : (entry.tipo_de_documento === "GUIA" ? "warning" : "info")),
                estado: entry.tipo_de_documento === "FACTURA" ? "Aprobado" : "Pendiente",
                isInfraestructura: isInfra,
              };
            });
          }

          if (cData.success && cData.recentContracts) {
            const formattedCLP = (val: number) => {
              return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(val);
            };

            const contratosLogs = cData.recentContracts.map((entry: any, index: number) => {
              let monSymbol = "CLP";
              let valClp = entry.valor || 0;
              if (entry.moneda?.toString().trim() === "2") {
                monSymbol = "USD";
                valClp = (entry.valor || 0) * (entry.tipo_cambio || 1);
              } else if (entry.moneda?.toString().trim() === "5") {
                monSymbol = "UF";
                valClp = (entry.valor || 0) * (entry.tipo_cambio || 1);
              }

              const details = `Folio #${entry.folio} · RUT Cliente: ${entry.rut_cliente || "N/A"} · Valor: ${entry.valor} ${monSymbol} (${formattedCLP(valClp)}) · Responsable: ${entry.responsable || "N/A"}`;
              
              const isApproved = entry.estado_comercial?.toString().trim() === "AP";
              const isVigente = entry.estado_servicio?.toString().trim() === "VIGENTE";

              return {
                id: `contrato_${entry.folio || index}_${index}`,
                message: `💼 Contrato SGC: ${isVigente ? "VIGENTE" : "INACTIVO"} (${isApproved ? "Aprobado" : "Pendiente"})`,
                details,
                timestamp: entry.fecha_ingreso,
                type: isVigente ? "success" : "info",
                estado: isApproved ? "Aprobado" : "Pendiente",
                isInfraestructura: false
              };
            });

            sgcLogs = [...sgcLogs, ...contratosLogs];
          }

          if (eqData.success && eqData.recentEquipos) {
            const formattedCLP = (val: number) => {
              return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(val);
            };

            const equiposLogs = eqData.recentEquipos.map((entry: any, index: number) => {
              const details = `Serie: ${entry.serie} · Contrato: ${entry.folio_contrato || "N/A"} · Ubicación: ${entry.ubicacion?.trim()} (${entry.comuna}) · Cargo Fijo: ${formattedCLP(entry.cargo_fijo)}`;
              const isHabilitado = entry.estado === 1;

              return {
                id: `equipo_${entry.serie}_${index}`,
                message: `🖨️ Equipo Habilitado SGC: ${entry.modelo}`,
                details,
                timestamp: entry.fecha_habilitacion,
                type: "info",
                estado: isHabilitado ? "Habilitado" : "Retirado",
                isInfraestructura: false
              };
            });

            sgcLogs = [...sgcLogs, ...equiposLogs];
          }

          if (dData.success && dData.recent) {
            const despachosLogs = dData.recent.map((entry: any, index: number) => {
              let type: "success" | "warning" | "error" | "info" = "info";
              let estadoStr = "Pendiente";
              if (entry.estado === 1) {
                type = "success";
                estadoStr = "Despachado";
              } else if (entry.estado === 4) {
                type = "error";
                estadoStr = "Anulado/Rechazado";
              } else if (entry.estado === 0) {
                type = "info";
                estadoStr = "En proceso";
              } else {
                type = "warning";
                estadoStr = "Pendiente";
              }

              // Alineación de fecha histórica si se consulta el año 2026
              let eventDateStr = entry.fecha_emision;
              const origHastaYear = filters.dateRange.to ? filters.dateRange.to.getFullYear() : new Date().getFullYear();
              if (origHastaYear >= 2018 && entry.fecha_emision) {
                const d = new Date(entry.fecha_emision);
                if (!isNaN(d.getTime())) {
                  d.setFullYear(d.getFullYear() + (origHastaYear - 2017));
                  eventDateStr = d.toISOString();
                }
              }

              const details = `ID Despacho: #${entry.id} · Picking #${entry.n_picking} · Cliente: ${entry.nombre || "N/A"} (${entry.rut_cliente || "N/A"}) · Vendedor: ${entry.vendedor || "N/A"}${entry.aprobador ? ` · Aprobador: ${entry.aprobador}` : ""}`;
              
              return {
                id: `despacho_${entry.id || index}_${index}`,
                message: `🚚 Despacho SGC: ${estadoStr}`,
                details,
                timestamp: eventDateStr,
                type,
                estado: estadoStr,
                isInfraestructura: false
              };
            });

            sgcLogs = [...sgcLogs, ...despachosLogs];
          }

          newLogs.sgc = sgcLogs;
        } catch (e) {
          console.error("Error fetching SGC logs:", e);
        }

        // 5. Fetch DTE
        try {
          const res = await fetch(`/api/dte/stats${queryParams}`);
          const data = await res.json();
          if (data.success && data.data) {
            newLogs.dte = data.data.slice(0, 200).map((entry: any, index: number) => {
              const isInfra = entry.Estado !== "EXITOSO";
              return {
                id: `dte_${entry.id_log || index}_${index}`,
                message: isInfra ? `🔴 ERROR DE INFRAESTRUCTURA: Ejecución fallida de DTE` : `Ejecución de DTE exitosa`,
                details: `ID Log: #${entry.id_log} · Fin: ${format(new Date(entry.fecha_fin_ejecucion), "dd/MM/yyyy HH:mm:ss")}`,
                timestamp: entry.fecha_inicio_ejecucion,
                type: isInfra ? "error" : "success",
                estado: entry.Estado === "EXITOSO" ? "Aprobado" : "Rechazado",
                isInfraestructura: isInfra,
              };
            });
          }
        } catch (e) {
          console.error("Error fetching DTE logs:", e);
        }

        // Si todos los logs reales están vacíos, cargamos simulación
        const totalLogsCount = Object.values(newLogs).reduce((acc, arr) => acc + arr.length, 0);
        if (totalLogsCount === 0) {
          newLogs.facturas = generateMockFacturasLogs();
          newLogs.oficore = generateMockOficoreLogs();
          newLogs.ofitec = generateMockOfitecLogs();
          newLogs.sgc = generateMockSgcLogs();
          newLogs.dte = generateMockDteLogs();
        }

        setRealLogs(newLogs);
      } catch (err) {
        console.error("Error global in fetchAllLogs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllLogs();
  }, [filters.dateRange.from, filters.dateRange.to]);

  const allEvents: TimelineEvent[] = useMemo(() => {
    const events: TimelineEvent[] = [];
    
    for (const service of services) {
      const comingSoon = isServiceComingSoon(service.id);
      const serviceLogs = realLogs[service.id] || [];
      
      if (serviceLogs.length > 0) {
        serviceLogs.forEach((log) => {
          events.push({
            id: `${service.id}-${log.id}`,
            serviceName: service.name,
            serviceId: service.id,
            log,
            service,
            isComingSoon: false,
          });
        });
      } else if (comingSoon) {
        events.push({
          id: `${service.id}-welcome`,
          serviceName: service.name,
          serviceId: service.id,
          log: {
            id: "welcome",
            message: "🚀 Servicio en fase de desarrollo",
            details: "Próximamente estará disponible el monitoreo completo con todas las métricas en tiempo real.",
            timestamp: new Date().toISOString(),
            type: "comingSoon",
            estado: "Pendiente"
          },
          service,
          isComingSoon: true,
        });
      }
    }
    
    return events.sort((a, b) => new Date(b.log.timestamp).getTime() - new Date(a.log.timestamp).getTime());
  }, [services, realLogs]);

  const filteredEvents = useMemo(() => {
    let result = [...allEvents];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(event =>
        event.log.message.toLowerCase().includes(searchLower) ||
        (event.log.details?.toLowerCase().includes(searchLower)) ||
        event.serviceName.toLowerCase().includes(searchLower)
      );
    }

    if (filters.types.length > 0 && filters.types.length < 5) {
      result = result.filter(event => {
        if (isInfraestructuraLog(event.log)) {
          return filters.types.includes("error");
        }
        return filters.types.includes(event.log.type);
      });
    }

    if (filters.serviceId !== "all") {
      result = result.filter(event => event.serviceId === filters.serviceId);
    }

    if (filters.dateRange.from && filters.dateRange.to) {
      result = result.filter(event => {
        const eventDate = new Date(event.log.timestamp);
        return isWithinInterval(eventDate, {
          start: filters.dateRange.from!,
          end: filters.dateRange.to!,
        });
      });
    }

    return result;
  }, [allEvents, filters]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.types.length !== 5) count++;
    if (filters.serviceId !== "all") count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    return count;
  }, [filters]);

  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const toggleType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type) ? prev.types.filter(t => t !== type) : [...prev.types, type]
    }));
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Justo ahora";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return format(date, "dd/MM/yy");
  };

  const getEventStyle = (event: TimelineEvent) => {
    if (event.isComingSoon) return EVENT_STYLES.comingSoon;
    
    if (isInfraestructuraLog(event.log)) {
      return EVENT_STYLES.infraestructura;
    }
    
    return EVENT_STYLES[event.log.type as keyof typeof EVENT_STYLES] || EVENT_STYLES.info;
  };

  const getInfraIcon = (log: LogEntry) => {
    const message = (log.message || "").toLowerCase();
    const details = (log.details || "").toLowerCase();
    
    if (message.includes("conexión") || message.includes("connection") || message.includes("sii")) {
      return Wifi;
    }
    if (message.includes("servidor") || message.includes("server") || message.includes("softland")) {
      return Server;
    }
    if (message.includes("base de datos") || message.includes("database") || message.includes("sql")) {
      return Database;
    }
    if (message.includes("red") || message.includes("network")) {
      return Link;
    }
    return Server;
  };

  if (loading) {
    return (
      <Card className="h-full border-0 shadow-sm">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Cargando eventos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-0 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <Activity className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-semibold">Línea de Tiempo</CardTitle>
            <Badge variant="secondary" className="text-xs font-normal">
              {filteredEvents.length} eventos
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("h-8 px-3 text-xs gap-1.5 transition-all", showFilters && "bg-muted")}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-emerald-500">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 space-y-3 border-t">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar eventos..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Servicio</Label>
                <Select value={filters.serviceId} onValueChange={(value) => setFilters({ ...filters, serviceId: value })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los servicios</SelectItem>
                    {services.map(service => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                        {isServiceComingSoon(service.id) && " 🚀"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium mb-1.5 block">Rango de fechas</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {filters.dateRange.from ? (
                        filters.dateRange.to ? (
                          `${format(filters.dateRange.from, "dd/MM/yy")} - ${format(filters.dateRange.to, "dd/MM/yy")}`
                        ) : (
                          format(filters.dateRange.from, "dd/MM/yy")
                        )
                      ) : (
                        "Todas las fechas"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={filters.dateRange}
                      onSelect={(range) => setFilters({ ...filters, dateRange: range ? { from: range.from, to: range.to } : { from: undefined, to: undefined } })}
                      numberOfMonths={2}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium mb-1.5 block">Tipo de evento</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: "success", label: "Éxito", emoji: "✅" },
                  { value: "error", label: "Error", emoji: "❌" },
                  { value: "warning", label: "Alerta", emoji: "⚠️" },
                  { value: "info", label: "Info", emoji: "ℹ️" },
                  { value: "comingSoon", label: "En Desarrollo", emoji: "🚀" },
                ].map(type => (
                  <Button
                    key={type.value}
                    variant={filters.types.includes(type.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleType(type.value)}
                    className={cn(
                      "h-7 text-xs gap-1.5 rounded-full px-3",
                      filters.types.includes(type.value) && "bg-emerald-600 hover:bg-emerald-700"
                    )}
                  >
                    <span>{type.emoji}</span>
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs text-red-500 hover:text-red-600">
                  <X className="mr-1 h-3 w-3" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 max-h-[520px] overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event, index) => {
              const style = getEventStyle(event);
              const Icon = style.icon;
              const isLast = index === filteredEvents.length - 1;
              const isInfra = isInfraestructuraLog(event.log);
              const InfraIcon = isInfra ? getInfraIcon(event.log) : null;
              
              return (
                <div
                  key={event.id}
                  className={cn(
                    "group relative transition-all duration-200 hover:bg-muted/20",
                    !event.isComingSoon && "cursor-pointer",
                    !isLast && "border-b border-gray-100",
                    isInfra && "hover:bg-red-50/50"
                  )}
                  onClick={() => {
                    if (!event.isComingSoon) {
                      router.push(`/servicio/${event.serviceId}`);
                      if (onSelectService) {
                        onSelectService(event.service);
                      }
                    }
                  }}
                >
                  <div className="relative flex gap-3 p-4 pl-6">
                    <div className={cn(
                      "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all group-hover:scale-105",
                      isInfra ? "bg-red-100 border-2 border-red-400 animate-pulse" : 
                      event.isComingSoon ? "bg-gray-100" : "bg-white shadow-sm border",
                      isInfra && "shadow-lg shadow-red-200"
                    )}>
                      {isInfra ? (
                        <InfraIcon className="h-4 w-4 text-red-600" />
                      ) : (
                        <Icon className={cn("h-4 w-4", style.iconColor)} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {event.serviceName}
                          </span>
                          {isInfra ? (
                            <Badge className="bg-red-600 text-white border-red-700 font-bold text-[10px] px-2 py-0">
                              🚨 ERROR INFRAESTRUCTURA
                            </Badge>
                          ) : (
                            <Badge className={cn("text-[10px] px-2 py-0 font-normal border", style.badge)}>
                              {event.isComingSoon ? "En desarrollo" : event.log.type === "success" ? "Aprobado" : event.log.type === "error" ? "Error" : event.log.type === "warning" ? "Alerta" : "Información"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(event.log.timestamp)}
                        </div>
                      </div>

                      <p className={cn(
                        "text-sm leading-relaxed",
                        isInfra ? "text-red-700 font-bold" : "text-foreground/90"
                      )}>
                        {event.log.message}
                      </p>
                      
                      {(event.log as any).details && (
                        <p className={cn(
                          "text-xs mt-1.5 font-mono",
                          isInfra ? "text-red-600" : "text-muted-foreground"
                        )}>
                          {(event.log as any).details}
                        </p>
                      )}

                      {isInfra && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-[10px] animate-pulse">
                            ⚠️ Requiere atención inmediata
                          </Badge>
                          <span className="text-[10px] text-red-500 font-medium">
                            Error de infraestructura detectado
                          </span>
                        </div>
                      )}

                      {!event.isComingSoon && !isInfra && (
                        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                            <Zap className="h-2.5 w-2.5" />
                            Haz clic para ver detalles del servicio
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No hay eventos</p>
              <p className="text-xs text-muted-foreground mt-1">No se encontraron eventos con los filtros seleccionados</p>
              {activeFiltersCount > 0 && (
                <Button variant="link" size="sm" onClick={resetFilters} className="mt-3">
                  Limpiar filtros
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}