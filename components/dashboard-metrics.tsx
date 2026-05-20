// app/components/dashboard-metrics.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Calendar as CalendarIcon,
  Filter,
  Download,
  RefreshCw,
  FileSpreadsheet,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { services, generateMetricsData, type MetricDataPoint } from "@/lib/services-data";

// Valores por defecto de los filtros
const DEFAULT_FILTERS = {
  dateRange: { from: subDays(new Date(), 30), to: new Date() },
  services: [] as string[],
  minSuccessRate: 0,
  maxResponseTime: 1000,
  status: ["success", "warning", "error"] as ("success" | "warning" | "error")[],
};

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];

// Lista de errores TÉCNICOS de infraestructura (NO reglas de negocio)
const ERRORES_INFRAESTRUCTURA = [
  "error de conexión", "timeout", "servidor no responde", "softland no disponible",
  "sii no responde", "connection failed", "failed to connect", "could not connect",
  "connection refused", "network error", "500", "503", "502", "504",
  "no se pudo conectar", "softland error", "sii error", "error de red",
  "socket hang up", "ECONNREFUSED", "ENOTFOUND", "error interno del servidor",
  "base de datos caída", "sql server no disponible", "el servicio rpa no responde"
];

// Función para detectar si un motivo es error de infraestructura
const isInfraestructuraError = (motivo: string): boolean => {
  if (!motivo) return false;
  const motivoLower = motivo.toLowerCase();
  return ERRORES_INFRAESTRUCTURA.some(term => motivoLower.includes(term.toLowerCase()));
};

// Interfaz para datos reales de facturas
interface InvoiceData {
  fecha_proceso: string;
  estado: string;
  tipo_documento: number;
  folio_documento: number;
  rut_proveedor: string;
  razon_social: string;
  motivo: string;
}

