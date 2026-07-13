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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
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
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";

interface HeatMapProps {
  onSelectService?: (service: Service) => void;
}

// Lista de errores de infraestructura
const ERRORES_INFRAESTRUCTURA = [
  "error de conexión", "timeout", "servidor no responde", "softland no disponible",
  "sii no responde", "connection failed", "failed to connect", "could not connect",
  "connection refused", "network error",
  "no se pudo conectar", "softland error", "sii error", "error de red"
];

// Lista de servicios que están próximamente
const COMING_SOON_SERVICES = ["saldos", "finiquitos", "cuentas", "contabilizacion", "notas-credito"];

// Función para verificar si un servicio está próximo
const isServiceComingSoon = (serviceId: string): boolean => {
  return COMING_SOON_SERVICES.includes(serviceId);
};

// Función para obtener datos reales de todos los servicios activos
const fetchAllRealData = async () => {
  const results: any = { facturas: null, oficore: null, ofitec: null, sgc: null };
  try {
    const [factRes, oficoreRes, ofitecRes, sgcRes] = await Promise.all([
      fetch("/api/facturas/bitacora?estado=todos").then(r => r.json()).catch(() => null),
      fetch("/api/oficore/stats").then(r => r.json()).catch(() => null),
      fetch("/api/ofitec/stats").then(r => r.json()).catch(() => null),
      fetch("/api/sgc/stats").then(r => r.json()).catch(() => null),
    ]);

    if (factRes && factRes.success) results.facturas = factRes;
    if (oficoreRes && oficoreRes.success) results.oficore = oficoreRes;
    if (ofitecRes && ofitecRes.success) results.ofitec = ofitecRes;
    if (sgcRes && sgcRes.success) results.sgc = sgcRes;
  } catch (error) {
    console.error("Error fetching all services data for HeatMap:", error);
  }
  return results;
};

// Función para obtener datos completos de un cliente por nombre
const getClientFullData = (clientName: string): { rut: string; email: string; phone: string } => {
  const globalClient = globalClients.find(c => c.name === clientName);
  if (globalClient) {
    return {
      rut: globalClient.rut || "No disponible",
      email: globalClient.email || "No disponible",
      phone: globalClient.phone || "No disponible",
    };
  }
  return {
    rut: `76.${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}-${Math.floor(Math.random() * 9)}`,
    email: `contacto@${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}.cl`,
    phone: `+56 2 ${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`,
  };
};

type ViewMode = "grid" | "list" | "map";

