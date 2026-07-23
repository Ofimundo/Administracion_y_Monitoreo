"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/header";
import { StatusIndicator } from "@/components/status-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import dynamic from "next/dynamic";

const PickingDashboardCharts = dynamic(
  () => import("@/components/picking-dashboard-charts").then((mod) => mod.PickingDashboardCharts),
  { ssr: false }
);
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
import { services, type Client, type LogEntry } from "@/lib/services-data";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  FileText,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Filter,
  Search,
  X,
  Calendar as CalendarIcon,
  Loader2,
  LayoutDashboard,
  Activity,
  Eye,
  AlertCircle,
  ChevronDown,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { ClientDashboard } from "@/components/client-dashboard";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ContratosDashboardView } from "@/components/contratos-dashboard-view";
import { EquiposDashboardView } from "@/components/equipos-dashboard-view";
import { DespachosDashboardView } from "@/components/despachos-dashboard-view";
import { FileSpreadsheet, Download, Package, Ticket as TicketIcon } from "lucide-react";
import * as XLSX from "xlsx";

const EXPORT_FIELDS_MI_CUENTA = [
  { id: "folio", label: "N° Solicitud", default: true },
  { id: "fecha", label: "Fecha y Hora Solicitud", default: true },
  { id: "tipoSolicitud", label: "Tipo de Solicitud", default: true },
  { id: "cliente", label: "RUT / Código Cliente", default: true },
  { id: "contacto", label: "Nombre Cliente / Contacto", default: true },
  { id: "contrato", label: "N° Contrato", default: true },
  { id: "serie", label: "N° Serie Equipo / Suministro", default: true },
  { id: "direccion", label: "Dirección", default: false },
  { id: "comuna", label: "Comuna", default: false },
  { id: "referencia", label: "Referencia Ubicación", default: false },
  { id: "telefono", label: "Teléfono Contacto", default: false },
  { id: "email", label: "Email Contacto", default: false },
  { id: "exportDate", label: "Fecha de Exportación", default: true },
];

// Lista de servicios que están próximamente
const COMING_SOON_SERVICES = ["saldos", "finiquitos", "cuentas", "contabilizacion", "notas-credito"];

// Función para verificar si un servicio está próximo
const isServiceComingSoon = (serviceId: string): boolean => {
  return COMING_SOON_SERVICES.includes(serviceId);
};

// ✅ SOLO ERRORES DE INFRAESTRUCTURA REALES
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
  
  // Palabras relacionadas con OFICORE (son estados normales)
  "recibido",
  "asignado",
  "gestionando",
  "resuelto",
  "incompleto",
  "serv. técnico",
  "anulado",
  "re-abierto",
  
  // Palabras relacionadas con OFITEC (son estados normales)
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
  
  // Palabras generales
  "manual",
  "pendiente",
  "estado",
  "incidencia",
  "llamada",
  "sast"
];

