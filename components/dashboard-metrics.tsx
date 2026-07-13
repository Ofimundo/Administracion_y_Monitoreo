// app/components/dashboard-metrics.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Calendar as CalendarIcon,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  X,
  ChevronDown,
  Server,
  Globe,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  List,
  Circle,
  History,
  CheckCircle,
  Download,
  Cloud,
  Code,
  DollarSign,
  FolderKanban,
  Clock,
  Users,
  GitBranch,
  Trophy,
  Plus,
  ListChecks,
  Bug,
  Timer,
  Gauge,
  AlertTriangle,
  Shield,
  ZapIcon,
  Briefcase,
  FileText,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Ticket,
  Layers,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, parseISO, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { services, generateMetricsData, type MetricDataPoint } from "@/lib/services-data";
import { useRouter } from "next/navigation";

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];

// ✅ SOLO ERRORES DE INFRAESTRUCTURA REALES
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
  "ECONNREFUSED",
  "ENOTFOUND",
  "502", "503", "504", "500"
];

const NO_INFRAESTRUCTURA = [
  "sii", "dte", "reclamar", "aceptado", "registrado previamente",
  "evento registrado", "acuso recibo", "desviación", "límite permitido",
  "reglas de negocio", "cumple con todas", "documento aprobado",
  "documento rechazado", "documento cumple", "aprobado exitosamente",
  "rechazado debido", "folio", "recibido", "asignado", "gestionando",
  "resuelto", "incompleto", "serv. técnico", "anulado", "re-abierto",
  "pendiente", "despachado", "finalizado", "soporte telefonico",
  "por coordinar", "presupuesto pendiente", "chequeo pendiente",
  "reporte completado", "llamadas sin solucion", "habilitacion por coordinar",
  "incompleto tecnico", "terminado", "despachada historico",
  "incompleto por repuesto", "confirmacion de equipo", "manual",
  "estado", "incidencia", "llamada", "sast"
];

const isInfraestructuraError = (motivo: string): boolean => {
  if (!motivo) return false;
  const motivoLower = motivo.toLowerCase();
  
  for (const term of NO_INFRAESTRUCTURA) {
    if (motivoLower.includes(term)) {
      return false;
    }
  }
  
  return ERRORES_INFRAESTRUCTURA.some(term => motivoLower.includes(term));
};

interface InvoiceData {
  fecha_proceso: string;
  estado: string;
  tipo_documento: number;
  folio_documento: number;
  rut_proveedor: string;
  razon_social: string;
  motivo: string;
}

const EXPORT_FIELDS = [
  { id: "fecha", label: "Fecha", default: true },
  { id: "servicio", label: "Servicio", default: true },
  { id: "exitosas", label: "Peticiones Exitosas", default: true },
  { id: "erroresInfraestructura", label: "Errores Infraestructura", default: true },
  { id: "reglasNegocio", label: "Reglas de Negocio", default: true },
  { id: "totalPeticiones", label: "Total Peticiones", default: true },
  { id: "tasaExito", label: "Tasa de Éxito (%)", default: false },
  { id: "tasaErrorInfra", label: "Tasa Error Infraestructura (%)", default: false },
  { id: "tiempoRespuesta", label: "Tiempo Respuesta Promedio (ms)", default: false },
];

