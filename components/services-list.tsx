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

  // Función para verificar si un servicio está próximo
  const isComingSoon = (serviceId: string): boolean => {
    return COMING_SOON_SERVICES.includes(serviceId);
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
      errorPercentage: service.errorPercentage,
      status: service.status,
      isComingSoon: isComingSoon(service.id),
    }));
  }, []);

  const filteredServices = useMemo(() => {
    let result = [...services];

    if (filters.search) {
      result = result.filter(service =>
        service.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.status.length > 0 && filters.status.length < 3) {
      result = result.filter(service => filters.status.includes(service.status));
    }

    if (filters.minError > 0) {
      result = result.filter(service => service.errorPercentage >= filters.minError);
    }

    if (filters.maxError < 100) {
      result = result.filter(service => service.errorPercentage <= filters.maxError);
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

  const exportToExcel = () => {
    const excelData = filteredServices.map(service => ({
      "Servicio": service.name,
      "Descripción": service.isComingSoon ? "Próximamente - En desarrollo" : service.description,
      "Porcentaje de Error": service.isComingSoon ? "N/A" : `${service.errorPercentage}%`,
      "Estado": service.isComingSoon ? "Próximamente" : (service.status === "success" ? "Excelente" : service.status === "warning" ? "Atención" : "Crítico"),
      "Total Clientes": service.isComingSoon ? 0 : service.clients.length,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, "Servicios");
    
    const fileName = `servicios_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const getStatusColor = (status: string, isComingSoonValue: boolean) => {
    if (isComingSoonValue) return "border-gray-200 bg-gray-50/50 hover:bg-gray-50";
    if (status === "success") return "border-green-200 bg-green-50/50 hover:bg-green-50";
    if (status === "warning") return "border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50";
    return "border-red-200 bg-red-50/50 hover:bg-red-50";
  };

  const getErrorBadgeColor = (errorPercentage: number, isComingSoonValue: boolean) => {
    if (isComingSoonValue) return "bg-gray-100 text-gray-600 border-gray-200";
    if (errorPercentage === 0) return "bg-green-100 text-green-700 border-green-200";
    if (errorPercentage <= 10) return "bg-yellow-100 text-yellow-700 border-yellow-200";
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

        <Button variant="outline" size="sm" onClick={exportToExcel}>
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
          return (
            <Card
              key={service.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg",
                getStatusColor(service.status, comingSoon)
              )}
              onDoubleClick={() => !comingSoon && setSelectedService(service)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                      {!comingSoon && service.status === "success" && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {!comingSoon && service.status === "warning" && <AlertCircle className="h-5 w-5 text-yellow-600" />}
                      {!comingSoon && service.status === "error" && <AlertCircle className="h-5 w-5 text-red-600" />}
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
                    <Badge className={cn("text-sm font-bold", getErrorBadgeColor(service.errorPercentage, comingSoon))}>
                      {comingSoon ? "Próximamente" : `${service.errorPercentage}% de errores técnicos`}
                    </Badge>
                    {!comingSoon && (
                      <StatusIndicator 
                        status={service.status} 
                        errorPercentage={service.errorPercentage} 
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
    </div>
  );
}