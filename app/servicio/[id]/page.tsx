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
  RefreshCw,
  Send,
  Bell,
  Settings,
  Eye,
  Filter,
  Search,
  X,
  Calendar as CalendarIcon,
  Play,
  Loader2,
  LayoutDashboard,
} from "lucide-react";
import { format, isWithinInterval, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { ClientDashboard } from "@/components/client-dashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LogFilters {
  search: string;
  types: string[];
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

// Lista de servicios que están próximamente
const COMING_SOON_SERVICES = ["saldos", "finiquitos", "cuentas", "dte", "contabilizacion", "notas-credito"];

// Función para verificar si un servicio está próximo
const isServiceComingSoon = (serviceId: string): boolean => {
  return COMING_SOON_SERVICES.includes(serviceId);
};

// Función para determinar el tipo de log según el estado y motivo - SOLO INFRAESTRUCTURA es ERROR
const getLogTypeFromEntry = (entry: any): LogEntry["type"] => {
  const estado = entry.estado;
  const motivo = entry.motivo || "";
  
  const erroresInfraestructura = [
    "error de conexión a la base de datos", "timeout al conectar", "servidor no responde",
    "softland no disponible", "sii no responde", "connection failed", "failed to connect",
    "could not connect", "connection refused", "network error", "500", "503",
    "no se pudo conectar", "softland error", "sii error", "error de red"
  ];
  
  const esErrorInfraestructura = erroresInfraestructura.some(term => 
    motivo.toLowerCase().includes(term.toLowerCase())
  );
  
  if (esErrorInfraestructura) return "error";
  
  switch (estado) {
    case "Aprobado": return "success";
    case "Rechazado": return "info";
    case "Manual": return "info";
    case "Pendiente":
    case "Pendiente Espera": return "info";
    default: return "info";
  }
};

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDashboard, setShowClientDashboard] = useState(false);
  const [showLogFilters, setShowLogFilters] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceStatus, setServiceStatus] = useState<"success" | "warning" | "error">("success");
  const [serviceErrorPercentage, setServiceErrorPercentage] = useState(0);
  const [serviceClients, setServiceClients] = useState<Client[]>([]);
  const [mounted, setMounted] = useState(false);
  
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
  });
  
  const [statsDateRange, setStatsDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [showStatsDateFilter, setShowStatsDateFilter] = useState(false);
  const [hasStatsFilter, setHasStatsFilter] = useState(false);
  
  const [tempFilters, setTempFilters] = useState<LogFilters>({
    search: "",
    types: ["success", "error", "warning", "info"],
    dateRange: { from: undefined, to: undefined },
  });
  
  const [appliedFilters, setAppliedFilters] = useState<LogFilters>({
    search: "",
    types: ["success", "error", "warning", "info"],
    dateRange: { from: undefined, to: undefined },
  });

  const serviceStatic = services.find((s) => s.id === params.id);
  const comingSoon = serviceStatic ? isServiceComingSoon(serviceStatic.id) : false;
  
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const [liveClients, setLiveClients] = useState<Client[]>([]);
  const [liveStats, setLiveStats] = useState({
    uptime: "100%",
    lastActivity: "En línea",
    transactionsToday: 0,
    errorsToday: 0,
  });
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchLiveData = async () => {
    if (params.id !== "facturas") return;
    try {
      setLoading(true);
      const res = await fetch("/api/facturas/bitacora?estado=todos");
      const data = await res.json();
      if (data.success && data.data && Array.isArray(data.data)) {
        setRawData(data.data);
        
        const mappedLogs: LogEntry[] = data.data.map((entry: any, index: number) => {
          const uniqueId = entry.id_proceso 
            ? `bitacora_${entry.id_proceso}` 
            : `bitacora_${entry.tipo_documento}_${entry.folio_documento}_${index}`;
          
          return {
            id: uniqueId,
            message: `[Folio #${entry.folio_documento}] Factura ${entry.razon_social} (RUT: ${entry.rut_proveedor}) -> Estado: ${entry.estado}. Motivo: ${entry.motivo || "Evaluación exitosa en Softland."}`,
            timestamp: entry.fecha_proceso,
            type: getLogTypeFromEntry(entry)
          };
        });
        
        const uniqueLogs = mappedLogs.filter((log, index, self) => 
          index === self.findIndex((l) => l.id === log.id)
        );
        
        setLiveLogs(uniqueLogs);
        calculateRealStats(data.data);
        
        const totalDocs = data.data.length;
        
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
        
        setLiveStats({
          uptime: "100%",
          lastActivity: "Reciente",
          transactionsToday: totalDocs,
          errorsToday: 0
        });
        
        setServiceErrorPercentage(0);
        setServiceStatus("success");
      } else {
        setLiveLogs([]);
        setLiveClients([]);
      }
    } catch (e) {
      console.error("Error fetching live invoice data:", e);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del servicio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const calculateRealStats = (data: any[], dateRange?: { from: Date | undefined; to: Date | undefined }) => {
    let filteredData = [...data];
    
    if (dateRange?.from || dateRange?.to) {
      filteredData = filteredData.filter((item: any) => {
        const itemDate = new Date(item.fecha_proceso);
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
    const approvedDocs = filteredData.filter((e: any) => e.estado === "Aprobado").length;
    const rejectedDocs = filteredData.filter((e: any) => e.estado === "Rechazado").length;
    const manualDocs = filteredData.filter((e: any) => e.estado === "Manual").length;
    const pendingDocs = filteredData.filter((e: any) => 
      e.estado === "Pendiente" || e.estado === "Pendiente Espera"
    ).length;
    
    const erroresTecnicos = [
      "error de conexión", "timeout", "servidor no responde", "softland no disponible",
      "sii no responde", "connection failed", "failed to connect", "could not connect",
      "connection refused", "network error", "500", "503", "no se pudo conectar",
      "softland error", "sii error", "error de red"
    ];
    
    const infrastructureErrors = filteredData.filter((e: any) => {
      const motivo = e.motivo || "";
      return erroresTecnicos.some(term => motivo.toLowerCase().includes(term.toLowerCase()));
    }).length;
    
    const infrastructureErrorPercentage = totalDocs > 0 ? Math.round((infrastructureErrors / totalDocs) * 100) : 0;
    
    let lastActivity = "No hay datos";
    if (filteredData.length > 0) {
      const latestDate = new Date(Math.max(...filteredData.map((e: any) => new Date(e.fecha_proceso).getTime())));
      lastActivity = format(latestDate, "dd/MM/yyyy HH:mm");
    }
    
    setStatsData({
      uptime: "100%",
      lastActivity,
      totalTransactions: totalDocs,
      infrastructureErrors,
      infrastructureErrorPercentage,
      approvedCount: approvedDocs,
      rejectedCount: rejectedDocs,
      manualCount: manualDocs,
      pendingCount: pendingDocs,
    });
    
    setHasStatsFilter(dateRange?.from !== undefined || dateRange?.to !== undefined);
  };
  
  const applyStatsDateFilter = () => {
    if (rawData.length > 0) {
      calculateRealStats(rawData, statsDateRange);
      setShowStatsDateFilter(false);
      toast({
        title: "Filtro aplicado",
        description: `Estadísticas actualizadas${statsDateRange.from ? ` desde ${format(statsDateRange.from, "dd/MM/yyyy")}` : ""}${statsDateRange.to ? ` hasta ${format(statsDateRange.to, "dd/MM/yyyy")}` : ""}`,
      });
    }
  };
  
  const resetStatsDateFilter = () => {
    setStatsDateRange({ from: undefined, to: undefined });
    if (rawData.length > 0) {
      calculateRealStats(rawData, { from: undefined, to: undefined });
    }
    setHasStatsFilter(false);
    toast({
      title: "Filtro limpiado",
      description: "Estadísticas restauradas a todos los datos",
    });
  };

  useEffect(() => {
    if (params.id === "facturas") {
      fetchLiveData();
      if (serviceStatic) {
        setServiceName(serviceStatic.name);
        setServiceDescription(serviceStatic.description);
        setServiceClients(serviceStatic.clients);
      }
    } else if (serviceStatic && !comingSoon) {
      setServiceName(serviceStatic.name);
      setServiceDescription(serviceStatic.description);
      setServiceErrorPercentage(0);
      setServiceStatus("success");
      setServiceClients(serviceStatic.clients);
    }
  }, [params.id, serviceStatic, comingSoon]);

  const applyFilters = () => {
    setAppliedFilters({ ...tempFilters });
    setShowLogFilters(false);
    toast({
      title: "Filtros aplicados",
      description: "Los filtros se han aplicado correctamente.",
    });
  };

  const resetFilters = () => {
    const resetState = {
      search: "",
      types: ["success", "error", "warning", "info"],
      dateRange: { from: undefined, to: undefined },
    };
    setTempFilters(resetState);
    setAppliedFilters(resetState);
    toast({
      title: "Filtros limpiados",
      description: "Todos los filtros han sido eliminados.",
    });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.search && appliedFilters.search.trim() !== "") count++;
    if (appliedFilters.types.length < 4) count++;
    if (appliedFilters.dateRange.from || appliedFilters.dateRange.to) count++;
    return count;
  }, [appliedFilters]);

  const handleOpenClientDashboard = (client: Client) => {
    setSelectedClient(client);
    setShowClientDashboard(true);
  };

  const displayClients = params.id === "facturas" ? liveClients : serviceClients;

  const filteredLogs = useMemo(() => {
    const rawLogs = params.id === "facturas" ? liveLogs : (serviceStatic?.logs || []);
    let result = [...rawLogs];

    if (appliedFilters.search) {
      result = result.filter(log =>
        log.message.toLowerCase().includes(appliedFilters.search.toLowerCase())
      );
    }

    if (appliedFilters.types.length > 0 && appliedFilters.types.length < 4) {
      result = result.filter(log => appliedFilters.types.includes(log.type));
    }

    if (appliedFilters.dateRange.from && appliedFilters.dateRange.to) {
      result = result.filter(log => {
        const logDate = new Date(log.timestamp);
        const fromDate = new Date(appliedFilters.dateRange.from!);
        const toDate = new Date(appliedFilters.dateRange.to!);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        return logDate >= fromDate && logDate <= toDate;
      });
    } else if (appliedFilters.dateRange.from && !appliedFilters.dateRange.to) {
      result = result.filter(log => {
        const logDate = new Date(log.timestamp);
        const fromDate = new Date(appliedFilters.dateRange.from!);
        fromDate.setHours(0, 0, 0, 0);
        return logDate >= fromDate;
      });
    } else if (!appliedFilters.dateRange.from && appliedFilters.dateRange.to) {
      result = result.filter(log => {
        const logDate = new Date(log.timestamp);
        const toDate = new Date(appliedFilters.dateRange.to!);
        toDate.setHours(23, 59, 59, 999);
        return logDate <= toDate;
      });
    }

    return result;
  }, [serviceStatic?.logs, liveLogs, appliedFilters]);

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "error": return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLogBgColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800";
      case "error": return "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800";
      case "warning": return "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800";
      default: return "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800";
    }
  };

  const getLogBadge = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return <Badge variant="success" className="text-[10px] px-1.5">✅ Éxito</Badge>;
      case "error": return <Badge variant="destructive" className="text-[10px] px-1.5">❌ Error Infraestructura</Badge>;
      case "warning": return <Badge variant="warning" className="text-[10px] px-1.5">⚠️ Advertencia</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] px-1.5">ℹ️ Regla de Negocio</Badge>;
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

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
  const displayStatus: "success" | "warning" | "error" = "success";
  const displayErrorPercentage = 0;

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
              <StatusIndicator status="success" errorPercentage={0} size="lg" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="h-[500px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              </div>
            </div>
            <div>
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
            <StatusIndicator status="success" errorPercentage={0} size="lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="logs" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="logs" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Reglas de Negocio
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

              <TabsContent value="logs">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-medium flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                        Sin errores - Funcionando correctamente
                      </CardTitle>
                      <Button variant={showLogFilters ? "default" : "outline"} size="sm" onClick={() => setShowLogFilters(!showLogFilters)}>
                        <Filter className="mr-2 h-3 w-3" />
                        Filtros
                        {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{activeFiltersCount}</Badge>}
                      </Button>
                    </div>

                    {showLogFilters && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        <div>
                          <Label className="text-xs font-medium mb-1 block">Buscar</Label>
                          <div className="relative">
                            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                            <Input placeholder="Buscar en mensajes..." value={tempFilters.search} onChange={(e) => setTempFilters({ ...tempFilters, search: e.target.value })} className="pl-7 h-8 text-xs" />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-medium mb-1 block">Tipo de evento</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: "success", label: "Éxito", color: "bg-emerald-500" },
                              { value: "error", label: "Error Infraestructura", color: "bg-red-500" },
                              { value: "warning", label: "Advertencia", color: "bg-amber-500" },
                              { value: "info", label: "Regla de Negocio", color: "bg-blue-500" },
                            ].map(type => (
                              <Button key={type.value} variant={tempFilters.types.includes(type.value) ? "default" : "outline"} size="sm" onClick={() => {
                                setTempFilters(prev => ({
                                  ...prev,
                                  types: prev.types.includes(type.value) ? prev.types.filter(t => t !== type.value) : [...prev.types, type.value]
                                }));
                              }} className="h-6 text-xs gap-1">
                                <div className={cn("w-2 h-2 rounded-full", type.color)} />
                                {type.label}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-medium mb-1 block">Rango de fechas</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal h-8 text-xs">
                                <CalendarIcon className="mr-2 h-3 w-3" />
                                {tempFilters.dateRange.from ? (
                                  tempFilters.dateRange.to ? (
                                    <>{format(tempFilters.dateRange.from, "dd/MM/yy")} - {format(tempFilters.dateRange.to, "dd/MM/yy")}</>
                                  ) : (format(tempFilters.dateRange.from, "dd/MM/yy"))
                                ) : (<span>Todas las fechas</span>)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="range" selected={tempFilters.dateRange} onSelect={(range) => setTempFilters({ ...tempFilters, dateRange: range || { from: undefined, to: undefined } })} numberOfMonths={2} locale={es} />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                          <Button variant="outline" size="sm" onClick={resetFilters} className="h-7 text-xs"><X className="mr-1 h-3 w-3" /> Limpiar todo</Button>
                          <Button size="sm" onClick={applyFilters} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"><Search className="mr-1 h-3 w-3" /> Aplicar filtros</Button>
                        </div>
                      </div>
                    )}

                    {activeFiltersCount > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
                        {appliedFilters.search && <Badge variant="secondary" className="text-[10px] gap-1"><Search className="h-2 w-2" /> {appliedFilters.search}<X className="h-2 w-2 cursor-pointer hover:text-red-500" onClick={() => { setTempFilters(prev => ({ ...prev, search: "" })); setAppliedFilters(prev => ({ ...prev, search: "" })); }} /></Badge>}
                        {appliedFilters.types.length < 4 && <Badge variant="secondary" className="text-[10px] gap-1">Tipo: {appliedFilters.types.map(t => t === "success" ? "Éxito" : t === "error" ? "Error Infraestructura" : t === "warning" ? "Advertencia" : "Regla de Negocio").join(", ")}<X className="h-2 w-2 cursor-pointer hover:text-red-500" onClick={() => { const resetTypes = ["success", "error", "warning", "info"]; setTempFilters(prev => ({ ...prev, types: resetTypes })); setAppliedFilters(prev => ({ ...prev, types: resetTypes })); }} /></Badge>}
                        {appliedFilters.dateRange.from && <Badge variant="secondary" className="text-[10px] gap-1">Fechas: {format(appliedFilters.dateRange.from, "dd/MM/yy")}{appliedFilters.dateRange.to && ` → ${format(appliedFilters.dateRange.to, "dd/MM/yy")}`}{!appliedFilters.dateRange.to && " → Actual"}<X className="h-2 w-2 cursor-pointer hover:text-red-500" onClick={() => { setTempFilters(prev => ({ ...prev, dateRange: { from: undefined, to: undefined } })); setAppliedFilters(prev => ({ ...prev, dateRange: { from: undefined, to: undefined } })); }} /></Badge>}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {filteredLogs.length > 0 ? (
                          filteredLogs.map((log) => (
                            <div key={log.id} className={cn("p-4 rounded-lg border transition-colors", getLogBgColor(log.type as LogEntry["type"]))}>
                              <div className="flex items-start gap-3">
                                {getLogIcon(log.type as LogEntry["type"])}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    {getLogBadge(log.type as LogEntry["type"])}
                                    <span className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</span>
                                  </div>
                                  <p className="font-medium text-foreground">{log.message}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No hay reglas de negocio que coincidan con los filtros</p>
                            <Button variant="link" size="sm" onClick={resetFilters} className="mt-2">Limpiar filtros</Button>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="description">
                <Card>
                  <CardHeader><CardTitle className="text-lg font-medium flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Información del Servicio</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div><h3 className="font-semibold text-foreground mb-2">Descripción</h3><p className="text-muted-foreground leading-relaxed">{displayDescription}</p></div>
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="bg-muted/30"><CardContent className="p-4"><div className="text-sm text-muted-foreground">Estado actual</div><div className="flex items-center gap-2 mt-1"><StatusIndicator status="success" errorPercentage={0} /></div></CardContent></Card>
                      <Card className="bg-muted/30"><CardContent className="p-4"><div className="text-sm text-muted-foreground">Total de clientes</div><div className="text-2xl font-bold text-foreground mt-1">{displayClients.length}</div></CardContent></Card>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="clients">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-lg font-medium flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Clientes con este servicio</CardTitle></CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {displayClients.map((client) => (
                          <div key={client.id} className={cn("p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md", selectedClient?.id === client.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")} onClick={() => handleOpenClientDashboard(client)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-white", "bg-emerald-500")}>{client.name.charAt(0)}</div>
                                <div><p className="font-semibold text-foreground">{client.name}</p><p className="text-sm text-muted-foreground">0% errores infraestructura</p></div>
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusIndicator status="success" errorPercentage={0} />
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
          </div>

          {/* Right side - SOLO Estadísticas */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Estadísticas</CardTitle>
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
              <CardContent className="space-y-4">
                {showStatsDateFilter && (
                  <div className="p-3 bg-muted/30 rounded-lg space-y-3 mb-2">
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
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Documentos</span>
                  <span className="font-semibold">{statsData.totalTransactions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">✅ Aprobados</span>
                  <span className="font-semibold text-emerald-600">{statsData.approvedCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">❌ Rechazados</span>
                  <span className="font-semibold text-red-500">{statsData.rejectedCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">⚠️ Manuales</span>
                  <span className="font-semibold text-amber-500">{statsData.manualCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">⏳ Pendientes</span>
                  <span className="font-semibold text-blue-500">{statsData.pendingCount.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">🔧 Errores Infraestructura</span>
                    <span className="font-semibold text-red-500">{statsData.infrastructureErrors.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground text-xs">Tasa error infraestructura</span>
                    <span className="font-semibold text-red-500 text-sm">{statsData.infrastructureErrorPercentage}%</span>
                  </div>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">📊 Uptime</span>
                    <span className="font-semibold text-emerald-600">{statsData.uptime}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground">🕐 Última actividad</span>
                    <span className="font-semibold text-xs">{statsData.lastActivity}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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