export function DashboardMetrics({
  onNavigateToServices,
  onNavigateToTimeline,
}: {
  onNavigateToServices?: () => void;
  onNavigateToTimeline?: () => void;
}) {
  const router = useRouter();
  const [allData, setAllData] = useState<MetricDataPoint[]>([]);
  const [realInvoiceData, setRealInvoiceData] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [oficoreData, setOficoreData] = useState<any[]>([]);
  const [ofitecData, setOfitecData] = useState<any[]>([]);
  const [sgcData, setSgcData] = useState<any[]>([]);
  const [serviciosData, setServiciosData] = useState<any[]>([]);
  
  const [proyectosActivos, setProyectosActivos] = useState<Array<{
    id: number;
    nombre: string;
    responsable: string;
    progreso: number;
    estado: string;
    prioridad: "Crítica" | "Alta" | "Media" | "Baja";
  }>>([]);

  const [entregasPorEstado, setEntregasPorEstado] = useState([
    { name: "Completadas", value: 0, color: "#10b981", icon: "✅" },
    { name: "En Progreso", value: 0, color: "#3b82f6", icon: "🔄" },
    { name: "Retrasadas", value: 0, color: "#ef4444", icon: "⚠️" },
    { name: "Pendientes", value: 0, color: "#f59e0b", icon: "⏳" },
  ]);

  const [saludProyectos, setSaludProyectos] = useState([
    { name: "Salud Técnica", value: 0, color: "#8b5cf6" },
    { name: "Cumplimiento", value: 0, color: "#3b82f6" },
    { name: "Recursos", value: 0, color: "#f59e0b" },
    { name: "Riesgos", value: 0, color: "#ef4444" },
  ]);

  const [proyectosMetrics, setProyectosMetrics] = useState({
    entregasATiempo: 0,
    tareasPendientes: 0,
    bugsAbiertos: 0,
    proyectosActivos: 0,
    avancePromedio: 0,
  });

  const [detalleDisponibilidad, setDetalleDisponibilidad] = useState<any[]>([]);
  const [detalleIncidentes, setDetalleIncidentes] = useState<any[]>([]);
  const [detalleAlertas, setDetalleAlertas] = useState<any[]>([]);
  const [detalleCambios, setDetalleCambios] = useState<any[]>([]);
  const [detalleTickets, setDetalleTickets] = useState<any[]>([]);
  const [incidentesSeveridad, setIncidentesSeveridad] = useState<Array<{ name: string; value: number; color: string }>>([
    { name: "Crítico", value: 0, color: "#ef4444" },
    { name: "Alto", value: 0, color: "#f97316" },
    { name: "Medio", value: 0, color: "#eab308" },
    { name: "Bajo", value: 0, color: "#3b82f6" }
  ]);
  
  const [showDisponibilidadModal, setShowDisponibilidadModal] = useState(false);
  const [showIncidentesModal, setShowIncidentesModal] = useState(false);
  const [showAlertasModal, setShowAlertasModal] = useState(false);
  const [showCambiosModal, setShowCambiosModal] = useState(false);
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  
  const [showProyectosModal, setShowProyectosModal] = useState(false);
  const [showEntregasModal, setShowEntregasModal] = useState(false);
  const [showTareasModal, setShowTareasModal] = useState(false);
  const [showBugsModal, setShowBugsModal] = useState(false);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );
  const [selectAll, setSelectAll] = useState(true);
  
  const [filters, setFilters] = useState({
    service: "todos",
    dateRange: { from: undefined as Date | undefined, to: undefined as Date | undefined },
    view: "todos" as "todos" | "daily" | "weekly" | "monthly",
    metric: "all" as "all" | "success" | "errors" | "rules",
  });

  const [tempDateRange, setTempDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateFilterApplied, setDateFilterApplied] = useState(false);

  const [showFilters, setShowFilters] = useState(false);

  const [infraStats, setInfraStats] = useState({
    online: true,
    equiposPrincipales: 99.4,
    servidoresCore: 100,
    database: 100,
    enlacesRed: 98.2,
    version: null as string | null,
    error: null as string | null
  });

  useEffect(() => {
    let isMounted = true;
    
    const fetchInfra = async () => {
      try {
        const res = await fetch("/api/infraestructura/status");
        const data = await res.json();
        if (isMounted && data.success) {
          setInfraStats({
            online: data.online,
            equiposPrincipales: parseFloat(data.equiposPrincipales.toFixed(2)),
            servidoresCore: data.servidoresCore,
            database: data.database,
            enlacesRed: parseFloat(data.enlacesRed.toFixed(2)),
            version: data.version || null,
            error: data.error
          });
        }
      } catch (err) {
        console.error("Error fetching infra status:", err);
      }
    };

    fetchInfra();
    const interval = setInterval(fetchInfra, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleZabbixRedirect = () => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://zabbix.ofimundo.cl/index.php';
    form.target = '_blank';

    const nameInput = document.createElement('input');
    nameInput.type = 'hidden';
    nameInput.name = 'name';
    nameInput.value = 'reporte_api';
    form.appendChild(nameInput);

    const passwordInput = document.createElement('input');
    passwordInput.type = 'hidden';
    passwordInput.name = 'password';
    passwordInput.value = 'Soporte0101';
    form.appendChild(passwordInput);

    const autologinInput = document.createElement('input');
    autologinInput.type = 'hidden';
    autologinInput.name = 'autologin';
    autologinInput.value = '1';
    form.appendChild(autologinInput);

    const requestInput = document.createElement('input');
    requestInput.type = 'hidden';
    requestInput.name = 'request';
    requestInput.value = 'zabbix.php?action=dashboard.view&dashboardid=392';
    form.appendChild(requestInput);

    const enterInput = document.createElement('input');
    enterInput.type = 'hidden';
    enterInput.name = 'enter';
    enterInput.value = 'Sign in';
    form.appendChild(enterInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const fetchAllServicesData = async (dateRange?: { from: Date | undefined; to: Date | undefined }) => {
    try {
      const serviceIds = ["facturas", "oficore", "ofitec", "sgc"];
      const results: any = {};

      let queryParams = "";
      if (dateRange?.from) {
        const fromStr = format(dateRange.from, "yyyyMMdd");
        queryParams += `?fechaDesde=${fromStr}`;
        if (dateRange.to) {
          const toStr = format(dateRange.to, "yyyyMMdd");
          queryParams += `&fechaHasta=${toStr}`;
        }
      }

      for (const serviceId of serviceIds) {
        try {
          let url = "";
          if (serviceId === "facturas") {
            url = "/api/facturas/bitacora?estado=todos";
            if (dateRange?.from) {
              const fromStr = format(dateRange.from, "yyyy-MM-dd");
              url += `&fechaDesde=${fromStr}`;
            }
            if (dateRange?.to) {
              const toStr = format(dateRange.to, "yyyy-MM-dd");
              url += `&fechaHasta=${toStr}`;
            }
          } else if (serviceId === "oficore") {
            url = `/api/oficore/stats${queryParams}`;
          } else if (serviceId === "ofitec") {
            url = `/api/ofitec/stats${queryParams}`;
          } else if (serviceId === "sgc") {
            url = `/api/sgc/stats${queryParams}`;
          }

          const res = await fetch(url);
          const data = await res.json();
          
          if (data.success) {
            results[serviceId] = data;
          }
        } catch (e) {
          console.error(`Error fetching ${serviceId}:`, e);
          results[serviceId] = null;
        }
      }

      return results;
    } catch (error) {
      console.error("Error fetching services data:", error);
      return null;
    }
  };

  const calculateAllMetrics = (servicesData: any, facturasData: any[]) => {
    const isFiltered = filters.dateRange.from !== undefined;
    const limitDate = new Date("2026-07-09T00:00:00");
    limitDate.setDate(limitDate.getDate() - 14);

    const filterRecent = (d: any, dateField: string) => {
      if (isFiltered) return true;
      if (!d[dateField]) return false;
      return new Date(d[dateField]) >= limitDate;
    };

    const facturasDataFiltered = facturasData.filter((f: any) => filterRecent(f, "fecha_proceso"));
    const oficoreDetallesFiltered = (servicesData.oficore?.detalles || []).filter((d: any) => filterRecent(d, "fecha_detalle"));
    const ofitecDetallesFiltered = (servicesData.ofitec?.detalles || []).filter((d: any) => filterRecent(d, "LLA_FEC_LLAMADA"));
    const sgcDataFiltered = (servicesData.sgc?.data || []).filter((d: any) => filterRecent(d, "fecha_documento"));

    const facturasTotal = facturasDataFiltered.length;
    const facturasAprobadas = facturasDataFiltered.filter(f => f.estado === "Aprobado").length;
    const facturasRechazadas = facturasDataFiltered.filter(f => f.estado === "Rechazado").length;
    const facturasManuales = facturasDataFiltered.filter(f => f.estado === "Manual").length;
    const facturasPendientes = facturasDataFiltered.filter(f => f.estado === "Pendiente" || f.estado === "Pendiente Espera").length;
    const facturasErrorInfra = facturasDataFiltered.filter(f => isInfraestructuraError(f.motivo)).length;
    
    const oficoreTotal = oficoreDetallesFiltered.length;
    const oficoreResueltas = oficoreDetallesFiltered.filter((d: any) => d.id_accion === 5).length || 0;
    const oficoreNoResueltas = oficoreTotal - oficoreResueltas;
    
    const ofitecTotal = ofitecDetallesFiltered.length;
    const resolvedStatuses = ['4','24','6','8','9','15','16','7'];
    const ofitecResueltas = ofitecDetallesFiltered.filter((d: any) => resolvedStatuses.includes(d.LLA_ESTADO)).length || 0;
    const ofitecIngresadas = ofitecDetallesFiltered.filter((d: any) => d.LLA_CORRELATIVO === "1" || d.LLA_CORRELATIVO === 1).length || 0;
    const ofitecPendientes = ofitecIngresadas - ofitecResueltas;
    
    const sgcTotal = sgcDataFiltered.length;
    const sgcPicking = sgcDataFiltered.filter((d: any) => d.tipo_de_venta?.toLowerCase() === "picking").length || 0;
    const sgcOd = sgcDataFiltered.filter((d: any) => d.tipo_de_venta?.toLowerCase() === "od").length || 0;
    const sgcOtros = sgcTotal - sgcPicking - sgcOd;

    const totalDocumentos = facturasTotal + oficoreTotal + ofitecTotal + sgcTotal;
    const totalResueltos = facturasAprobadas + facturasRechazadas + facturasManuales + oficoreResueltas + ofitecResueltas + sgcPicking + sgcOd;
    const totalPendientes = facturasPendientes + oficoreNoResueltas + ofitecPendientes + sgcOtros;
    const totalErroresInfra = facturasErrorInfra;

    const tasaExitoGlobal = totalDocumentos > 0 ? Math.round((totalResueltos / totalDocumentos) * 100) : 0;
    const disponibilidadGlobal = totalDocumentos > 0 ? (100 - Math.round((totalErroresInfra / totalDocumentos) * 100)) : 100;
    const infraestructuraGlobal = totalDocumentos > 0 ? Math.round((totalErroresInfra / totalDocumentos) * 100) : 0;

    setDetalleDisponibilidad([
      { 
        id: "facturas", 
        nombre: "Aceptación y Rechazo", 
        valor: facturasTotal > 0 ? (100 - Math.round((facturasErrorInfra / facturasTotal) * 100)) : 100,
        total: facturasTotal,
        errorDocs: facturasErrorInfra,
        estado: facturasErrorInfra === 0 ? "Disponible" : "Atención"
      },
      { 
        id: "oficore", 
        nombre: "OFICORE", 
        valor: oficoreTotal > 0 ? Math.round((oficoreResueltas / oficoreTotal) * 100) : 100,
        total: oficoreTotal,
        errorDocs: 0,
        estado: oficoreResueltas > oficoreTotal * 0.8 ? "Disponible" : "Atención"
      },
      { 
        id: "ofitec", 
        nombre: "OFITEC", 
        valor: ofitecIngresadas > 0 ? Math.round((ofitecResueltas / ofitecIngresadas) * 100) : 100,
        total: ofitecIngresadas,
        errorDocs: 0,
        estado: ofitecResueltas > ofitecIngresadas * 0.8 ? "Disponible" : "Atención"
      },
      { 
        id: "sgc", 
        nombre: "SGC", 
        valor: sgcTotal > 0 ? Math.round(((sgcPicking + sgcOd) / sgcTotal) * 100) : 100,
        total: sgcTotal,
        errorDocs: 0,
        estado: (sgcPicking + sgcOd) > sgcTotal * 0.8 ? "Disponible" : "Atención"
      },
    ]);

    const incidentesDetalle = [
      { id: "facturas-manuales", nombre: "Facturas Manuales", valor: facturasManuales, servicio: "Facturas", estado: "Manual" },
      { id: "facturas-rechazadas", nombre: "Facturas Rechazadas", valor: facturasRechazadas, servicio: "Facturas", estado: "Rechazado" },
      { id: "oficore-pendientes", nombre: "Incidencias No Resueltas", valor: oficoreNoResueltas, servicio: "OFICORE", estado: "Pendiente" },
      { id: "ofitec-pendientes", nombre: "Llamadas Pendientes", valor: ofitecPendientes, servicio: "OFITEC", estado: "Pendiente" },
      { id: "sgc-otros", nombre: "Documentos Otros", valor: sgcOtros, servicio: "SGC", estado: "Pendiente" },
    ].filter(i => i.valor > 0);
    setDetalleIncidentes(incidentesDetalle);

    const alertasCriticas = [
      { 
        id: "errorInfra", 
        nombre: "Errores Infraestructura", 
        valor: facturasErrorInfra, 
        servicio: "Facturas", 
        estado: "Crítico",
        descripcion: "Errores técnicos (conexión, timeout, servidor caído)"
      },
    ].filter(i => i.valor > 0);
    
    setDetalleAlertas(alertasCriticas);

    const criticos = facturasErrorInfra;
    const altos = facturasRechazadas + oficoreNoResueltas;
    const medios = facturasManuales + ofitecPendientes;
    const bajos = facturasPendientes + sgcOtros;

    setIncidentesSeveridad([
      { name: "Crítico", value: criticos, color: "#ef4444" },
      { name: "Alto", value: altos, color: "#f97316" },
      { name: "Medio", value: medios, color: "#eab308" },
      { name: "Bajo", value: bajos, color: "#3b82f6" }
    ]);

    setDetalleCambios([
      { id: "facturas", nombre: "Facturas Aprobadas", valor: facturasAprobadas, total: facturasTotal, porcentaje: facturasTotal > 0 ? Math.round((facturasAprobadas / facturasTotal) * 100) : 0, estado: "Exitoso" },
      { id: "oficore", nombre: "Incidencias Resueltas", valor: oficoreResueltas, total: oficoreTotal, porcentaje: oficoreTotal > 0 ? Math.round((oficoreResueltas / oficoreTotal) * 100) : 0, estado: "Exitoso" },
      { id: "ofitec", nombre: "Llamadas Resueltas", valor: ofitecResueltas, total: ofitecIngresadas, porcentaje: ofitecIngresadas > 0 ? Math.round((ofitecResueltas / ofitecIngresadas) * 100) : 0, estado: "Exitoso" },
      { id: "sgc", nombre: "Documentos Procesados", valor: sgcPicking + sgcOd, total: sgcTotal, porcentaje: sgcTotal > 0 ? Math.round(((sgcPicking + sgcOd) / sgcTotal) * 100) : 0, estado: "Exitoso" },
    ]);

    const ticketsPorDia: { [key: string]: { ingresados: number; asignados: number; resueltos: number; cerrados: number } } = {};
    
    facturasDataFiltered.forEach((f: any) => {
      const fecha = f.fecha_proceso?.split('T')[0];
      if (fecha) {
        if (!ticketsPorDia[fecha]) {
          ticketsPorDia[fecha] = { ingresados: 0, asignados: 0, resueltos: 0, cerrados: 0 };
        }
        ticketsPorDia[fecha].ingresados++;
        if (f.estado === "Aprobado" || f.estado === "Rechazado") {
          ticketsPorDia[fecha].resueltos++;
        }
        if (f.estado === "Manual") {
          ticketsPorDia[fecha].asignados++;
        }
        if (f.estado === "Rechazado") {
          ticketsPorDia[fecha].cerrados++;
        }
      }
    });

    oficoreDetallesFiltered.forEach((d: any) => {
      const fecha = d.fecha_detalle?.split('T')[0];
      if (fecha) {
        if (!ticketsPorDia[fecha]) {
          ticketsPorDia[fecha] = { ingresados: 0, asignados: 0, resueltos: 0, cerrados: 0 };
        }
        ticketsPorDia[fecha].ingresados++;
        if (d.id_accion === 5) {
          ticketsPorDia[fecha].resueltos++;
        }
        if (d.id_accion !== 5 && d.id_accion !== 3) {
          ticketsPorDia[fecha].asignados++;
        }
        if (d.id_accion === 3) {
          ticketsPorDia[fecha].cerrados++;
        }
      }
    });

    ofitecDetallesFiltered.forEach((d: any) => {
      const fecha = d.LLA_FEC_LLAMADA?.split('T')[0];
      if (fecha) {
        if (!ticketsPorDia[fecha]) {
          ticketsPorDia[fecha] = { ingresados: 0, asignados: 0, resueltos: 0, cerrados: 0 };
        }
        if (d.LLA_CORRELATIVO === "1" || d.LLA_CORRELATIVO === 1) {
          ticketsPorDia[fecha].ingresados++;
        }
        const est = d.LLA_ESTADO?.toString().trim();
        if (['4','24','6','8','9','15','16','7'].includes(est)) {
          ticketsPorDia[fecha].resueltos++;
        }
        if (['1','2','17','20','5','30'].includes(est)) {
          ticketsPorDia[fecha].asignados++;
        }
        if (['8','9','11','12'].includes(est)) {
          ticketsPorDia[fecha].cerrados++;
        }
      }
    });

    sgcDataFiltered.forEach((d: any) => {
      const fecha = d.fecha_documento?.split('T')[0];
      if (fecha) {
        if (!ticketsPorDia[fecha]) {
          ticketsPorDia[fecha] = { ingresados: 0, asignados: 0, resueltos: 0, cerrados: 0 };
        }
        ticketsPorDia[fecha].ingresados++;
        if (d.tipo_de_venta === "picking" || d.tipo_de_venta === "od") {
          ticketsPorDia[fecha].resueltos++;
        }
        if (d.tipo_de_venta === "venta directa") {
          ticketsPorDia[fecha].asignados++;
        }
        if (d.tipo_de_venta === "distribución") {
          ticketsPorDia[fecha].cerrados++;
        }
      }
    });

    const ticketsData = Object.keys(ticketsPorDia).sort().map(fecha => ({
      fecha,
      ...ticketsPorDia[fecha]
    }));

    setDetalleTickets(ticketsData);

    const proyectos: any[] = [];
    const detalleEntregas: any[] = [];
    const detalleTareas: any[] = [];
    const detalleBugs: any[] = [];

    const tasaExitoFacturas = facturasTotal > 0 ? Math.round((facturasAprobadas / facturasTotal) * 100) : 0;
    proyectos.push({
      id: 1,
      nombre: "Aceptación y Rechazo de Facturas",
      responsable: "RPA",
      progreso: tasaExitoFacturas,
      estado: tasaExitoFacturas >= 80 ? "En Progreso" : "Retrasada",
      prioridad: "Alta" as const,
    });
    detalleEntregas.push({
      id: "facturas",
      nombre: "Facturas Aprobadas",
      valor: facturasAprobadas,
      total: facturasTotal,
      porcentaje: tasaExitoFacturas,
      estado: "Completadas",
      color: "#10b981"
    });
    detalleTareas.push({
      id: "facturas",
      nombre: "Facturas Pendientes",
      valor: facturasManuales + facturasPendientes,
      detalle: `Manuales: ${facturasManuales}, Pendientes: ${facturasPendientes}`,
      estado: "Pendiente"
    });
    detalleBugs.push({
      id: "facturas",
      nombre: "Facturas Rechazadas",
      valor: facturasRechazadas,
      detalle: `Rechazadas por reglas de negocio`,
      estado: "Bug"
    });

    const tasaExitoOficore = oficoreTotal > 0 ? Math.round((oficoreResueltas / oficoreTotal) * 100) : 0;
    proyectos.push({
      id: 2,
      nombre: "OFICORE - Incidencias",
      responsable: "Soporte Técnico",
      progreso: tasaExitoOficore,
      estado: tasaExitoOficore >= 80 ? "En Progreso" : tasaExitoOficore >= 50 ? "En Progreso" : "Retrasada",
      prioridad: "Media" as const,
    });
    detalleEntregas.push({
      id: "oficore",
      nombre: "Incidencias Resueltas",
      valor: oficoreResueltas,
      total: oficoreTotal,
      porcentaje: tasaExitoOficore,
      estado: "Completadas",
      color: "#10b981"
    });
    detalleTareas.push({
      id: "oficore",
      nombre: "Incidencias Pendientes",
      valor: oficoreNoResueltas,
      detalle: `No resueltas (id_accion !== 5)`,
      estado: "Pendiente"
    });
    detalleBugs.push({
      id: "oficore",
      nombre: "Incidencias No Resueltas",
      valor: oficoreNoResueltas,
      detalle: `Requieren atención técnica`,
      estado: "Bug"
    });

    const tasaExitoOfitec = ofitecIngresadas > 0 ? Math.round((ofitecResueltas / ofitecIngresadas) * 100) : 0;
    proyectos.push({
      id: 3,
      nombre: "OFITEC - Llamadas",
      responsable: "Soporte Técnico",
      progreso: tasaExitoOfitec,
      estado: tasaExitoOfitec >= 80 ? "En Progreso" : tasaExitoOfitec >= 50 ? "En Progreso" : "Retrasada",
      prioridad: "Media" as const,
    });
    detalleEntregas.push({
      id: "ofitec",
      nombre: "Llamadas Resueltas",
      valor: ofitecResueltas,
      total: ofitecIngresadas,
      porcentaje: tasaExitoOfitec,
      estado: "Completadas",
      color: "#10b981"
    });
    detalleTareas.push({
      id: "ofitec",
      nombre: "Llamadas Pendientes",
      valor: ofitecPendientes,
      detalle: `No resueltas (estados no resueltos)`,
      estado: "Pendiente"
    });
    detalleBugs.push({
      id: "ofitec",
      nombre: "Llamadas No Resueltas",
      valor: ofitecPendientes,
      detalle: `Requieren seguimiento técnico`,
      estado: "Bug"
    });

    const tasaExitoSgc = sgcTotal > 0 ? Math.round(((sgcPicking + sgcOd) / sgcTotal) * 100) : 0;
    proyectos.push({
      id: 4,
      nombre: "SGC - Documentos",
      responsable: "Logística",
      progreso: tasaExitoSgc,
      estado: tasaExitoSgc >= 80 ? "En Progreso" : tasaExitoSgc >= 50 ? "En Progreso" : "Retrasada",
      prioridad: "Media" as const,
    });
    detalleEntregas.push({
      id: "sgc",
      nombre: "Documentos Procesados",
      valor: sgcPicking + sgcOd,
      total: sgcTotal,
      porcentaje: tasaExitoSgc,
      estado: "Completadas",
      color: "#10b981"
    });
    detalleTareas.push({
      id: "sgc",
      nombre: "Documentos Otros",
      valor: sgcOtros,
      detalle: `Documentos no clasificados`,
      estado: "Pendiente"
    });
    detalleBugs.push({
      id: "sgc",
      nombre: "Documentos No Procesados",
      valor: sgcOtros,
      detalle: `Requieren revisión`,
      estado: "Bug"
    });

    const totalProblemas = facturasRechazadas + oficoreNoResueltas + ofitecPendientes + sgcOtros;
    const problemasPorcentaje = totalDocumentos > 0 
      ? Math.round((totalProblemas / totalDocumentos) * 100) 
      : 0;
    const erroresInfraPorcentaje = totalDocumentos > 0 
      ? Math.round((totalErroresInfra / totalDocumentos) * 100) 
      : 0;

    const saludTecnica = Math.min(100, tasaExitoGlobal);
    const cumplimiento = Math.min(100, tasaExitoGlobal + 5);
    const recursos = Math.max(0, Math.min(100, 100 - Math.min(erroresInfraPorcentaje, 30)));
    const riesgos = Math.max(0, Math.min(100, 100 - Math.min(problemasPorcentaje, 30)));

    setSaludProyectos([
      { 
        name: "Salud Técnica", 
        value: Math.round(saludTecnica), 
        color: saludTecnica > 70 ? "#8b5cf6" : saludTecnica > 40 ? "#f59e0b" : "#ef4444" 
      },
      { 
        name: "Cumplimiento", 
        value: Math.round(cumplimiento), 
        color: cumplimiento > 70 ? "#3b82f6" : cumplimiento > 40 ? "#f59e0b" : "#ef4444" 
      },
      { 
        name: "Recursos", 
        value: Math.round(recursos), 
        color: recursos > 70 ? "#10b981" : recursos > 40 ? "#f59e0b" : "#ef4444" 
      },
      { 
        name: "Riesgos", 
        value: Math.round(riesgos), 
        color: riesgos > 70 ? "#10b981" : riesgos > 40 ? "#f59e0b" : "#ef4444" 
      },
    ]);

    const numProyectos = proyectos.length || 1;
    const avancePromedio = Math.round(proyectos.reduce((sum, p) => sum + p.progreso, 0) / numProyectos);
    const completadas = detalleEntregas.reduce((sum, p) => sum + p.valor, 0);
    const pendientesTotal = detalleTareas.reduce((sum, p) => sum + p.valor, 0);
    const bugsTotal = detalleBugs.reduce((sum, p) => sum + p.valor, 0);

    setProyectosActivos(proyectos);
    setProyectosMetrics({
      entregasATiempo: avancePromedio,
      tareasPendientes: pendientesTotal,
      bugsAbiertos: Math.round(bugsTotal / 4),
      proyectosActivos: proyectos.length,
      avancePromedio: avancePromedio,
    });

    setEntregasPorEstado([
      { name: "Completadas", value: completadas, color: "#10b981", icon: "✅" },
      { name: "En Progreso", value: pendientesTotal, color: "#3b82f6", icon: "🔄" },
      { name: "Retrasadas", value: bugsTotal, color: "#ef4444", icon: "⚠️" },
      { name: "Pendientes", value: pendientesTotal, color: "#f59e0b", icon: "⏳" },
    ]);

    return { 
      proyectos, 
      metrics: { 
        avancePromedio, 
        completadas, 
        pendientesTotal, 
        bugsTotal,
        disponibilidadGlobal,
        infraestructuraGlobal
      } 
    };
  };

  const sortedServices = useMemo(() => {
    const active = services.filter(s => !s.isComingSoon);
    const soon = services.filter(s => s.isComingSoon);
    return [...active, ...soon];
  }, []);

  const serviceAvailabilities = useMemo(() => {
    return {
      facturas: 99.85,
      oficore: 99.80,
      ofitec: 99.85,
      sgc: 96.90
    };
  }, []);

  const navigateToService = (serviceId: string) => {
    router.push(`/servicio/${serviceId}`);
  };

  const filteredInvoices = useMemo(() => {
    return realInvoiceData.filter(item => {
      const itemDate = new Date(item.fecha_proceso);
      if (isNaN(itemDate.getTime())) return false;

      if (filters.dateRange.from) {
        const from = startOfDay(filters.dateRange.from);
        if (itemDate < from) return false;
      }
      if (filters.dateRange.to) {
        const to = endOfDay(filters.dateRange.to);
        if (itemDate > to) return false;
      }

      return true;
    });
  }, [realInvoiceData, filters.dateRange]);

  const operacionStats = useMemo(() => {
    const totalDocs = filteredInvoices.length;
    const errorDocs = filteredInvoices.filter(f => isInfraestructuraError(f.motivo)).length;
    
    const errorRate = totalDocs > 0 ? (errorDocs / totalDocs) * 100 : 0;
    const disponibilidadGlobal = (100 - errorRate).toFixed(2);

    const incidentesAbiertos = filteredInvoices.filter(f => ["Manual", "Rechazado"].includes(f.estado)).length;
    const aprobadas = filteredInvoices.filter(f => f.estado === "Aprobado").length;
    const cambiosExitosos = totalDocs > 0 ? Math.round((aprobadas / totalDocs) * 100) : 100;
    const ticketsResueltos = filteredInvoices.filter(f => ["Aprobado", "Rechazado", "Manual"].includes(f.estado)).length;

    return {
      disponibilidadGlobal,
      incidentesAbiertos,
      cambiosExitosos,
      errorDocs,
      ticketsResueltos
    };
  }, [filteredInvoices]);

  const getServiceAvailability = (serviceId: string) => {
    const srv = services.find(s => s.id === serviceId);
    if (srv) {
      if (srv.id === "facturas") {
        return parseFloat(operacionStats.disponibilidadGlobal);
      }
      return 100 - srv.errorPercentage;
    }
    return (serviceAvailabilities as Record<string, number>)[serviceId] || 100;
  };

  // ✅ Función para obtener el estado REAL del servicio
  const getRealServiceStatus = (service: any): "success" | "warning" | "error" => {
    if (service.isComingSoon) return "success";
    
    if (service.id === "facturas") {
      const facturasService = services.find(s => s.id === "facturas");
      if (facturasService) {
        const hasRealInfraError = facturasService.logs?.some((log: any) => 
          isInfraestructuraError(log.message) || 
          isInfraestructuraError(log.details) ||
          isInfraestructuraError(log.estado || "")
        );
        
        if (!hasRealInfraError) {
          return "success";
        }
        return facturasService.status || "success";
      }
    }
    
    return service.status || "success";
  };

  const loadAllData = async (dateRange?: { from: Date | undefined; to: Date | undefined }) => {
    setLoading(true);
    try {
      const fechaDesde = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
      const fechaHasta = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

      let facturasUrl = "/api/facturas/bitacora?estado=todos";
      if (fechaDesde) facturasUrl += `&fechaDesde=${fechaDesde}`;
      if (fechaHasta) facturasUrl += `&fechaHasta=${fechaHasta}`;
      
      const facturasRes = await fetch(facturasUrl);
      const facturasData = await facturasRes.json();
      const facturasArray = facturasData.success && facturasData.data ? facturasData.data : [];
      
      setRealInvoiceData(facturasArray);
      
      const servicesData = await fetchAllServicesData(dateRange);
      
      if (servicesData) {
        calculateAllMetrics(servicesData, facturasArray);
      }

      if (facturasArray.length > 0) {
        const dailyStats: { [key: string]: any } = {};
        
        facturasArray.forEach((item: any) => {
          const fecha = item.fecha_proceso.split('T')[0];
          const estado = item.estado;
          const motivo = item.motivo || "";
          const esErrorInfra = isInfraestructuraError(motivo);
          
          if (!dailyStats[fecha]) {
            dailyStats[fecha] = {
              fecha,
              aprobadas: 0,
              rechazadasReglaNegocio: 0,
              manualesReglaNegocio: 0,
              pendientes: 0,
              erroresInfraestructura: 0,
              total: 0
            };
          }
          
          if (estado === "Aprobado") {
            dailyStats[fecha].aprobadas++;
          } else if (estado === "Rechazado") {
            if (esErrorInfra) {
              dailyStats[fecha].erroresInfraestructura++;
            } else {
              dailyStats[fecha].rechazadasReglaNegocio++;
            }
          } else if (estado === "Manual") {
            if (esErrorInfra) {
              dailyStats[fecha].erroresInfraestructura++;
            } else {
              dailyStats[fecha].manualesReglaNegocio++;
            }
          } else {
            dailyStats[fecha].pendientes++;
          }
          dailyStats[fecha].total++;
        });
        
        const metricsData: MetricDataPoint[] = [];
        const sortedDates = Object.keys(dailyStats).sort();
        
        sortedDates.forEach(date => {
          const stats = dailyStats[date];
          metricsData.push({
            id: `facturas_${date}`,
            timestamp: date,
            date: parseISO(date),
            successCount: stats.aprobadas,
            errorCount: stats.erroresInfraestructura,
            reglaNegocioCount: stats.rechazadasReglaNegocio + stats.manualesReglaNegocio,
            responseTime: 300 + Math.floor(Math.random() * 100),
            throughput: Math.floor(stats.total / 24),
            serviceName: "Aceptación y Rechazo de Facturas",
            endpoint: "/api/facturas/bitacora",
          });
        });
        
        const simulatedData = generateMetricsData();
        const otherServicesData = simulatedData.filter(s => s.serviceName !== "Aceptación y Rechazo de Facturas");
        setAllData([...metricsData, ...otherServicesData]);
      } else {
        setAllData(generateMetricsData());
      }

    } catch (error) {
      console.error("Error loading data:", error);
      setAllData(generateMetricsData());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const applyDateFilter = () => {
    const newRange = { from: tempDateRange.from, to: tempDateRange.to };
    setFilters({ ...filters, dateRange: newRange });
    setDateFilterApplied(true);
    setCalendarOpen(false);
    loadAllData(newRange);
  };

  const clearDateFilter = () => {
    setTempDateRange({ from: undefined, to: undefined });
    setFilters({ ...filters, dateRange: { from: undefined, to: undefined } });
    setDateFilterApplied(false);
    setCalendarOpen(false);
    loadAllData();
  };

  const availableServices = useMemo(() => {
    const servicesSet = new Set(allData.map(item => item.serviceName));
    return Array.from(servicesSet).sort();
  }, [allData]);

  const serviciosInternos = useMemo(() => {
    return services.filter(s => 
      s.id === "facturas" || 
      s.id === "saldos" || 
      s.id === "finiquitos" || 
      s.id === "cuentas"
    );
  }, []);

  const serviciosExternos = useMemo(() => {
    return services.filter(s => 
      s.id === "dte" || 
      s.id === "contabilizacion" || 
      s.id === "notas-credito"
    );
  }, []);

  const serviciosConErrores = useMemo(() => {
    return services.filter(s => s.errorPercentage > 0);
  }, []);

  const globalStats = useMemo(() => {
    const totalSuccess = allData.reduce((sum, d) => sum + d.successCount, 0);
    const totalInfraErrors = allData.reduce((sum, d) => sum + (d.errorCount || 0), 0);
    const totalRequests = totalSuccess + totalInfraErrors;
    
    const errorRate = totalRequests > 0 ? (totalInfraErrors / totalRequests) * 100 : 0;
    const successRate = totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0;
    
    return {
      successRate: successRate.toFixed(1),
      totalSuccess,
      totalInfraErrors,
      errorRate: errorRate.toFixed(2),
      sistemasInternos: serviciosInternos.length,
      sistemasExternos: serviciosExternos.length,
      serviciosConErrores: serviciosConErrores.length,
    };
  }, [allData, serviciosInternos, serviciosExternos, serviciosConErrores]);

  const filteredData = useMemo(() => {
    let data = allData;
    
    if (filters.service !== "todos") {
      data = data.filter(d => d.serviceName === filters.service);
    }
    
    if (filters.dateRange.from && filters.dateRange.to) {
      data = data.filter(d => {
        const date = new Date(d.date);
        return isWithinInterval(date, {
          start: startOfDay(filters.dateRange.from!),
          end: endOfDay(filters.dateRange.to!),
        });
      });
    }
    
    return data;
  }, [allData, filters]);

  const evolutionChartData = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    const grouped: { [key: string]: any } = {};
    
    filteredData.forEach(d => {
      let key = format(d.date, "yyyy-MM-dd");
      let label = format(d.date, "dd/MM");
      
      if (filters.view === "weekly") {
        const weekNumber = Math.ceil(parseInt(format(d.date, "dd")) / 7);
        const month = format(d.date, "MMM");
        key = `${format(d.date, "yyyy-MM")}-W${weekNumber}`;
        label = `${month} S${weekNumber}`;
      } else if (filters.view === "monthly") {
        key = format(d.date, "yyyy-MM");
        label = format(d.date, "MMM yyyy");
      } else if (filters.view === "todos") {
        key = format(d.date, "yyyy-MM");
        label = format(d.date, "MMM yyyy");
      }
      
      if (!grouped[key]) {
        grouped[key] = {
          date: label,
          key: key,
          exitosas: 0,
          erroresInfraestructura: 0,
          reglasNegocio: 0,
        };
      }
      grouped[key].exitosas += d.successCount;
      grouped[key].erroresInfraestructura += (d.errorCount || 0);
      grouped[key].reglasNegocio += (d.reglaNegocioCount || 0);
    });
    
    return Object.values(grouped).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredData, filters.view]);

  const distributionChartData = useMemo(() => {
    const totalSuccess = filteredData.reduce((sum, d) => sum + d.successCount, 0);
    const totalInfraErrors = filteredData.reduce((sum, d) => sum + (d.errorCount || 0), 0);
    const totalReglasNegocio = filteredData.reduce((sum, d) => sum + (d.reglaNegocioCount || 0), 0);
    
    return [
      { name: "Exitosas", value: totalSuccess, color: COLORS[0], icon: "✅" },
      { name: "Reglas de Negocio", value: totalReglasNegocio, color: COLORS[2], icon: "⚠️" },
      { name: "Errores Infraestructura", value: totalInfraErrors, color: COLORS[1], icon: "❌" },
    ].filter(item => item.value > 0);
  }, [filteredData]);

  const resetFilters = () => {
    setFilters({
      service: "todos",
      dateRange: { from: undefined, to: undefined },
      view: "todos",
      metric: "all",
    });
    setTempDateRange({ from: undefined, to: undefined });
    setDateFilterApplied(false);
    setCalendarOpen(false);
    loadAllData();
  };

  const handleOpenExportModal = () => {
    setShowExportModal(true);
  };

  const handleToggleAllFields = () => {
    if (selectAll) {
      setSelectedFields([]);
    } else {
      setSelectedFields(EXPORT_FIELDS.map(f => f.id));
    }
    setSelectAll(!selectAll);
  };

  const handleToggleField = (fieldId: string) => {
    setSelectedFields(prev => {
      const newSelection = prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId];
      
      setSelectAll(newSelection.length === EXPORT_FIELDS.length);
      return newSelection;
    });
  };

  const handleExportToExcel = () => {
    if (selectedFields.length === 0) {
      alert("Por favor selecciona al menos un campo para exportar.");
      return;
    }

    const fieldMap: Record<string, (item: any) => any> = {
      fecha: (item) => {
        try {
          const d = item.date ? new Date(item.date) : new Date(item.timestamp);
          return format(d, "dd/MM/yyyy");
        } catch {
          return item.timestamp || format(new Date(), "dd/MM/yyyy");
        }
      },
      servicio: (item) => item.serviceName || "Todos los servicios",
      exitosas: (item) => item.successCount || 0,
      erroresInfraestructura: (item) => item.errorCount || 0,
      reglasNegocio: (item) => item.reglaNegocioCount || 0,
      totalPeticiones: (item) => (item.successCount || 0) + (item.errorCount || 0) + (item.reglaNegocioCount || 0),
      tasaExito: (item) => {
        const total = (item.successCount || 0) + (item.errorCount || 0) + (item.reglaNegocioCount || 0);
        return total > 0 ? ((item.successCount / total) * 100).toFixed(1) : "0";
      },
      tasaErrorInfra: (item) => {
        const total = (item.successCount || 0) + (item.errorCount || 0) + (item.reglaNegocioCount || 0);
        return total > 0 ? ((item.errorCount / total) * 100).toFixed(1) : "0";
      },
      tiempoRespuesta: (item) => item.responseTime || "N/A",
    };

    const fieldLabels: Record<string, string> = {};
    EXPORT_FIELDS.forEach(f => fieldLabels[f.id] = f.label);

    const exportDataItems = filteredData;

    const exportData = exportDataItems.map(item => {
      const row: Record<string, any> = {};
      selectedFields.forEach(fieldId => {
        const label = fieldLabels[fieldId] || fieldId;
        row[label] = fieldMap[fieldId](item);
      });
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    const colWidths = selectedFields.map(() => ({ wch: 25 }));
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard Metrics");
    
    const summaryData = [
      { "Métrica": "Tasa Éxito General", "Valor": `${globalStats.successRate}%` },
      { "Métrica": "Total Peticiones Exitosas", "Valor": globalStats.totalSuccess.toLocaleString() },
      { "Métrica": "Total Errores Infraestructura", "Valor": globalStats.totalInfraErrors.toLocaleString() },
      { "Métrica": "Tasa Error Infraestructura", "Valor": `${globalStats.errorRate}%` },
      { "Métrica": "Sistemas Internos", "Valor": globalStats.sistemasInternos },
      { "Métrica": "Sistemas Externos", "Valor": globalStats.sistemasExternos },
      { "Métrica": "Fecha Exportación", "Valor": format(new Date(), "dd/MM/yyyy HH:mm:ss") },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    
    XLSX.writeFile(wb, `dashboard_metrics_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xlsx`);
    
    setShowExportModal(false);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const clientesUnicos = useMemo(() => {
    const clientesMap = new Map<string, { id: string; name: string; rut: string; email: string; phone: string }>();
    
    services.filter(s => !s.isComingSoon).forEach(service => {
      service.clients.forEach(client => {
        if (!clientesMap.has(client.id)) {
          clientesMap.set(client.id, {
            id: client.id,
            name: client.name,
            rut: client.rut || "N/A",
            email: client.email || "N/A",
            phone: client.phone || "N/A",
          });
        }
      });
    });
    
    return Array.from(clientesMap.values());
  }, []);

  const totalClientesActivos = clientesUnicos.length;
  const totalServiciosActivos = services.filter(s => !s.isComingSoon).length;
  
  const disponibilidad = useMemo(() => {
    const activeServices = services.filter(s => !s.isComingSoon);
    if (activeServices.length === 0) return 100;
    const sum = activeServices.reduce((acc, s) => acc + getServiceAvailability(s.id), 0);
    return sum / activeServices.length;
  }, [services, operacionStats.disponibilidadGlobal]);

  // ✅ INFRAESTRUCTURA: Calcular promedio de Servidores Core y Bases de Datos (sin Enlaces de Red)
  const infraestructuraZabbix = (infraStats.servidoresCore + infraStats.database) / 2;

  const ticketsPorDia = useMemo(() => {
    return detalleTickets.map(t => {
      let formattedDate = t.fecha;
      if (t.fecha && t.fecha.includes("-")) {
        const parts = t.fecha.split("-");
        if (parts.length === 3) {
          formattedDate = `${parts[2]}/${parts[1]}`;
        }
      }
      return {
        ...t,
        fecha: formattedDate
      };
    }).slice(-14);
  }, [detalleTickets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando datos del dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1e293b] flex items-center gap-2">
            VISTA EJECUTIVA
          </h1>
          <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
            RESUMEN INTEGRAL DE TECNOLOGÍA
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs bg-white border-slate-200 shadow-sm font-semibold text-slate-700">
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                {dateFilterApplied && filters.dateRange.from && filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, "dd MMM yyyy", { locale: es })} - {format(filters.dateRange.to, "dd MMM yyyy", { locale: es })}
                  </>
                ) : (
                  "Seleccionar período"
                )}
                {dateFilterApplied && (
                  <Badge variant="secondary" className="ml-1 text-[8px] bg-emerald-100 text-emerald-700 border-emerald-200">
                    Activo
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ 
                  from: tempDateRange.from || undefined, 
                  to: tempDateRange.to || undefined 
                }}
                onSelect={(range) => {
                  if (range) {
                    setTempDateRange({ 
                      from: range.from || undefined, 
                      to: range.to || undefined 
                    });
                  }
                }}
                initialFocus
                locale={es}
              />
              <div className="p-2 border-t flex justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearDateFilter}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpiar
                </Button>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => setCalendarOpen(false)}
                    variant="outline"
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={applyDateFilter}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700"
                    disabled={!tempDateRange.from || !tempDateRange.to}
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {dateFilterApplied && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearDateFilter}
              className="h-9 text-xs text-red-500 hover:text-red-600"
            >
              <X className="h-3 w-3 mr-1" />
              Quitar filtro
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handleOpenExportModal} className="h-9 text-xs bg-white border-slate-200 shadow-sm font-semibold text-slate-700">
            <Download className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
            Exportar
          </Button>

          <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ============================================================
          PANEL 1: OPERACIONES Y DISPONIBILIDAD
          ============================================================ */}
      <div className="flex flex-col lg:flex-row bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="w-full lg:w-[150px] shrink-0 p-4 bg-[#1e40af] text-white flex lg:flex-col justify-between items-center text-center select-none border-b lg:border-b-0 lg:border-r border-slate-200">
          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">1</div>
          <div className="flex flex-col items-center gap-1.5 my-auto">
            <Cloud className="h-7 w-7 text-white/90" />
            <p className="font-extrabold text-[10px] leading-tight tracking-wider uppercase">Operaciones y Disponibilidad</p>
            <p className="text-[8px] text-white/80 font-medium tracking-wide uppercase">Servicios e Infraestructura</p>
          </div>
          <div className="hidden lg:block h-6 w-6" />
        </div>

        <div className="flex-1 p-4 space-y-4 bg-slate-50/20">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Clientes</span>
                <User className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-xl font-black text-slate-800 mt-1">{totalClientesActivos}</p>
              <span className="text-[8px] text-slate-400 block mt-1">Activos</span>
            </div>

            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Servicios</span>
                <Layers className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-xl font-black text-slate-800 mt-1">{totalServiciosActivos}</p>
              <span className="text-[8px] text-slate-400 block mt-1">Activos</span>
            </div>

            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Disponibilidad</span>
                <Gauge className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-xl font-black text-slate-800 mt-1">{disponibilidad.toFixed(2)}%</p>
            </div>

            {/* ✅ INFRAESTRUCTURA - PROMEDIO DE SERVIDORES CORE Y BASES DE DATOS */}
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Infraestructura</span>
                <Server className="h-4 w-4 text-blue-500" />
              </div>
              <p className={cn(
                "text-xl font-black mt-1",
                infraestructuraZabbix >= 99 ? "text-emerald-600" : 
                infraestructuraZabbix >= 95 ? "text-amber-600" : "text-red-500"
              )}>
                {infraestructuraZabbix.toFixed(2)}%
              </p>
              <span className="text-[8px] text-slate-400 block mt-1">Servidores Core y BD</span>
            </div>

            <div 
              className="bg-white border rounded-lg p-3 shadow-xs cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
              onClick={() => setShowTicketsModal(true)}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ticket</span>
                <Ticket className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-xl font-black text-slate-800 mt-1">
                {realInvoiceData.filter(f => f.estado === "Pendiente" || f.estado === "Pendiente Espera").length}
              </p>
              <div className="flex items-center gap-1 text-[8px] text-amber-600 font-semibold">
                <span>Ver detalle</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Card 
              className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
              onClick={onNavigateToServices}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disponibilidad por Servicio</span>
                <ArrowRight className="h-3 w-3 text-emerald-500" />
              </div>
              <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1 mt-2">
                {sortedServices.map(s => {
                  if (s.isComingSoon) {
                    return (
                      <div key={s.id} className="space-y-0.5">
                        <div className="flex justify-between text-[9px] font-bold text-slate-450">
                          <span className="truncate max-w-[120px]">{s.name}</span>
                          <span className="text-[8px] font-extrabold text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-100">Próximamente</span>
                        </div>
                      </div>
                    );
                  }
                  const avail = getServiceAvailability(s.id);
                  const color = avail >= 99 ? "bg-emerald-500" : (avail >= 96 ? "bg-emerald-500" : "bg-amber-500");
                  return (
                    <div key={s.id} className="space-y-0.5">
                      <div className="flex justify-between text-[9px] font-bold text-slate-650">
                        <span className="truncate max-w-[140px]">{s.name}</span>
                        <span>{avail.toFixed(2)}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", color)} style={{ width: `${avail}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block border-b pb-1 mb-2">Estado de Servicios</span>
              <div className="text-[9px] space-y-1.5 font-semibold text-slate-700 max-h-[170px] overflow-y-auto pr-1">
                {sortedServices.map(s => {
                  if (s.isComingSoon) {
                    return (
                      <div key={s.id} className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold truncate max-w-[120px]">{s.name}</span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          <span className="text-[8px] font-extrabold text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-100">Próximamente</span>
                        </span>
                      </div>
                    );
                  }
                  
                  const realStatus = getRealServiceStatus(s);
                  let statusText = "Operativo";
                  let statusColor = "bg-emerald-500";
                  
                  if (realStatus === "error") {
                    statusText = "Crítico";
                    statusColor = "bg-red-500";
                  } else if (realStatus === "warning") {
                    statusText = "Intermitente";
                    statusColor = "bg-amber-500";
                  } else {
                    statusText = "Operativo";
                    statusColor = "bg-emerald-500";
                  }
                  
                  return (
                    <div key={s.id} className="flex justify-between items-center">
                      <span className="truncate max-w-[140px]">{s.name}</span>
                      <span className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", statusColor)} />
                        <span className="text-slate-500 text-[8px]">{statusText}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ✅ CUADRO DE INFRAESTRUCTURA - ZABBIX (SIN ENLACES DE RED) */}
            <Card className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-center border-b pb-1 mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Infraestructura</span>
                {infraStats.online && infraStats.version && (
                  <span className="text-[7.5px] font-extrabold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                    Zabbix v{infraStats.version}
                  </span>
                )}
              </div>
              
              <div className="text-[9px] space-y-1.5 font-semibold text-slate-700">
                <div className="flex justify-between items-center">
                  <span>Servidores Core</span>
                  <span className={cn("text-[9.5px] font-bold", infraStats.servidoresCore >= 99 ? "text-emerald-600" : "text-amber-600")}>
                    {infraStats.servidoresCore}%
                  </span>
                </div>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", infraStats.servidoresCore >= 99 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${infraStats.servidoresCore}%` }} />
                </div>

                <div className="flex justify-between items-center pt-0.5">
                  <span>Bases de Datos</span>
                  <span className={cn("text-[9.5px] font-bold", infraStats.database >= 99 ? "text-emerald-600" : "text-amber-600")}>
                    {infraStats.database}%
                  </span>
                </div>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", infraStats.database >= 99 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${infraStats.database}%` }} />
                </div>

                <div className="flex justify-between items-center pt-0.5 text-xs text-muted-foreground">
                  <span>Promedio General</span>
                  <span className={cn("text-[9.5px] font-bold", infraestructuraZabbix >= 99 ? "text-emerald-600" : "text-amber-600")}>
                    {infraestructuraZabbix.toFixed(2)}%
                  </span>
                </div>
              </div>

              <Button variant="ghost" size="sm" className="mt-3 w-full text-[9px] h-7 font-bold text-[#1e40af] hover:text-[#1d4ed8] hover:bg-blue-50 flex items-center justify-center gap-1 border border-blue-100 rounded" onClick={handleZabbixRedirect}>
                Ver más
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Card>

            <Card className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block border-b pb-1 mb-1">Incidentes por Severidad</span>
                <div className="flex items-center justify-between mt-2">
                  <div className="h-[90px] w-[90px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={incidentesSeveridad}
                          cx="50%"
                          cy="50%"
                          innerRadius={25}
                          outerRadius={40}
                          dataKey="value"
                        >
                          {incidentesSeveridad.map((cell, idx) => (
                            <Cell key={`cell-${idx}`} fill={cell.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-[8px] text-slate-600 space-y-1 pr-2 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 block" /> 
                      Crítico: {incidentesSeveridad.find(i => i.name === "Crítico")?.value || 0}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500 block" /> 
                      Alto: {incidentesSeveridad.find(i => i.name === "Alto")?.value || 0}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 block" /> 
                      Medio: {incidentesSeveridad.find(i => i.name === "Medio")?.value || 0}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 block" /> 
                      Bajo: {incidentesSeveridad.find(i => i.name === "Bajo")?.value || 0}
                    </div>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-3 w-full text-[9px] h-7 font-bold text-[#1e40af] hover:text-[#1d4ed8] hover:bg-blue-50 flex items-center justify-center gap-1 border border-blue-100 rounded" onClick={onNavigateToTimeline}>
                Ver más
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Card>

            <Card className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block border-b pb-1 mb-2">Tickets por Día</span>
              <div className="w-full h-[90px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ticketsPorDia}>
                    <Bar dataKey="ingresados" stackId="a" fill="#3b82f6" name="Ingresados" />
                    <Bar dataKey="asignados" stackId="a" fill="#f59e0b" name="Asignados" />
                    <Bar dataKey="resueltos" stackId="a" fill="#10b981" name="Resueltos" />
                    <Bar dataKey="cerrados" stackId="a" fill="#ef4444" name="Cerrados" />
                    <Tooltip 
                      contentStyle={{ fontSize: '10px', padding: '4px 8px' }}
                      formatter={(value) => [value, '']}
                      labelFormatter={(label) => `Fecha: ${label}`}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-[6px] font-medium text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Ingresados
                </span>
                <span className="flex items-center gap-1 text-[6px] font-medium text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Asignados
                </span>
                <span className="flex items-center gap-1 text-[6px] font-medium text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Resueltos
                </span>
                <span className="flex items-center gap-1 text-[6px] font-medium text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Cerrados
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ============================================================
          PANEL 2: NEGOCIOS (PRÓXIMAMENTE)
          ============================================================ */}
      <div className="flex flex-col lg:flex-row bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
        <div className="w-full lg:w-[150px] shrink-0 p-4 bg-[#10b981] text-white flex lg:flex-col justify-between items-center text-center select-none border-b lg:border-b-0 lg:border-r border-slate-200">
          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">2</div>
          <div className="flex flex-col items-center gap-1.5 my-auto">
            <DollarSign className="h-7 w-7 text-white/90" />
            <p className="font-extrabold text-[10px] leading-tight tracking-wider uppercase">Negocios</p>
            <p className="text-[8px] text-white/80 font-medium tracking-wide uppercase">Lit / Propuestas / Cierres</p>
          </div>
          <div className="hidden lg:block h-6 w-6" />
        </div>

        <div className="flex-1 p-4 space-y-4 bg-slate-50/20 relative min-h-[250px]">
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6">
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-full mb-3 border border-emerald-100 shadow-sm animate-bounce">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase">Módulo de Negocios</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Próximamente: Integración con CRM, seguimiento de oportunidades, análisis de conversión y métricas de ventas.
            </p>
            <span className="mt-3 text-[10px] font-extrabold text-emerald-600 bg-emerald-100/60 px-2.5 py-1 rounded-full border border-emerald-200 uppercase tracking-wider">
              Próximamente
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 opacity-30 select-none pointer-events-none">
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Oportunidades</span>
              <p className="text-xl font-black text-slate-800 mt-1">24</p>
              <span className="text-[8px] text-emerald-600 block mt-1 font-semibold">↑ +12% vs mes ant.</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Propuestas</span>
              <p className="text-xl font-black text-slate-800 mt-1">18</p>
              <span className="text-[8px] text-slate-400 block mt-1">En revisión</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cierres</span>
              <p className="text-xl font-black text-slate-800 mt-1">8</p>
              <span className="text-[8px] text-emerald-600 block mt-1 font-semibold">↑ +5% vs mes ant.</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tasa Conversión</span>
              <p className="text-xl font-black text-slate-800 mt-1">33%</p>
              <span className="text-[8px] text-slate-400 block mt-1">Promedio Q2</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pipeline</span>
              <p className="text-xl font-black text-slate-800 mt-1">$456M</p>
              <span className="text-[8px] text-slate-400 block mt-1">Valor total</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          PANEL 3: PROYECTOS (PRÓXIMAMENTE)
          ============================================================ */}
      <div className="flex flex-col lg:flex-row bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
        <div className="w-full lg:w-[150px] shrink-0 p-4 bg-[#7c3aed] text-white flex lg:flex-col justify-between items-center text-center select-none border-b lg:border-b-0 lg:border-r border-slate-200">
          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">3</div>
          <div className="flex flex-col items-center gap-1.5 my-auto">
            <FolderKanban className="h-7 w-7 text-white/90" />
            <p className="font-extrabold text-[10px] leading-tight tracking-wider uppercase">Proyectos</p>
            <p className="text-[8px] text-white/80 font-medium tracking-wide uppercase">Gestión y Entregas</p>
          </div>
          <div className="hidden lg:block h-6 w-6" />
        </div>

        <div className="flex-1 p-4 space-y-4 bg-slate-50/20 relative min-h-[250px]">
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6">
            <div className="bg-purple-50 text-purple-700 p-3 rounded-full mb-3 border border-purple-100 shadow-sm animate-bounce">
              <GitBranch className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase">Módulo de Proyectos</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Próximamente: Gestión completa de proyectos, seguimiento de hitos, recursos y entregables.
            </p>
            <span className="mt-3 text-[10px] font-extrabold text-purple-600 bg-purple-100/60 px-2.5 py-1 rounded-full border border-purple-200 uppercase tracking-wider">
              Próximamente
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 opacity-30 select-none pointer-events-none">
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Proyectos Activos</span>
              <p className="text-xl font-black text-slate-800 mt-1">12</p>
              <span className="text-[8px] text-slate-400 block mt-1">En ejecución</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">% Avance Promedio</span>
              <p className="text-xl font-black text-slate-800 mt-1">68%</p>
              <span className="text-[8px] text-emerald-600 block mt-1 font-semibold">↑ +5% vs mes ant.</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Entregas a Tiempo</span>
              <p className="text-xl font-black text-slate-800 mt-1">82%</p>
              <span className="text-[8px] text-slate-400 block mt-1">Cumplimiento SLA</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tareas Pendientes</span>
              <p className="text-xl font-black text-slate-800 mt-1">45</p>
              <span className="text-[8px] text-amber-600 block mt-1 font-semibold">Priorizadas</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bugs Abiertos</span>
              <p className="text-xl font-black text-slate-800 mt-1">23</p>
              <span className="text-[8px] text-red-600 block mt-1 font-semibold">Requieren atención</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          PANEL 4: PRESUPUESTO Y CONTRATOS (PRÓXIMAMENTE)
          ============================================================ */}
      <div className="flex flex-col lg:flex-row bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
        <div className="w-full lg:w-[150px] shrink-0 p-4 bg-[#f59e0b] text-white flex lg:flex-col justify-between items-center text-center select-none border-b lg:border-b-0 lg:border-r border-slate-200">
          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">4</div>
          <div className="flex flex-col items-center gap-1.5 my-auto">
            <FileText className="h-7 w-7 text-white/90" />
            <p className="font-extrabold text-[10px] leading-tight tracking-wider uppercase">Presupuesto y Contratos</p>
            <p className="text-[8px] text-white/80 font-medium tracking-wide uppercase">Finanzas / Legal</p>
          </div>
          <div className="hidden lg:block h-6 w-6" />
        </div>

        <div className="flex-1 p-4 space-y-4 bg-slate-50/20 relative min-h-[250px]">
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6">
            <div className="bg-amber-50 text-amber-700 p-3 rounded-full mb-3 border border-amber-100 shadow-sm animate-bounce">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase">Módulo de Presupuesto y Contratos</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Próximamente: Gestión de presupuestos, contratos, seguimiento de costos y análisis financiero.
            </p>
            <span className="mt-3 text-[10px] font-extrabold text-amber-600 bg-amber-100/60 px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
              Próximamente
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 opacity-30 select-none pointer-events-none">
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Presupuesto Anual</span>
              <p className="text-xl font-black text-slate-800 mt-1">$2.4B</p>
              <span className="text-[8px] text-slate-400 block mt-1">Asignado 2026</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ejecutado</span>
              <p className="text-xl font-black text-slate-800 mt-1">$1.8B</p>
              <span className="text-[8px] text-emerald-600 block mt-1 font-semibold">75% del presupuesto</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Contratos Activos</span>
              <p className="text-xl font-black text-slate-800 mt-1">34</p>
              <span className="text-[8px] text-slate-400 block mt-1">En vigencia</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ahorros Identificados</span>
              <p className="text-xl font-black text-slate-800 mt-1">$186M</p>
              <span className="text-[8px] text-emerald-600 block mt-1 font-semibold">YTD</span>
            </div>
            <div className="bg-white border rounded-lg p-3 shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ROI Promedio</span>
              <p className="text-xl font-black text-slate-800 mt-1">2.8x</p>
              <span className="text-[8px] text-slate-400 block mt-1">Proyectos</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          MODALES - Panel 1 (ACTIVO)
          ============================================================ */}
      <Dialog open={showDisponibilidadModal} onOpenChange={setShowDisponibilidadModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Gauge className="h-5 w-5 text-emerald-500" />
              Disponibilidad por Servicio
              <Badge variant="secondary" className="ml-2">
                {detalleDisponibilidad.length > 0 ? Math.round(detalleDisponibilidad.reduce((sum, d) => sum + parseFloat(d.valor), 0) / detalleDisponibilidad.length) : 0}%
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Disponibilidad de cada servicio (SLA)</p>
            {detalleDisponibilidad.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay datos disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {detalleDisponibilidad.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.errorDocs > 0 ? `${item.errorDocs} errores técnicos` : "Sin errores"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      <div className="w-12 text-right">
                        <span className={cn("text-sm font-bold", 
                          parseFloat(item.valor) >= 99 ? "text-emerald-600" : 
                          parseFloat(item.valor) >= 95 ? "text-amber-600" : "text-red-600"
                        )}>
                          {typeof item.valor === 'string' ? item.valor : item.valor}%
                        </span>
                      </div>
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all",
                          parseFloat(item.valor) >= 99 ? "bg-emerald-500" : 
                          parseFloat(item.valor) >= 95 ? "bg-amber-500" : "bg-red-500"
                        )} style={{ width: `${item.valor}%` }} />
                      </div>
                      <Badge variant="outline" className={cn(
                        item.estado === "Disponible" && "bg-emerald-50 text-emerald-600 border-emerald-200",
                        item.estado === "Atención" && "bg-amber-50 text-amber-600 border-amber-200",
                        item.estado === "Crítico" && "bg-red-50 text-red-600 border-red-200"
                      )}>
                        {item.estado}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showIncidentesModal} onOpenChange={setShowIncidentesModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Incidentes Abiertos
              <Badge variant="secondary" className="ml-2">
                {detalleIncidentes.reduce((sum, d) => sum + d.valor, 0)}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Detalle de incidentes abiertos por tipo y servicio</p>
            {detalleIncidentes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <p>No hay incidentes abiertos</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {detalleIncidentes.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.nombre}</p>
                      <p className="text-xs text-muted-foreground">Servicio: {item.servicio}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      <span className="text-sm font-bold text-amber-600">{item.valor}</span>
                      <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                        {item.estado}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAlertasModal} onOpenChange={setShowAlertasModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Alertas Críticas
              <Badge variant="secondary" className="ml-2">
                {detalleAlertas.reduce((sum, d) => sum + d.valor, 0)}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {detalleAlertas.length === 0 
                ? "✅ No hay alertas críticas. Todos los servicios funcionan correctamente." 
                : "Alertas críticas por tipo"}
            </p>
            {detalleAlertas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-lg font-medium text-emerald-600">Todo funcionando correctamente</p>
                <p className="text-sm">No hay errores de infraestructura reportados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {detalleAlertas.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/30 hover:bg-red-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate text-red-700">{item.nombre}</p>
                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-[10px]">
                          {item.estado}
                        </Badge>
                      </div>
                      <p className="text-xs text-red-600">Servicio: {item.servicio}</p>
                      <p className="text-[10px] text-red-500 mt-0.5">{item.descripcion}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      <span className="text-xl font-bold text-red-600">{item.valor}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCambiosModal} onOpenChange={setShowCambiosModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Cambios Exitosos
              <Badge variant="secondary" className="ml-2">
                {detalleCambios.length > 0 ? Math.round(detalleCambios.reduce((sum, d) => sum + d.porcentaje, 0) / detalleCambios.length) : 0}%
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Detalle de cambios exitosos por servicio</p>
            {detalleCambios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay datos disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {detalleCambios.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.valor} de {item.total}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      <div className="w-12 text-right">
                        <span className="text-sm font-bold text-emerald-600">
                          {item.porcentaje}%
                        </span>
                      </div>
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${item.porcentaje}%` }} />
                      </div>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                        {item.estado}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTicketsModal} onOpenChange={setShowTicketsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Ticket className="h-5 w-5 text-amber-500" />
              Tickets - Detalle por Día
              <Badge variant="secondary" className="ml-2">
                {realInvoiceData.filter(f => f.estado === "Pendiente" || f.estado === "Pendiente Espera").length} Pendientes
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Distribución de tickets por día</p>
            {ticketsPorDia.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay tickets registrados</p>
              </div>
            ) : (
              <div className="w-full h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ticketsPorDia} margin={{ bottom: 20 }}>
                    <XAxis dataKey="fecha" fontSize={10} interval={0} angle={-45} textAnchor="end" height={50} />
                    <YAxis fontSize={10} />
                    <Tooltip 
                      contentStyle={{ fontSize: '11px', padding: '8px 12px' }}
                    />
                    <Legend fontSize={10} />
                    <Bar dataKey="ingresados" stackId="a" fill="#3b82f6" name="Ingresados" />
                    <Bar dataKey="asignados" stackId="a" fill="#f59e0b" name="Asignados" />
                    <Bar dataKey="resueltos" stackId="a" fill="#10b981" name="Resueltos" />
                    <Bar dataKey="cerrados" stackId="a" fill="#ef4444" name="Cerrados" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          MODALES - Panel 3 (PRÓXIMAMENTE - Opcionales)
          ============================================================ */}
      <Dialog open={showProyectosModal} onOpenChange={setShowProyectosModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FolderKanban className="h-5 w-5 text-purple-500" />
              Proyectos Activos (Próximamente)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-center py-12 text-muted-foreground">
              <FolderKanban className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600">Módulo en desarrollo</p>
              <p className="text-sm text-slate-500">Próximamente disponible</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEntregasModal} onOpenChange={setShowEntregasModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ListChecks className="h-5 w-5 text-emerald-500" />
              Entregas a Tiempo (Próximamente)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-center py-12 text-muted-foreground">
              <ListChecks className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600">Módulo en desarrollo</p>
              <p className="text-sm text-slate-500">Próximamente disponible</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTareasModal} onOpenChange={setShowTareasModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Timer className="h-5 w-5 text-amber-500" />
              Tareas Pendientes (Próximamente)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-center py-12 text-muted-foreground">
              <Timer className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600">Módulo en desarrollo</p>
              <p className="text-sm text-slate-500">Próximamente disponible</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBugsModal} onOpenChange={setShowBugsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Bug className="h-5 w-5 text-red-500" />
              Bugs Abiertos (Próximamente)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-center py-12 text-muted-foreground">
              <Bug className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600">Módulo en desarrollo</p>
              <p className="text-sm text-slate-500">Próximamente disponible</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          MODAL - Exportación
          ============================================================ */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Seleccionar Campos para Exportar
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleToggleAllFields}
                  id="select-all"
                />
                <Label htmlFor="select-all" className="font-semibold">
                  Seleccionar todos
                </Label>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedFields.length} de {EXPORT_FIELDS.length} campos seleccionados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {EXPORT_FIELDS.map((field) => (
                <div key={field.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={selectedFields.includes(field.id)}
                    onCheckedChange={() => handleToggleField(field.id)}
                    id={`field-${field.id}`}
                  />
                  <Label htmlFor={`field-${field.id}`} className="text-sm cursor-pointer">
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>

            {selectedFields.length === 0 && (
              <div className="text-center text-sm text-red-500 p-2 bg-red-50 rounded-lg">
                ⚠️ Debes seleccionar al menos un campo para exportar.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleExportToExcel} 
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={selectedFields.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar {selectedFields.length} campos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}