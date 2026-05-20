// app/components/clients-list.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { clients, getClientServices, type Client, type Service } from "@/lib/services-data";
import { StatusIndicator } from "@/components/status-indicator";
import { ClientDashboard } from "@/components/client-dashboard";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  X,
  Building,
  Mail,
  Phone,
  Briefcase,
  Users,
  LayoutDashboard,
  Eye,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface ClientsListProps {
  onSelectClient?: (client: Client) => void;
}

export function ClientsList({ onSelectClient }: ClientsListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [realData, setRealData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Cargar datos reales de facturas para sincronizar
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/facturas/bitacora?estado=todos");
        const data = await res.json();
        if (data.success && data.data) {
          const totalDocs = data.data.length;
          const erroresTecnicos = [
            "error de conexión", "timeout", "servidor no responde",
            "softland no disponible", "sii no responde", "connection failed",
            "failed to connect", "could not connect", "connection refused",
            "network error", "500", "503", "no se pudo conectar",
            "softland error", "sii error", "error de red"
          ];
          
          const errorDocs = data.data.filter((e: any) => {
            const motivo = e.motivo || "";
            return erroresTecnicos.some(term => motivo.toLowerCase().includes(term.toLowerCase()));
          }).length;
          
          const errPercent = totalDocs > 0 ? Math.round((errorDocs / totalDocs) * 100) : 0;
          setRealData({ errorRate: errPercent, totalDocs });
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Obtener cliente con datos reales sincronizados
  const getClientWithRealData = (client: Client): Client => {
    if (client.id === "cl_ofimundo" && realData) {
      const status = realData.errorRate > 0 ? (realData.errorRate > 40 ? "error" : "warning") : "success";
      return {
        ...client,
        errorPercentage: realData.errorRate,
        status: status as any,
      };
    }
    return client;
  };

  const filteredClients = useMemo(() => {
    let result = [...clients];
    
    if (search) {
      result = result.filter(client =>
        client.name.toLowerCase().includes(search.toLowerCase()) ||
        client.rut?.toLowerCase().includes(search.toLowerCase()) ||
        client.email?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (statusFilter !== "all") {
      result = result.filter(client => {
        const clientWithData = getClientWithRealData(client);
        return clientWithData.status === statusFilter;
      });
    }
    
    return result;
  }, [clients, search, statusFilter, realData]);

  const activeFiltersCount = (search ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const exportToExcel = () => {
    const excelData = filteredClients.map(client => {
      const clientWithData = getClientWithRealData(client);
      const clientServices = getClientServices(client.id);
      return {
        "Cliente": client.name,
        "RUT": client.rut || "-",
        "Email": client.email || "-",
        "Teléfono": client.phone || "-",
        "Porcentaje de Error": `${clientWithData.errorPercentage}%`,
        "Estado": clientWithData.status === "success" ? "Excelente" : clientWithData.status === "warning" ? "Atención" : "Crítico",
        "Servicios Contratados": clientServices.length,
        "Lista Servicios": clientServices.map(s => s.name).join(", "),
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    const colWidths = [
      { wch: 30 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 50 },
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    
    const fileName = `clientes_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleGoToServiceMonitoring = (serviceId: string, serviceName: string) => {
    router.push(`/servicio/${serviceId}`);
  };

  const handleOpenDashboard = (client: Client) => {
    const clientWithData = getClientWithRealData(client);
    setSelectedClient(clientWithData);
    setShowDashboard(true);
    if (onSelectClient) {
      onSelectClient(clientWithData);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "success") return "border-green-200 bg-green-50/50 hover:bg-green-50";
    if (status === "warning") return "border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50";
    return "border-red-200 bg-red-50/50 hover:bg-red-50";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <>
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
                Limpiar filtros
              </Button>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Exportar a Excel
          </Button>
        </div>

        {/* Panel de filtros */}
        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Buscar cliente</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre, RUT o email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Estado del cliente</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">🌐 Todos</SelectItem>
                      <SelectItem value="success">✅ Excelente (0% error)</SelectItem>
                      <SelectItem value="warning">⚠️ Atención (1-10% error)</SelectItem>
                      <SelectItem value="error">❌ Crítico (&gt;10% error)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {activeFiltersCount > 0 && (
                  <div className="flex justify-end pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Limpiar filtros ({activeFiltersCount})
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Indicadores de filtros activos */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2 items-center p-3 bg-muted/30 rounded-lg">
            <span className="text-sm font-medium text-muted-foreground">Filtros aplicados:</span>
            {search && (
              <Badge variant="secondary" className="gap-1">
                <Search className="h-3 w-3" />
                {search}
              </Badge>
            )}
            {statusFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                {statusFilter === "success" ? "✅ Excelente" : statusFilter === "warning" ? "⚠️ Atención" : "❌ Crítico"}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground ml-auto">
              Mostrando {filteredClients.length} de {clients.length} clientes
            </span>
          </div>
        )}

        {/* Lista de clientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const clientWithData = getClientWithRealData(client);
            const clientServices = getClientServices(client.id);
            const successRate = 100 - clientWithData.errorPercentage;
            const firstService = clientServices[0];
            
            return (
              <Card
                key={client.id}
                className={cn(
                  "transition-all hover:shadow-lg",
                  getStatusColor(clientWithData.status)
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg",
                        clientWithData.status === "success" ? "bg-emerald-500" :
                        clientWithData.status === "warning" ? "bg-amber-500" : "bg-red-500"
                      )}>
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{client.name}</CardTitle>
                        {client.rut && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building className="h-3 w-3" />
                            {client.rut}
                          </p>
                        )}
                      </div>
                    </div>
                    <StatusIndicator 
                      status={clientWithData.status} 
                      errorPercentage={clientWithData.errorPercentage} 
                      size="md" 
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    {client.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </p>
                    )}
                    {client.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-2xl font-bold">{clientServices.length}</p>
                      <p className="text-xs text-muted-foreground">Servicios</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className={cn(
                        "text-2xl font-bold",
                        clientWithData.errorPercentage === 0 ? "text-emerald-600" :
                        clientWithData.errorPercentage <= 10 ? "text-amber-600" : "text-red-600"
                      )}>
                        {clientWithData.errorPercentage}%
                      </p>
                      <p className="text-xs text-muted-foreground">Error técnico</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Tasa de éxito</span>
                      <span className="font-medium">{successRate}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          successRate >= 90 ? "bg-emerald-500" :
                          successRate >= 80 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${successRate}%` }}
                      />
                    </div>
                  </div>

                  {clientServices.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {clientServices.slice(0, 3).map(service => (
                        <Badge key={service.id} variant="outline" className="text-[10px]">
                          <Briefcase className="h-2 w-2 mr-1" />
                          {service.name.length > 20 ? service.name.substring(0, 20) + "..." : service.name}
                        </Badge>
                      ))}
                      {clientServices.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{clientServices.length - 3} más
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    <Button 
                      variant="outline"
                      size="sm" 
                      className="flex-1 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDashboard(clientWithData);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                      Dashboard
                    </Button>
                    
                    {firstService && (
                      <Button 
                        variant="default"
                        size="sm" 
                        className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGoToServiceMonitoring(firstService.id, firstService.name);
                        }}
                      >
                        <LayoutDashboard className="h-3 w-3" />
                        Monitorear Servicio
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron clientes con los filtros aplicados</p>
            <Button variant="link" onClick={resetFilters} className="mt-2">
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Modal del Dashboard del Cliente - CON VisuallyHidden para accesibilidad */}
      <Dialog open={showDashboard} onOpenChange={setShowDashboard}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] h-[90vh] overflow-y-auto p-0">
          <VisuallyHidden>
            <DialogHeader>
              <DialogTitle>
                Dashboard del Cliente - {selectedClient?.name || "Cliente"}
              </DialogTitle>
            </DialogHeader>
          </VisuallyHidden>
          {selectedClient && (
            <ClientDashboard
              clientId={selectedClient.id}
              onClose={() => {
                setShowDashboard(false);
                setSelectedClient(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}