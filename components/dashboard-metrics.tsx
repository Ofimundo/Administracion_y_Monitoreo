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
import { format, subDays } from "date-fns";
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

export function DashboardMetrics() {
  const [allData, setAllData] = useState<MetricDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showServiceList, setShowServiceList] = useState(false);
  const [searchService, setSearchService] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<"requests" | "errors" | "responseTime" | "throughput">("requests");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Obtener lista de servicios reales
  const availableServices = useMemo(() => {
    return services.map(s => s.name).sort();
  }, []);

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setTimeout(() => {
        setAllData(generateMetricsData());
        setLoading(false);
      }, 500);
    };
    loadData();
  }, []);

  // Servicios filtrados por búsqueda
  const filteredServicesList = useMemo(() => {
    if (!searchService) return availableServices;
    return availableServices.filter(service => 
      service.toLowerCase().includes(searchService.toLowerCase())
    );
  }, [availableServices, searchService]);

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    
    // Verificar si el rango de fechas es diferente al default
    const defaultFrom = DEFAULT_FILTERS.dateRange.from;
    const defaultTo = DEFAULT_FILTERS.dateRange.to;
    const currentFrom = filters.dateRange.from;
    const currentTo = filters.dateRange.to;
    
    if (currentFrom && defaultFrom && currentFrom.getTime() !== defaultFrom.getTime()) {
      count++;
    } else if (currentTo && defaultTo && currentTo.getTime() !== defaultTo.getTime()) {
      count++;
    }
    
    if (filters.services.length > 0) count++;
    if (filters.minSuccessRate > 0) count++;
    if (filters.maxResponseTime < 1000) count++;
    if (filters.status.length < 3) count++;
    
    return count;
  }, [filters]);

  // Aplicar filtros a los datos
  const filteredData = useMemo(() => {
    let result = [...allData];
    
    if (filters.dateRange.from && filters.dateRange.to) {
      result = result.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= filters.dateRange.from! && itemDate <= filters.dateRange.to!;
      });
    }
    
    if (filters.services.length > 0) {
      result = result.filter(item => filters.services.includes(item.serviceName));
    }
    
    if (filters.minSuccessRate > 0) {
      result = result.filter(item => {
        const successRate = (item.successCount / (item.successCount + item.errorCount)) * 100;
        return successRate >= filters.minSuccessRate;
      });
    }
    
    if (filters.maxResponseTime < 1000) {
      result = result.filter(item => item.responseTime <= filters.maxResponseTime);
    }
    
    if (filters.status.length < 3) {
      result = result.filter(item => {
        const serviceInfo = services.find(s => s.name === item.serviceName);
        const status = serviceInfo?.status || "success";
        return filters.status.includes(status);
      });
    }
    
    return result;
  }, [allData, filters]);

  // Calcular estadísticas
  const statistics = useMemo(() => {
    const totalSuccess = filteredData.reduce((sum, d) => sum + d.successCount, 0);
    const totalErrors = filteredData.reduce((sum, d) => sum + d.errorCount, 0);
    const avgResponseTime = filteredData.reduce((sum, d) => sum + d.responseTime, 0) / (filteredData.length || 1);
    const avgThroughput = filteredData.reduce((sum, d) => sum + d.throughput, 0) / (filteredData.length || 1);
    const errorRate = totalSuccess + totalErrors > 0 ? (totalErrors / (totalSuccess + totalErrors)) * 100 : 0;
    
    const byService = filteredData.reduce((acc, d) => {
      if (!acc[d.serviceName]) {
        acc[d.serviceName] = { success: 0, errors: 0, responseTime: 0, count: 0 };
      }
      acc[d.serviceName].success += d.successCount;
      acc[d.serviceName].errors += d.errorCount;
      acc[d.serviceName].responseTime += d.responseTime;
      acc[d.serviceName].count++;
      return acc;
    }, {} as Record<string, { success: number; errors: number; responseTime: number; count: number }>);
    
    return {
      totalRequests: totalSuccess + totalErrors,
      totalSuccess,
      totalErrors,
      avgResponseTime: Math.round(avgResponseTime),
      avgThroughput: Math.round(avgThroughput),
      errorRate: errorRate.toFixed(2),
      byService,
    };
  }, [filteredData]);

  // Datos para gráficos
  const chartData = useMemo(() => {
    const groupedByDate = filteredData.reduce((acc, d) => {
      const dateKey = format(d.date, "yyyy-MM-dd");
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          success: 0,
          errors: 0,
          responseTime: 0,
          throughput: 0,
          count: 0,
        };
      }
      acc[dateKey].success += d.successCount;
      acc[dateKey].errors += d.errorCount;
      acc[dateKey].responseTime += d.responseTime;
      acc[dateKey].throughput += d.throughput;
      acc[dateKey].count++;
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(groupedByDate).map(item => ({
      date: format(new Date(item.date), "dd/MM"),
      success: item.success,
      errors: item.errors,
      responseTime: Math.round(item.responseTime / item.count),
      throughput: Math.round(item.throughput / item.count),
    })).sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      return new Date(2024, parseInt(monthA) - 1, parseInt(dayA)).getTime() - 
             new Date(2024, parseInt(monthB) - 1, parseInt(dayB)).getTime();
    });
  }, [filteredData]);

  const pieData = [
    { name: "Exitosas", value: statistics.totalSuccess, color: COLORS[0] },
    { name: "Con Error", value: statistics.totalErrors, color: COLORS[1] },
  ];

  // Resetear filtros
  const resetFilters = () => {
    setFilters({
      dateRange: { from: subDays(new Date(), 30), to: new Date() },
      services: [],
      minSuccessRate: 0,
      maxResponseTime: 1000,
      status: ["success", "warning", "error"],
    });
    setSearchService("");
  };

  const toggleService = (service: string) => {
    setFilters(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const toggleAllServices = () => {
    if (filters.services.length === availableServices.length) {
      setFilters(prev => ({ ...prev, services: [] }));
    } else {
      setFilters(prev => ({ ...prev, services: [...availableServices] }));
    }
  };

  // Exportar a Excel
  const exportToExcel = () => {
    const excelData = filteredData.map(item => ({
      "Fecha": format(item.date, "dd/MM/yyyy HH:mm:ss"),
      "Servicio": item.serviceName,
      "Endpoint": item.endpoint,
      "Peticiones Exitosas": item.successCount,
      "Peticiones con Error": item.errorCount,
      "Total Peticiones": item.successCount + item.errorCount,
      "Tasa de Éxito": `${((item.successCount / (item.successCount + item.errorCount)) * 100).toFixed(2)}%`,
      "Tiempo Respuesta (ms)": item.responseTime,
      "Throughput (req/s)": item.throughput,
    }));

    const summaryData = [
      { "Métrica": "Total Peticiones", "Valor": statistics.totalRequests, "Unidad": "peticiones" },
      { "Métrica": "Total Exitosas", "Valor": statistics.totalSuccess, "Unidad": "peticiones" },
      { "Métrica": "Total Errores", "Valor": statistics.totalErrors, "Unidad": "peticiones" },
      { "Métrica": "Tasa de Error", "Valor": `${statistics.errorRate}%`, "Unidad": "porcentaje" },
      { "Métrica": "Tiempo Respuesta Promedio", "Valor": statistics.avgResponseTime, "Unidad": "ms" },
      { "Métrica": "Throughput Promedio", "Valor": statistics.avgThroughput, "Unidad": "req/s" },
    ];

    const wb = XLSX.utils.book_new();
    const wsData = XLSX.utils.json_to_sheet(excelData);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    XLSX.utils.book_append_sheet(wb, wsData, "Datos Detallados");
    
    const fileName = `dashboard_metrics_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setAllData(generateMetricsData());
      setIsRefreshing(false);
    }, 1000);
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Filtro de fecha */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Rango de fechas</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.from ? (
                          filters.dateRange.to ? (
                            <>
                              {format(filters.dateRange.from, "dd/MM/yy")} -{" "}
                              {format(filters.dateRange.to, "dd/MM/yy")}
                            </>
                          ) : (
                            format(filters.dateRange.from, "dd/MM/yy")
                          )
                        ) : (
                          <span>Seleccionar fechas</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={filters.dateRange}
                        onSelect={(range) => setFilters({ ...filters, dateRange: range || { from: undefined, to: undefined } })}
                        numberOfMonths={2}
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Filtro de servicios - LISTA DE SERVICIOS REALES */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Servicios
                    {filters.services.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {filters.services.length} seleccionado{filters.services.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </Label>
                  <Collapsible open={showServiceList} onOpenChange={setShowServiceList}>
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar servicio..."
                            value={searchService}
                            onChange={(e) => setSearchService(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="icon">
                            {showServiceList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="mt-2">
                        <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                          <div className="flex items-center justify-between pb-2 border-b">
                            <span className="text-sm font-medium">Lista de servicios</span>
                            <Button variant="ghost" size="sm" onClick={toggleAllServices}>
                              {filters.services.length === availableServices.length ? "Deseleccionar todos" : "Seleccionar todos"}
                            </Button>
                          </div>
                          {filteredServicesList.map(service => {
                            const serviceInfo = services.find(s => s.name === service);
                            const successRate = serviceInfo ? 
                              ((100 - serviceInfo.errorPercentage)).toFixed(1) : "0";
                            
                            return (
                              <div key={service} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-3 flex-1">
                                  <Checkbox
                                    checked={filters.services.includes(service)}
                                    onCheckedChange={() => toggleService(service)}
                                    id={`service-${service}`}
                                  />
                                  <Label htmlFor={`service-${service}`} className="flex-1 cursor-pointer">
                                    <div className="font-medium">{service}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Tasa éxito: {successRate}% | Error: {serviceInfo?.errorPercentage || 0}%
                                    </div>
                                  </Label>
                                </div>
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  serviceInfo?.status === "success" ? "bg-green-500" :
                                  serviceInfo?.status === "warning" ? "bg-yellow-500" : "bg-red-500"
                                )} />
                              </div>
                            );
                          })}
                          {filteredServicesList.length === 0 && (
                            <div className="text-center text-muted-foreground py-4">
                              No se encontraron servicios
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </div>

                {/* Filtro de tasa de éxito */}
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

                {/* Filtro de tiempo de respuesta */}
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

              {/* Filtro de estado */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Estado del servicio</Label>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "success", label: "Excelente (0% error)", color: "bg-green-500" },
                    { value: "warning", label: "Warning (1-10% error)", color: "bg-yellow-500" },
                    { value: "error", label: "Crítico (>10% error)", color: "bg-red-500" },
                  ].map(status => (
                    <Button
                      key={status.value}
                      variant={filters.status.includes(status.value as any) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const newStatus = filters.status.includes(status.value as any)
                          ? filters.status.filter(s => s !== status.value)
                          : [...filters.status, status.value as any];
                        setFilters({ ...filters, status: newStatus });
                      }}
                      className="gap-2"
                    >
                      <div className={cn("w-2 h-2 rounded-full", status.color)} />
                      {status.label}
                      {filters.status.includes(status.value as any) && <Check className="h-3 w-3" />}
                    </Button>
                  ))}
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
          {filters.services.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              {filters.services.length} servicio{filters.services.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {filters.minSuccessRate > 0 && (
            <Badge variant="secondary">Éxito ≥ {filters.minSuccessRate}%</Badge>
          )}
          {filters.maxResponseTime < 1000 && (
            <Badge variant="secondary">Respuesta ≤ {filters.maxResponseTime}ms</Badge>
          )}
          {filters.status.length < 3 && (
            <Badge variant="secondary">
              Estado: {filters.status.map(s => 
                s === "success" ? "Excelente" : s === "warning" ? "Warning" : "Crítico"
              ).join(", ")}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground ml-auto">
            Mostrando {filteredData.length} de {allData.length} registros
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
            <div className="text-2xl font-bold">{statistics.totalRequests.toLocaleString()}</div>
            <div className="flex gap-2 text-xs mt-1">
              <span className="text-green-600">✓ {statistics.totalSuccess.toLocaleString()}</span>
              <span className="text-red-600">✗ {statistics.totalErrors.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Error</CardTitle>
            <TrendingDown className={cn("h-4 w-4", parseFloat(statistics.errorRate) > 10 ? "text-red-500" : "text-yellow-500")} />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              parseFloat(statistics.errorRate) > 10 ? "text-red-500" : parseFloat(statistics.errorRate) > 5 ? "text-yellow-500" : "text-green-500"
            )}>
              {statistics.errorRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">{statistics.totalErrors} errores totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Respuesta</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.avgResponseTime} ms</div>
            <p className="text-xs text-muted-foreground mt-1">Promedio del período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.avgThroughput} req/s</div>
            <p className="text-xs text-muted-foreground mt-1">Promedio por segundo</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <Tabs defaultValue="line" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="line">📈 Línea</TabsTrigger>
          <TabsTrigger value="bar">📊 Barras</TabsTrigger>
          <TabsTrigger value="area">📉 Área</TabsTrigger>
          <TabsTrigger value="pie">🥧 Distribución</TabsTrigger>
        </TabsList>

        <TabsContent value="line">
          <Card>
            <CardHeader>
              <CardTitle>Evolución Temporal</CardTitle>
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
                    {selectedMetric === "requests" && (
                      <>
                        <Line type="monotone" dataKey="success" stroke="#10b981" name="Exitosas" strokeWidth={2} />
                        <Line type="monotone" dataKey="errors" stroke="#ef4444" name="Errores" strokeWidth={2} />
                      </>
                    )}
                    {selectedMetric === "errors" && (
                      <Line type="monotone" dataKey="errors" stroke="#ef4444" name="Errores" strokeWidth={2} />
                    )}
                    {selectedMetric === "responseTime" && (
                      <Line type="monotone" dataKey="responseTime" stroke="#3b82f6" name="Tiempo Respuesta (ms)" strokeWidth={2} />
                    )}
                    {selectedMetric === "throughput" && (
                      <Line type="monotone" dataKey="throughput" stroke="#8b5cf6" name="Throughput (req/s)" strokeWidth={2} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-center">
                <Select value={selectedMetric} onValueChange={(v: any) => setSelectedMetric(v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requests">Mostrar Peticiones</SelectItem>
                    <SelectItem value="errors">Mostrar Errores</SelectItem>
                    <SelectItem value="responseTime">Mostrar Tiempo Respuesta</SelectItem>
                    <SelectItem value="throughput">Mostrar Throughput</SelectItem>
                  </SelectContent>
                </Select>
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
                  <BarChart data={chartData.slice(-7)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {selectedMetric === "requests" && (
                      <>
                        <Bar dataKey="success" fill="#10b981" name="Exitosas" />
                        <Bar dataKey="errors" fill="#ef4444" name="Errores" />
                      </>
                    )}
                    {selectedMetric === "errors" && (
                      <Bar dataKey="errors" fill="#ef4444" name="Errores" />
                    )}
                    {selectedMetric === "responseTime" && (
                      <Bar dataKey="responseTime" fill="#3b82f6" name="Tiempo Respuesta (ms)" />
                    )}
                    {selectedMetric === "throughput" && (
                      <Bar dataKey="throughput" fill="#8b5cf6" name="Throughput (req/s)" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="area">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Errores vs Exitosas</CardTitle>
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
                    <Area type="monotone" dataKey="errors" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Errores" />
                    <Area type="monotone" dataKey="success" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Exitosas" />
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
                <p className="text-sm text-muted-foreground">Total: {statistics.totalRequests.toLocaleString()} peticiones</p>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        outerRadius={100}
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen de Métricas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span>Tasa de Éxito</span>
                    <Badge variant="success" className="text-lg">
                      {((statistics.totalSuccess / statistics.totalRequests) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span>Tiempo Promedio Respuesta</span>
                    <Badge className="text-lg">{statistics.avgResponseTime} ms</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span>Throughput Promedio</span>
                    <Badge className="text-lg">{statistics.avgThroughput} req/s</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span>Ratio Éxito/Error</span>
                    <Badge className="text-lg">
                      {statistics.totalErrors > 0 
                        ? (statistics.totalSuccess / statistics.totalErrors).toFixed(1)
                        : "∞"}:1
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Tabla de datos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Datos Detallados
            <Badge variant="secondary" className="ml-2">{filteredData.length} registros</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Servicio</th>
                  <th className="text-left p-3">Endpoint</th>
                  <th className="text-right p-3">Exitosas</th>
                  <th className="text-right p-3">Errores</th>
                  <th className="text-right p-3">Tasa Éxito</th>
                  <th className="text-right p-3">Tiempo Respuesta</th>
                  <th className="text-right p-3">Throughput</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(0, 50).map((item) => {
                  const total = item.successCount + item.errorCount;
                  const successRate = (item.successCount / total) * 100;
                  
                  return (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">{format(item.date, "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3 font-medium">{item.serviceName}</td>
                      <td className="p-3 font-mono text-xs">{item.endpoint}</td>
                      <td className="text-right p-3 text-green-600">{item.successCount.toLocaleString()}</td>
                      <td className="text-right p-3 text-red-600">{item.errorCount.toLocaleString()}</td>
                      <td className="text-right p-3 font-semibold">{successRate.toFixed(1)}%</td>
                      <td className="text-right p-3">{item.responseTime} ms</td>
                      <td className="text-right p-3">{item.throughput} req/s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}