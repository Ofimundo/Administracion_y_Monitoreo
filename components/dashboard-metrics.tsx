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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, parseISO, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { services, generateMetricsData, type MetricDataPoint } from "@/lib/services-data";
import { useRouter } from "next/navigation";

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];

// Lista de errores TÉCNICOS de infraestructura
const ERRORES_INFRAESTRUCTURA = [
  "error de conexión", "timeout", "servidor no responde", "softland no disponible",
  "sii no responde", "connection failed", "failed to connect", "could not connect",
  "connection refused", "network error", "500", "503", "502", "504",
  "no se pudo conectar", "softland error", "sii error", "error de red",
  "socket hang up", "ECONNREFUSED", "ENOTFOUND", "error interno del servidor",
  "base de datos caída", "sql server no disponible", "el servicio rpa no responde"
];

const isInfraestructuraError = (motivo: string): boolean => {
  if (!motivo) return false;
  const motivoLower = motivo.toLowerCase();
  return ERRORES_INFRAESTRUCTURA.some(term => motivoLower.includes(term.toLowerCase()));
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

// Definición de campos disponibles para exportación
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

export function DashboardMetrics() {
  const router = useRouter();
  const [allData, setAllData] = useState<MetricDataPoint[]>([]);
  const [realInvoiceData, setRealInvoiceData] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modales
  const [showInternosModal, setShowInternosModal] = useState(false);
  const [showExternosModal, setShowExternosModal] = useState(false);
  const [showErroresModal, setShowErroresModal] = useState(false);
  
  // Modal de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );
  const [selectAll, setSelectAll] = useState(true);
  
  // FILTRO UNIFICADO - SIN FECHA PREDETERMINADA
  const [filters, setFilters] = useState({
    service: "todos",
    dateRange: { from: undefined as Date | undefined, to: undefined as Date | undefined },
    view: "todos" as "todos" | "daily" | "weekly" | "monthly",
    metric: "all" as "all" | "success" | "errors" | "rules",
  });

  const [showFilters, setShowFilters] = useState(false);

  const navigateToService = (serviceId: string) => {
    router.push(`/servicio/${serviceId}`);
  };

  // Cargar datos reales
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/facturas/bitacora?estado=todos");
        const data = await res.json();
        
        if (data.success && data.data) {
          setRealInvoiceData(data.data);
          
          const dailyStats: { [key: string]: any } = {};
          
          data.data.forEach((item: any) => {
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
    loadData();
  }, []);

  // Servicios disponibles
  const availableServices = useMemo(() => {
    const servicesSet = new Set(allData.map(item => item.serviceName));
    return Array.from(servicesSet).sort();
  }, [allData]);

  // Obtener lista de servicios reales
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

  // Servicios con errores de infraestructura
  const serviciosConErrores = useMemo(() => {
    return services.filter(s => s.errorPercentage > 0);
  }, []);

  // Estadísticas generales (TODOS los datos sin filtro de fecha)
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

  // Datos filtrados por SERVICIO y FECHA (si el usuario selecciona)
  const filteredData = useMemo(() => {
    let data = allData;
    
    // Filtrar por servicio
    if (filters.service !== "todos") {
      data = data.filter(d => d.serviceName === filters.service);
    }
    
    // Filtrar por rango de fechas SOLO si el usuario seleccionó fechas
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

  // Datos para el gráfico de evolución
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

  // Datos para el gráfico de distribución
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
  };

  // Abrir modal de exportación
  const handleOpenExportModal = () => {
    setShowExportModal(true);
  };

  // Toggle selección de todos los campos
  const handleToggleAllFields = () => {
    if (selectAll) {
      setSelectedFields([]);
    } else {
      setSelectedFields(EXPORT_FIELDS.map(f => f.id));
    }
    setSelectAll(!selectAll);
  };

  // Toggle selección de un campo individual
  const handleToggleField = (fieldId: string) => {
    setSelectedFields(prev => {
      const newSelection = prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId];
      
      setSelectAll(newSelection.length === EXPORT_FIELDS.length);
      return newSelection;
    });
  };

  // Exportar a Excel con campos seleccionados
  const handleExportToExcel = () => {
    if (selectedFields.length === 0) {
      alert("Por favor selecciona al menos un campo para exportar.");
      return;
    }

    const fieldMap: Record<string, (item: any) => any> = {
      fecha: (item) => item.date || format(new Date(), "dd/MM/yyyy"),
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

    // Determinar qué datos exportar
    let exportDataItems = [];
    if (filters.service !== "todos") {
      // Si hay un servicio específico, usar datos filtrados por servicio
      exportDataItems = filteredData;
    } else {
      // Si es "todos", agrupar por fecha
      const groupedByDate: Record<string, any> = {};
      filteredData.forEach(item => {
        const dateKey = format(item.date, "yyyy-MM-dd");
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = {
            date: dateKey,
            serviceName: "Todos los servicios",
            successCount: 0,
            errorCount: 0,
            reglaNegocioCount: 0,
            responseTime: 0,
            count: 0,
          };
        }
        groupedByDate[dateKey].successCount += item.successCount;
        groupedByDate[dateKey].errorCount += (item.errorCount || 0);
        groupedByDate[dateKey].reglaNegocioCount += (item.reglaNegocioCount || 0);
        groupedByDate[dateKey].responseTime += item.responseTime;
        groupedByDate[dateKey].count++;
      });
      // Calcular promedio de response time
      Object.values(groupedByDate).forEach((item: any) => {
        item.responseTime = Math.round(item.responseTime / (item.count || 1));
      });
      exportDataItems = Object.values(groupedByDate);
    }

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
    
    // Ajustar anchos de columna
    const colWidths = selectedFields.map(() => ({ wch: 25 }));
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard Metrics");
    
    // Resumen estadístico
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

  const MetricCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    color, 
    onClick,
    badge,
  }: { 
    title: string; 
    value: string | number; 
    subtitle: string; 
    icon: any; 
    color: string;
    onClick?: () => void;
    badge?: React.ReactNode;
  }) => (
    <Card 
      className={cn(
        "transition-all hover:shadow-lg",
        onClick && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        "border-l-4",
        color === "emerald" && "border-l-emerald-500",
        color === "red" && "border-l-red-500",
        color === "amber" && "border-l-amber-500",
        color === "blue" && "border-l-blue-500",
        color === "purple" && "border-l-purple-500",
        color === "cyan" && "border-l-cyan-500",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            {badge && <div className="mt-2">{badge}</div>}
          </div>
          <div className={cn(
            "p-3 rounded-full flex-shrink-0",
            color === "emerald" && "bg-emerald-100",
            color === "red" && "bg-red-100",
            color === "amber" && "bg-amber-100",
            color === "blue" && "bg-blue-100",
            color === "purple" && "bg-purple-100",
            color === "cyan" && "bg-cyan-100",
          )}>
            <Icon className={cn(
              "h-5 w-5",
              color === "emerald" && "text-emerald-600",
              color === "red" && "text-red-600",
              color === "amber" && "text-amber-600",
              color === "blue" && "text-blue-600",
              color === "purple" && "text-purple-600",
              color === "cyan" && "text-cyan-600",
            )} />
          </div>
        </div>
        {onClick && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            <span>Click para ver detalles</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );

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
      {/* INDICADORES CLAVE - AHORA EN LA PARTE SUPERIOR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Tasa Éxito"
          value={`${globalStats.successRate}%`}
          subtitle={`${globalStats.totalSuccess.toLocaleString()} exitosas`}
          icon={TrendingUp}
          color="emerald"
        />

        <MetricCard
          title="Errores Infraestructura"
          value={globalStats.totalInfraErrors}
          subtitle={`${globalStats.errorRate}% del total`}
          icon={AlertCircle}
          color="red"
          onClick={() => setShowErroresModal(true)}
          badge={
            <Badge variant="outline" className="text-[10px] gap-1">
              <List className="h-3 w-3" />
              Ver servicios con errores
            </Badge>
          }
        />

        <MetricCard
          title="Sistemas Internos"
          value={globalStats.sistemasInternos}
          subtitle="Servicios propios"
          icon={Server}
          color="purple"
          onClick={() => setShowInternosModal(true)}
          badge={
            <Badge variant="outline" className="text-[10px] gap-1">
              <List className="h-3 w-3" />
              Ver lista
            </Badge>
          }
        />

        <MetricCard
          title="Sistemas Externos"
          value={globalStats.sistemasExternos}
          subtitle="Integraciones"
          icon={Globe}
          color="cyan"
          onClick={() => setShowExternosModal(true)}
          badge={
            <Badge variant="outline" className="text-[10px] gap-1">
              <List className="h-3 w-3" />
              Ver lista
            </Badge>
          }
        />
      </div>

      {/* Barra de acciones superior (filtros) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <div className="flex items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Filtros</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showFilters && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-3 pt-3 border-t space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1 block">Servicio</Label>
                  <Select 
                    value={filters.service} 
                    onValueChange={(v) => setFilters({ ...filters, service: v })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">🌐 Todos</SelectItem>
                      {availableServices.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1 block">Período</Label>
                  <Select 
                    value={filters.view} 
                    onValueChange={(v: any) => setFilters({ ...filters, view: v })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">📊 Todos</SelectItem>
                      <SelectItem value="daily">📅 Diario</SelectItem>
                      <SelectItem value="weekly">📊 Semanal</SelectItem>
                      <SelectItem value="monthly">📈 Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1 block">Métrica</Label>
                  <Select 
                    value={filters.metric} 
                    onValueChange={(v: any) => setFilters({ ...filters, metric: v })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">📊 Todas</SelectItem>
                      <SelectItem value="success">✅ Exitosas</SelectItem>
                      <SelectItem value="errors">❌ Errores</SelectItem>
                      <SelectItem value="rules">⚠️ Reglas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1 block">Rango de Fechas</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={cn(
                          "w-full justify-start text-left h-8 text-sm",
                          !filters.dateRange.from && !filters.dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {filters.dateRange.from ? (
                          filters.dateRange.to ? (
                            `${format(filters.dateRange.from, "dd/MM/yy")} - ${format(filters.dateRange.to, "dd/MM/yy")}`
                          ) : format(filters.dateRange.from, "dd/MM/yy")
                        ) : (
                          "Seleccionar fechas"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={filters.dateRange}
                        onSelect={(range) => setFilters({ 
                          ...filters, 
                          dateRange: range || { from: undefined, to: undefined } 
                        })}
                        numberOfMonths={2}
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {filters.dateRange.from || filters.dateRange.to ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFilters({ ...filters, dateRange: { from: undefined, to: undefined } })}
                    className="h-7 text-xs text-blue-500"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Limpiar fechas
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs text-red-500">
                  <X className="h-3 w-3 mr-1" />
                  Limpiar todos
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenExportModal}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* GRÁFICOS AL MISMO NIVEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Evolución Temporal */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolución Temporal</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{filters.service === "todos" ? "Todos los servicios" : filters.service}</span>
              <span>·</span>
              <span>
                {filters.view === "todos" ? "Todos los períodos" : 
                 filters.view === "daily" ? "Diario" : 
                 filters.view === "weekly" ? "Semanal" : "Mensual"}
              </span>
              {filters.dateRange.from && filters.dateRange.to && (
                <>
                  <span>·</span>
                  <span className="text-emerald-600">
                    {format(filters.dateRange.from, "dd/MM/yy")} - {format(filters.dateRange.to, "dd/MM/yy")}
                  </span>
                </>
              )}
              {!filters.dateRange.from && !filters.dateRange.to && (
                <>
                  <span>·</span>
                  <span className="text-muted-foreground/60">Todos los datos</span>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[300px]">
              {evolutionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evolutionChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      interval={evolutionChartData.length > 10 ? Math.floor(evolutionChartData.length / 8) : 0}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                      formatter={(value: any, name: string) => {
                        const labels: Record<string, string> = {
                          exitosas: '✅ Exitosas',
                          reglasNegocio: '⚠️ Reglas de Negocio',
                          erroresInfraestructura: '❌ Errores Infraestructura'
                        };
                        return [value, labels[name] || name];
                      }}
                    />
                    
                    {(filters.metric === "all" || filters.metric === "success") && (
                      <Line 
                        type="monotone" 
                        dataKey="exitosas" 
                        stroke="#10b981" 
                        name="Exitosas" 
                        strokeWidth={2.5} 
                        dot={{ r: 3, fill: "#10b981" }}
                        activeDot={{ r: 5 }}
                      />
                    )}
                    
                    {(filters.metric === "all" || filters.metric === "rules") && (
                      <Line 
                        type="monotone" 
                        dataKey="reglasNegocio" 
                        stroke="#f59e0b" 
                        name="Reglas de Negocio" 
                        strokeWidth={2} 
                        strokeDasharray="6 3"
                        dot={{ r: 3, fill: "#f59e0b" }}
                      />
                    )}
                    
                    {(filters.metric === "all" || filters.metric === "errors") && (
                      <Line 
                        type="monotone" 
                        dataKey="erroresInfraestructura" 
                        stroke="#ef4444" 
                        name="Errores Infraestructura" 
                        strokeWidth={2} 
                        strokeDasharray="3 3"
                        dot={{ r: 3, fill: "#ef4444" }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {filters.dateRange.from && filters.dateRange.to ? (
                    <div className="text-center">
                      <p>No hay datos en el rango seleccionado</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Prueba con un rango de fechas diferente
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p>No hay datos disponibles</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Selecciona un rango de fechas para ver los datos
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Leyenda compacta */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-4 h-0.5 bg-emerald-500" />
                <span className="text-emerald-700">Exitosas</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-0.5 bg-amber-500 border-t border-dashed border-amber-500" />
                <span className="text-amber-700">Reglas</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-0.5 bg-red-500 border-t border-dotted border-red-500" />
                <span className="text-red-700">Errores</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 2: Distribución */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribución de Peticiones</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{filters.service === "todos" ? "Todos los servicios" : filters.service}</span>
              {filters.dateRange.from && filters.dateRange.to && (
                <>
                  <span>·</span>
                  <span className="text-emerald-600">
                    {format(filters.dateRange.from, "dd/MM/yy")} - {format(filters.dateRange.to, "dd/MM/yy")}
                  </span>
                </>
              )}
              {!filters.dateRange.from && !filters.dateRange.to && (
                <>
                  <span>·</span>
                  <span className="text-muted-foreground/60">Todos los datos</span>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[300px]">
              {distributionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      outerRadius={90}
                      dataKey="value"
                    >
                      {distributionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                      formatter={(value: any) => [value.toLocaleString(), 'Cantidad']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {filters.dateRange.from && filters.dateRange.to ? (
                    <div className="text-center">
                      <p>No hay datos en el rango seleccionado</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Prueba con un rango de fechas diferente
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p>No hay datos disponibles</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Selecciona un rango de fechas para ver los datos
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Resumen compacto */}
            {distributionChartData.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[10px]">
                {distributionChartData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}:</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1 text-blue-600">
                  <span>Total:</span>
                  <span className="font-medium">
                    {distributionChartData.reduce((sum, d) => sum + d.value, 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Errores */}
      <Dialog open={showErroresModal} onOpenChange={setShowErroresModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Servicios con Errores de Infraestructura
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Servicios que presentan errores técnicos ({serviciosConErrores.length})
            </p>
            {serviciosConErrores.length > 0 ? (
              serviciosConErrores.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border-l-4 border-l-red-500"
                  onClick={() => {
                    setShowErroresModal(false);
                    navigateToService(service.id);
                  }}
                >
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.errorPercentage}% de errores técnicos
                    </p>
                  </div>
                  <Badge variant="outline" className="gap-1 bg-red-50 text-red-600 border-red-200">
                    <ExternalLink className="h-3 w-3" />
                    Ver
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <p>No hay servicios con errores de infraestructura</p>
                <p className="text-xs">Todos los servicios están funcionando correctamente</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Sistemas Internos */}
      <Dialog open={showInternosModal} onOpenChange={setShowInternosModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-purple-500" />
              Sistemas Internos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Servicios internos del sistema ({serviciosInternos.length})
            </p>
            {serviciosInternos.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => {
                  setShowInternosModal(false);
                  navigateToService(service.id);
                }}
              >
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">{service.description}</p>
                </div>
                <Badge variant="outline" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Ver
                </Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Sistemas Externos */}
      <Dialog open={showExternosModal} onOpenChange={setShowExternosModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-cyan-500" />
              Sistemas Externos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Integraciones con sistemas externos ({serviciosExternos.length})
            </p>
            {serviciosExternos.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => {
                  setShowExternosModal(false);
                  navigateToService(service.id);
                }}
              >
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">{service.description}</p>
                </div>
                <Badge variant="outline" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Ver
                </Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Exportación con selección de campos */}
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