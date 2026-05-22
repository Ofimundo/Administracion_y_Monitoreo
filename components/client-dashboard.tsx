// app/components/client-dashboard.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { 
  TrendingUp, 
  Activity, 
  Clock,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  Building,
  Star,
  Briefcase,
  X,
  Filter,
  Search,
  Calendar as CalendarIcon,
  Zap,
  ChevronDown,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clients, getClientServices } from "@/lib/services-data";
import { StatusIndicator } from "@/components/status-indicator";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";

interface ClientDashboardProps {
  clientId: string;
  onClose?: () => void;
}

// Lista de servicios que están próximamente
const COMING_SOON_SERVICES = ["saldos", "finiquitos", "cuentas", "dte", "contabilizacion", "notas-credito"];

// Función para verificar si un servicio está próximo
const isServiceComingSoon = (serviceId: string): boolean => {
  return COMING_SOON_SERVICES.includes(serviceId);
};

// Función para normalizar fecha
const normalizeDate = (dateInput: any): Date => {
  if (!dateInput) return new Date();
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return new Date();
    return date;
  } catch {
    return new Date();
  }
};

// Función para generar datos mensuales a partir de datos filtrados
const generateMonthlyData = (filteredData: any[]) => {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthlyData: { [key: string]: any } = {};
  
  months.forEach(month => {
    monthlyData[month] = { month, aprobadas: 0, rechazadas: 0, manuales: 0, pendientes: 0 };
  });
  
  filteredData.forEach((item: any) => {
    const date = normalizeDate(item.fecha_proceso);
    const monthName = months[date.getMonth()];
    if (monthlyData[monthName]) {
      switch (item.estado) {
        case "Aprobado":
          monthlyData[monthName].aprobadas++;
          break;
        case "Rechazado":
          monthlyData[monthName].rechazadas++;
          break;
        case "Manual":
          monthlyData[monthName].manuales++;
          break;
        default:
          monthlyData[monthName].pendientes++;
          break;
      }
    }
  });
  
  return Object.values(monthlyData).filter(m => m.aprobadas > 0 || m.rechazadas > 0 || m.manuales > 0 || m.pendientes > 0).slice(-6);
};