const isInfraestructuraError = (motivo: string): boolean => {
  if (!motivo) return false;
  const motivoLower = motivo.toLowerCase();
  
  // ✅ PRIMERO: Verificar si es algo que NO es infraestructura
  for (const term of NO_INFRAESTRUCTURA) {
    if (motivoLower.includes(term)) {
      return false;
    }
  }
  
  // ✅ SEGUNDO: Verificar contra la lista de errores de infraestructura reales
  return ERRORES_INFRAESTRUCTURA.some(term => motivoLower.includes(term));
};

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDashboard, setShowClientDashboard] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceStatus, setServiceStatus] = useState<"success" | "warning" | "error">("success");
  const [serviceClients, setServiceClients] = useState<Client[]>([]);
  const [mounted, setMounted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  // Estadísticas basadas en datos reales
  const [statsData, setStatsData] = useState({
    uptime: "100%",
    lastActivity: "Cargando...",
    totalTransactions: 0,
    infrastructureErrors: 0,
    infrastructureErrorPercentage: 0,
    approvedCount: 0,
    rejectedCount: 0,
    manualCount: 0,
    pendingCount: 0,
    enProceso: 0,
    finalizado: 0,
    anulado: 0,
    incompleto: 0,
    reAbierto: 0,
    servTecnico: 0,
    cancelado: 0,
    sgcFacturas: 0,
    sgcGuias: 0,
    sgcNotasCredito: 0,
    sgcNotasDebito: 0,
    sgcOrigenSgc: 0,
    sgcOrigenSoftland: 0,
  });
  
  const [statsDateRange, setStatsDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => {
    const currentYear = new Date().getFullYear();
    return {
      from: new Date(currentYear, 0, 1),
      to: new Date(currentYear, 11, 31),
    };
  });
  const [showStatsDateFilter, setShowStatsDateFilter] = useState(false);
  const [hasStatsFilter, setHasStatsFilter] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<any[]>([]);
  const [liveClients, setLiveClients] = useState<Client[]>([]);
  const [dbMode, setDbMode] = useState<"simulation" | "real">("simulation");
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Estados para Monitoreo de Picking SGC
  const [pickingStats, setPickingStats] = useState<any>(null);
  const [pickingLoading, setPickingLoading] = useState(false);
  const [alertHours, setAlertHours] = useState(24);
  const [pickingError, setPickingError] = useState<string | null>(null);
  const [pickingPeriod, setPickingPeriod] = useState<"day" | "week" | "month">("day");
  const [sgcSubTab, setSgcSubTab] = useState<"docs" | "picking" | "contratos" | "equipos" | "despachos">("docs");
  const [isSgcMenuOpen, setIsSgcMenuOpen] = useState(false);

  // Estados para Monitoreo de Contratos SGC
  const [contratosStats, setContratosStats] = useState<any>(null);
  const [contratosLoading, setContratosLoading] = useState(false);
  const [contratosError, setContratosError] = useState<string | null>(null);

  // Estados para Monitoreo de Equipos en Parque SGC
  const [equiposStats, setEquiposStats] = useState<any>(null);
  const [equiposLoading, setEquiposLoading] = useState(false);
  const [equiposError, setEquiposError] = useState<string | null>(null);

  // Estados para Portal Mi Cuenta
  const [miCuentaPeticionesCliente, setMiCuentaPeticionesCliente] = useState<any[]>([]);
  const [showExportModalMiCuenta, setShowExportModalMiCuenta] = useState(false);
  const [selectedFieldsMiCuenta, setSelectedFieldsMiCuenta] = useState<string[]>(() =>
    EXPORT_FIELDS_MI_CUENTA.filter(f => f.default).map(f => f.id)
  );
  const [selectAllMiCuenta, setSelectAllMiCuenta] = useState(true);

  // Estados para Monitoreo de Despachos SGC
  const [despachosStats, setDespachosStats] = useState<any>(null);
  const [despachosLoading, setDespachosLoading] = useState(false);
  const [despachosError, setDespachosError] = useState<string | null>(null);

  const serviceStatic = services.find((s) => s.id === params.id);
  const comingSoon = serviceStatic ? isServiceComingSoon(serviceStatic.id) : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchLiveData = async (dateRange?: { from: Date | undefined; to: Date | undefined }) => {
    const serviceId = params.id as string;
    const activeServices = ["facturas", "oficore", "ofitec", "sgc", "dte", "mi-cuenta"];
    if (!activeServices.includes(serviceId)) return;
    
    try {
      setLoading(true);
      setPermissionError(null);
      setApiError(null);

      let queryParams = "";
      const targetRange = dateRange || statsDateRange;
      if (targetRange?.from) {
        const fromStr = format(targetRange.from, "yyyyMMdd");
        queryParams += `?fechaDesde=${fromStr}`;
        if (targetRange.to) {
          const toStr = format(targetRange.to, "yyyyMMdd");
          queryParams += `&fechaHasta=${toStr}`;
        }
      }

      // ============================================================
      // FACTURAS - CORREGIDO CON FUERZA A VERDE
      // ============================================================
      if (serviceId === "facturas") {
        const res = await fetch(`/api/facturas/bitacora?estado=todos${queryParams ? '&' + queryParams.slice(1) : ''}`);
        const data = await res.json();
        if (data.success && data.data && Array.isArray(data.data)) {
          setRawData(data.data);
          setDbMode("real");
          
          const totalDocs = data.data.length;
          const aprobadas = data.data.filter((f: any) => f.estado === "Aprobado").length;
          const rechazadas = data.data.filter((f: any) => f.estado === "Rechazado").length;
          const manuales = data.data.filter((f: any) => f.estado === "Manual").length;
          const pendientes = data.data.filter((f: any) => f.estado === "Pendiente" || f.estado === "Pendiente Espera").length;
          
          // ✅ Calcular errores de infraestructura REALES
          const erroresInfra = data.data.filter((f: any) => isInfraestructuraError(f.motivo)).length;
          const errorPercentage = totalDocs > 0 ? Math.round((erroresInfra / totalDocs) * 100) : 0;
          
          // ✅ FORZAR: Si no hay errores reales de infraestructura, el estado es "success" (verde)
          let status: "success" | "warning" | "error" = "success";
          
          // ✅ Solo si hay errores REALES de infraestructura y son significativos
          if (erroresInfra > 0 && errorPercentage > 5) {
            if (errorPercentage > 40) {
              status = "error";
            } else {
              status = "warning";
            }
          }
          // ✅ Si no hay errores o son menores al 5%, se mantiene en "success" (verde)
          
          setServiceStatus(status);
          
          setStatsData({
            uptime: status === "error" ? "0%" : "100%",
            lastActivity: totalDocs > 0 ? format(new Date(data.data[0]?.fecha_proceso || new Date()), "dd/MM/yyyy HH:mm") : "No hay datos",
            totalTransactions: totalDocs,
            infrastructureErrors: erroresInfra,
            infrastructureErrorPercentage: errorPercentage,
            approvedCount: aprobadas,
            rejectedCount: rechazadas,
            manualCount: manuales,
            pendingCount: pendientes,
            enProceso: 0,
            finalizado: 0,
            anulado: 0,
            incompleto: 0,
            reAbierto: 0,
            servTecnico: 0,
            cancelado: 0,
            sgcFacturas: 0,
            sgcGuias: 0,
            sgcNotasCredito: 0,
            sgcNotasDebito: 0,
            sgcOrigenSgc: 0,
            sgcOrigenSoftland: 0,
          });
          
          const singleClient: Client = {
            id: "cl_ofimundo",
            name: "Ofimundo S.A. (Softland ERP)",
            rut: "76.452.910-K",
            email: "rpa-invoice@ofimundo.cl",
            phone: "+56 2 2840 9300",
            errorPercentage: errorPercentage,
            status: status as any,
          };
          setLiveClients([singleClient]);
          setHasStatsFilter(false);
        } else {
          setRawData([]);
          setLiveClients([]);
          setApiError("No se encontraron datos de facturas");
          setServiceStatus("error");
        }
      } 
      // ============================================================
      // OFICORE
      // ============================================================
      else if (serviceId === "oficore") {
        const res = await fetch(`/api/oficore/stats${queryParams}`);
        const data = await res.json();
        if (data.success) {
          const docs = data.detalles || [];
          setRawData(docs);
          setDbMode(data.mode || "real");
          
          const totalDocs = docs.length;
          const resueltas = docs.filter((d: any) => d.id_accion === 5).length;
          const noResueltas = totalDocs - resueltas;
          
          // ✅ Verificar si hay errores reales de infraestructura
          const hasRealError = docs.some((d: any) => {
            const motivo = d.detalle_motivo || d.motivo || d.observacion || "";
            return isInfraestructuraError(motivo);
          });
          
          // ✅ FORZAR: Si no hay errores reales, el estado es "success"
          const status: "success" | "warning" | "error" = hasRealError ? "warning" : "success";
          
          setServiceStatus(status);
          setStatsData({
            uptime: (status as string) === "error" ? "0%" : "100%",
            lastActivity: totalDocs > 0 ? format(new Date(docs[0]?.fecha_detalle || new Date()), "dd/MM/yyyy HH:mm") : "No hay datos",
            totalTransactions: totalDocs,
            infrastructureErrors: 0,
            infrastructureErrorPercentage: 0,
            approvedCount: resueltas,
            rejectedCount: noResueltas,
            manualCount: 0,
            pendingCount: 0,
            enProceso: 0,
            finalizado: 0,
            anulado: 0,
            incompleto: 0,
            reAbierto: 0,
            servTecnico: 0,
            cancelado: 0,
            sgcFacturas: 0,
            sgcGuias: 0,
            sgcNotasCredito: 0,
            sgcNotasDebito: 0,
            sgcOrigenSgc: 0,
            sgcOrigenSoftland: 0,
          });

          const singleClient: Client = {
            id: "cl_oficore",
            name: "Ofimundo S.A. (OFICORE)",
            rut: "76.452.910-K",
            email: "oficore-support@ofimundo.cl",
            phone: "+56 2 2840 9300",
            errorPercentage: 0,
            status: status as any,
          };
          setLiveClients([singleClient]);
          setHasStatsFilter(dateRange?.from !== undefined || dateRange?.to !== undefined);
        } else {
          setApiError(data.message || "Error al obtener datos de OFICORE");
          setServiceStatus("error");
        }
      }
      // ============================================================
      // OFITEC
      // ============================================================
      else if (serviceId === "ofitec") {
        try {
          const res = await fetch(`/api/ofitec/stats${queryParams}`);
          const data = await res.json();
          
          if (data.success && data.detalles && Array.isArray(data.detalles) && data.detalles.length > 0) {
            const docs = data.detalles || [];
            setRawData(docs);
            setDbMode(data.mode || "real");
            
            const totalDocs = docs.length;
            const resolvedStatuses = ['4', '24', '6', '8', '9', '15', '16', '7'];
            const ingresadas = docs.filter((c: any) => c.LLA_CORRELATIVO === "1" || c.LLA_CORRELATIVO === 1).length;
            const resueltas = docs.filter((c: any) => {
              const est = c.LLA_ESTADO?.toString().trim();
              return resolvedStatuses.includes(est);
            }).length;
            const pendientes = Math.max(0, ingresadas - resueltas);
            
            // ✅ Verificar si hay errores reales de infraestructura
            const hasRealError = docs.some((c: any) => {
              const motivo = c.LLA_OBSERVACION || c.motivo || "";
              return isInfraestructuraError(motivo);
            });
            
            // ✅ FORZAR: Si no hay errores reales, el estado es "success"
            const status: "success" | "warning" | "error" = hasRealError ? "warning" : "success";
            
            setServiceStatus(status);
            
            const enProceso = docs.filter((c: any) => {
              const est = c.LLA_ESTADO?.toString().trim();
              return ['1', '2', '17', '20', '5', '30'].includes(est);
            }).length;
            const finalizado = docs.filter((c: any) => {
              const est = c.LLA_ESTADO?.toString().trim();
              return ['4', '24'].includes(est);
            }).length;
            const anulado = docs.filter((c: any) => {
              const est = c.LLA_ESTADO?.toString().trim();
              return ['8', '9'].includes(est);
            }).length;
            const incompleto = docs.filter((c: any) => {
              const est = c.LLA_ESTADO?.toString().trim();
              return ['3', '10', '22', '33'].includes(est);
            }).length;
            const cancelado = docs.filter((c: any) => {
              const est = c.LLA_ESTADO?.toString().trim();
              return ['11', '12'].includes(est);
            }).length;

            setStatsData({
              uptime: (status as string) === "error" ? "0%" : "100%",
              lastActivity: totalDocs > 0 ? format(new Date(docs[0]?.LLA_FEC_LLAMADA || new Date()), "dd/MM/yyyy HH:mm") : "No hay datos",
              totalTransactions: ingresadas,
              infrastructureErrors: 0,
              infrastructureErrorPercentage: 0,
              approvedCount: resueltas,
              rejectedCount: pendientes,
              manualCount: 0,
              pendingCount: 0,
              enProceso,
              finalizado,
              anulado,
              incompleto,
              reAbierto: 0,
              servTecnico: 0,
              cancelado,
              sgcFacturas: 0,
              sgcGuias: 0,
              sgcNotasCredito: 0,
              sgcNotasDebito: 0,
              sgcOrigenSgc: 0,
              sgcOrigenSoftland: 0,
            });

            const singleClient: Client = {
              id: "cl_ofitec",
              name: "Ofimundo S.A. (OFITEC)",
              rut: "76.452.910-K",
              email: "ofitec-support@ofimundo.cl",
              phone: "+56 2 2840 9300",
              errorPercentage: 0,
              status: status as any,
            };
            setLiveClients([singleClient]);
            setApiError(null);
            setHasStatsFilter(dateRange?.from !== undefined || dateRange?.to !== undefined);
          } else {
            setRawData([]);
            setDbMode("real");
            setLiveClients([]);
            setServiceStatus("error");
            setApiError(data.message || "⚠️ No se encontraron registros en la base de datos OFITEC");
          }
        } catch (e) {
          console.error("Error fetching OFITEC data:", e);
          setRawData([]);
          setLiveClients([]);
          setServiceStatus("error");
          setApiError("❌ Error al conectar con la base de datos OFITEC");
        }
      }
      // ============================================================
      // SGC
      // ============================================================
      else if (serviceId === "sgc") {
        try {
          setPickingLoading(true);
          setPickingError(null);
          setContratosLoading(true);
          setContratosError(null);
          setEquiposLoading(true);
          setEquiposError(null);
          setDespachosLoading(true);
          setDespachosError(null);
          
          const connector = queryParams ? "&" : "?";
          const [res, pickingRes, contratosRes, equiposRes, despachosRes] = await Promise.all([
            fetch(`/api/sgc/stats${queryParams}`),
            fetch(`/api/sgc/picking-stats${queryParams}${connector}hours=${alertHours}`),
            fetch(`/api/sgc/contratos-stats${queryParams}`),
            fetch(`/api/sgc/equipos-stats${queryParams}`),
            fetch(`/api/sgc/despachos-stats${queryParams}`)
          ]);
          
          const data = await res.json();
          const pData = await pickingRes.json();
          const cData = await contratosRes.json();
          const eqData = await equiposRes.json();
          const dData = await despachosRes.json();
          
          setPickingLoading(false);
          if (pData.success) {
            setPickingStats(pData);
          } else {
            setPickingError(pData.message || "⚠️ Error al obtener estadísticas de picking");
          }

          setContratosLoading(false);
          if (cData.success) {
            setContratosStats(cData);
          } else {
            setContratosError(cData.message || "⚠️ Error al obtener estadísticas de contratos");
          }

          setEquiposLoading(false);
          if (eqData.success) {
            setEquiposStats(eqData);
          } else {
            setEquiposError(eqData.message || "⚠️ Error al obtener estadísticas de equipos en parque");
          }

          setDespachosLoading(false);
          if (dData.success) {
            setDespachosStats(dData);
          } else {
            setDespachosError(dData.message || "⚠️ Error al obtener estadísticas de despachos");
          }
          
          if (res.status === 403 || !data.success) {
            if (data.isPermissionError) {
              setPermissionError(data.message);
              setServiceStatus("error");
              setApiError(null);
            } else {
              setServiceStatus("error");
              setApiError(data.message || "⚠️ Error al obtener datos de SGC");
            }
          } else {
            const docs = data.data || [];
            if (docs.length > 0) {
              setRawData(docs);
              setDbMode(data.mode || "real");
              
              const totalDocs = docs.length;
              const sgcFacturas = docs.filter((e: any) => e.tipo_de_documento?.toString().trim().toUpperCase() === "FACTURA").length;
              const sgcGuias = docs.filter((e: any) => e.tipo_de_documento?.toString().trim().toUpperCase() === "GUIA").length;
              const sgcNotasCredito = docs.filter((e: any) => e.tipo_de_documento?.toString().trim().toUpperCase() === "NOTA DE CREDITO").length;
              const sgcNotasDebito = docs.filter((e: any) => e.tipo_de_documento?.toString().trim().toUpperCase() === "NOTA DE DEBITO").length;
              const procesados = docs.filter((e: any) => e.tipo_de_venta?.toLowerCase() === "picking" || e.tipo_de_venta?.toLowerCase() === "od").length;
              
              // ✅ Verificar si hay errores reales de infraestructura
              const hasRealError = docs.some((e: any) => {
                const motivo = e.observacion || e.motivo || "";
                return isInfraestructuraError(motivo);
              });
              
              // ✅ FORZAR: Si no hay errores reales, el estado es "success"
              const status: "success" | "warning" | "error" = hasRealError ? "warning" : "success";
              
              setServiceStatus(status);
              setStatsData({
                uptime: (status as string) === "error" ? "0%" : "100%",
                lastActivity: totalDocs > 0 ? format(new Date(docs[0]?.fecha_documento || new Date()), "dd/MM/yyyy HH:mm") : "No hay datos",
                totalTransactions: totalDocs,
                infrastructureErrors: 0,
                infrastructureErrorPercentage: 0,
                approvedCount: 0,
                rejectedCount: 0,
                manualCount: 0,
                pendingCount: 0,
                enProceso: 0,
                finalizado: 0,
                anulado: 0,
                incompleto: 0,
                reAbierto: 0,
                servTecnico: 0,
                cancelado: 0,
                sgcFacturas,
                sgcGuias,
                sgcNotasCredito,
                sgcNotasDebito,
                sgcOrigenSgc: docs.filter((e: any) => e.SISTEMA_ORIGEN?.toString().trim().toUpperCase() === "SGC").length,
                sgcOrigenSoftland: docs.filter((e: any) => e.SISTEMA_ORIGEN?.toString().trim().toUpperCase() === "SOFTLAND").length,
              });
              setApiError(null);
            } else {
              setRawData([]);
              setDbMode("real");
              setApiError("⚠️ No se encontraron registros en la base de datos SGC");
              setServiceStatus("warning");
            }

            const singleClient: Client = {
              id: "cl_sgc",
              name: "Ofimundo S.A. (SGC)",
              rut: "76.452.910-K",
              email: "sgc-support@ofimundo.cl",
              phone: "+56 2 2840 9300",
              errorPercentage: 0,
              status: "success",
            };
            setLiveClients([singleClient]);
            setHasStatsFilter(dateRange?.from !== undefined || dateRange?.to !== undefined);
          }
        } catch (e) {
          setPickingLoading(false);
          setContratosLoading(false);
          setEquiposLoading(false);
          setDespachosLoading(false);
          console.error("Error fetching SGC data:", e);
          setRawData([]);
          setLiveClients([]);
          setServiceStatus("error");
          setApiError("❌ Error al conectar con la base de datos SGC");
        }
      }
      // ============================================================
      // DTE
      // ============================================================
      else if (serviceId === "dte") {
        try {
          const res = await fetch(`/api/dte/stats${queryParams}`);
          const data = await res.json();
          
          if (data.success && data.data && Array.isArray(data.data)) {
            const docs = data.data || [];
            setRawData(docs);
            setDbMode(data.mode || "real");
            
            const totalDocs = docs.length;
            const exitosos = docs.filter((d: any) => d.Estado === "EXITOSO").length;
            const fallidos = totalDocs - exitosos;
            const latestDoc = docs[0];
            
            const errorPercentage = totalDocs > 0 ? Math.round((fallidos / totalDocs) * 100) : 0;
            
            // Status is error if the latest run failed, warning if errorPercentage > 20%, success otherwise
            let status: "success" | "warning" | "error" = "success";
            if (latestDoc) {
              if (latestDoc.Estado !== "EXITOSO") {
                status = "error";
              } else if (errorPercentage > 20) {
                status = "warning";
              }
            }
            
            setServiceStatus(status);
            
            // Calculate average duration in seconds
            let totalDuration = 0;
            let validDurationsCount = 0;
            docs.forEach((d: any) => {
              if (d.fecha_inicio_ejecucion && d.fecha_fin_ejecucion) {
                const duration = (new Date(d.fecha_fin_ejecucion).getTime() - new Date(d.fecha_inicio_ejecucion).getTime()) / 1000;
                if (duration >= 0) {
                  totalDuration += duration;
                  validDurationsCount++;
                }
              }
            });
            const avgDuration = validDurationsCount > 0 ? Math.round(totalDuration / validDurationsCount) : 0;
            
            setStatsData({
              uptime: status === "error" ? "0%" : "100%",
              lastActivity: latestDoc ? format(new Date(latestDoc.fecha_inicio_ejecucion), "dd/MM/yyyy HH:mm") : "No hay datos",
              totalTransactions: totalDocs,
              infrastructureErrors: fallidos,
              infrastructureErrorPercentage: errorPercentage,
              approvedCount: exitosos,
              rejectedCount: fallidos,
              manualCount: 0,
              pendingCount: 0,
              enProceso: avgDuration, // We'll use enProceso to store average duration in seconds
              finalizado: exitosos,
              anulado: 0,
              incompleto: 0,
              reAbierto: 0,
              servTecnico: 0,
              cancelado: 0,
              sgcFacturas: 0,
              sgcGuias: 0,
              sgcNotasCredito: 0,
              sgcNotasDebito: 0,
              sgcOrigenSgc: 0,
              sgcOrigenSoftland: 0,
            });
            
            const singleClient: Client = {
              id: "cl_ofimundo",
              name: "Ofimundo S.A. (DTE)",
              rut: "76.452.910-K",
              email: "dte-support@ofimundo.cl",
              phone: "+56 2 2840 9300",
              errorPercentage: errorPercentage,
              status: status as any,
            };
            setLiveClients([singleClient]);
            setApiError(null);
            setHasStatsFilter(dateRange?.from !== undefined || dateRange?.to !== undefined);
          } else {
            setRawData([]);
            setLiveClients([]);
            setServiceStatus("error");
            setApiError(data.message || "⚠️ No se encontraron registros en la base de datos DTE");
          }
        } catch (e) {
          console.error("Error fetching DTE data:", e);
          setRawData([]);
          setLiveClients([]);
          setServiceStatus("error");
          setApiError("❌ Error al conectar con la base de datos DTE");
        }
      }
      // ============================================================
      // PORTAL MI CUENTA ([THE_COOLER_MI_CUENTA].[dbo].[SOLICITUDES])
      // ============================================================
      else if (serviceId === "mi-cuenta") {
        try {
          const res = await fetch(`/api/mi-cuenta/stats${queryParams}`);
          const data = await res.json();

          if (data.success && data.detalles) {
            const docs = data.detalles || [];
            setRawData(docs);
            setDbMode(data.mode || "real");
            setMiCuentaPeticionesCliente(data.peticionesPorCliente || []);

            const totalDocs = docs.length;
            const suministrosCount = data.stats?.suministrosSolicitados || docs.filter((s: any) => s.CDG_TIPO_SOLICITUD === 1 || s.NMR_SERIE).length;

            setServiceStatus("success");
            setStatsData({
              uptime: "100%",
              lastActivity: data.stats?.lastActivity || (totalDocs > 0 ? format(new Date(docs[0]?.FCH_SOLICITUD || new Date()), "dd/MM/yyyy HH:mm") : "No hay datos"),
              totalTransactions: totalDocs,
              infrastructureErrors: 0,
              infrastructureErrorPercentage: 0,
              approvedCount: suministrosCount,
              rejectedCount: 0,
              manualCount: 0,
              pendingCount: 0,
              enProceso: 0,
              finalizado: 0,
              anulado: 0,
              incompleto: 0,
              reAbierto: 0,
              servTecnico: 0,
              cancelado: 0,
              sgcFacturas: 0,
              sgcGuias: 0,
              sgcNotasCredito: 0,
              sgcNotasDebito: 0,
              sgcOrigenSgc: 0,
              sgcOrigenSoftland: 0,
            });

            const singleClient: Client = {
              id: "cl_mi_cuenta",
              name: "Ofimundo S.A. (Portal Mi Cuenta)",
              rut: "76.452.910-K",
              email: "micuenta@ofimundo.cl",
              phone: "+56 2 2840 9300",
              errorPercentage: 0,
              status: "success",
            };
            setLiveClients([singleClient]);
            setApiError(null);
            setHasStatsFilter(dateRange?.from !== undefined || dateRange?.to !== undefined);
          } else {
            setRawData([]);
            setLiveClients([]);
            setServiceStatus("error");
            setApiError(data.message || "❌ ALERTA DE CONEXIÓN: No fue posible conectar a la base de datos [THE_COOLER_MI_CUENTA] o al servidor SQL Server.");
          }
        } catch (e: any) {
          console.error("Error fetching Portal Mi Cuenta data:", e);
          setRawData([]);
          setLiveClients([]);
          setServiceStatus("error");
          setApiError("❌ ALERTA DE CONEXIÓN: No fue posible conectar con el servidor de base de datos SQL Server [THE_COOLER_MI_CUENTA].");
        }
      }
    } catch (e: any) {
      console.error("Error fetching live service data:", e);
      toast({
        title: "Error",
        description: e.message || "No se pudieron cargar los datos del servicio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const applyStatsDateFilter = () => {
    fetchLiveData(statsDateRange);
    setShowStatsDateFilter(false);
    toast({
      title: "Filtrando datos...",
      description: `Consultando${statsDateRange.from ? ` desde ${format(statsDateRange.from, "dd/MM/yyyy")}` : ""}${statsDateRange.to ? ` hasta ${format(statsDateRange.to, "dd/MM/yyyy")}` : ""}`,
    });
  };

  const resetStatsDateFilter = () => {
    const currentYear = new Date().getFullYear();
    const defaultRange = {
      from: new Date(currentYear, 0, 1),
      to: new Date(currentYear, 11, 31)
    };
    setStatsDateRange(defaultRange);
    fetchLiveData(defaultRange);
    setHasStatsFilter(false);
    toast({
      title: "Filtro limpiado",
      description: "Consulta restaurada al rango por defecto",
    });
  };

  useEffect(() => {
    const activeServices = ["facturas", "oficore", "ofitec", "sgc", "dte", "mi-cuenta"];
    if (serviceStatic && !comingSoon) {
      setServiceName(serviceStatic.name);
      setServiceDescription(serviceStatic.description);
      setServiceClients(serviceStatic.clients);
      
      if (activeServices.includes(serviceStatic.id)) {
        const currentYear = new Date().getFullYear();
        const defaultRange = {
          from: new Date(currentYear, 0, 1),
          to: new Date(currentYear, 11, 31)
        };
        setStatsDateRange(defaultRange);
        fetchLiveData(defaultRange);
      }
    }
  }, [params.id, serviceStatic, comingSoon]);

  const handleOpenClientDashboard = (client: Client) => {
    setSelectedClient(client);
    setShowClientDashboard(true);
  };

  const displayClients = params.id === "facturas" ? liveClients : serviceClients;

  // Mostrar pantalla de "Próximamente" para servicios en desarrollo
  if (comingSoon && params.id !== "facturas") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => router.push("/")} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la lista de servicios
          </Button>
          
          <Card className="text-center py-16">
            <CardContent className="pt-8">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-12 w-12 text-amber-500" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-3">
                {serviceStatic?.name || "Servicio"}
              </h1>
              <p className="text-muted-foreground text-lg mb-6">
                Este servicio se encuentra actualmente en desarrollo
              </p>
              <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
                <p className="text-amber-700 text-sm">
                  🚀 Próximamente estará disponible el monitoreo completo de este servicio.
                  Te invitamos a revisar más adelante para acceder a todas las métricas y estadísticas.
                </p>
              </div>
              <Button onClick={() => router.push("/")} className="bg-emerald-600 hover:bg-emerald-700">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Volver al Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
        <footer className="border-t border-border mt-8 py-4">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm text-muted-foreground">
                Sistema de Administración y Monitoreo de Servicios &copy; 2026
              </span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (!serviceStatic && params.id !== "facturas") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Servicio no encontrado</h1>
            <Button onClick={() => router.push("/")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const displayName = params.id === "facturas" ? "Aceptación y Rechazo de Facturas" : serviceName;
  const displayDescription = params.id === "facturas" 
    ? "El proyecto tiene como objetivo automatizar el flujo de aceptación y rechazo de facturas electrónicas registradas en el sistema, permitiendo una gestión eficiente y reduciendo la intervención manual."
    : serviceDescription;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a la lista de servicios
            </Button>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
              <StatusIndicator status="success" percentage={0} size="lg" />
            </div>
          </div>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        </main>
      </div>
    );
  }

  const isOfitec = params.id === "ofitec";
  const isOficore = params.id === "oficore";
  const isSgcService = params.id === "sgc";
  const isMiCuenta = params.id === "mi-cuenta";
  const isTicketService = isOficore || isOfitec;

  const getDisplayStatus = () => {
    // ✅ FORZAR: Para facturas, siempre mostrar "success" si no hay errores reales de infraestructura
    if (params.id === "facturas") {
      const erroresInfra = rawData.filter((f: any) => isInfraestructuraError(f.motivo)).length;
      const totalDocs = rawData.length;
      const errorPercentage = totalDocs > 0 ? Math.round((erroresInfra / totalDocs) * 100) : 0;
      
      // ✅ Si no hay errores reales o son menores al 5%, mostrar verde
      if (erroresInfra === 0 || errorPercentage <= 5) {
        return "success";
      }
      return serviceStatus;
    }
    return serviceStatus;
  };

  const getDisplayPercentage = () => {
    if (params.id === "facturas") {
      const erroresInfra = rawData.filter((f: any) => isInfraestructuraError(f.motivo)).length;
      const totalDocs = rawData.length;
      return totalDocs > 0 ? Math.round((erroresInfra / totalDocs) * 100) : 0;
    }
    return 0;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          {/* ✅ Logo de Ofilab en la esquina superior izquierda */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a la lista de servicios
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
            <StatusIndicator 
              status={getDisplayStatus()} 
              percentage={getDisplayPercentage()} 
              size="lg" 
            />
          </div>
          {apiError && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 px-4">
              ⚠️ {apiError}
            </div>
          )}
          {permissionError && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 px-4">
              ⚠️ {permissionError}
            </div>
          )}
        </div>

        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Estadísticas
            </TabsTrigger>
            <TabsTrigger value="description" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Descripción
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes ({displayClients.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB - ESTADÍSTICAS */}
          <TabsContent value="stats">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                      <Activity className="h-5 w-5 text-emerald-500" />
                      {isTicketService 
                        ? "Estadísticas de Tickets" 
                        : isSgcService 
                          ? (sgcSubTab === "docs" 
                            ? "Estadísticas de Documentos SGC" 
                            : sgcSubTab === "picking" 
                              ? "Monitoreo de Picking SGC" 
                              : sgcSubTab === "contratos" 
                                ? "Monitoreo de Contratos SGC" 
                                : sgcSubTab === "equipos"
                                  ? "Monitoreo de Equipos en Parque SGC"
                                  : sgcSubTab === "despachos"
                                    ? "Monitoreo de Despachos SGC"
                                    : "Dashboard de Órdenes de Retiro SGC") 
                          : "Estadísticas de Documentos"}
                    </CardTitle>
                    {isSgcService && (
                      <div className="relative">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsSgcMenuOpen(!isSgcMenuOpen)}
                          className="flex items-center gap-2 h-8 text-xs font-semibold px-3 border border-emerald-500/20 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 rounded-lg shadow-sm transition-all focus:ring-1 focus:ring-emerald-500/30"
                        >
                          <Activity className="h-3.5 w-3.5 text-emerald-600" />
                          <span>
                            {sgcSubTab === "docs" && "Documentos"}
                            {sgcSubTab === "picking" && "Monitoreo de Picking"}
                            {sgcSubTab === "contratos" && "Contratos"}
                            {sgcSubTab === "equipos" && "Equipos en Parque"}
                            {sgcSubTab === "despachos" && "Despachos"}
                          </span>
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 text-emerald-600", isSgcMenuOpen && "transform rotate-180")} />
                        </Button>
                        
                        {isSgcMenuOpen && (
                          <>
                            {/* Backdrop to close dropdown on click outside */}
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setIsSgcMenuOpen(false)} 
                            />
                            
                            <div className="absolute right-0 sm:left-0 mt-1.5 w-56 rounded-xl shadow-lg bg-background border border-border/80 z-50 py-1.5 origin-top-left animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="px-3 py-1 mb-1 border-b border-border/50">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Vistas de Monitoreo
                                </span>
                              </div>
                              {[
                                { id: "docs", label: "Documentos", desc: "Estadísticas generales de venta" },
                                { id: "picking", label: "Monitoreo de Picking", desc: "Dashboard de picking en tiempo real" },
                                { id: "contratos", label: "Contratos", desc: "Monitoreo y estado de contratos" },
                                { id: "equipos", label: "Equipos en Parque", desc: "Ubicación y datos de equipos" },
                                { id: "despachos", label: "Despachos", desc: "Control y seguimiento de despachos" }
                              ].map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    setSgcSubTab(item.id as any);
                                    setIsSgcMenuOpen(false);
                                  }}
                                  className={cn(
                                    "w-full text-left px-3.5 py-2 text-xs transition-colors flex flex-col gap-0.5",
                                    sgcSubTab === item.id 
                                      ? "bg-emerald-50/70 text-emerald-800 font-medium" 
                                      : "text-foreground hover:bg-muted/65 hover:text-foreground"
                                  )}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <span className="font-semibold">{item.label}</span>
                                    {sgcSubTab === item.id && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                                  </div>
                                  <span className={cn(
                                    "text-[9.5px] leading-none",
                                    sgcSubTab === item.id ? "text-emerald-600/80" : "text-muted-foreground"
                                  )}>
                                    {item.desc}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasStatsFilter && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={resetStatsDateFilter}
                        className="gap-1 h-7 text-xs text-red-500 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                        Limpiar filtro
                      </Button>
                    )}
                    {isMiCuenta && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowExportModalMiCuenta(true)}
                        disabled={rawData.length === 0}
                        className="gap-1 h-7 text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 font-semibold"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                        Exportar Excel
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowStatsDateFilter(!showStatsDateFilter)}
                      className="gap-1 h-7 text-xs"
                    >
                      <Filter className="h-3 w-3" />
                      {hasStatsFilter ? "Filtro activo" : "Filtrar por fecha"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {showStatsDateFilter && (
                  <div className="p-3 bg-muted/30 rounded-lg space-y-3 mb-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium text-muted-foreground uppercase">Periodos Rápidos</Label>
                      <Select
                        onValueChange={(val) => {
                          const now = new Date();
                          if (val === "2025") {
                            setStatsDateRange({ from: new Date(2025, 0, 1), to: new Date(2025, 11, 31) });
                          } else if (val === "2026") {
                            setStatsDateRange({ from: new Date(2026, 0, 1), to: new Date(2026, 11, 31) });
                          } else if (val === "all") {
                            setStatsDateRange({ from: new Date(2025, 0, 1), to: new Date(2026, 11, 31) });
                          } else if (val === "last30") {
                            const from = new Date();
                            from.setDate(now.getDate() - 30);
                            setStatsDateRange({ from, to: now });
                          } else if (val === "last90") {
                            const from = new Date();
                            from.setDate(now.getDate() - 90);
                            setStatsDateRange({ from, to: now });
                          } else if (val === "ofitec-demo") {
                            setStatsDateRange({ from: new Date(2025, 3, 1), to: new Date(2025, 3, 30) });
                          } else if (val === "oficore-demo") {
                            setStatsDateRange({ from: new Date(2026, 4, 1), to: new Date(2026, 4, 30) });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="Seleccionar periodo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2025">Todo el Año 2025</SelectItem>
                          <SelectItem value="2026">Todo el Año 2026</SelectItem>
                          <SelectItem value="all">Rango Amplio (2025 - 2026)</SelectItem>
                          <SelectItem value="last30">Últimos 30 días</SelectItem>
                          <SelectItem value="last90">Últimos 90 días</SelectItem>
                          {params.id === "ofitec" && <SelectItem value="ofitec-demo">Abril 2025 (Demo OFITEC)</SelectItem>}
                          {params.id === "oficore" && <SelectItem value="oficore-demo">Mayo 2026 (Demo OFICORE)</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 justify-start text-left h-8 text-xs">
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {statsDateRange.from ? format(statsDateRange.from, "dd/MM/yyyy") : "Desde"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={statsDateRange.from || undefined}
                            onSelect={(date) => setStatsDateRange({ ...statsDateRange, from: date || undefined })}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 justify-start text-left h-8 text-xs">
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {statsDateRange.to ? format(statsDateRange.to, "dd/MM/yyyy") : "Hasta"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={statsDateRange.to || undefined}
                            onSelect={(date) => setStatsDateRange({ ...statsDateRange, to: date || undefined })}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setStatsDateRange({ from: undefined, to: undefined });
                          setShowStatsDateFilter(false);
                        }} 
                        className="h-7 text-xs"
                      >
                        <X className="mr-1 h-3 w-3" />
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={applyStatsDateFilter} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">
                        <Search className="mr-1 h-3 w-3" />
                        Aplicar
                      </Button>
                    </div>
                  </div>
                )}
                
                {isOfitec ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{statsData.totalTransactions.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">🎫 Tickets Ingresados</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{statsData.approvedCount.toLocaleString()}</p>
                      <p className="text-xs text-emerald-600">✅ Tickets Resueltos</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-red-500">{statsData.rejectedCount.toLocaleString()}</p>
                      <p className="text-xs text-red-500">⏳ Tickets Pendientes</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-blue-500">{statsData.enProceso.toLocaleString()}</p>
                      <p className="text-xs text-blue-500">🔄 En Proceso</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{statsData.finalizado.toLocaleString()}</p>
                      <p className="text-xs text-purple-600">✅ Finalizado</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-600">{statsData.anulado.toLocaleString()}</p>
                      <p className="text-xs text-gray-600">🚫 Anulado</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-orange-600">{statsData.incompleto.toLocaleString()}</p>
                      <p className="text-xs text-orange-600">⚠️ Incompleto</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
                      <p className="text-2xl font-bold text-red-600">{statsData.cancelado.toLocaleString()}</p>
                      <p className="text-xs text-red-600">❌ Cancelado</p>
                    </div>
                  </div>
                ) : isMiCuenta ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-emerald-50 rounded-lg p-4 text-center border border-emerald-200">
                      <p className="text-2xl font-bold text-emerald-700">{statsData.approvedCount.toLocaleString()}</p>
                      <p className="text-xs text-emerald-700 font-semibold mt-1">📦 Suministros Solicitados</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                      <p className="text-2xl font-bold text-blue-700">{statsData.totalTransactions.toLocaleString()}</p>
                      <p className="text-xs text-blue-700 font-semibold mt-1">🎫 Tickets Generados</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
                      <p className="text-2xl font-bold text-purple-700">{miCuentaPeticionesCliente.length}</p>
                      <p className="text-xs text-purple-700 font-semibold mt-1">👥 Clientes con Peticiones</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-200">
                      <p className="text-2xl font-bold text-slate-700">100%</p>
                      <p className="text-xs text-slate-600 font-semibold mt-1">⚡ Disponibilidad Portal</p>
                    </div>
                  </div>
                ) : isOficore ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{statsData.totalTransactions.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">🎫 Incidencias Ingresadas</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{statsData.approvedCount.toLocaleString()}</p>
                      <p className="text-xs text-emerald-600">✅ Incidencias Resueltas</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-amber-500">{statsData.rejectedCount.toLocaleString()}</p>
                      <p className="text-xs text-amber-500">⏳ Incidencias Pendientes</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
                      <p className="text-2xl font-bold text-red-600">{statsData.infrastructureErrors.toLocaleString()}</p>
                      <p className="text-xs text-red-600">❌ Errores</p>
                    </div>
                  </div>
                ) : isSgcService ? (
                  sgcSubTab === "docs" ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{statsData.totalTransactions.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">📄 Total Documentos</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{statsData.sgcFacturas.toLocaleString()}</p>
                        <p className="text-xs text-blue-600">🧾 Facturas</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-orange-600">{statsData.sgcGuias.toLocaleString()}</p>
                        <p className="text-xs text-orange-600">🚚 Guías</p>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-indigo-600">{statsData.sgcNotasCredito.toLocaleString()}</p>
                        <p className="text-xs text-indigo-600">💳 Notas de Crédito</p>
                      </div>
                      <div className="bg-rose-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-rose-600">{statsData.sgcNotasDebito.toLocaleString()}</p>
                        <p className="text-xs text-rose-600">📉 Notas de Débito</p>
                      </div>
                    </div>
                  ) : sgcSubTab === "picking" ? (
                    <div className="space-y-6">
                      {pickingLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
                          <p className="text-sm text-muted-foreground">Cargando estadísticas de picking en tiempo real...</p>
                        </div>
                      ) : pickingError ? (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
                          ⚠️ {pickingError}
                        </div>
                      ) : pickingStats ? (
                        <>
                          {/* 1. KPIs Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-muted/30 rounded-lg p-4 text-center border border-border/50">
                              <p className="text-2xl font-bold text-foreground">{(pickingStats.kpis?.vol_24h || 0).toLocaleString()}</p>
                              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-1">📦 Volumen (24h)</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                              <p className="text-2xl font-bold text-blue-600">{(pickingStats.kpis?.vol_semana || 0).toLocaleString()}</p>
                              <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider mt-1">🗓️ Volumen Semanal</p>
                            </div>
                            <div className="bg-indigo-50 rounded-lg p-4 text-center border border-indigo-100">
                              <p className="text-2xl font-bold text-indigo-600">{(pickingStats.kpis?.vol_mes || 0).toLocaleString()}</p>
                              <p className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider mt-1">📊 Volumen Mensual</p>
                            </div>
                          </div>

                          {/* 2. Picking Charts */}
                          <PickingDashboardCharts pickingStats={pickingStats} />
                        </>
                      ) : (
                        <div className="flex justify-center py-10 text-xs text-muted-foreground">
                          No hay estadísticas de picking disponibles.
                        </div>
                      )}
                    </div>
                  ) : sgcSubTab === "contratos" ? (
                    <ContratosDashboardView 
                      stats={contratosStats?.stats}
                      byMonth={contratosStats?.byMonth}
                      byCurrency={contratosStats?.byCurrency} 
                      loading={contratosLoading} 
                      error={contratosError} 
                    />
                  ) : sgcSubTab === "equipos" ? (
                    <EquiposDashboardView
                      summary={equiposStats?.summary}
                      alerts={equiposStats?.alerts}
                      volume={equiposStats?.volume}
                      topModels={equiposStats?.topModels}
                      geo={equiposStats?.geo}
                      topComunas={equiposStats?.topComunas}
                      loading={equiposLoading}
                      error={equiposError}
                    />
                  ) : (
                    <DespachosDashboardView
                      stats={despachosStats}
                      loading={despachosLoading}
                      error={despachosError}
                    />
                  )
                ) : params.id === "dte" ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{statsData.totalTransactions.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">🤖 Ejecuciones Totales</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{statsData.approvedCount.toLocaleString()}</p>
                      <p className="text-xs text-emerald-600">✅ Ejecuciones Exitosas</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-red-500">{statsData.rejectedCount.toLocaleString()}</p>
                      <p className="text-xs text-red-500">❌ Ejecuciones Fallidas</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-blue-500">
                        {statsData.enProceso > 0 ? `${statsData.enProceso}s` : "N/A"}
                      </p>
                      <p className="text-xs text-blue-500">⏱️ Duración Promedio</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{statsData.totalTransactions.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">📄 Total Documentos</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{statsData.approvedCount.toLocaleString()}</p>
                      <p className="text-xs text-emerald-600">✅ Aprobados</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-red-500">{statsData.rejectedCount.toLocaleString()}</p>
                      <p className="text-xs text-red-500">❌ Rechazados</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-amber-500">{statsData.manualCount.toLocaleString()}</p>
                      <p className="text-xs text-amber-500">⚠️ Manuales</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-blue-500">{statsData.pendingCount.toLocaleString()}</p>
                      <p className="text-xs text-blue-500">⏳ Pendientes</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center border-2 border-red-200">
                      <p className="text-2xl font-bold text-red-600">{statsData.infrastructureErrors.toLocaleString()}</p>
                      <p className="text-xs text-red-600">🔧 Errores Infraestructura</p>
                    </div>
                  </div>
                )}
                
                {(!isSgcService || sgcSubTab === "docs") && (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                        <span className="text-sm text-muted-foreground">Tasa error infraestructura</span>
                        <span className="font-bold text-red-500">{getDisplayPercentage()}%</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                        <span className="text-sm text-muted-foreground">📊 Uptime</span>
                        <span className="font-bold text-emerald-600">{statsData.uptime}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                      <span className="text-sm text-muted-foreground">🕐 Última actividad</span>
                      <span className="font-semibold text-sm">{statsData.lastActivity}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          {/* TAB - DESCRIPCIÓN */}
          <TabsContent value="description">
            <Card>
              <CardHeader><CardTitle className="text-lg font-medium flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Información del Servicio</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div><h3 className="font-semibold text-foreground mb-2">Descripción</h3><p className="text-muted-foreground leading-relaxed">{displayDescription}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-muted/30"><CardContent className="p-4"><div className="text-sm text-muted-foreground">Estado actual</div><div className="flex items-center gap-2 mt-1"><StatusIndicator status={getDisplayStatus()} percentage={getDisplayPercentage()} /></div></CardContent></Card>
                  <Card className="bg-muted/30"><CardContent className="p-4"><div className="text-sm text-muted-foreground">Total de clientes</div><div className="text-2xl font-bold text-foreground mt-1">{displayClients.length}</div></CardContent></Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB - CLIENTES */}
          <TabsContent value="clients">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-lg font-medium flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Clientes con este servicio</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {displayClients.map((client) => (
                      <div key={client.id} className={cn("p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md", selectedClient?.id === client.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")} onClick={() => handleOpenClientDashboard(client)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-white", "bg-emerald-500")}>{client.name.charAt(0)}</div>
                            <div><p className="font-semibold text-foreground">{client.name}</p><p className="text-sm text-muted-foreground">{client.errorPercentage}% errores infraestructura</p></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusIndicator status={client.status || "success"} percentage={client.errorPercentage || 0} />
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenClientDashboard(client); }}><Eye className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ✅ DIALOG DEL DASHBOARD DE CLIENTES CON LOGO GRANDE EN ESQUINA SUPERIOR DERECHA */}
      <Dialog open={showClientDashboard} onOpenChange={setShowClientDashboard}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] !max-h-[95vh] !h-[95vh] overflow-y-auto p-0">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <LayoutDashboard className="h-6 w-6" />
                  Dashboard de Clientes
                </DialogTitle>
              </div>
              <div className="mt-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {selectedClient?.name || "Cliente"}
                </p>
                {selectedClient?.rut && (
                  <p className="text-xs text-muted-foreground/70">
                    RUT: {selectedClient.rut}
                  </p>
                )}
              </div>
            </DialogHeader>
            {selectedClient && (
              <ClientDashboard 
                clientId={selectedClient.id} 
                onClose={() => {
                  setShowClientDashboard(false);
                  setSelectedClient(null);
                }}
                onNavigateToTimeline={() => {
                  setShowClientDashboard(false);
                  setSelectedClient(null);
                  const timelineTab = document.querySelector('[data-value="timeline"]') as HTMLButtonElement | null;
                  if (timelineTab) {
                    timelineTab.click();
                  } else {
                    const statsTab = document.querySelector('[data-value="stats"]') as HTMLButtonElement | null;
                    if (statsTab) statsTab.click();
                  }
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Exportación a Excel - Portal Mi Cuenta */}
      <Dialog open={showExportModalMiCuenta} onOpenChange={setShowExportModalMiCuenta}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Seleccionar Campos para Exportar (Portal Mi Cuenta)
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectAllMiCuenta}
                  onCheckedChange={() => {
                    if (selectAllMiCuenta) {
                      setSelectedFieldsMiCuenta([]);
                      setSelectAllMiCuenta(false);
                    } else {
                      setSelectedFieldsMiCuenta(EXPORT_FIELDS_MI_CUENTA.map(f => f.id));
                      setSelectAllMiCuenta(true);
                    }
                  }}
                  id="select-all-micuenta"
                />
                <Label htmlFor="select-all-micuenta" className="font-semibold">
                  Seleccionar todos
                </Label>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedFieldsMiCuenta.length} de {EXPORT_FIELDS_MI_CUENTA.length} campos seleccionados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {EXPORT_FIELDS_MI_CUENTA.map((field) => (
                <div key={field.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={selectedFieldsMiCuenta.includes(field.id)}
                    onCheckedChange={() => {
                      setSelectedFieldsMiCuenta(prev => {
                        const newSelection = prev.includes(field.id)
                          ? prev.filter(id => id !== field.id)
                          : [...prev, field.id];
                        setSelectAllMiCuenta(newSelection.length === EXPORT_FIELDS_MI_CUENTA.length);
                        return newSelection;
                      });
                    }}
                    id={`field-micuenta-${field.id}`}
                  />
                  <Label htmlFor={`field-micuenta-${field.id}`} className="text-sm cursor-pointer">
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>

            {selectedFieldsMiCuenta.length === 0 && (
              <div className="text-center text-sm text-red-500 p-2 bg-red-50 rounded-lg">
                ⚠️ Debes seleccionar al menos un campo para exportar.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportModalMiCuenta(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (selectedFieldsMiCuenta.length === 0 || rawData.length === 0) return;
                const fieldMap: Record<string, (s: any) => any> = {
                  folio: (s) => s.CDG_SOLICITUD,
                  fecha: (s) => s.FCH_SOLICITUD ? format(new Date(s.FCH_SOLICITUD), "dd/MM/yyyy HH:mm:ss") : "N/A",
                  tipoSolicitud: (s) => s.CDG_TIPO_SOLICITUD === 1 ? "Suministro" : "Ticket Incidencia",
                  cliente: (s) => s.CDG_CLIENTE,
                  contacto: (s) => s.NMB_CONTACTO || "N/A",
                  contrato: (s) => s.CDG_CONTRATO || "N/A",
                  serie: (s) => s.NMR_SERIE || "N/A",
                  direccion: (s) => s.DIR_SERIE || "N/A",
                  comuna: (s) => s.COM_SERIE || "N/A",
                  referencia: (s) => s.REF_SERIE || "N/A",
                  telefono: (s) => s.TEL_CONTACTO || "N/A",
                  email: (s) => s.EMAIL_CONTACTO || "N/A",
                  exportDate: () => format(new Date(), "dd/MM/yyyy HH:mm:ss"),
                };

                const fieldLabels: Record<string, string> = {};
                EXPORT_FIELDS_MI_CUENTA.forEach(f => fieldLabels[f.id] = f.label);

                const exportData = rawData.map(item => {
                  const row: Record<string, any> = {};
                  selectedFieldsMiCuenta.forEach(fieldId => {
                    const label = fieldLabels[fieldId] || fieldId;
                    row[label] = fieldMap[fieldId](item);
                  });
                  return row;
                });

                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();

                const colWidths = selectedFieldsMiCuenta.map(() => ({ wch: 25 }));
                ws['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(wb, ws, "Solicitudes Mi Cuenta");

                const summaryData = [
                  { "Métrica": "Total Tickets Generados", "Valor": statsData.totalTransactions },
                  { "Métrica": "Suministros Solicitados", "Valor": statsData.approvedCount },
                  { "Métrica": "Clientes con Peticiones", "Valor": miCuentaPeticionesCliente.length },
                  { "Métrica": "Fecha Exportación", "Valor": format(new Date(), "dd/MM/yyyy HH:mm:ss") },
                ];
                const wsSummary = XLSX.utils.json_to_sheet(summaryData);
                XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

                XLSX.writeFile(wb, `Solicitudes_Portal_Mi_Cuenta_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
                setShowExportModalMiCuenta(false);
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={selectedFieldsMiCuenta.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar {selectedFieldsMiCuenta.length} campos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="border-t border-border mt-8 py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm text-muted-foreground">
              Sistema de Administración y Monitoreo de Servicios &copy; 2026
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}