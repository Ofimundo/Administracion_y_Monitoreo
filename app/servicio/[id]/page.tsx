// app/service/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/header";
import { StatusIndicator } from "@/components/status-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { ClientDashboard } from "@/components/client-dashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Lista de servicios que están próximamente
const COMING_SOON_SERVICES = ["saldos", "finiquitos", "cuentas", "dte", "contabilizacion", "notas-credito"];

// Función para verificar si un servicio está próximo
const isServiceComingSoon = (serviceId: string): boolean => {
  return COMING_SOON_SERVICES.includes(serviceId);
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
    // Campos adicionales para OFITEC
    enProceso: 0,
    finalizado: 0,
    anulado: 0,
    incompleto: 0,
    reAbierto: 0,
    servTecnico: 0,
    cancelado: 0,
    // Campos adicionales para SGC
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

  const serviceStatic = services.find((s) => s.id === params.id);
  const comingSoon = serviceStatic ? isServiceComingSoon(serviceStatic.id) : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Función para generar datos de muestra REALISTAS para SGC
  const generateSgcSampleData = () => {
    const data = [];
    const startDate = new Date(2026, 4, 1);
    const tiposDocumento = ["Factura", "Guía", "Nota de Crédito", "Boleta"];
    const sistemasOrigen = ["SAP", "Oracle", "Softland", "STUEDEMANNSA"];
    const tiposVenta = ["picking", "od", "venta directa", "distribución"];
    const tiposDocOrigen = ["FACT", "GUID", "NC", "BOL"];
    
    for (let i = 0; i < 500; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() - Math.floor(Math.random() * 30));
      
      data.push({
        tipo_de_documento: tiposDocumento[Math.floor(Math.random() * tiposDocumento.length)],
        SISTEMA_ORIGEN: sistemasOrigen[Math.floor(Math.random() * sistemasOrigen.length)],
        tipo_de_venta: tiposVenta[Math.floor(Math.random() * tiposVenta.length)],
        TIPO_DOCUMENTO_ORIGEN: tiposDocOrigen[Math.floor(Math.random() * tiposDocOrigen.length)],
        fecha_documento: date.toISOString(),
        cantidad: Math.floor(Math.random() * 100) + 1,
      });
    }
    return data;
  };

  const fetchLiveData = async (dateRange?: { from: Date | undefined; to: Date | undefined }) => {
    const serviceId = params.id as string;
    const activeServices = ["facturas", "oficore", "ofitec", "sgc"];
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
      // FACTURAS
      // ============================================================
      if (serviceId === "facturas") {
        const res = await fetch("/api/facturas/bitacora?estado=todos");
        const data = await res.json();
        if (data.success && data.data && Array.isArray(data.data)) {
          setRawData(data.data);
          setDbMode("real");
          calculateRealStats(data.data, targetRange);
          
          const singleClient: Client = {
            id: "cl_ofimundo",
            name: "Ofimundo S.A. (Softland ERP)",
            rut: "76.452.910-K",
            email: "rpa-invoice@ofimundo.cl",
            phone: "+56 2 2840 9300",
            errorPercentage: 0,
            status: "success",
          };
          setLiveClients([singleClient]);
          setServiceStatus("success");
        } else {
          setRawData([]);
          setLiveClients([]);
          setApiError("No se encontraron datos de facturas");
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
          calculateRealStats(docs, targetRange);

          const singleClient: Client = {
            id: "cl_oficore",
            name: "Ofimundo S.A. (OFICORE)",
            rut: "76.452.910-K",
            email: "oficore-support@ofimundo.cl",
            phone: "+56 2 2840 9300",
            errorPercentage: 0,
            status: "success",
          };
          setLiveClients([singleClient]);
          setServiceStatus("success");
        } else {
          setApiError(data.message || "Error al obtener datos de OFICORE");
        }
      }
      // ============================================================
      // OFITEC - SOLO DATOS REALES
      // ============================================================
      else if (serviceId === "ofitec") {
        try {
          const res = await fetch(`/api/ofitec/stats${queryParams}`);
          const data = await res.json();
          
          if (data.success && data.detalles && Array.isArray(data.detalles) && data.detalles.length > 0) {
            const docs = data.detalles || [];
            setRawData(docs);
            setDbMode(data.mode || "real");
            calculateRealStats(docs, targetRange);

            const singleClient: Client = {
              id: "cl_ofitec",
              name: "Ofimundo S.A. (OFITEC)",
              rut: "76.452.910-K",
              email: "ofitec-support@ofimundo.cl",
              phone: "+56 2 2840 9300",
              errorPercentage: 0,
              status: "success",
            };
            setLiveClients([singleClient]);
            setServiceStatus("success");
            setApiError(null);
          } else {
            // Si no hay datos reales, mostrar error
            setRawData([]);
            setDbMode("real");
            setLiveClients([]);
            setServiceStatus("error");
            setApiError(data.message || "⚠️ No se encontraron registros en la base de datos OFITEC. Verifica la conexión a OFITEC.dbo.SAST_LLAMADA");
          }
        } catch (e) {
          console.error("Error fetching OFITEC data:", e);
          setRawData([]);
          setDbMode("real");
          setLiveClients([]);
          setServiceStatus("error");
          setApiError("❌ Error al conectar con la base de datos OFITEC. Verifica las credenciales y la conexión a SQL Server.");
        }
      }
      // ============================================================
      // SGC
      // ============================================================
      else if (serviceId === "sgc") {
        try {
          const res = await fetch(`/api/sgc/stats${queryParams}`);
          const data = await res.json();
          
          if (res.status === 403 || !data.success) {
            if (data.isPermissionError) {
              setPermissionError(data.message);
              setRawData([]);
              setStatsData({
                uptime: "100%",
                lastActivity: "Acceso denegado",
                totalTransactions: 0,
                infrastructureErrors: 1,
                infrastructureErrorPercentage: 100,
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
              });
              setServiceStatus("error");
              setApiError(null);
            } else {
              // Si hay error pero no es de permisos, mostrar error
              setRawData([]);
              setLiveClients([]);
              setServiceStatus("error");
              setApiError(data.message || "⚠️ Error al obtener datos de SGC");
            }
          } else {
            const docs = data.data || [];
            if (docs.length > 0) {
              setRawData(docs);
              setDbMode(data.mode || "real");
              calculateRealStats(docs, targetRange);
              setApiError(null);
            } else {
              setRawData([]);
              setDbMode("real");
              setApiError("⚠️ No se encontraron registros en la base de datos SGC");
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
            setServiceStatus("success");
          }
        } catch (e) {
          console.error("Error fetching SGC data:", e);
          setRawData([]);
          setLiveClients([]);
          setServiceStatus("error");
          setApiError("❌ Error al conectar con la base de datos SGC");
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
  
  const calculateRealStats = (data: any[], dateRange?: { from: Date | undefined; to: Date | undefined }) => {
    const serviceId = params.id as string;
    let filteredData = [...data];
    
    const getSafeMaxDate = (dates: any[]): Date | null => {
      if (!dates || dates.length === 0) return null;
      let maxTime = 0;
      for (let i = 0; i < dates.length; i++) {
        if (!dates[i]) continue;
        const t = new Date(dates[i]).getTime();
        if (t > maxTime) maxTime = t;
      }
      return maxTime > 0 ? new Date(maxTime) : null;
    };
    
    // Aplicar filtro de fechas si existe
    if (dateRange?.from || dateRange?.to) {
      filteredData = filteredData.filter((item: any) => {
        let dateVal = item.fecha_proceso;
        if (serviceId === "oficore") dateVal = item.fecha_detalle;
        else if (serviceId === "ofitec") dateVal = item.LLA_FEC_LLAMADA;
        else if (serviceId === "sgc") dateVal = item.fecha_documento;
        
        if (!dateVal) return true;
        const itemDate = new Date(dateVal);
        let valid = true;
        if (dateRange.from) {
          const fromDate = new Date(dateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          if (itemDate < fromDate) valid = false;
        }
        if (dateRange.to && valid) {
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          if (itemDate > toDate) valid = false;
        }
        return valid;
      });
    }
    
    const totalDocs = filteredData.length;
    let approvedDocs = 0;
    let rejectedDocs = 0;
    let manualDocs = 0;
    let pendingDocs = 0;
    let infrastructureErrors = 0;
    let infrastructureErrorPercentage = 0;
    let lastActivity = "No hay datos";
    
    // Variables adicionales para OFITEC
    let enProceso = 0;
    let finalizado = 0;
    let anulado = 0;
    let incompleto = 0;
    let reAbierto = 0;
    let servTecnico = 0;
    let cancelado = 0;

    // Variables adicionales para SGC
    let sgcFacturas = 0;
    let sgcGuias = 0;
    let sgcNotasCredito = 0;
    let sgcNotasDebito = 0;
    let sgcOrigenSgc = 0;
    let sgcOrigenSoftland = 0;

    // ============================================================
    // CALCULAR ESTADÍSTICAS SEGÚN EL SERVICIO
    // ============================================================
    
    if (serviceId === "facturas") {
      // FACTURAS: Usar estados reales
      approvedDocs = filteredData.filter((e: any) => e.estado === "Aprobado").length;
      rejectedDocs = filteredData.filter((e: any) => e.estado === "Rechazado").length;
      manualDocs = filteredData.filter((e: any) => e.estado === "Manual").length;
      pendingDocs = filteredData.filter((e: any) => 
        e.estado === "Pendiente" || e.estado === "Pendiente Espera"
      ).length;
      
      const erroresTecnicos = [
        "error de conexión", "timeout", "servidor no responde", "softland no disponible",
        "sii no responde", "connection failed", "failed to connect", "could not connect",
        "connection refused", "network error", "no se pudo conectar",
        "softland error", "sii error", "error de red"
      ];
      
      infrastructureErrors = filteredData.filter((e: any) => {
        const motivo = e.motivo || "";
        const motivoLower = motivo.toLowerCase();
        const hasTextError = erroresTecnicos.some(term => motivoLower.includes(term.toLowerCase()));
        if (hasTextError) return true;
        return ["500", "502", "503", "504"].some(code => new RegExp(`\\b${code}\\b`).test(motivoLower));
      }).length;
      
      infrastructureErrorPercentage = totalDocs > 0 ? Math.round((infrastructureErrors / totalDocs) * 100) : 0;
      
      if (filteredData.length > 0) {
        const latestDate = getSafeMaxDate(filteredData.map((e: any) => e.fecha_proceso));
        if (latestDate) lastActivity = format(latestDate, "dd/MM/yyyy HH:mm");
      }
    }
    else if (serviceId === "oficore") {
      // OFICORE: Usar los estados de MDA.accion
      approvedDocs = filteredData.filter((e: any) => e.id_accion === 5).length;
      rejectedDocs = filteredData.filter((e: any) => e.id_accion !== 5).length;
      manualDocs = 0;
      pendingDocs = 0;
      infrastructureErrors = 0;
      infrastructureErrorPercentage = 0;
      
      if (filteredData.length > 0) {
        const dates = filteredData.map((e: any) => e.fecha_detalle).filter(Boolean);
        const latestDate = getSafeMaxDate(dates);
        if (latestDate) lastActivity = format(latestDate, "dd/MM/yyyy HH:mm");
      }
    }
    else if (serviceId === "ofitec") {
      // ============================================================
      // OFITEC: Estadísticas basadas en LLA_CORRELATIVO y LLA_ESTADO
      // DATOS REALES DE LA BASE DE DATOS
      // ============================================================
      
      // ESTADOS RESUELTOS DE OFITEC
      const resolvedStatuses = ['4', '24', '6', '8', '9', '15', '16', '7'];
      
      // Tickets Ingresados = LLA_CORRELATIVO = '1'
      const ingresadas = filteredData.filter((c: any) => c.LLA_CORRELATIVO === "1" || c.LLA_CORRELATIVO === 1).length;
      
      // Tickets Resueltos = LLA_ESTADO en estados resueltos
      const resueltas = filteredData.filter((c: any) => {
        const est = c.LLA_ESTADO?.toString().trim();
        return resolvedStatuses.includes(est);
      }).length;
      
      // Tickets Pendientes = Ingresados - Resueltos
      const pendientes = Math.max(0, ingresadas - resueltas);
      
      approvedDocs = resueltas;
      rejectedDocs = pendientes;
      manualDocs = 0;
      pendingDocs = 0;
      infrastructureErrors = 0;
      infrastructureErrorPercentage = 0;
      
      // Contar por estado específico para estadísticas detalladas
      enProceso = filteredData.filter((c: any) => {
        const est = c.LLA_ESTADO?.toString().trim();
        return ['1', '2', '17', '20', '5', '30'].includes(est);
      }).length;

      finalizado = filteredData.filter((c: any) => {
        const est = c.LLA_ESTADO?.toString().trim();
        return ['4', '24'].includes(est);
      }).length;

      anulado = filteredData.filter((c: any) => {
        const est = c.LLA_ESTADO?.toString().trim();
        return ['8', '9'].includes(est);
      }).length;

      incompleto = filteredData.filter((c: any) => {
        const est = c.LLA_ESTADO?.toString().trim();
        return ['3', '10', '22', '33'].includes(est);
      }).length;

      cancelado = filteredData.filter((c: any) => {
        const est = c.LLA_ESTADO?.toString().trim();
        return ['11', '12'].includes(est);
      }).length;
      
      if (filteredData.length > 0) {
        const dates = filteredData.map((e: any) => e.LLA_FEC_LLAMADA).filter(Boolean);
        const latestDate = getSafeMaxDate(dates);
        if (latestDate) lastActivity = format(latestDate, "dd/MM/yyyy HH:mm");
      }
    }
    else if (serviceId === "sgc") {
      // SGC: Mostrar todos los documentos procesados
      approvedDocs = 0;
      rejectedDocs = 0;
      manualDocs = 0;
      pendingDocs = 0;
      infrastructureErrors = 0;
      infrastructureErrorPercentage = 0;
      
      sgcFacturas = filteredData.filter((e: any) => e.tipo_de_documento?.toString().trim().toUpperCase() === "FACTURA").length;
      sgcGuias = filteredData.filter((e: any) => e.tipo_de_documento?.toString().trim().toUpperCase() === "GUIA").length;
      sgcNotasCredito = filteredData.filter((e: any) => e.tipo_de_documento?.toString().trim().toUpperCase() === "NOTA DE CREDITO").length;
      sgcNotasDebito = filteredData.filter((e: any) => e.tipo_de_documento?.toString().trim().toUpperCase() === "NOTA DE DEBITO").length;
      sgcOrigenSgc = filteredData.filter((e: any) => e.SISTEMA_ORIGEN?.toString().trim().toUpperCase() === "SGC").length;
      sgcOrigenSoftland = filteredData.filter((e: any) => e.SISTEMA_ORIGEN?.toString().trim().toUpperCase() === "SOFTLAND").length;
      
      if (filteredData.length > 0) {
        const dates = filteredData.map((e: any) => e.fecha_documento).filter(Boolean);
        const latestDate = getSafeMaxDate(dates);
        if (latestDate) lastActivity = format(latestDate, "dd/MM/yyyy HH:mm");
      }
    }

    setStatsData({
      uptime: "100%",
      lastActivity,
      totalTransactions: serviceId === "ofitec" ? (filteredData.filter((c: any) => c.LLA_CORRELATIVO === "1" || c.LLA_CORRELATIVO === 1).length) : totalDocs,
      infrastructureErrors,
      infrastructureErrorPercentage,
      approvedCount: approvedDocs,
      rejectedCount: rejectedDocs,
      manualCount: manualDocs,
      pendingCount: pendingDocs,
      enProceso,
      finalizado,
      anulado,
      incompleto,
      reAbierto,
      servTecnico,
      cancelado,
      sgcFacturas,
      sgcGuias,
      sgcNotasCredito,
      sgcNotasDebito,
      sgcOrigenSgc,
      sgcOrigenSoftland,
    });
    
    setHasStatsFilter(dateRange?.from !== undefined || dateRange?.to !== undefined);
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
    const isOfitec = params.id === "ofitec";
    const isOficore = params.id === "oficore";
    const defaultRange = isOfitec 
      ? { from: new Date(2025, 3, 1), to: new Date(2025, 3, 30) }
      : isOficore
        ? { from: new Date(2026, 4, 1), to: new Date(2026, 4, 30) }
        : { from: new Date(new Date().getFullYear(), 0, 1), to: new Date(new Date().getFullYear(), 11, 31) };
    setStatsDateRange(defaultRange);
    fetchLiveData(defaultRange);
    setHasStatsFilter(false);
    toast({
      title: "Filtro limpiado",
      description: "Consulta restaurada al rango por defecto",
    });
  };

  useEffect(() => {
    const activeServices = ["facturas", "oficore", "ofitec", "sgc"];
    if (serviceStatic && !comingSoon) {
      setServiceName(serviceStatic.name);
      setServiceDescription(serviceStatic.description);
      setServiceClients(serviceStatic.clients);
      setServiceStatus("success");
      
      if (activeServices.includes(serviceStatic.id)) {
        if (serviceStatic.id === "ofitec") {
          const defaultRange = {
            from: new Date(2025, 3, 1),
            to: new Date(2025, 3, 30),
          };
          setStatsDateRange(defaultRange);
          fetchLiveData(defaultRange);
        } else if (serviceStatic.id === "oficore") {
          const defaultRange = {
            from: new Date(2026, 4, 1),
            to: new Date(2026, 4, 30),
          };
          setStatsDateRange(defaultRange);
          fetchLiveData(defaultRange);
        } else {
          fetchLiveData();
        }
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
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            Sistema de Administración y Monitoreo de Servicios &copy; 2026
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

  // Evitar la hidratación mostrando un placeholder hasta que el cliente esté listo
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

  // Determinar si es OFITEC
  const isOfitec = params.id === "ofitec";
  // Determinar si es OFICORE
  const isOficore = params.id === "oficore";
  // Determinar si es SGC
  const isSgcService = params.id === "sgc";
  // Determinar si es un servicio de tickets (OFICORE o OFITEC)
  const isTicketService = isOficore || isOfitec;

  // ============================================================
  // RENDERIZADO PRINCIPAL - Dashboard como primera pestaña
  // ============================================================
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.push("/")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la lista de servicios
          </Button>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
            <StatusIndicator status="success" percentage={0} size="lg" />
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

        {/* Tabs con Dashboard, Estadísticas, Descripción y Clientes */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
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

          {/* TAB - DASHBOARD (NUEVO - PRIMERO) */}
          <TabsContent value="dashboard">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5 text-emerald-500" />
                    Dashboard del Servicio
                  </CardTitle>
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
                
                {/* ============================================================
                    DASHBOARD - VISTA RESUMEN DEL SERVICIO
                    ============================================================ */}
                <div className="space-y-4">
                  {/* Resumen de métricas principales */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/30 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{statsData.totalTransactions.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {isTicketService ? "🎫 Tickets" : "📄 Documentos"}
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{statsData.approvedCount.toLocaleString()}</p>
                      <p className="text-xs text-emerald-600">
                        {isTicketService ? "✅ Resueltos" : "✅ Aprobados"}
                      </p>
                    </div>
                    <div className={cn(
                      "rounded-lg p-4 text-center",
                      statsData.rejectedCount > 0 ? "bg-red-50" : "bg-muted/30"
                    )}>
                      <p className={cn(
                        "text-2xl font-bold",
                        statsData.rejectedCount > 0 ? "text-red-500" : "text-foreground"
                      )}>
                        {statsData.rejectedCount.toLocaleString()}
                      </p>
                      <p className={cn(
                        "text-xs",
                        statsData.rejectedCount > 0 ? "text-red-500" : "text-muted-foreground"
                      )}>
                        {isTicketService ? "⏳ Pendientes" : "❌ Rechazados"}
                      </p>
                    </div>
                    <div className={cn(
                      "rounded-lg p-4 text-center border-2",
                      statsData.infrastructureErrorPercentage > 0 ? "border-red-300 bg-red-50" : "border-emerald-200 bg-emerald-50"
                    )}>
                      <p className={cn(
                        "text-2xl font-bold",
                        statsData.infrastructureErrorPercentage > 0 ? "text-red-600" : "text-emerald-600"
                      )}>
                        {statsData.infrastructureErrorPercentage}%
                      </p>
                      <p className={cn(
                        "text-xs",
                        statsData.infrastructureErrorPercentage > 0 ? "text-red-600" : "text-emerald-600"
                      )}>
                        🔧 Error Infraestructura
                      </p>
                    </div>
                  </div>

                  {/* Información adicional del servicio */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                      <span className="text-sm text-muted-foreground">📊 Uptime</span>
                      <span className="font-bold text-emerald-600">{statsData.uptime}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                      <span className="text-sm text-muted-foreground">🕐 Última actividad</span>
                      <span className="font-semibold text-sm">{statsData.lastActivity}</span>
                    </div>
                  </div>

                  {/* Estado del servicio */}
                  <div className="flex justify-between items-center p-4 bg-muted/20 rounded-lg border">
                    <span className="text-sm font-medium text-foreground">Estado del Servicio</span>
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={serviceStatus} percentage={0} />
                      <span className="text-sm font-semibold">
                        {serviceStatus === "success" ? "✅ Operativo" : 
                         serviceStatus === "warning" ? "⚠️ Atención" : "❌ Crítico"}
                      </span>
                    </div>
                  </div>

                  {/* Clientes asociados resumen */}
                  <div className="bg-muted/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Clientes Asociados
                      </h4>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => document.querySelector('[value="clients"]')?.click()}
                      >
                        Ver todos <ArrowLeft className="h-3 w-3 rotate-180 ml-1" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {displayClients.slice(0, 5).map((client) => (
                        <Badge key={client.id} variant="outline" className="text-xs px-3 py-1">
                          {client.name.length > 25 ? client.name.substring(0, 25) + "..." : client.name}
                        </Badge>
                      ))}
                      {displayClients.length > 5 && (
                        <Badge variant="outline" className="text-xs px-3 py-1 bg-muted/50">
                          +{displayClients.length - 5} más
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Descripción resumida */}
                  <div className="bg-muted/20 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4" />
                      Descripción
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-3">{displayDescription}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs mt-2"
                      onClick={() => document.querySelector('[value="description"]')?.click()}
                    >
                      Ver más <ArrowLeft className="h-3 w-3 rotate-180 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB - ESTADÍSTICAS (CONTENIDO COMPLETO) */}
          <TabsContent value="stats">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-500" />
                    {isTicketService ? "Estadísticas de Tickets" : isSgcService ? "Estadísticas de Documentos SGC" : "Estadísticas de Documentos"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {/* ============================================================
                    ESTADÍSTICAS EN TARJETAS - ADAPTADAS SEGÚN EL SERVICIO
                    ============================================================ */}
                {isOfitec ? (
                  // ============================================================
                  // ESTADÍSTICAS PARA OFITEC - DATOS REALES (SIMPLIFICADO Y CORRECTO)
                  // ============================================================
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
                ) : isOficore ? (
                  // ============================================================
                  // ESTADÍSTICAS PARA OFICORE - SIMPLIFICADO
                  // ============================================================
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
                  // ============================================================
                  // ESTADÍSTICAS PARA SGC
                  // ============================================================
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
                ) : (
                  // ============================================================
                  // ESTADÍSTICAS PARA FACTURAS
                  // ============================================================
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
                
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                    <span className="text-sm text-muted-foreground">Tasa error infraestructura</span>
                    <span className="font-bold text-red-500">{statsData.infrastructureErrorPercentage}%</span>
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
                  <Card className="bg-muted/30"><CardContent className="p-4"><div className="text-sm text-muted-foreground">Estado actual</div><div className="flex items-center gap-2 mt-1"><StatusIndicator status="success" percentage={0} /></div></CardContent></Card>
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
                            <div><p className="font-semibold text-foreground">{client.name}</p><p className="text-sm text-muted-foreground">0% errores infraestructura</p></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusIndicator status="success" percentage={0} />
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

      {/* Modal del Dashboard del Cliente */}
      <Dialog open={showClientDashboard} onOpenChange={setShowClientDashboard}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] !max-h-[95vh] !h-[95vh] overflow-y-auto p-0">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <LayoutDashboard className="h-6 w-6" />
                Dashboard del Cliente - {selectedClient?.name || "Cliente"}
              </DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <ClientDashboard 
                clientId={selectedClient.id} 
                onClose={() => {
                  setShowClientDashboard(false);
                  setSelectedClient(null);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <footer className="border-t border-border mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Sistema de Administración y Monitoreo de Servicios &copy; 2026
        </div>
      </footer>
    </div>
  );
}