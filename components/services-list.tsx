// app/components/services-list.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { services, clients, getClientById, getClientServices, type Service, type Client } from "@/lib/services-data";
import { StatusIndicator } from "@/components/status-indicator";
import { ClientDashboard } from "@/components/client-dashboard";
import { cn } from "@/lib/utils";
import {
  Filter,
  X,
  Search,
  AlertCircle,
  CheckCircle,
  Eye,
  FileSpreadsheet,
  ChevronDown,
  Check,
  LayoutDashboard,
  Clock,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface Filters {
  search: string;
  status: string[];
  minError: number;
  maxError: number;
}

// Lista de servicios que están próximamente
const COMING_SOON_SERVICES = ["saldos", "finiquitos", "cuentas", "dte", "contabilizacion", "notas-credito"];

// ✅ SOLO ERRORES DE INFRAESTRUCTURA REALES
const ERRORES_INFRAESTRUCTURA = [
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
  "base de datos caída",
  "sql server no disponible",
  "database error",
  "error de base de datos",
  "timeout",
  "request timeout",
  "gateway timeout",
  "network error",
  "socket hang up",
  "ECONNREFUSED",
  "ENOTFOUND",
  "502", "503", "504", "500"
];

const NO_INFRAESTRUCTURA = [
  "sii", "dte", "reclamar", "aceptado", "registrado previamente",
  "evento registrado", "acuso recibo", "desviación", "límite permitido",
  "reglas de negocio", "cumple con todas", "documento aprobado",
  "documento rechazado", "documento cumple", "aprobado exitosamente",
  "rechazado debido", "folio", "recibido", "asignado", "gestionando",
  "resuelto", "incompleto", "serv. técnico", "anulado", "re-abierto",
  "pendiente", "despachado", "finalizado", "soporte telefonico",
  "por coordinar", "presupuesto pendiente", "chequeo pendiente",
  "reporte completado", "llamadas sin solucion", "habilitacion por coordinar",
  "incompleto tecnico", "terminado", "despachada historico",
  "incompleto por repuesto", "confirmacion de equipo", "manual",
  "estado", "incidencia", "llamada", "sast"
];

const isInfraestructuraError = (motivo: string): boolean => {
  if (!motivo) return false;
  const motivoLower = motivo.toLowerCase();
  
  for (const term of NO_INFRAESTRUCTURA) {
    if (motivoLower.includes(term)) {
      return false;
    }
  }
  
  return ERRORES_INFRAESTRUCTURA.some(term => motivoLower.includes(term));
};

// Definición de campos disponibles para exportación
const EXPORT_FIELDS = [
  { id: "id", label: "ID Servicio", default: false },
  { id: "nombre", label: "Servicio", default: true },
  { id: "descripcion", label: "Descripción", default: true },
  { id: "estado", label: "Estado", default: true },
  { id: "errorPorcentaje", label: "Porcentaje de Error", default: true },
  { id: "errorNivel", label: "Nivel de Error", default: false },
  { id: "clientesTotal", label: "Total Clientes", default: true },
  { id: "clientesLista", label: "Lista de Clientes", default: false },
  { id: "fechaExportacion", label: "Fecha Exportación", default: true },
];

export function ServicesList() {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: ["success", "warning", "error"],
    minError: 0,
    maxError: 100,
  });
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDashboard, setShowClientDashboard] = useState(false);
  
  // Modal de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );
  const [selectAll, setSelectAll] = useState(true);

  // Función para verificar si un servicio está próximo
  const isComingSoon = (serviceId: string): boolean => {
    return COMING_SOON_SERVICES.includes(serviceId);
  };

  // ✅ Función para obtener el estado real de un servicio
  const getRealServiceStatus = (service: Service): "success" | "warning" | "error" => {
    // Si es un servicio "Próximamente", retornar success (pero se maneja con el flag)
    if (isComingSoon(service.id)) {
      return "success";
    }
    
    // Para facturas, recalcular basado en errores reales de infraestructura
    if (service.id === "facturas") {
      // Verificar si hay errores reales de infraestructura en los logs
      const hasRealInfraError = service.logs?.some((log: any) => 
        isInfraestructuraError(log.message) || 
        isInfraestructuraError(log.details) ||
        isInfraestructuraError(log.estado || "")
      );
      
      // Si no hay errores reales de infraestructura, es success
      if (!hasRealInfraError) {
        return "success";
      }
      
      // Si hay errores reales, usar el status actual
      return service.status || "success";
    }
    
    return service.status || "success";
  };

  // ✅ Función para obtener el porcentaje de error real
  const getRealErrorPercentage = (service: Service): number => {
    if (isComingSoon(service.id)) {
      return 0;
    }
    
    // Para facturas, el porcentaje de error real es 0 si no hay errores de infraestructura
    if (service.id === "facturas") {
      const hasRealInfraError = service.logs?.some((log: any) => 
        isInfraestructuraError(log.message) || 
        isInfraestructuraError(log.details) ||
        isInfraestructuraError(log.estado || "")
      );
      
      if (!hasRealInfraError) {
        return 0;
      }
    }
    
    return service.errorPercentage || 0;
  };

  const availableStatuses = [
    { value: "success", label: "Excelente (0% error)", color: "bg-green-500" },
    { value: "warning", label: "Atención (1-10% error)", color: "bg-yellow-500" },
    { value: "error", label: "Crítico (>10% error)", color: "bg-red-500" },
  ];

  const serviceNames = useMemo(() => {
    return services.map(service => ({
      value: service.name,
      label: service.name,
      errorPercentage: getRealErrorPercentage(service),
      status: getRealServiceStatus(service),
      isComingSoon: isComingSoon(service.id),
    }));
  }, [services]);

  const filteredServices = useMemo(() => {
    let result = [...services];

    if (filters.search) {
      result = result.filter(service =>
        service.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.status.length > 0 && filters.status.length < 3) {
      result = result.filter(service => {
        const realStatus = getRealServiceStatus(service);
        return filters.status.includes(realStatus);
      });
    }

    if (filters.minError > 0) {
      result = result.filter(service => {
        const realError = getRealErrorPercentage(service);
        return realError >= filters.minError;
      });
    }

    if (filters.maxError < 100) {
      result = result.filter(service => {
        const realError = getRealErrorPercentage(service);
        return realError <= filters.maxError;
      });
    }

    return result;
  }, [services, filters]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status.length < 3) count++;
    if (filters.minError > 0) count++;
    if (filters.maxError < 100) count++;
    return count;
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      search: "",
      status: ["success", "warning", "error"],
      minError: 0,
      maxError: 100,
    });
    setOpenSearch(false);
  };

  const toggleStatus = (statusValue: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(statusValue)
        ? prev.status.filter(s => s !== statusValue)
        : [...prev.status, statusValue]
    }));
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

    const fieldMap: Record<string, (service: any) => any> = {
      id: (s) => s.id,
      nombre: (s) => s.name,
      descripcion: (s) => s.isComingSoon ? "Próximamente - En desarrollo" : s.description,
      estado: (s) => {
        if (s.isComingSoon) return "Próximamente";
        const realStatus = getRealServiceStatus(s);
        return realStatus === "success" ? "Excelente" : realStatus === "warning" ? "Atención" : "Crítico";
      },
      errorPorcentaje: (s) => {
        if (s.isComingSoon) return "N/A";
        const realError = getRealErrorPercentage(s);
        return `${realError}%`;
      },
      errorNivel: (s) => {
        if (s.isComingSoon) return "N/A";
        const realError = getRealErrorPercentage(s);
        return realError === 0 ? "Sin errores" : 
               realError <= 5 ? "Bajo" :
               realError <= 10 ? "Medio" :
               realError <= 20 ? "Alto" : "Crítico";
      },
      clientesTotal: (s) => s.isComingSoon ? 0 : s.clients.length,
      clientesLista: (s) => s.isComingSoon ? "" : s.clients.map((c: any) => c.name).join(", "),
      fechaExportacion: () => format(new Date(), "dd/MM/yyyy HH:mm:ss"),
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
    
    XLSX.utils.book_append_sheet(wb, ws, "Servicios");
    
    // Resumen estadístico
    const summaryData = [
      { "Métrica": "Total Servicios", "Valor": filteredServices.length },
      { "Métrica": "Total Clientes", "Valor": filteredServices.reduce((acc, s) => acc + s.clients.length, 0) },
      { "Métrica": "Servicios Excelentes", "Valor": filteredServices.filter(s => getRealServiceStatus(s) === "success" && !isComingSoon(s.id)).length },
      { "Métrica": "Servicios en Atención", "Valor": filteredServices.filter(s => getRealServiceStatus(s) === "warning").length },
      { "Métrica": "Servicios Críticos", "Valor": filteredServices.filter(s => getRealServiceStatus(s) === "error").length },
      { "Métrica": "Servicios Próximamente", "Valor": filteredServices.filter(s => isComingSoon(s.id)).length },
      { "Métrica": "Fecha Exportación", "Valor": format(new Date(), "dd/MM/yyyy HH:mm:ss") },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    
    XLSX.writeFile(wb, `servicios_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xlsx`);
    
    setShowExportModal(false);
  };

  const getStatusColor = (service: Service) => {
    const comingSoon = isComingSoon(service.id);
    if (comingSoon) return "border-gray-200 bg-gray-50/50 hover:bg-gray-50";
    const realStatus = getRealServiceStatus(service);
    if (realStatus === "success") return "border-green-200 bg-green-50/50 hover:bg-green-50";
    if (realStatus === "warning") return "border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50";
    return "border-red-200 bg-red-50/50 hover:bg-red-50";
  };

  const getErrorBadgeColor = (service: Service) => {
    const comingSoon = isComingSoon(service.id);
    if (comingSoon) return "bg-gray-100 text-gray-600 border-gray-200";
    const realError = getRealErrorPercentage(service);
    if (realError === 0) return "bg-green-100 text-green-700 border-green-200";
    if (realError <= 10) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  const handleClientClick = (clientId: string) => {
    const fullClient = getClientById(clientId);
    if (fullClient) {
      setSelectedClient(fullClient);
      setShowClientDashboard(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de filtros */}
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

        <Button variant="outline" size="sm" onClick={handleOpenExportModal}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar a Excel
        </Button>
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Buscar servicio</Label>
                <Popover open={openSearch} onOpenChange={setOpenSearch}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openSearch}
                      className="w-full justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        {filters.search || "Seleccionar un servicio..."}
                      </div>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput 
                        placeholder="Buscar servicio por nombre..." 
                        value={filters.search}
                        onValueChange={(value) => setFilters({ ...filters, search: value })}
                      />
                      <CommandList>
                        <CommandEmpty>No se encontraron servicios.</CommandEmpty>
                        <CommandGroup heading="📋 Servicios disponibles">
                          {serviceNames.map((service) => (
                            <CommandItem
                              key={service.value}
                              value={service.value}
                              onSelect={(currentValue) => {
                                setFilters({ 
                                  ...filters, 
                                  search: currentValue === filters.search ? "" : currentValue 
                                });
                                setOpenSearch(false);
                              }}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  service.isComingSoon ? "bg-gray-400" :
                                  service.status === "success" ? "bg-green-500" :
                                  service.status === "warning" ? "bg-yellow-500" : "bg-red-500"
                                )} />
                                <span className="font-medium">{service.label}</span>
                                {service.isComingSoon && (
                                  <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                                    🚀 Próximamente
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    service.isComingSoon ? "text-gray-500 border-gray-200" :
                                    service.errorPercentage === 0 ? "text-green-600 border-green-200" :
                                    service.errorPercentage <= 10 ? "text-yellow-600 border-yellow-200" : 
                                    "text-red-600 border-red-200"
                                  )}
                                >
                                  {service.isComingSoon ? "N/A" : `${service.errorPercentage}% error`}
                                </Badge>
                                {filters.search === service.value && (
                                  <Check className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Haz clic para ver la lista de todos los servicios disponibles
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Estado del servicio</Label>
                  <div className="space-y-2">
                    {availableStatuses.map(status => (
                      <div key={status.value} className="flex items-center gap-2">
                        <Checkbox
                          checked={filters.status.includes(status.value)}
                          onCheckedChange={() => toggleStatus(status.value)}
                          id={`status-${status.value}`}
                        />
                        <Label htmlFor={`status-${status.value}`} className="cursor-pointer flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", status.color)} />
                          {status.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Error mínimo: {filters.minError}%
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={filters.minError}
                    onChange={(e) => setFilters({ ...filters, minError: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Error máximo: {filters.maxError}%
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={filters.maxError}
                    onChange={(e) => setFilters({ ...filters, maxError: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
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
          </CardContent>
        </Card>
      )}

      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center p-3 bg-muted/30 rounded-lg">
          <span className="text-sm font-medium text-muted-foreground">Filtros aplicados:</span>
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              <Search className="h-3 w-3" />
              {filters.search}
            </Badge>
          )}
          {filters.status.length < 3 && (
            <Badge variant="secondary" className="gap-1">
              Estado: {filters.status.map(s => 
                s === "success" ? "Excelente" : s === "warning" ? "Atención" : "Crítico"
              ).join(", ")}
            </Badge>
          )}
          {filters.minError > 0 && (
            <Badge variant="secondary" className="gap-1">
              Error ≥ {filters.minError}%
            </Badge>
          )}
          {filters.maxError < 100 && (
            <Badge variant="secondary" className="gap-1">
              Error ≤ {filters.maxError}%
            </Badge>
          )}
          <span className="text-sm text-muted-foreground ml-auto">
            Mostrando {filteredServices.length} de {services.length} servicios
          </span>
        </div>
      )}

      {/* Lista de servicios */}
      <div className="grid grid-cols-1 gap-4">
        {filteredServices.map((service) => {
          const comingSoon = isComingSoon(service.id);
          const realStatus = getRealServiceStatus(service);
          const realError = getRealErrorPercentage(service);
          
          return (
            <Card
              key={service.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg",
                getStatusColor(service)
              )}
              onDoubleClick={() => !comingSoon && setSelectedService(service)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                      {!comingSoon && realStatus === "success" && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {!comingSoon && realStatus === "warning" && <AlertCircle className="h-5 w-5 text-yellow-600" />}
                      {!comingSoon && realStatus === "error" && <AlertCircle className="h-5 w-5 text-red-600" />}
                      {comingSoon && <Clock className="h-5 w-5 text-gray-500" />}
                      {service.name}
                      {comingSoon && (
                        <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-200 ml-2">
                          🚀 Próximamente
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-2 line-clamp-2">
                      {comingSoon ? "🚀 Servicio en desarrollo. Próximamente estará disponible el monitoreo completo." : service.description}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={cn("text-sm font-bold", getErrorBadgeColor(service))}>
                      {comingSoon ? "Próximamente" : `${realError}% de errores técnicos`}
                    </Badge>
                    {!comingSoon && (
                      <StatusIndicator 
                        status={realStatus} 
                        percentage={realError} 
                        size="lg"
                      />
                    )}
                    {comingSoon && (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {comingSoon ? "0 clientes asociados" : `${service.clients.length} clientes asociados`}
                  </div>
                  <div className="flex items-center gap-2">
                    {comingSoon ? (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-gray-400 cursor-not-allowed"
                        disabled
                        title="Servicio en desarrollo - Próximamente disponible"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Próximamente
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-primary hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/servicio/${service.id}`);
                        }}
                      >
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Monitorear
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No se encontraron servicios con los filtros aplicados</p>
          <Button variant="link" onClick={resetFilters} className="mt-2">
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Modal del Dashboard del Cliente */}
      <Dialog open={showClientDashboard} onOpenChange={setShowClientDashboard}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Dashboard del Cliente
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