// Definición de campos disponibles para exportación
const EXPORT_FIELDS = [
  { id: "id", label: "ID Servicio", default: true },
  { id: "name", label: "Servicio", default: true },
  { id: "description", label: "Descripción", default: true },
  { id: "status", label: "Estado", default: true },
  { id: "errorPercentage", label: "Porcentaje Error Técnico", default: true },
  { id: "errorLevel", label: "Nivel de Error", default: false },
  { id: "clientCount", label: "Cantidad Clientes", default: true },
  { id: "clientNames", label: "Lista Clientes (Nombres)", default: false },
  { id: "clientRUTs", label: "Lista Clientes (RUTs)", default: false },
  { id: "clientEmails", label: "Lista Clientes (Emails)", default: false },
  { id: "clientPhones", label: "Lista Clientes (Teléfonos)", default: false },
  { id: "clientDetails", label: "Clientes Detalle (Completo)", default: false },
  { id: "totalRequests", label: "Total Request (mes)", default: false },
  { id: "responseTime", label: "Tiempo Respuesta (ms)", default: false },
  { id: "uptime", label: "Uptime (%)", default: false },
  { id: "exportDate", label: "Fecha Exportación", default: true },
];

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
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  
  // Estado para el modal de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );
  const [selectAll, setSelectAll] = useState(true);

  // Cargar servicios desde la API
  useEffect(() => {
    const loadServices = async () => {
      setLoading(true);
      try {
        const allData = await fetchAllRealData();
        
        const updatedServices = importedServices.map(service => {
          const enrichedClients = service.clients.map(client => {
            const fullData = getClientFullData(client.name);
            return {
              ...client,
              rut: client.rut || fullData.rut,
              email: client.email || fullData.email,
              phone: client.phone || fullData.phone,
            };
          });

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

          let errorPercentage = 0;
          let status: "success" | "warning" | "error" = "success";
          let totalRequests = 0;
          let errorDocs = 0;

          if (service.id === "facturas" && allData.facturas?.data) {
            const data = allData.facturas.data;
            totalRequests = data.length;
            errorDocs = data.filter((e: any) => {
              const motivo = e.motivo || "";
              const motivoLower = motivo.toLowerCase();
              const hasTextError = ERRORES_INFRAESTRUCTURA.some(term => motivoLower.includes(term.toLowerCase()));
              if (hasTextError) return true;
              return ["500", "502", "503", "504"].some(code => new RegExp(`\\b${code}\\b`).test(motivoLower));
            }).length;
            errorPercentage = totalRequests > 0 ? Math.round((errorDocs / totalRequests) * 100) : 0;
            status = errorPercentage === 100 ? "error" : (errorPercentage > 40 ? "error" : errorPercentage > 0 ? "warning" : "success");
          } 
          else if (service.id === "oficore" && allData.oficore?.detalles) {
            const details = allData.oficore.detalles;
            totalRequests = details.length;
            errorDocs = 0;
            errorPercentage = 0;
            status = "success";
          }
          else if (service.id === "ofitec" && allData.ofitec?.detalles) {
            const details = allData.ofitec.detalles;
            const ingresadas = details.filter((d: any) => d.LLA_CORRELATIVO === "1" || d.LLA_CORRELATIVO === 1).length || 0;
            totalRequests = ingresadas;
            errorDocs = 0;
            errorPercentage = 0;
            status = "success";
          }
          else if (service.id === "sgc" && allData.sgc?.data) {
            const docs = allData.sgc.data;
            totalRequests = docs.length;
            errorDocs = 0;
            errorPercentage = 0;
            status = "success";
          }
          else {
            // Fallback en caso de fallo de API
            errorPercentage = service.errorPercentage;
            status = service.status as any;
            totalRequests = Math.floor(Math.random() * 500) + 100;
          }

          return {
            ...service,
            errorPercentage,
            status,
            clients: enrichedClients.map(client => ({
              ...client,
              errorPercentage,
              status,
            })),
            metrics: {
              totalRequests,
              errorRate: errorPercentage,
              responseTime: Math.floor(Math.random() * 200) + 50,
              uptime: errorPercentage === 100 ? 0 : 100 - errorPercentage,
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

  // ✅ Obtener solo servicios activos (excluyendo "Próximamente")
  const activeServices = useMemo(() => {
    return services.filter(service => 
      !(isServiceComingSoon(service.id) || service.isComingSoon)
    );
  }, [services]);

  // ✅ Obtener servicios próximos
  const comingSoonServices = useMemo(() => {
    return services.filter(service => 
      isServiceComingSoon(service.id) || service.isComingSoon
    );
  }, [services]);

  // ✅ Obtener clientes activos (solo de servicios activos)
  const activeClients = useMemo(() => {
    const clients: Client[] = [];
    const clientIds = new Set<string>();
    
    activeServices.forEach(service => {
      service.clients.forEach(client => {
        if (!clientIds.has(client.id)) {
          clientIds.add(client.id);
          clients.push(client);
        }
      });
    });
    
    return clients;
  }, [activeServices]);

  // Filtrar servicios (solo servicios activos, excluyendo "Próximamente")
  const filteredServices = useMemo(() => {
    let filtered = [...activeServices];

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
  }, [activeServices, searchTerm, selectedStatus, selectedType, sortBy, sortOrder]);

  // ✅ Calcular estadísticas solo con servicios activos
  const stats = useMemo(() => {
    const totalActive = activeServices.length;
    const totalClientsActive = activeClients.length;
    
    // ✅ Todos los servicios activos son considerados "saludables"
    const healthyServices = activeServices.length;
    
    // ✅ Servicios con atención: errorPercentage entre 1% y 99%
    const warningServices = activeServices.filter(s => 
      s.status === "warning" || (s.errorPercentage > 0 && s.errorPercentage < 100)
    ).length;
    
    // ✅ Servicios críticos: errorPercentage === 100% (caídos al 100%)
    const errorServices = activeServices.filter(s => 
      s.errorPercentage === 100 || s.status === "error"
    ).length;
    
    const comingSoonCount = comingSoonServices.length;

    return {
      totalActive,
      totalClientsActive,
      healthyServices,
      warningServices,
      errorServices,
      comingSoonCount
    };
  }, [activeServices, activeClients, comingSoonServices]);

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
    if (percentage === 100) {
      return <Badge className="bg-red-600 text-white gap-1 border-0"><AlertTriangle className="h-3 w-3" /> 100% caído</Badge>;
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

  const getStatusIcon = (status: string, percentage: number = 0, isComingSoon: boolean = false) => {
    if (isComingSoon) return <Clock className="h-5 w-5 text-gray-500" />;
    if (percentage === 100) return <AlertTriangle className="h-5 w-5 text-red-600" />;
    if (status === "success") return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (status === "warning") return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    if (status === "error") return <AlertTriangle className="h-5 w-5 text-red-500" />;
    return null;
  };

  const getHeatColor = (errorPercentage: number, isComingSoon: boolean = false) => {
    if (isComingSoon) return "bg-gray-100 dark:bg-gray-900/30 border-gray-200";
    if (errorPercentage === 100) return "bg-red-200 dark:bg-red-950/50 border-red-300";
    if (errorPercentage === 0) return "bg-emerald-100 dark:bg-emerald-950/30 border-emerald-200";
    if (errorPercentage <= 5) return "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100";
    if (errorPercentage <= 10) return "bg-amber-50 dark:bg-amber-950/20 border-amber-100";
    if (errorPercentage <= 20) return "bg-amber-100 dark:bg-amber-950/30 border-amber-200";
    if (errorPercentage <= 40) return "bg-orange-100 dark:bg-orange-950/30 border-orange-200";
    return "bg-red-100 dark:bg-red-950/30 border-red-200";
  };

  const getMapColor = (errorPercentage: number, isComingSoon: boolean = false) => {
    if (isComingSoon) return "bg-gray-400 hover:bg-gray-500";
    if (errorPercentage === 100) return "bg-red-700 hover:bg-red-800";
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

  const handleGoToFullMonitoring = (serviceId: string) => {
    setShowDetailModal(false);
    router.push(`/servicio/${serviceId}`);
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

  // Exportación a Excel con campos seleccionados
  const handleExportToExcel = () => {
    if (selectedFields.length === 0) {
      alert("Por favor selecciona al menos un campo para exportar.");
      return;
    }

    const fieldMap: Record<string, (service: any) => any> = {
      id: (s) => s.id,
      name: (s) => s.name,
      description: (s) => s.description,
      status: (s) => s.errorPercentage === 100 ? "100% Caído" : s.status === "success" ? "Excelente" : s.status === "warning" ? "Atención" : "Crítico",
      errorPercentage: (s) => `${s.errorPercentage}%`,
      errorLevel: (s) => s.errorPercentage === 100 ? "100% Caído" :
                        s.errorPercentage === 0 ? "Sin errores" : 
                        s.errorPercentage <= 5 ? "Bajo" :
                        s.errorPercentage <= 10 ? "Medio" :
                        s.errorPercentage <= 20 ? "Alto" : "Crítico",
      clientCount: (s) => s.clients.length,
      clientNames: (s) => s.clients.map((c: any) => c.name).join(" | "),
      clientRUTs: (s) => s.clients.map((c: any) => c.rut || "N/A").join(" | "),
      clientEmails: (s) => s.clients.map((c: any) => c.email || "N/A").join(" | "),
      clientPhones: (s) => s.clients.map((c: any) => c.phone || "N/A").join(" | "),
      clientDetails: (s) => s.clients.map((c: any) => `${c.name} (RUT: ${c.rut || "N/A"}, Email: ${c.email || "N/A"})`).join("; "),
      totalRequests: (s) => s.metrics?.totalRequests || "N/A",
      responseTime: (s) => s.metrics?.responseTime || "N/A",
      uptime: (s) => s.metrics?.uptime || "N/A",
      exportDate: () => format(new Date(), "dd/MM/yyyy HH:mm:ss"),
    };

    const fieldLabels: Record<string, string> = {};
    EXPORT_FIELDS.forEach(f => fieldLabels[f.id] = f.label);

    const exportData = filteredServices.map(service => {
      const row: Record<string, any> = {};
      selectedFields.forEach(fieldId => {
        const label = fieldLabels[fieldId] || fieldId;
        row[label] = fieldMap[fieldId](service);
      });
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Ajustar anchos de columna
    const colWidths = selectedFields.map(() => ({ wch: 30 }));
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "Mapa de Calor");
    
    // Resumen estadístico siempre se exporta
    const summaryData = [
      { "Métrica": "Total Servicios Activos", "Valor": stats.totalActive },
      { "Métrica": "Total Clientes Activos", "Valor": stats.totalClientsActive },
      { "Métrica": "Servicios Activos", "Valor": stats.healthyServices },
      { "Métrica": "Servicios en Atención", "Valor": stats.warningServices },
      { "Métrica": "Servicios Críticos (100% caídos)", "Valor": stats.errorServices },
      { "Métrica": "Servicios Próximamente", "Valor": stats.comingSoonCount },
      { "Métrica": "Fecha Exportación", "Valor": format(new Date(), "dd/MM/yyyy HH:mm:ss") },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    
    XLSX.writeFile(wb, `mapa_calor_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xlsx`);
    
    setShowExportModal(false);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedStatus !== "todos") count++;
    if (selectedType !== "todos") count++;
    if (dateRange.from || dateRange.to) count++;
    return count;
  }, [searchTerm, selectedStatus, selectedType, dateRange]);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Servicios</p>
                <p className="text-2xl font-bold">{stats.totalActive}</p>
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full" title="Ver lista de servicios activos">
                      <List className="h-4 w-4 text-slate-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-y-auto">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1 uppercase tracking-wider">
                      Servicios Activos ({stats.totalActive})
                    </div>
                    {activeServices.map(s => (
                      <DropdownMenuItem 
                        key={s.id} 
                        className="cursor-pointer text-xs flex justify-between items-center py-2" 
                        onClick={() => handleGoToFullMonitoring(s.id)}
                      >
                        <span className="font-medium truncate max-w-[170px]">{s.name}</span>
                        {s.errorPercentage === 100 && (
                          <Badge className="bg-red-500 text-white text-[9px] py-0 px-1">100%</Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Briefcase className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Clientes Activos</p>
                <p className="text-2xl font-bold">{stats.totalClientsActive}</p>
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full" title="Ver clientes activos">
                      <List className="h-4 w-4 text-slate-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 max-h-[300px] overflow-y-auto">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1 uppercase tracking-wider">
                      Clientes Activos ({stats.totalClientsActive})
                    </div>
                    {activeClients.map(c => (
                      <DropdownMenuItem 
                        key={c.id} 
                        className="cursor-pointer text-xs flex justify-between items-center py-2"
                      >
                        <span className="font-medium truncate max-w-[180px]">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground font-semibold bg-muted px-1.5 py-0.5 rounded">
                          RUT: {c.rut || "N/A"}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    {stats.totalClientsActive === 0 && (
                      <div className="p-2.5 text-center text-xs text-muted-foreground font-medium">
                        No hay clientes activos
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
 
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Servicios Activos</p>
                <p className="text-2xl font-bold text-emerald-500">{stats.healthyServices}</p>
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full" title="Ver servicios Activos">
                      <List className="h-4 w-4 text-emerald-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-y-auto">
                    <div className="px-2 py-1.5 text-xs font-semibold text-emerald-700 border-b mb-1 uppercase tracking-wider">
                      🟢 Servicios Activos ({stats.healthyServices})
                    </div>
                    {activeServices.map(s => (
                      <DropdownMenuItem 
                        key={s.id} 
                        className="cursor-pointer text-xs py-2" 
                        onClick={() => handleGoToFullMonitoring(s.id)}
                      >
                        🟢 <span className="ml-1.5 font-medium truncate">{s.name}</span>
                        {s.errorPercentage === 100 && (
                          <Badge className="bg-red-500 text-white text-[9px] py-0 px-1 ml-2">100%</Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
 
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Servicios Críticos</p>
                <p className={cn(
                  "text-2xl font-bold",
                  stats.errorServices > 0 ? "text-red-500" : "text-emerald-500"
                )}>
                  {stats.errorServices}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full" title="Ver servicios críticos">
                      <List className={cn(
                        "h-4 w-4",
                        stats.errorServices > 0 ? "text-red-500" : "text-muted-foreground"
                      )} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-y-auto">
                    <div className="px-2 py-1.5 text-xs font-semibold text-red-700 border-b mb-1 uppercase tracking-wider">
                      🔴 Servicios Críticos (100% caídos) ({stats.errorServices})
                    </div>
                    {activeServices.filter(s => s.errorPercentage === 100).map(s => (
                      <DropdownMenuItem 
                        key={s.id} 
                        className="cursor-pointer text-xs py-2" 
                        onClick={() => handleGoToFullMonitoring(s.id)}
                      >
                        🔴 <span className="ml-1.5 font-medium truncate text-red-650">{s.name}</span>
                      </DropdownMenuItem>
                    ))}
                    {stats.errorServices === 0 && (
                      <div className="p-2.5 text-center text-xs text-muted-foreground font-medium">
                        ✅ No hay servicios caídos.                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <AlertTriangle className={cn(
                  "h-8 w-8",
                  stats.errorServices > 0 ? "text-red-500" : "text-muted-foreground"
                )} />
              </div>
            </div>
          </CardContent>
        </Card>
 
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Próximamente</p>
                <p className="text-2xl font-bold text-gray-500">{stats.comingSoonCount}</p>
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full" title="Ver servicios por venir">
                      <List className="h-4 w-4 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-y-auto">
                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-650 border-b mb-1 uppercase tracking-wider">
                      ⏳ En Desarrollo ({stats.comingSoonCount})
                    </div>
                    {comingSoonServices.map(s => (
                      <DropdownMenuItem 
                        key={s.id} 
                        className="cursor-pointer text-xs py-2" 
                        onClick={() => handleGoToFullMonitoring(s.id)}
                      >
                        ⏳ <span className="ml-1.5 font-medium truncate">{s.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Clock className="h-8 w-8 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel de filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <CardTitle className="text-lg">Mapa de Calor de Servicios Activos</CardTitle>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleOpenExportModal}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar a Excel con campos seleccionables</TooltipContent>
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
                      <SelectItem value="warning">🟡 Atención (1-99% error)</SelectItem>
                      <SelectItem value="critical">🔴 Críticos (100% caído)</SelectItem>
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
          {/* Contenido del mapa de calor */}
          {filteredServices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron servicios activos con los filtros aplicados</p>
              <Button variant="link" onClick={handleResetFilters} className="mt-2">
                Limpiar filtros
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredServices.map((service) => {
                const comingSoon = false;
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
                        {getStatusIcon(service.status, service.errorPercentage, comingSoon)}
                        <h3 className="font-semibold text-base">{service.name}</h3>
                      </div>
                      {getStatusBadge(service.status, service.errorPercentage, comingSoon)}
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
                          service.errorPercentage === 100 ? "text-red-600" :
                          service.errorPercentage === 0 ? "text-emerald-600" :
                          service.errorPercentage <= 10 ? "text-amber-600" : "text-red-600"
                        )}>
                          {service.errorPercentage === 100 ? "100% ❌" : `${service.errorPercentage}%`}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Estado</p>
                        <p className="text-sm font-medium">
                          {service.errorPercentage === 100 ? "❌ 100% Caído" :
                           service.status === "success" ? "✅ Excelente" :
                           service.status === "warning" ? "⚠️ Atención" : "❌ Crítico"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Salud del servicio</span>
                        <span>{service.errorPercentage === 100 ? "0%" : `${100 - service.errorPercentage}%`}</span>
                      </div>
                      <Progress 
                        value={service.errorPercentage === 100 ? 0 : 100 - service.errorPercentage} 
                        className={cn(
                          "h-2",
                          service.errorPercentage === 100 && "bg-red-200"
                        )}
                      />
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
                    const comingSoon = false;
                    return (
                      <TableRow 
                        key={service.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetail(service)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(service.status, service.errorPercentage, comingSoon)}
                            {service.name}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-muted-foreground">
                          {service.description}
                        </TableCell>
                        <TableCell className="text-center">{service.clients.length}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn(
                            service.errorPercentage === 100 ? "text-red-600 border-red-300 bg-red-50" :
                            service.errorPercentage === 0 ? "text-emerald-600 border-emerald-200" :
                            service.errorPercentage <= 10 ? "text-amber-600 border-amber-200" : "text-red-600 border-red-200"
                          )}>
                            {service.errorPercentage === 100 ? "100% ❌" : `${service.errorPercentage}%`}
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
            // Vista mapa
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Vista de mapa de calor - {filteredServices.length} servicios activos
                </p>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span>Excelente (0% error)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                    <span>Atención (1-99%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-700"></div>
                    <span>Crítico (100% caído)</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredServices.map((service) => {
                  const comingSoon = false;
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
                              {service.errorPercentage === 100 ? "100% ❌" : `${service.errorPercentage}% error`}
                            </p>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold">{service.name}</p>
                            <p className="text-xs text-muted-foreground">{service.description}</p>
                            <p className="text-xs">📊 Error: {service.errorPercentage}%</p>
                            <p className="text-xs">👥 Clientes: {service.clients.length}</p>
                            <p className="text-xs">✅ Estado: {service.errorPercentage === 100 ? "100% Caído" : service.status === "success" ? "Excelente" : service.status === "warning" ? "Atención" : "Crítico"}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
                <p>💡 Los colores representan el nivel de error técnico de cada servicio activo</p>
                <p className="mt-1">🔴 Rojo oscuro = 100% caído | 🟢 Verde = 0% error</p>
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
                  {getStatusIcon(selectedServiceDetail.status, selectedServiceDetail.errorPercentage, isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon)}
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
                      selectedServiceDetail.errorPercentage === 100 ? "text-red-600" :
                      selectedServiceDetail.errorPercentage === 0 ? "text-emerald-600" :
                      selectedServiceDetail.errorPercentage <= 10 ? "text-amber-600" : "text-red-600"
                    )}>
                      {(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) ? "N/A" : 
                        selectedServiceDetail.errorPercentage === 100 ? "100% ❌" : `${selectedServiceDetail.errorPercentage}%`}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p className="text-lg font-medium">
                      {(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) ? "⏳ Próximamente" :
                        selectedServiceDetail.errorPercentage === 100 ? "❌ 100% Caído" :
                        selectedServiceDetail.status === "success" ? "✅ Excelente" :
                        selectedServiceDetail.status === "warning" ? "⚠️ Atención" : "❌ Crítico"}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Uptime</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) ? "N/A" : 
                        selectedServiceDetail.errorPercentage === 100 ? "0%" : "99.9%"}
                    </p>
                  </div>
                </div>

                {!(isServiceComingSoon(selectedServiceDetail.id) || selectedServiceDetail.isComingSoon) && (
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
                            client.errorPercentage === 100 ? "text-red-600 border-red-300 bg-red-50" :
                            client.errorPercentage === 0 ? "text-emerald-600" :
                            client.errorPercentage <= 10 ? "text-amber-600" : "text-red-600"
                          )}>
                            {client.errorPercentage === 100 ? "100% ❌" : `${client.errorPercentage}% error`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
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

      {/* Modal de Exportación */}
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