// app/components/clients-list.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Clock,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface ClientsListProps {
  onSelectClient?: (client: Client) => void;
}

// Solo el cliente activo (Ofimundo S.A.)
const ACTIVE_CLIENT_ID = "cl_ofimundo";

// Definición de campos disponibles para exportación
const EXPORT_FIELDS = [
  { id: "cliente", label: "Cliente", default: true },
  { id: "rut", label: "RUT", default: true },
  { id: "email", label: "Email", default: true },
  { id: "telefono", label: "Teléfono", default: false },
  { id: "errorPorcentaje", label: "Porcentaje de Error", default: true },
  { id: "estado", label: "Estado", default: true },
  { id: "serviciosContratados", label: "Servicios Contratados", default: true },
  { id: "listaServicios", label: "Lista Servicios", default: false },
];

export function ClientsList({ onSelectClient }: ClientsListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [realData, setRealData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );

  // Filtrar solo el cliente activo
  const activeClients = useMemo(() => {
    return clients.filter(client => client.id === ACTIVE_CLIENT_ID);
  }, []);

  // Cargar datos reales de facturas para sincronizar solo con Ofimundo
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
    if (client.id === ACTIVE_CLIENT_ID && realData) {
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
    let result = [...activeClients];
    
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
  }, [activeClients, search, statusFilter, realData]);

  const activeFiltersCount = (search ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  // Abrir modal de exportación
  const handleOpenExportModal = () => {
    setShowExportModal(true);
  };

  // Cerrar modal de exportación
  const handleCloseExportModal = () => {
    setShowExportModal(false);
  };

  // Toggle selección de un campo individual
  const handleToggleField = (fieldId: string) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldId)) {
        return prev.filter(id => id !== fieldId);
      } else {
        return [...prev, fieldId];
      }
    });
  };

  // Seleccionar/Deseleccionar todos los campos
  const handleSelectAllFields = () => {
    if (selectedFields.length === EXPORT_FIELDS.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(EXPORT_FIELDS.map(f => f.id));
    }
  };

  // Exportar a Excel con campos seleccionados
  const handleExportToExcel = () => {
    if (selectedFields.length === 0) {
      alert("Por favor selecciona al menos un campo para exportar.");
      return;
    }

    const fieldMap: Record<string, (client: any) => any> = {
      cliente: (c) => c.name,
      rut: (c) => c.rut || "-",
      email: (c) => c.email || "-",
      telefono: (c) => c.phone || "-",
      errorPorcentaje: (c) => `${c.errorPercentage}%`,
      estado: (c) => c.status === "success" ? "Excelente" : c.status === "warning" ? "Atención" : "Crítico",
      serviciosContratados: (c) => getClientServices(c.id).length,
      listaServicios: (c) => getClientServices(c.id).map(s => s.name).join(", "),
    };

    const fieldLabels: Record<string, string> = {};
    EXPORT_FIELDS.forEach(f => fieldLabels[f.id] = f.label);

    const exportData = filteredClients.map(client => {
      const clientWithData = getClientWithRealData(client);
      const row: Record<string, any> = {};
      selectedFields.forEach(fieldId => {
        const label = fieldLabels[fieldId] || fieldId;
        row[label] = fieldMap[fieldId](clientWithData);
      });
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    const colWidths = selectedFields.map(() => ({ wch: 30 }));
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    
    // Resumen estadístico
    const summaryData = [
      { "Métrica": "Total Clientes", "Valor": filteredClients.length },
      { "Métrica": "Clientes Excelentes", "Valor": filteredClients.filter(c => getClientWithRealData(c).status === "success").length },
      { "Métrica": "Clientes en Atención", "Valor": filteredClients.filter(c => getClientWithRealData(c).status === "warning").length },
      { "Métrica": "Clientes Críticos", "Valor": filteredClients.filter(c => getClientWithRealData(c).status === "error").length },
      { "Métrica": "Fecha Exportación", "Valor": format(new Date(), "dd/MM/yyyy HH:mm:ss") },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    
    XLSX.writeFile(wb, `clientes_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xlsx`);
    
    setShowExportModal(false);
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
              Mostrando {filteredClients.length} de {activeClients.length} clientes
            </span>
          </div>
        )}

        {/* Lista de clientes - Solo Ofimundo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const clientWithData = getClientWithRealData(client);
            const clientServices = getClientServices(client.id);
            const successRate = 100 - clientWithData.errorPercentage;
            const firstService = clientServices[0];
            const isOfimundo = client.id === ACTIVE_CLIENT_ID;
            
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
                  {/* Badge indicador para Ofimundo */}
                  {isOfimundo && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      📡 Datos en tiempo real
                    </Badge>
                  )}

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
                      <p className="text-xs text-muted-foreground">Servicios Activos</p>
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

                  {/* Servicios contratados activos */}
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

      {/* Modal del Dashboard del Cliente */}
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
                  checked={selectedFields.length === EXPORT_FIELDS.length}
                  onCheckedChange={handleSelectAllFields}
                  id="select-all"
                />
                <Label htmlFor="select-all" className="font-semibold cursor-pointer">
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
            <Button variant="outline" onClick={handleCloseExportModal}>
              Cancelar
            </Button>
            <Button 
              onClick={handleExportToExcel} 
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={selectedFields.length === 0 || filteredClients.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar {selectedFields.length} campos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}