export function DashboardMetrics() {
  const [allData, setAllData] = useState<MetricDataPoint[]>([]);
  const [realInvoiceData, setRealInvoiceData] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showServiceList, setShowServiceList] = useState(false);
  const [searchService, setSearchService] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<"requests" | "errors" | "responseTime" | "throughput">("requests");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>("todos");

  // Obtener lista de servicios reales
  const availableServices = useMemo(() => {
    return services.map(s => s.name).sort();
  }, []);

  // Cargar datos reales de facturas y datos generales
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/facturas/bitacora?estado=todos");
        const data = await res.json();
        
        if (data.success && data.data) {
          setRealInvoiceData(data.data);
          
          // Calcular estadísticas diarias SOLO con errores de infraestructura
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
              errorCount: stats.erroresInfraestructura, // SOLO errores de infraestructura
              reglaNegocioCount: stats.rechazadasReglaNegocio + stats.manualesReglaNegocio, // Reglas de negocio
              responseTime: 300 + Math.floor(Math.random() * 100),
              throughput: Math.floor(stats.total / 24),
              serviceName: "Aceptación y Rechazo de Facturas",
              endpoint: "/api/facturas/bitacora",
            });
          });
          
          // Combinar con datos simulados de otros servicios
          const simulatedData = generateMetricsData();
          const otherServicesData = simulatedData.filter(s => s.serviceName !== "Aceptación y Rechazo de Facturas");
          
          setAllData([...metricsData, ...otherServicesData]);
        } else {
          setAllData(generateMetricsData());
        }
      } catch (error) {
        console.error("Error cargando datos:", error);
        setAllData(generateMetricsData());
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Datos filtrados por servicio seleccionado
  const filteredByService = useMemo(() => {
    if (selectedServiceFilter === "todos") {
      return allData;
    }
    return allData.filter(item => item.serviceName === selectedServiceFilter);
  }, [allData, selectedServiceFilter]);

  // Servicios disponibles para el selector (con datos reales)
  const availableServicesWithData = useMemo(() => {
    const servicesWithData = new Set(allData.map(item => item.serviceName));
    return Array.from(servicesWithData).sort();
  }, [allData]);

  // Datos específicos para facturas (si está seleccionado)
  const invoiceChartData = useMemo(() => {
    if (selectedServiceFilter !== "todos" && selectedServiceFilter !== "Aceptación y Rechazo de Facturas") {
      return [];
    }
    if (realInvoiceData.length === 0) return [];
    
    const dailyData: { [key: string]: any } = {};
    
    realInvoiceData.forEach(item => {
      const fecha = item.fecha_proceso.split('T')[0];
      const motivo = item.motivo || "";
      const esErrorInfra = isInfraestructuraError(motivo);
      
      if (!dailyData[fecha]) {
        dailyData[fecha] = {
          fecha: format(parseISO(fecha), "dd/MM"),
          aprobadas: 0,
          reglasNegocio: 0,
          erroresInfraestructura: 0,
          pendientes: 0,
        };
      }
      
      if (item.estado === "Aprobado") {
        dailyData[fecha].aprobadas++;
      } else if (item.estado === "Rechazado" || item.estado === "Manual") {
        if (esErrorInfra) {
          dailyData[fecha].erroresInfraestructura++;
        } else {
          dailyData[fecha].reglasNegocio++;
        }
      } else {
        dailyData[fecha].pendientes++;
      }
    });
    
    return Object.values(dailyData).sort((a, b) => {
      const [dayA, monthA] = a.fecha.split('/');
      const [dayB, monthB] = b.fecha.split('/');
      return new Date(2024, parseInt(monthA) - 1, parseInt(dayA)).getTime() - 
             new Date(2024, parseInt(monthB) - 1, parseInt(dayB)).getTime();
    }).slice(-30);
  }, [realInvoiceData, selectedServiceFilter]);

  // Calcular estadísticas reales de facturas (separando errores técnicos de reglas de negocio)
  const invoiceStats = useMemo(() => {
    if (selectedServiceFilter !== "todos" && selectedServiceFilter !== "Aceptación y Rechazo de Facturas") {
      return null;
    }
    
    const total = realInvoiceData.length;
    const aprobadas = realInvoiceData.filter(i => i.estado === "Aprobado").length;
    const pendientes = realInvoiceData.filter(i => i.estado === "Pendiente" || i.estado === "Pendiente Espera").length;
    
    // Separar reglas de negocio de errores de infraestructura
    const reglasNegocio = realInvoiceData.filter(i => {
      if (i.estado === "Rechazado" || i.estado === "Manual") {
        return !isInfraestructuraError(i.motivo || "");
      }
      return false;
    }).length;
    
    const erroresInfraestructura = realInvoiceData.filter(i => {
      return isInfraestructuraError(i.motivo || "");
    }).length;
    
    const tasaExito = total > 0 ? (aprobadas / total) * 100 : 0;
    const tasaErrorInfraestructura = total > 0 ? (erroresInfraestructura / total) * 100 : 0;
    
    return {
      total,
      aprobadas,
      reglasNegocio,
      erroresInfraestructura,
      pendientes,
      tasaExito: tasaExito.toFixed(1),
      tasaErrorInfraestructura: tasaErrorInfraestructura.toFixed(1),
    };
  }, [realInvoiceData, selectedServiceFilter]);

  // Calcular estadísticas generales del servicio seleccionado (SOLO errores de infraestructura)
  const serviceStats = useMemo(() => {
    const totalSuccess = filteredByService.reduce((sum, d) => sum + d.successCount, 0);
    const totalInfraErrors = filteredByService.reduce((sum, d) => sum + (d.errorCount || 0), 0);
    const totalReglasNegocio = filteredByService.reduce((sum, d) => sum + (d.reglaNegocioCount || 0), 0);
    const avgResponseTime = filteredByService.reduce((sum, d) => sum + d.responseTime, 0) / (filteredByService.length || 1);
    const avgThroughput = filteredByService.reduce((sum, d) => sum + d.throughput, 0) / (filteredByService.length || 1);
    const totalRequests = totalSuccess + totalInfraErrors + totalReglasNegocio;
    const errorRateInfra = totalRequests > 0 ? (totalInfraErrors / totalRequests) * 100 : 0;
    
    return {
      totalRequests,
      totalSuccess,
      totalInfraErrors,
      totalReglasNegocio,
      avgResponseTime: Math.round(avgResponseTime),
      avgThroughput: Math.round(avgThroughput),
      errorRateInfra: errorRateInfra.toFixed(2),
    };
  }, [filteredByService]);

  // Datos para gráficos
  const chartData = useMemo(() => {
    if (selectedServiceFilter === "Aceptación y Rechazo de Facturas" && invoiceChartData.length > 0) {
      return invoiceChartData.map(item => ({
        date: item.fecha,
        exitosas: item.aprobadas,
        reglasNegocio: item.reglasNegocio,
        erroresInfraestructura: item.erroresInfraestructura,
        pendientes: item.pendientes,
      }));
    }
    
    const groupedByDate = filteredByService.reduce((acc, d) => {
      const dateKey = format(d.date, "yyyy-MM-dd");
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: format(d.date, "dd/MM"),
          exitosas: 0,
          erroresInfraestructura: 0,
          reglasNegocio: 0,
          count: 0,
        };
      }
      acc[dateKey].exitosas += d.successCount;
      acc[dateKey].erroresInfraestructura += (d.errorCount || 0);
      acc[dateKey].reglasNegocio += (d.reglaNegocioCount || 0);
      acc[dateKey].count++;
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(groupedByDate).map(item => ({
      date: item.date,
      exitosas: item.exitosas,
      erroresInfraestructura: item.erroresInfraestructura,
      reglasNegocio: item.reglasNegocio,
    })).sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      return new Date(2024, parseInt(monthA) - 1, parseInt(dayA)).getTime() - 
             new Date(2024, parseInt(monthB) - 1, parseInt(dayB)).getTime();
    });
  }, [filteredByService, invoiceChartData, selectedServiceFilter]);

  const pieData = useMemo(() => {
    if (selectedServiceFilter === "Aceptación y Rechazo de Facturas" && invoiceStats) {
      return [
        { name: "Exitosas", value: invoiceStats.aprobadas, color: COLORS[0] },
        { name: "Reglas de Negocio", value: invoiceStats.reglasNegocio, color: COLORS[2] },
        { name: "Errores Infraestructura", value: invoiceStats.erroresInfraestructura, color: COLORS[1] },
        { name: "Pendientes", value: invoiceStats.pendientes, color: COLORS[3] },
      ].filter(item => item.value > 0);
    }
    
    return [
      { name: "Exitosas", value: serviceStats.totalSuccess, color: COLORS[0] },
      { name: "Reglas de Negocio", value: serviceStats.totalReglasNegocio, color: COLORS[2] },
      { name: "Errores Infraestructura", value: serviceStats.totalInfraErrors, color: COLORS[1] },
    ].filter(item => item.value > 0);
  }, [selectedServiceFilter, invoiceStats, serviceStats]);

  // Servicios filtrados por búsqueda
  const filteredServicesList = useMemo(() => {
    if (!searchService) return availableServicesWithData;
    return availableServicesWithData.filter(service => 
      service.toLowerCase().includes(searchService.toLowerCase())
    );
  }, [availableServicesWithData, searchService]);

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedServiceFilter !== "todos") count++;
    if (filters.minSuccessRate > 0) count++;
    if (filters.maxResponseTime < 1000) count++;
    return count;
  }, [filters, selectedServiceFilter]);

  // Resetear filtros
  const resetFilters = () => {
    setFilters({
      dateRange: { from: subDays(new Date(), 30), to: new Date() },
      services: [],
      minSuccessRate: 0,
      maxResponseTime: 1000,
      status: ["success", "warning", "error"],
    });
    setSelectedServiceFilter("todos");
    setSearchService("");
  };

  // Exportar a Excel
  const exportToExcel = () => {
    let excelData: any[] = [];
    
    if (selectedServiceFilter === "Aceptación y Rechazo de Facturas" && realInvoiceData.length > 0) {
      excelData = realInvoiceData.map(item => ({
        "Fecha": format(parseISO(item.fecha_proceso), "dd/MM/yyyy HH:mm"),
        "Tipo Documento": item.tipo_documento === 33 ? "Factura (33)" : item.tipo_documento === 34 ? "Factura Exenta (34)" : "Nota Crédito (61)",
        "Folio": item.folio_documento,
        "RUT Proveedor": item.rut_proveedor,
        "Razón Social": item.razon_social,
        "Estado": item.estado,
        "Tipo": isInfraestructuraError(item.motivo || "") ? "❌ Error Infraestructura" : (item.estado === "Rechazado" || item.estado === "Manual" ? "⚠️ Regla de Negocio" : "📋 Normal"),
        "Motivo": item.motivo || "-",
      }));
    } else {
      excelData = filteredByService.map(item => ({
        "Fecha": format(item.date, "dd/MM/yyyy"),
        "Servicio": item.serviceName,
        "Exitosas": item.successCount,
        "Errores Infraestructura": item.errorCount || 0,
        "Reglas de Negocio": item.reglaNegocioCount || 0,
        "Tiempo Respuesta (ms)": item.responseTime,
      }));
    }

    const summaryData = [
      { "Métrica": "Servicio Seleccionado", "Valor": selectedServiceFilter === "todos" ? "Todos los servicios" : selectedServiceFilter, "Unidad": "" },
      { "Métrica": "Total Peticiones", "Valor": serviceStats.totalRequests, "Unidad": "peticiones" },
      { "Métrica": "Exitosas", "Valor": serviceStats.totalSuccess, "Unidad": "peticiones" },
      { "Métrica": "Reglas de Negocio", "Valor": serviceStats.totalReglasNegocio, "Unidad": "peticiones" },
      { "Métrica": "Errores Infraestructura", "Valor": serviceStats.totalInfraErrors, "Unidad": "peticiones" },
      { "Métrica": "Tasa Error Infraestructura", "Valor": `${serviceStats.errorRateInfra}%`, "Unidad": "porcentaje" },
      { "Métrica": "Tiempo Respuesta Promedio", "Valor": serviceStats.avgResponseTime, "Unidad": "ms" },
    ];

    const wb = XLSX.utils.book_new();
    const wsData = XLSX.utils.json_to_sheet(excelData);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    XLSX.utils.book_append_sheet(wb, wsData, "Datos Detallados");
    
    const fileName = `dashboard_metrics_${selectedServiceFilter}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

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
      {/* Barra de filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFiltersCount} activo{activeFiltersCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </Button>
              
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Limpiar todos los filtros
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar a Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Panel de filtros */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Servicio</Label>
                  <Select value={selectedServiceFilter} onValueChange={setSelectedServiceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">🌐 Todos los servicios</SelectItem>
                      {availableServicesWithData.map(service => (
                        <SelectItem key={service} value={service}>
                          {service}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Tasa de éxito mínima: {filters.minSuccessRate}%
                  </Label>
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={filters.minSuccessRate}
                    onChange={(e) => setFilters({ ...filters, minSuccessRate: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Tiempo máximo respuesta: {filters.maxResponseTime}ms
                  </Label>
                  <Input
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={filters.maxResponseTime}
                    onChange={(e) => setFilters({ ...filters, maxResponseTime: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <div className="flex justify-end pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <X className="mr-2 h-4 w-4" />
                    Limpiar todos los filtros ({activeFiltersCount})
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Indicadores de filtros activos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center p-3 bg-muted/30 rounded-lg">
          <span className="text-sm font-medium text-muted-foreground">Filtros aplicados:</span>
          {selectedServiceFilter !== "todos" && (
            <Badge variant="secondary">Servicio: {selectedServiceFilter}</Badge>
          )}
          {filters.minSuccessRate > 0 && (
            <Badge variant="secondary">Éxito ≥ {filters.minSuccessRate}%</Badge>
          )}
          {filters.maxResponseTime < 1000 && (
            <Badge variant="secondary">Respuesta ≤ {filters.maxResponseTime}ms</Badge>
          )}
          <span className="text-sm text-muted-foreground ml-auto">
            Mostrando datos de {selectedServiceFilter === "todos" ? "todos los servicios" : selectedServiceFilter}
          </span>
        </div>
      )}

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Peticiones</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceStats.totalRequests.toLocaleString()}</div>
            <div className="flex gap-2 text-xs mt-1">
              <span className="text-emerald-600">✓ Exitosas: {serviceStats.totalSuccess.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasa Error Infraestructura</CardTitle>
            <TrendingDown className={cn("h-4 w-4", parseFloat(serviceStats.errorRateInfra) > 10 ? "text-red-500" : "text-yellow-500")} />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              parseFloat(serviceStats.errorRateInfra) > 10 ? "text-red-500" : parseFloat(serviceStats.errorRateInfra) > 5 ? "text-yellow-500" : "text-green-500"
            )}>
              {serviceStats.errorRateInfra}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">{serviceStats.totalInfraErrors} errores técnicos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reglas de Negocio</CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{serviceStats.totalReglasNegocio.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Decisiones de negocio (no son errores)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Respuesta</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceStats.avgResponseTime} ms</div>
            <p className="text-xs text-muted-foreground mt-1">Promedio del período</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <Tabs defaultValue="line" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="line">📈 Evolución</TabsTrigger>
          <TabsTrigger value="bar">📊 Barras</TabsTrigger>
          <TabsTrigger value="area">📉 Área</TabsTrigger>
          <TabsTrigger value="pie">🥧 Distribución</TabsTrigger>
        </TabsList>

        <TabsContent value="line">
          <Card>
            <CardHeader>
              <CardTitle>Evolución Temporal</CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedServiceFilter === "todos" ? "Todos los servicios" : selectedServiceFilter}
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="exitosas" stroke="#10b981" name="Exitosas" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="reglasNegocio" stroke="#f59e0b" name="Reglas de Negocio" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="erroresInfraestructura" stroke="#ef4444" name="Errores Infraestructura" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bar">
          <Card>
            <CardHeader>
              <CardTitle>Comparativa por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="exitosas" fill="#10b981" name="Exitosas" radius={[4,4,0,0]} />
                    <Bar dataKey="reglasNegocio" fill="#f59e0b" name="Reglas de Negocio" radius={[4,4,0,0]} />
                    <Bar dataKey="erroresInfraestructura" fill="#ef4444" name="Errores Infraestructura" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="area">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia Acumulada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="erroresInfraestructura" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Errores Infraestructura" />
                    <Area type="monotone" dataKey="reglasNegocio" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Reglas de Negocio" />
                    <Area type="monotone" dataKey="exitosas" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Exitosas" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pie">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Peticiones</CardTitle>
                <p className="text-sm text-muted-foreground">Total: {serviceStats.totalRequests.toLocaleString()} peticiones</p>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  * Las reglas de negocio NO son errores técnicos, son decisiones del negocio
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen de Métricas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <span className="font-medium">✅ Exitosas</span>
                    <Badge className="bg-emerald-500 text-white text-lg px-3 py-1">
                      {serviceStats.totalSuccess.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <span className="font-medium">⚠️ Reglas de Negocio</span>
                    <Badge className="bg-amber-500 text-white text-lg px-3 py-1">
                      {serviceStats.totalReglasNegocio.toLocaleString()}
                    </Badge>
                    <p className="text-xs text-muted-foreground">No afectan la estabilidad</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="font-medium">❌ Errores Infraestructura</span>
                    <Badge className="bg-red-500 text-white text-lg px-3 py-1">
                      {serviceStats.totalInfraErrors.toLocaleString()}
                    </Badge>
                    <p className="text-xs text-muted-foreground">Problemas técnicos reales</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="font-medium">⚡ Tiempo Respuesta Promedio</span>
                    <Badge className="bg-blue-500 text-white text-lg px-3 py-1">
                      {serviceStats.avgResponseTime} ms
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}