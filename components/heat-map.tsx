// components/heat-map.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { services as importedServices, type Service, type Client } from "@/lib/services-data";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Search,
  Filter,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Eye,
  Users,
  Briefcase,
  Activity,
  Download,
  RefreshCw,
  LayoutGrid,
  List,
  Map,
  LayoutDashboard,
} from "lucide-react";
import * as XLSX from "xlsx";

interface HeatMapProps {
  onSelectService?: (service: Service) => void;
}

// Lista de errores de infraestructura
const ERRORES_INFRAESTRUCTURA = [
  "error de conexión", "timeout", "servidor no responde", "softland no disponible",
  "sii no responde", "connection failed", "failed to connect", "could not connect",
  "connection refused", "network error", "500", "503", "502", "504",
  "no se pudo conectar", "softland error", "sii error", "error de red"
];

// Función para obtener datos reales de facturas
const fetchRealData = async () => {
  try {
    const res = await fetch("/api/facturas/bitacora?estado=todos");
    const data = await res.json();
    if (data.success && data.data) {
      const totalDocs = data.data.length;
      const errorDocs = data.data.filter((e: any) => {
        const motivo = e.motivo || "";
        return ERRORES_INFRAESTRUCTURA.some(term => motivo.toLowerCase().includes(term.toLowerCase()));
      }).length;
      const errPercent = totalDocs > 0 ? Math.round((errorDocs / totalDocs) * 100) : 0;
      const status = errorDocs > 0 ? (errPercent > 40 ? "error" : "warning") : "success";
      return { errorPercentage: errPercent, status, totalDocs, errorDocs };
    }
    return null;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
};

type ViewMode = "grid" | "list" | "map";

export function HeatMap({ onSelectService }: HeatMapProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [selectedType, setSelectedType] = useState<string>("todos");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServiceDetail, setSelectedServiceDetail] = useState<Service | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "error" | "clients">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Cargar servicios desde la API
  useEffect(() => {
    const loadServices = async () => {
      setLoading(true);
      try {
        const realData = await fetchRealData();
        
        const updatedServices = importedServices.map(service => {
          if (service.id === "facturas" && realData) {
            return {
              ...service,
              errorPercentage: realData.errorPercentage,
              status: realData.status as any,
              clients: service.clients.map(client => ({
                ...client,
                errorPercentage: realData.errorPercentage,
                status: realData.status as any,
              })),
              metrics: {
                totalRequests: realData.totalDocs,
                errorRate: realData.errorPercentage,
                responseTime: 320,
                uptime: 99.99,
              }
            };
          }
          return {
            ...service,
            metrics: {
              totalRequests: Math.floor(Math.random() * 10000) + 1000,
              errorRate: service.errorPercentage,
              responseTime: Math.floor(Math.random() * 200) + 50,
              uptime: 99.9,
            }
          };
        });
        
        setServices(updatedServices);
      } catch (error) {
        console.error("Error loading services:", error);
        setServices(importedServices);
      } finally {
        setLoading(false);
      }
    };
    
    loadServices();
  }, []);

  // Filtrar servicios
  const filteredServices = useMemo(() => {
    let filtered = [...services];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(term) ||
        service.description.toLowerCase().includes(term) ||
        service.clients.some(client => client.name.toLowerCase().includes(term))
      );
    }

    if (selectedStatus !== "todos") {
      filtered = filtered.filter(service => service.status === selectedStatus);
    }

    if (selectedType !== "todos") {
      if (selectedType === "critical") {
        filtered = filtered.filter(service => service.errorPercentage > 10);
      } else if (selectedType === "warning") {
        filtered = filtered.filter(service => service.errorPercentage > 0 && service.errorPercentage <= 10);
      } else if (selectedType === "healthy") {
        filtered = filtered.filter(service => service.errorPercentage === 0);
      }
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") comparison = a.name.localeCompare(b.name);
      else if (sortBy === "error") comparison = a.errorPercentage - b.errorPercentage;
      else if (sortBy === "clients") comparison = a.clients.length - b.clients.length;
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [services, searchTerm, selectedStatus, selectedType, sortBy, sortOrder]);

  const getStatusColor = (status: string) => {
    if (status === "success") return "bg-emerald-500";
    if (status === "warning") return "bg-amber-500";
    if (status === "error") return "bg-red-500";
    return "bg-gray-500";
  };

  const getStatusBadge = (status: string, percentage: number) => {
    if (status === "success") {
      return <Badge className="bg-emerald-500 text-white gap-1 border-0"><CheckCircle className="h-3 w-3" /> {percentage}% error técnico</Badge>;
    }
    if (status === "warning") {
      return <Badge className="bg-amber-500 text-white gap-1 border-0"><AlertTriangle className="h-3 w-3" /> {percentage}% error técnico</Badge>;
    }
    if (status === "error") {
      return <Badge className="bg-red-500 text-white gap-1 border-0"><AlertTriangle className="h-3 w-3" /> {percentage}% error técnico</Badge>;
    }
    return <Badge variant="outline">{percentage}% error</Badge>;
  };

  const getStatusIcon = (status: string) => {
    if (status === "success") return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (status === "warning") return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    if (status === "error") return <AlertTriangle className="h-5 w-5 text-red-500" />;
    return null;
  };

  const getHeatColor = (errorPercentage: number) => {
    if (errorPercentage === 0) return "bg-emerald-100 dark:bg-emerald-950/30 border-emerald-200";
    if (errorPercentage <= 5) return "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100";
    if (errorPercentage <= 10) return "bg-amber-50 dark:bg-amber-950/20 border-amber-100";
    if (errorPercentage <= 20) return "bg-amber-100 dark:bg-amber-950/30 border-amber-200";
    if (errorPercentage <= 40) return "bg-orange-100 dark:bg-orange-950/30 border-orange-200";
    return "bg-red-100 dark:bg-red-950/30 border-red-200";
  };

  const getMapColor = (errorPercentage: number) => {
    if (errorPercentage === 0) return "bg-emerald-500 hover:bg-emerald-600";
    if (errorPercentage <= 5) return "bg-emerald-400 hover:bg-emerald-500";
    if (errorPercentage <= 10) return "bg-amber-400 hover:bg-amber-500";
    if (errorPercentage <= 20) return "bg-amber-500 hover:bg-amber-600";
    if (errorPercentage <= 40) return "bg-orange-500 hover:bg-orange-600";
    return "bg-red-500 hover:bg-red-600";
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedStatus("todos");
    setSelectedType("todos");
    setDateRange({ from: undefined, to: undefined });
    setSortBy("name");
    setSortOrder("asc");
  };

  const handleViewDetail = (service: Service) => {
    setSelectedServiceDetail(service);
    setShowDetailModal(true);
    if (onSelectService) {
      onSelectService(service);
    }
  };

  // Redirigir al monitoreo completo del servicio - RUTA CORREGIDA
  const handleGoToFullMonitoring = (serviceId: string) => {
    setShowDetailModal(false);
    // Usar la misma ruta que en services-list.tsx: "/servicio/" (con acento en la i? revisemos)
    // En services-list.tsx usas: router.push(`/servicio/${service.id}`)
    router.push(`/servicio/${serviceId}`);
  };

  // Exportación mejorada con más detalles
  const handleExportToExcel = () => {
    const exportData = filteredServices.map(service => ({
      "ID Servicio": service.id,
      "Servicio": service.name,
      "Descripción": service.description,
      "Estado": service.status === "success" ? "Excelente" : service.status === "warning" ? "Atención" : "Crítico",
      "Porcentaje Error Técnico": `${service.errorPercentage}%`,
      "Nivel de Error": service.errorPercentage === 0 ? "Sin errores" : 
                        service.errorPercentage <= 5 ? "Bajo" :
                        service.errorPercentage <= 10 ? "Medio" :
                        service.errorPercentage <= 20 ? "Alto" : "Crítico",
      "Cantidad Clientes": service.clients.length,
      "Lista Clientes": service.clients.map(c => c.name).join(", "),
      "RUTs Clientes": service.clients.map(c => c.rut || "N/A").join(", "),
      "Emails Clientes": service.clients.map(c => c.email || "N/A").join(", "),
      "Total Request (mes)": service.metrics?.totalRequests || "N/A",
      "Tiempo Respuesta (ms)": service.metrics?.responseTime || "N/A",
      "Uptime (%)": service.metrics?.uptime || "N/A",
      "Fecha Exportación": format(new Date(), "dd/MM/yyyy HH:mm:ss"),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 15 }, // ID Servicio
      { wch: 25 }, // Servicio
      { wch: 40 }, // Descripción
      { wch: 12 }, // Estado
      { wch: 18 }, // Porcentaje Error Técnico
      { wch: 12 }, // Nivel de Error
      { wch: 15 }, // Cantidad Clientes
      { wch: 50 }, // Lista Clientes
      { wch: 30 }, // RUTs Clientes
      { wch: 35 }, // Emails Clientes
      { wch: 18 }, // Total Request
      { wch: 18 }, // Tiempo Respuesta
      { wch: 15 }, // Uptime
      { wch: 22 }, // Fecha Exportación
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "Mapa de Calor - Detallado");
    
    // Hoja adicional con resumen estadístico
    const summaryData = [
      { "Métrica": "Total Servicios", "Valor": filteredServices.length },
      { "Métrica": "Total Clientes", "Valor": filteredServices.reduce((acc, s) => acc + s.clients.length, 0) },
      { "Métrica": "Servicios Excelentes", "Valor": filteredServices.filter(s => s.status === "success").length },
      { "Métrica": "Servicios Atención", "Valor": filteredServices.filter(s => s.status === "warning").length },
      { "Métrica": "Servicios Críticos", "Valor": filteredServices.filter(s => s.status === "error").length },
      { "Métrica": "Tasa Error Promedio", "Valor": `${(filteredServices.reduce((acc, s) => acc + s.errorPercentage, 0) / filteredServices.length).toFixed(2)}%` },
      { "Métrica": "Fecha Exportación", "Valor": format(new Date(), "dd/MM/yyyy HH:mm:ss") },
      { "Métrica": "Filtros Aplicados", "Valor": `Estado: ${selectedStatus}, Tipo: ${selectedType}, Búsqueda: ${searchTerm || "Ninguna"}` },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Estadístico");
    
    XLSX.writeFile(wb, `mapa_calor_detallado_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xlsx`);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedStatus !== "todos") count++;
    if (selectedType !== "todos") count++;
    if (dateRange.from || dateRange.to) count++;
    return count;
  }, [searchTerm, selectedStatus, selectedType, dateRange]);

  const totalServices = filteredServices.length;
  const totalClients = filteredServices.reduce((acc, service) => acc + service.clients.length, 0);
  const avgErrorRate = filteredServices.length > 0 
    ? filteredServices.reduce((acc, service) => acc + service.errorPercentage, 0) / filteredServices.length 
    : 0;
  const healthyServices = filteredServices.filter(s => s.status === "success").length;
  const warningServices = filteredServices.filter(s => s.status === "warning").length;
  const errorServices = filteredServices.filter(s => s.status === "error").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-emerald-500" />
          <p className="text-muted-foreground">Cargando mapa de calor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarjetas de estadísticas mejoradas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Servicios</p>
                <p className="text-2xl font-bold">{totalServices}</p>
              </div>
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Clientes Activos</p>
                <p className="text-2xl font-bold">{totalClients}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tasa Error Promedio</p>
                <p className={cn(
                  "text-2xl font-bold",
                  avgErrorRate > 10 ? "text-red-500" : avgErrorRate > 5 ? "text-amber-500" : "text-emerald-500"
                )}>
                  {avgErrorRate.toFixed(1)}%
                </p>
              </div>
              {avgErrorRate > 10 ? 
                <TrendingDown className="h-8 w-8 text-red-500" /> : 
                <TrendingUp className="h-8 w-8 text-emerald-500" />
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Servicios Saludables</p>
                <p className="text-2xl font-bold text-emerald-500">{healthyServices}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Servicios Críticos</p>
                <p className="text-2xl font-bold text-red-500">{errorServices}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel de filtros mejorado */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <CardTitle className="text-lg">Mapa de Calor de Servicios</CardTitle>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleExportToExcel}>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar a Excel con detalles completos</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/30">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={viewMode === "grid" ? "default" : "ghost"} 
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setViewMode("grid")}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Vista cuadrícula</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={viewMode === "list" ? "default" : "ghost"} 
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setViewMode("list")}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Vista lista</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={viewMode === "map" ? "default" : "ghost"} 
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setViewMode("map")}
                      >
                        <Map className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Vista mapa de calor (solo nombres)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="mr-2 h-3 w-3" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">{activeFiltersCount}</Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Panel de filtros expandible */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Servicio o cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Estado del Servicio</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">🌐 Todos</SelectItem>
                      <SelectItem value="success">✅ Excelente</SelectItem>
                      <SelectItem value="warning">⚠️ Atención</SelectItem>
                      <SelectItem value="error">❌ Crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Tipo de Servicio</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">📋 Todos</SelectItem>
                      <SelectItem value="healthy">🟢 Saludables (0% error)</SelectItem>
                      <SelectItem value="warning">🟡 Atención (1-10% error)</SelectItem>
                      <SelectItem value="critical">🔴 Críticos (&gt;10% error)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Ordenar por</Label>
                  <div className="flex gap-2">
                    <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                      <SelectTrigger className="flex-1 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Nombre</SelectItem>
                        <SelectItem value="error">Tasa error</SelectItem>
                        <SelectItem value="clients">Clientes</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9"
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    >
                      {sortOrder === "asc" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={handleResetFilters}>
                    <X className="mr-1 h-3 w-3" />
                    Limpiar todos los filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {filteredServices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron servicios con los filtros aplicados</p>
              <Button variant="link" onClick={handleResetFilters} className="mt-2">
                Limpiar filtros
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className={cn(
                    "rounded-lg border p-4 transition-all hover:shadow-md cursor-pointer",
                    getHeatColor(service.errorPercentage)
                  )}
                  onClick={() => handleViewDetail(service)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(service.status)}
                      <h3 className="font-semibold text-base">{service.name}</h3>
                    </div>
                    {getStatusBadge(service.status, service.errorPercentage)}
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {service.description}
                  </p>
                  
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Clientes</p>
                      <p className="text-lg font-bold">{service.clients.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Error técnico</p>
                      <p className={cn(
                        "text-lg font-bold",
                        service.errorPercentage === 0 ? "text-emerald-600" :
                        service.errorPercentage <= 10 ? "text-amber-600" : "text-red-600"
                      )}>
                        {service.errorPercentage}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Estado</p>
                      <p className="text-sm font-medium">
                        {service.status === "success" ? "✅ Excelente" :
                         service.status === "warning" ? "⚠️ Atención" : "❌ Crítico"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Salud del servicio</span>
                      <span>{100 - service.errorPercentage}%</span>
                    </div>
                    <Progress value={100 - service.errorPercentage} className="h-2" />
                  </div>

                  {service.clients.length > 0 && (
                    <div className="mt-3 pt-2 border-t">
                      <div className="flex flex-wrap gap-1">
                        {service.clients.slice(0, 3).map((client) => (
                          <Badge key={client.id} variant="outline" className="text-[10px]">
                            {client.name.length > 20 ? client.name.substring(0, 20) + "..." : client.name}
                          </Badge>
                        ))}
                        {service.clients.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{service.clients.length - 3} más
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : viewMode === "list" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-center">Clientes</TableHead>
                    <TableHead className="text-center">Error Técnico</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => (
                    <TableRow 
                      key={service.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetail(service)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(service.status)}
                          {service.name}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground">
                        {service.description}
                      </TableCell>
                      <TableCell className="text-center">{service.clients.length}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          service.errorPercentage === 0 ? "text-emerald-600 border-emerald-200" :
                          service.errorPercentage <= 10 ? "text-amber-600 border-amber-200" : "text-red-600 border-red-200"
                        )}>
                          {service.errorPercentage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(service.status, service.errorPercentage)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDetail(service); }}>
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            // VISTA MAPA: solo nombres con colores
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Vista de mapa de calor - {filteredServices.length} servicios
                </p>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span>Excelente (0% error)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                    <span>Atención (1-10%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span>Alto (11-40%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>Crítico (&gt;40%)</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredServices.map((service) => (
                  <TooltipProvider key={service.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleViewDetail(service)}
                          className={cn(
                            "p-3 rounded-lg text-center transition-all transform hover:scale-105 cursor-pointer",
                            "text-white font-medium shadow-md hover:shadow-lg",
                            getMapColor(service.errorPercentage)
                          )}
                        >
                          <p className="text-sm font-semibold truncate">
                            {service.name}
                          </p>
                          <p className="text-xs opacity-90 mt-1">
                            {service.errorPercentage}% error
                          </p>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-semibold">{service.name}</p>
                          <p className="text-xs text-muted-foreground">{service.description}</p>
                          <p className="text-xs">📊 Error: {service.errorPercentage}%</p>
                          <p className="text-xs">👥 Clientes: {service.clients.length}</p>
                          <p className="text-xs">✅ Estado: {service.status === "success" ? "Excelente" : service.status === "warning" ? "Atención" : "Crítico"}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
                <p>💡 Los colores representan el nivel de error técnico de cada servicio</p>
                <p className="mt-1">Haz clic en cualquier servicio para ver detalles completos</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalle del servicio */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedServiceDetail && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {getStatusIcon(selectedServiceDetail.status)}
                  <DialogTitle className="text-xl">{selectedServiceDetail.name}</DialogTitle>
                  {getStatusBadge(selectedServiceDetail.status, selectedServiceDetail.errorPercentage)}
                </div>
              </DialogHeader>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Descripción</h4>
                  <p className="text-sm text-muted-foreground">{selectedServiceDetail.description}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Clientes</p>
                    <p className="text-2xl font-bold">{selectedServiceDetail.clients.length}</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Error Técnico</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      selectedServiceDetail.errorPercentage === 0 ? "text-emerald-600" :
                      selectedServiceDetail.errorPercentage <= 10 ? "text-amber-600" : "text-red-600"
                    )}>
                      {selectedServiceDetail.errorPercentage}%
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p className="text-lg font-medium">
                      {selectedServiceDetail.status === "success" ? "✅ Excelente" :
                       selectedServiceDetail.status === "warning" ? "⚠️ Atención" : "❌ Crítico"}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Uptime</p>
                    <p className="text-2xl font-bold text-emerald-600">99.9%</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Clientes ({selectedServiceDetail.clients.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedServiceDetail.clients.map((client) => (
                      <div key={client.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            {client.rut && <span>RUT: {client.rut}</span>}
                            {client.email && <span>Email: {client.email}</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className={cn(
                          client.errorPercentage === 0 ? "text-emerald-600" :
                          client.errorPercentage <= 10 ? "text-amber-600" : "text-red-600"
                        )}>
                          {client.errorPercentage}% error
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                    Cerrar
                  </Button>
                  <Button 
                    onClick={() => handleGoToFullMonitoring(selectedServiceDetail.id)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <LayoutDashboard className="h-4 w-4 mr-1" />
                    Ver monitoreo completo
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}