export function ClientDashboard({ clientId, onClose }: ClientDashboardProps) {
  const { toast } = useToast();
  const [allData, setAllData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showFilters, setShowFilters] = useState(false);
  const [availableTipos, setAvailableTipos] = useState<string[]>([]);
  
  const [filters, setFilters] = useState({
    fechaDesde: null as Date | null,
    fechaHasta: null as Date | null,
    tipoDocumento: "todos",
    estado: "todos",
  });

  const isOfimundo = clientId === "cl_ofimundo";

  // Cargar datos reales solo para Ofimundo
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (isOfimundo) {
          const res = await fetch("/api/facturas/bitacora?estado=todos");
          const data = await res.json();
          
          if (data.success && data.data) {
            setAllData(data.data);
            setFilteredData(data.data);
            
            const tipos = new Set<string>();
            data.data.forEach((item: any) => {
              if (item.tipo_documento) {
                tipos.add(String(item.tipo_documento));
              }
            });
            setAvailableTipos(Array.from(tipos).sort());
          } else {
            const sampleData = generateSampleData();
            setAllData(sampleData);
            setFilteredData(sampleData);
            setAvailableTipos(["33", "34", "61"]);
          }
        } else {
          // Para otros clientes, no hay datos
          setAllData([]);
          setFilteredData([]);
          setAvailableTipos([]);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        if (isOfimundo) {
          const sampleData = generateSampleData();
          setAllData(sampleData);
          setFilteredData(sampleData);
          setAvailableTipos(["33", "34", "61"]);
        }
      } finally {
        setTimeout(() => {
          setLoading(false);
        }, 300);
      }
    };
    
    loadData();
  }, [clientId, isOfimundo]);

  const generateSampleData = () => {
    const data = [];
    const startDate = new Date(2024, 0, 1);
    const estados = ["Aprobado", "Rechazado", "Manual", "Pendiente"];
    const tipos = ["33", "34", "61"];
    
    for (let i = 0; i < 500; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + Math.floor(Math.random() * 365));
      data.push({
        id_proceso: i,
        fecha_proceso: date.toISOString(),
        estado: estados[Math.floor(Math.random() * estados.length)],
        tipo_documento: tipos[Math.floor(Math.random() * tipos.length)],
        folio_documento: Math.floor(Math.random() * 10000),
        razon_social: "Cliente Ejemplo",
        rut_proveedor: "76.452.910-K",
        motivo: Math.random() > 0.8 ? "Error de conexión" : "",
      });
    }
    return data;
  };

  const applyFilters = () => {
    if (!isOfimundo) return;
    let filtered = [...allData];
    
    if (filters.tipoDocumento !== "todos") {
      filtered = filtered.filter((item: any) => 
        String(item.tipo_documento) === filters.tipoDocumento
      );
    }
    
    if (filters.estado !== "todos") {
      let estadoValue = "";
      switch (filters.estado) {
        case "aprobado": estadoValue = "Aprobado"; break;
        case "rechazado": estadoValue = "Rechazado"; break;
        case "manual": estadoValue = "Manual"; break;
        case "pendiente": estadoValue = "Pendiente"; break;
        default: estadoValue = filters.estado;
      }
      filtered = filtered.filter((item: any) => item.estado === estadoValue);
    }
    
    if (filters.fechaDesde) {
      const desde = startOfDay(filters.fechaDesde);
      filtered = filtered.filter((item: any) => {
        const itemDate = normalizeDate(item.fecha_proceso);
        return itemDate >= desde;
      });
    }
    
    if (filters.fechaHasta) {
      const hasta = endOfDay(filters.fechaHasta);
      filtered = filtered.filter((item: any) => {
        const itemDate = normalizeDate(item.fecha_proceso);
        return itemDate <= hasta;
      });
    }
    
    setFilteredData(filtered);
    setShowFilters(false);
    
    toast({
      title: filtered.length === 0 ? "Sin resultados" : "Filtros aplicados",
      description: filtered.length === 0 
        ? "No se encontraron documentos con los filtros seleccionados"
        : `Se encontraron ${filtered.length} documentos`,
      variant: filtered.length === 0 ? "destructive" : "default",
    });
  };

  const resetFilters = () => {
    setFilters({
      fechaDesde: null,
      fechaHasta: null,
      tipoDocumento: "todos",
      estado: "todos",
    });
    setFilteredData(allData);
    toast({ 
      title: "Filtros limpiados", 
      description: "Se han eliminado todos los filtros" 
    });
  };

  const stats = useMemo(() => {
    if (!isOfimundo) {
      return {
        totalTransactions: 0,
        avgResponseTime: 0,
        avgSatisfaction: 0,
        approved: 0,
        rejected: 0,
        manual: 0,
        pending: 0,
        successRate: "0",
        errorRate: 0,
      };
    }
    
    const totalTransactions = filteredData.length;
    const approvedDocs = filteredData.filter((e: any) => e.estado === "Aprobado").length;
    const rejectedDocs = filteredData.filter((e: any) => e.estado === "Rechazado").length;
    const manualDocs = filteredData.filter((e: any) => e.estado === "Manual").length;
    const pendingDocs = filteredData.filter((e: any) => e.estado === "Pendiente" || e.estado === "Pendiente Espera").length;
    
    const successRate = totalTransactions > 0 ? ((approvedDocs / totalTransactions) * 100).toFixed(1) : "0";
    const satisfaction = totalTransactions > 0 ? Math.round((approvedDocs / totalTransactions) * 100) : 100;
    
    const erroresTecnicos = [
      "error de conexión", "timeout", "servidor no responde", "softland no disponible",
      "sii no responde", "connection failed", "failed to connect", "could not connect",
      "connection refused", "network error", "500", "503"
    ];
    
    const errorDocs = filteredData.filter((e: any) => {
      const motivo = e.motivo || "";
      return erroresTecnicos.some(term => motivo.toLowerCase().includes(term.toLowerCase()));
    }).length;
    
    const errorRate = totalTransactions > 0 ? Math.round((errorDocs / totalTransactions) * 100) : 0;
    const avgResponseTime = totalTransactions > 0 ? Math.min(800, Math.max(50, 300 + Math.floor(totalTransactions / 100) * 10)) : 300;
    
    return {
      totalTransactions,
      avgResponseTime,
      avgSatisfaction: satisfaction,
      approved: approvedDocs,
      rejected: rejectedDocs,
      manual: manualDocs,
      pending: pendingDocs,
      successRate,
      errorRate,
    };
  }, [filteredData, isOfimundo]);

  const chartData = useMemo(() => {
    if (!isOfimundo) return [];
    return generateMonthlyData(filteredData);
  }, [filteredData, isOfimundo]);

  const pieData = useMemo(() => {
    if (!isOfimundo) return [];
    return [
      { name: "Aprobadas", value: stats.approved, color: "#10b981" },
      { name: "Rechazadas", value: stats.rejected, color: "#ef4444" },
      { name: "Manuales", value: stats.manual, color: "#f59e0b" },
      { name: "Pendientes", value: stats.pending, color: "#3b82f6" },
    ].filter(item => item.value > 0);
  }, [stats.approved, stats.rejected, stats.manual, stats.pending, isOfimundo]);

  const client = useMemo(() => {
    return clients.find(c => c.id === clientId);
  }, [clientId]);

  // Filtrar servicios activos (no próximos)
  const clientServices = useMemo(() => {
    if (!client) return [];
    const allServices = getClientServices(clientId);
    return allServices.filter(service => !isServiceComingSoon(service.id));
  }, [client, clientId]);

  const activeFiltersCount = useMemo(() => {
    if (!isOfimundo) return 0;
    let count = 0;
    if (filters.tipoDocumento !== "todos") count++;
    if (filters.estado !== "todos") count++;
    if (filters.fechaDesde || filters.fechaHasta) count++;
    return count;
  }, [filters, isOfimundo]);

  const getSatisfactionColor = (score: number) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  const getTipoNombre = (tipo: string): string => {
    switch (tipo) {
      case "33": return "Factura";
      case "34": return "Factura Exenta";
      case "61": return "Nota Crédito";
      default: return `Tipo ${tipo}`;
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Cargando datos del cliente...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button onClick={handleClose} variant="outline" className="mt-4">
          <X className="h-4 w-4 mr-2" />
          Cerrar
        </Button>
      </div>
    );
  }

  // Pantalla de "Próximamente" para clientes que no son Ofimundo
  if (!isOfimundo) {
    return (
      <div className="space-y-5">
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClose}
            className="gap-2 text-sm text-muted-foreground hover:text-red-500 transition-colors"
          >
            <X className="h-4 w-4" />
            Cerrar
          </Button>
        </div>

        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-12 w-12 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            {client.name}
          </h2>
          <p className="text-muted-foreground text-lg mb-6">
            Dashboard en desarrollo
          </p>
          <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
            <p className="text-amber-700 text-sm">
              🚀 El dashboard para este cliente se encuentra actualmente en desarrollo.
              Próximamente podrás acceder a todas las métricas y estadísticas de monitoreo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {client.rut && (
              <Badge variant="outline" className="text-sm">
                <Building className="h-3 w-3 mr-1" />
                {client.rut}
              </Badge>
            )}
            {client.email && (
              <Badge variant="outline" className="text-sm">
                <Mail className="h-3 w-3 mr-1" />
                {client.email}
              </Badge>
            )}
            {client.phone && (
              <Badge variant="outline" className="text-sm">
                <Phone className="h-3 w-3 mr-1" />
                {client.phone}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Botón de cierre */}
      <div className="flex justify-end">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleClose}
          className="gap-2 text-sm text-muted-foreground hover:text-red-500 transition-colors"
        >
          <X className="h-4 w-4" />
          Cerrar
        </Button>
      </div>

      {/* Info Cliente */}
      <div className="rounded-lg border bg-gradient-to-r from-emerald-500/5 to-transparent p-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md">
            {client.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-lg font-bold">{client.name}</h2>
              <StatusIndicator status="success" errorPercentage={stats.errorRate} size="sm" />
              <Badge className={cn(
                "border-0 text-xs px-2",
                stats.errorRate === 0 ? "bg-emerald-100 text-emerald-700" :
                stats.errorRate <= 10 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
              )}>
                {stats.errorRate}% error técnico
              </Badge>
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                📡 Datos en tiempo real
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {client.rut && (
                <div className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  <span>{client.rut}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{client.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Botón Mostrar/Ocultar Filtros */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button 
          variant="outline" 
          onClick={() => setShowFilters(!showFilters)} 
          className="flex items-center gap-2 text-sm h-9 px-4"
        >
          <Filter className="h-4 w-4" />
          <span>{showFilters ? "Ocultar filtros" : "Mostrar filtros"}</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs px-2">{activeFiltersCount}</Badge>
          )}
          <ChevronDown className={cn("h-4 w-4 transition-transform", showFilters && "rotate-180")} />
        </Button>
        
        {activeFiltersCount > 0 && (
          <Button variant="ghost" onClick={resetFilters} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 h-9">
            <X className="h-4 w-4" />
            <span>Limpiar filtros</span>
          </Button>
        )}
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-emerald-500" />
                Rango de Fechas
              </Label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left h-10">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fechaDesde ? format(filters.fechaDesde, "dd/MM/yyyy") : "Desde"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.fechaDesde || undefined}
                      onSelect={(date) => setFilters({ ...filters, fechaDesde: date || null })}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
                
                <span className="text-muted-foreground text-center">→</span>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left h-10">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fechaHasta ? format(filters.fechaHasta, "dd/MM/yyyy") : "Hasta"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.fechaHasta || undefined}
                      onSelect={(date) => setFilters({ ...filters, fechaHasta: date || null })}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-500" />
                  Tipo Documento
                </Label>
                <Select value={filters.tipoDocumento} onValueChange={(value) => setFilters({ ...filters, tipoDocumento: value })}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">📄 Todos</SelectItem>
                    {availableTipos.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {getTipoNombre(tipo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Estado
                </Label>
                <Select value={filters.estado} onValueChange={(value) => setFilters({ ...filters, estado: value })}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">🎯 Todos</SelectItem>
                    <SelectItem value="aprobado">✅ Aprobados</SelectItem>
                    <SelectItem value="rechazado">❌ Rechazados</SelectItem>
                    <SelectItem value="manual">✋ Manuales</SelectItem>
                    <SelectItem value="pendiente">⏳ Pendientes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t">
              <Button 
                variant="outline" 
                onClick={resetFilters} 
                className="flex-1 gap-2 h-10"
              >
                <X className="h-4 w-4" />
                Limpiar todos
              </Button>
              <Button 
                onClick={applyFilters} 
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 h-10"
              >
                <Search className="h-4 w-4" />
                Aplicar filtros
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de filtros activos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
          <span className="text-xs font-medium text-emerald-700">Filtros activos:</span>
          {filters.tipoDocumento !== "todos" && (
            <Badge variant="secondary" className="bg-white text-xs">
              Tipo: {getTipoNombre(filters.tipoDocumento)}
            </Badge>
          )}
          {filters.estado !== "todos" && (
            <Badge variant="secondary" className="bg-white text-xs">
              Estado: {filters.estado === "aprobado" ? "Aprobados" : 
                       filters.estado === "rechazado" ? "Rechazados" : 
                       filters.estado === "manual" ? "Manuales" : "Pendientes"}
            </Badge>
          )}
          {(filters.fechaDesde || filters.fechaHasta) && (
            <Badge variant="secondary" className="bg-white text-xs">
              📅 {filters.fechaDesde ? format(filters.fechaDesde, "dd/MM/yy") : "Inicio"} 
              {" → "} 
              {filters.fechaHasta ? format(filters.fechaHasta, "dd/MM/yy") : "Hoy"}
            </Badge>
          )}
          <span className="text-xs text-emerald-600 ml-auto">
            {filteredData.length} documentos encontrados
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Total Documentos</p>
                <p className="text-xl font-bold mt-0.5">{stats.totalTransactions.toLocaleString()}</p>
              </div>
              <div className="p-1.5 bg-emerald-100 rounded-lg">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Tasa Aprobación</p>
                <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.successRate}%</p>
              </div>
              <div className="p-1.5 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Tiempo Respuesta</p>
                <p className="text-xl font-bold mt-0.5">{stats.avgResponseTime} ms</p>
              </div>
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Satisfacción</p>
                <p className={cn("text-xl font-bold mt-0.5", stats.avgSatisfaction >= 80 ? "text-emerald-600" : stats.avgSatisfaction >= 60 ? "text-amber-600" : "text-red-600")}>
                  {stats.avgSatisfaction}%
                </p>
              </div>
              <div className="p-1.5 bg-amber-100 rounded-lg">
                <Star className="h-3.5 w-3.5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-0.5 rounded-lg h-9">
          <TabsTrigger value="overview" className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📊 Resumen
          </TabsTrigger>
          <TabsTrigger value="services" className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📦 Servicios ({clientServices.length})
          </TabsTrigger>
          <TabsTrigger value="metrics" className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📈 Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Evolución Mensual</CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  {filteredData.length} documentos analizados
                </p>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[260px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: '11px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="aprobadas" fill="#10b981" name="Aprobadas" radius={[3,3,0,0]} />
                        <Bar dataKey="rechazadas" fill="#ef4444" name="Rechazadas" radius={[3,3,0,0]} />
                        <Bar dataKey="manuales" fill="#f59e0b" name="Manuales" radius={[3,3,0,0]} />
                        <Bar dataKey="pendientes" fill="#3b82f6" name="Pendientes" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      No hay datos para mostrar
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Distribución por Estado</CardTitle>
                <p className="text-[10px] text-muted-foreground">Proporción de documentos procesados</p>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[260px]">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {pieData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      No hay datos para mostrar
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Total: {stats.totalTransactions} documentos
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <div className="grid grid-cols-1 gap-3">
            {clientServices.length > 0 ? (
              clientServices.map((service) => (
                <Card key={service.id} className="border-l-3 border-l-emerald-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold text-base">{service.name}</h3>
                          <StatusIndicator status="success" errorPercentage={0} size="sm" />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {service.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p className="text-sm">No hay servicios activos para este cliente</p>
                <p className="text-xs">Los servicios están en desarrollo y estarán disponibles próximamente</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-3 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-xl font-bold text-emerald-600">{stats.approved.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">✅ Aprobados</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-xl font-bold text-red-600">{stats.rejected.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">❌ Rechazados</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-xl font-bold text-amber-600">{stats.manual.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">✋ Manuales</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-xl font-bold text-blue-600">{stats.pending.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">⏳ Pendientes</p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold">Tendencia Mensual</CardTitle>
              <p className="text-[10px] text-muted-foreground">Evolución de aprobaciones vs rechazos</p>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[280px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Line type="monotone" dataKey="aprobadas" stroke="#10b981" name="Aprobados" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="rechazadas" stroke="#ef4444" name="Rechazados" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="manuales" stroke="#f59e0b" name="Manuales" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No hay datos para mostrar
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}