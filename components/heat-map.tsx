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
import { services as importedServices, type Service, type Client, clients as globalClients } from "@/lib/services-data";
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
  Clock,
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

// Lista de servicios que están próximamente
const COMING_SOON_SERVICES = ["saldos", "finiquitos", "cuentas", "dte", "contabilizacion", "notas-credito"];

// Función para verificar si un servicio está próximo
const isServiceComingSoon = (serviceId: string): boolean => {
  return COMING_SOON_SERVICES.includes(serviceId);
};

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

// Función para obtener datos completos de un cliente por nombre
const getClientFullData = (clientName: string): { rut: string; email: string; phone: string } => {
  // Buscar en la lista global de clientes
  const globalClient = globalClients.find(c => c.name === clientName);
  if (globalClient) {
    return {
      rut: globalClient.rut || "No disponible",
      email: globalClient.email || "No disponible",
      phone: globalClient.phone || "No disponible",
    };
  }
  // Si no se encuentra, generar datos basados en el nombre
  return {
    rut: `76.${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}-${Math.floor(Math.random() * 9)}`,
    email: `contacto@${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}.cl`,
    phone: `+56 2 ${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`,
  };
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
          // Enriquecer clientes con RUT y Email desde la lista global
          const enrichedClients = service.clients.map(client => {
            const fullData = getClientFullData(client.name);
            return {
              ...client,
              rut: client.rut || fullData.rut,
              email: client.email || fullData.email,
              phone: client.phone || fullData.phone,
            };
          });

          // Solo facturas obtiene datos reales
          if (service.id === "facturas" && realData) {
            return {
              ...service,
              errorPercentage: realData.errorPercentage,
              status: realData.status as any,
              clients: enrichedClients.map(client => ({
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
          // Servicios próximos tienen 0% error y status success
          if (isServiceComingSoon(service.id) || service.isComingSoon) {
            return {
              ...service,
              errorPercentage: 0,
              status: "success" as any,
              description: "🚀 Próximamente - " + service.description,
              clients: [],
              metrics: {
                totalRequests: 0,
                errorRate: 0,
                responseTime: 0,
                uptime: 0,
              }
            };
          }
          return {
            ...service,
            clients: enrichedClients,
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

  const getStatusBadge = (status: string, percentage: number, isComingSoon: boolean = false) => {
    if (isComingSoon) {
      return <Badge className="bg-gray-500 text-white gap-1 border-0"><Clock className="h-3 w-3" /> Próximamente</Badge>;
    }
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

  const getStatusIcon = (status: string, isComingSoon: boolean = false) => {
    if (isComingSoon) return <Clock className="h-5 w-5 text-gray-500" />;
    if (status === "success") return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (status === "warning") return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    if (status === "error") return <AlertTriangle className="h-5 w-5 text-red-500" />;
    return null;
  };

  const getHeatColor = (errorPercentage: number, isComingSoon: boolean = false) => {
    if (isComingSoon) return "bg-gray-100 dark:bg-gray-900/30 border-gray-200";
    if (errorPercentage === 0) return "bg-emerald-100 dark:bg-emerald-950/30 border-emerald-200";
    if (errorPercentage <= 5) return "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100";
    if (errorPercentage <= 10) return "bg-amber-50 dark:bg-amber-950/20 border-amber-100";
    if (errorPercentage <= 20) return "bg-amber-100 dark:bg-amber-950/30 border-amber-200";
    if (errorPercentage <= 40) return "bg-orange-100 dark:bg-orange-950/30 border-orange-200";
    return "bg-red-100 dark:bg-red-950/30 border-red-200";
  };

  const getMapColor = (errorPercentage: number, isComingSoon: boolean = false) => {
    if (isComingSoon) return "bg-gray-400 hover:bg-gray-500";
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

  // Redirigir al monitoreo completo del servicio
  const handleGoToFullMonitoring = (serviceId: string) => {
    setShowDetailModal(false);
    router.push(`/servicio/${serviceId}`);
  };

  // Exportación a Excel con datos completos de clientes
  const handleExportToExcel = () => {
    const exportData = filteredServices.map(service => {
      const comingSoon = isServiceComingSoon(service.id) || service.isComingSoon;
      // Obtener todos los clientes con sus datos completos
      const clientDetails = comingSoon ? [] : service.clients.map(c => {
        const fullData = getClientFullData(c.name);
        return {
          name: c.name || "N/A",
          rut: c.rut || fullData.rut,
          email: c.email || fullData.email,
          phone: c.phone || fullData.phone,
          error: c.errorPercentage || 0
        };
      });
      
      return {
        "ID Servicio": service.id,
        "Servicio": service.name,
        "Descripción": comingSoon ? "🚀 Próximamente - En desarrollo" : service.description,
        "Estado": comingSoon ? "Próximamente" : (service.status === "success" ? "Excelente" : service.status === "warning" ? "Atención" : "Crítico"),
        "Porcentaje Error Técnico": comingSoon ? "N/A" : `${service.errorPercentage}%`,
        "Nivel de Error": comingSoon ? "N/A" : (service.errorPercentage === 0 ? "Sin errores" : 
                        service.errorPercentage <= 5 ? "Bajo" :
                        service.errorPercentage <= 10 ? "Medio" :
                        service.errorPercentage <= 20 ? "Alto" : "Crítico"),
        "Cantidad Clientes": comingSoon ? 0 : service.clients.length,
        "Lista Clientes (Nombres)": comingSoon ? "" : clientDetails.map(c => c.name).join(" | "),
        "Lista Clientes (RUTs)": comingSoon ? "" : clientDetails.map(c => c.rut).join(" | "),
        "Lista Clientes (Emails)": comingSoon ? "" : clientDetails.map(c => c.email).join(" | "),
        "Lista Clientes (Teléfonos)": comingSoon ? "" : clientDetails.map(c => c.phone).join(" | "),
        "Clientes Detalle": comingSoon ? "" : clientDetails.map(c => `${c.name} (RUT: ${c.rut}, Email: ${c.email})`).join("; "),
        "Total Request (mes)": comingSoon ? "N/A" : (service.metrics?.totalRequests || "N/A"),
        "Tiempo Respuesta (ms)": comingSoon ? "N/A" : (service.metrics?.responseTime || "N/A"),
        "Uptime (%)": comingSoon ? "N/A" : (service.metrics?.uptime || "N/A"),
        "Fecha Exportación": format(new Date(), "dd/MM/yyyy HH:mm:ss"),
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Ajustar anchos de columna para mejor visualización
    const colWidths = [
      { wch: 15 },   // ID Servicio
      { wch: 35 },   // Servicio
      { wch: 50 },   // Descripción
      { wch: 12 },   // Estado
      { wch: 18 },   // Porcentaje Error Técnico
      { wch: 12 },   // Nivel de Error
      { wch: 15 },   // Cantidad Clientes
      { wch: 50 },   // Lista Clientes (Nombres)
      { wch: 40 },   // Lista Clientes (RUTs)
      { wch: 50 },   // Lista Clientes (Emails)
      { wch: 40 },   // Lista Clientes (Teléfonos)
      { wch: 80 },   // Clientes Detalle
      { wch: 18 },   // Total Request
      { wch: 18 },   // Tiempo Respuesta
      { wch: 15 },   // Uptime
      { wch: 22 },   // Fecha Exportación
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "Mapa de Calor - Detallado");
    
    // Resumen estadístico
    const summaryData = [
      { "Métrica": "Total Servicios", "Valor": filteredServices.length },
      { "Métrica": "Total Clientes", "Valor": filteredServices.reduce((acc, s) => acc + s.clients.length, 0) },
      { "Métrica": "Servicios Excelentes", "Valor": filteredServices.filter(s => s.status === "success" && !isServiceComingSoon(s.id) && !s.isComingSoon).length },
      { "Métrica": "Servicios Atención", "Valor": filteredServices.filter(s => s.status === "warning").length },
      { "Métrica": "Servicios Críticos", "Valor": filteredServices.filter(s => s.status === "error").length },
      { "Métrica": "Servicios Próximamente", "Valor": filteredServices.filter(s => isServiceComingSoon(s.id) || s.isComingSoon).length },
      { "Métrica": "Tasa Error Promedio", "Valor": `${(filteredServices.filter(s => !isServiceComingSoon(s.id) && !s.isComingSoon).reduce((acc, s) => acc + s.errorPercentage, 0) / (filteredServices.filter(s => !isServiceComingSoon(s.id) && !s.isComingSoon).length || 1)).toFixed(2)}%` },
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
  const healthyServices = filteredServices.filter(s => s.status === "success" && !isServiceComingSoon(s.id) && !s.isComingSoon).length;
  const warningServices = filteredServices.filter(s => s.status === "warning").length;
  const errorServices = filteredServices.filter(s => s.status === "error").length;
  const comingSoonCount = filteredServices.filter(s => isServiceComingSoon(s.id) || s.isComingSoon).length;

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
      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Próximamente</p>
                <p className="text-2xl font-bold text-gray-500">{comingSoonCount}</p>
              </div>
              <Clock className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel de filtros */}
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
                    <TooltipContent>Vista mapa de calor</TooltipContent>
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
              {filteredServices.map((service) => {
                const comingSoon = isServiceComingSoon(service.id) || service.isComingSoon;
                return (
                  <div
                    key={service.id}
                    className={cn(
                      "rounded-lg border p-4 transition-all hover:shadow-md cursor-pointer",
                      getHeatColor(service.errorPercentage, comingSoon)
                    )}
                    onClick={() => handleViewDetail(service)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(service.status, comingSoon)}
                        <h3 className="font-semibold text-base">{service.name}</h3>
                        {comingSoon && (
                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                            🚀 Próximamente
                          </Badge>
                        )}
                      </div>
                      {getStatusBadge(service.status, service.errorPercentage, comingSoon)}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {comingSoon ? "🚀 Servicio en desarrollo. Próximamente estará disponible el monitoreo completo." : service.description}
                    </p>
                    
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Clientes</p>
                        <p className="text-lg font-bold">{comingSoon ? 0 : service.clients.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Error técnico</p>
                        <p className={cn(
                          "text-lg font-bold",
                          comingSoon ? "text-gray-500" :
                          service.errorPercentage === 0 ? "text-emerald-600" :
                          service.errorPercentage <= 10 ? "text-amber-600" : "text-red-600"
                        )}>
                          {comingSoon ? "N/A" : `${service.errorPercentage}%`}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Estado</p>
                        <p className="text-sm font-medium">
                          {comingSoon ? "⏳ Próximamente" :
                            service.status === "success" ? "✅ Excelente" :
                            service.status === "warning" ? "⚠️ Atención" : "❌ Crítico"}
                        </p>
                      </div>
                    </div>

                    {!comingSoon && (
                      <>
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
                      </>
                    )}

                    {comingSoon && (
                      <div className="mt-3 pt-2 border-t text-center">
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                          <Clock className="h-3 w-3 mr-1" />
                          En desarrollo
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}
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
                  {filteredServices.map((service) => {
                    const comingSoon = isServiceComingSoon(service.id) || service.isComingSoon;
                    return (
                      <TableRow 
                        key={service.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetail(service)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(service.status, comingSoon)}
                            {service.name}
                            {comingSoon && (
                              <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                                🚀 Próximamente
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-muted-foreground">
                          {comingSoon ? "🚀 Servicio en desarrollo" : service.description}
                        </TableCell>
                        <TableCell className="text-center">{comingSoon ? 0 : service.clients.length}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn(
                            comingSoon ? "text-gray-500 border-gray-200" :
                            service.errorPercentage === 0 ? "text-emerald-600 border-emerald-200" :
                            service.errorPercentage <= 10 ? "text-amber-600 border-amber-200" : "text-red-600 border-red-200"
                          )}>
                            {comingSoon ? "N/A" : `${service.errorPercentage}%`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(service.status, service.errorPercentage, comingSoon)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDetail(service); }}>
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            // VISTA MAPA
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
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                    <span>Próximamente</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredServices.map((service) => {
                  const comingSoon = isServiceComingSoon(service.id) || service.isComingSoon;
                  return (
                    <TooltipProvider key={service.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleViewDetail(service)}
                            className={cn(
                              "p-3 rounded-lg text-center transition-all transform hover:scale-105 cursor-pointer",
                              "text-white font-medium shadow-md hover:shadow-lg",
                              getMapColor(service.errorPercentage, comingSoon)
                            )}
                          >
                            <p className="text-sm font-semibold truncate">
                              {service.name}
                            </p>
                            <p className="text-xs opacity-90 mt-1">
                              {comingSoon ? "Próximamente" : `${service.errorPercentage}% error`}
                            </p>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold">{service.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {comingSoon ? "Servicio en desarrollo - Próximamente disponible" : service.description}
                            </p>
                            <p className="text-xs">📊 {comingSoon ? "Estado: En desarrollo" : `Error: ${service.errorPercentage}%`}</p>
                            <p className="text-xs">👥 Clientes: {comingSoon ? 0 : service.clients.length}</p>
                            <p className="text-xs">✅ Estado: {comingSoon ? "⏳ Próximamente" : (service.status === "success" ? "Excelente" : service.status === "warning" ? "Atención" : "Crítico")}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
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
                  {getStatusIcon(selectedServiceDetail.status, isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon)}
                  <DialogTitle className="text-xl">{selectedServiceDetail.name}</DialogTitle>
                  {getStatusBadge(selectedServiceDetail.status, selectedServiceDetail.errorPercentage, isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon)}
                </div>
              </DialogHeader>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Descripción</h4>
                  <p className="text-sm text-muted-foreground">
                    {(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) 
                      ? "🚀 Servicio en desarrollo. Próximamente estará disponible el monitoreo completo con todas las métricas y estadísticas."
                      : selectedServiceDetail.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Clientes</p>
                    <p className="text-2xl font-bold">
                      {(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) ? 0 : selectedServiceDetail.clients.length}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Error Técnico</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      (isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) ? "text-gray-500" :
                      selectedServiceDetail.errorPercentage === 0 ? "text-emerald-600" :
                      selectedServiceDetail.errorPercentage <= 10 ? "text-amber-600" : "text-red-600"
                    )}>
                      {(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) ? "N/A" : `${selectedServiceDetail.errorPercentage}%`}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p className="text-lg font-medium">
                      {(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) ? "⏳ Próximamente" :
                        selectedServiceDetail.status === "success" ? "✅ Excelente" :
                        selectedServiceDetail.status === "warning" ? "⚠️ Atención" : "❌ Crítico"}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Uptime</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) ? "N/A" : "99.9%"}
                    </p>
                  </div>
                </div>

                {!(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) && (
                  <>
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
                  </>
                )}

                {(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
                    <Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-amber-700 text-sm">
                      Este servicio se encuentra actualmente en desarrollo.
                      Próximamente podrás acceder a todas las métricas y estadísticas de monitoreo.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                    Cerrar
                  </Button>
                  {!(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) && (
                    <Button 
                      onClick={() => handleGoToFullMonitoring(selectedServiceDetail.id)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <LayoutDashboard className="h-4 w-4 mr-1" />
                      Ver monitoreo completo
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}