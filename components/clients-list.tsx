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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { clients, getClientServices, subscribeToData, initializeDatabaseData, type Client, type Service } from "@/lib/services-data";
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
  AlertCircle,
  CheckCircle,
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
  const [dataVersion, setDataVersion] = useState(0);
  
  // Modal de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );

  // Suscribirse a cambios en los datos reales de la base de datos
  useEffect(() => {
    initializeDatabaseData();
    return subscribeToData(() => {
      setDataVersion(v => v + 1);
    });
  }, []);

  // Mostrar todos los clientes de la base de datos
  const activeClients = useMemo(() => {
    return [...clients];
  }, [dataVersion]);

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
            "network error", "no se pudo conectar",
            "softland error", "sii error", "error de red"
          ];
          
          const errorDocs = data.data.filter((e: any) => {
            const motivo = e.motivo || "";
            const motivoLower = motivo.toLowerCase();
            const hasTextError = erroresTecnicos.some(term => motivoLower.includes(term.toLowerCase()));
            if (hasTextError) return true;
            return ["500", "502", "503", "504"].some(code => new RegExp(`\\b${code}\\b`).test(motivoLower));
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

  const [sgcPingOk, setSgcPingOk] = useState<boolean>(true);
  const [ofitecStatus, setOfitecStatus] = useState<{ disponible: boolean }>({ disponible: true });

  const [facturasBitacora, setFacturasBitacora] = useState<any[]>([]);
  const [dteLogs, setDteLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchMonitors = async () => {
      try {
        const [sgcRes, ofitecRes, factRes, dteRes] = await Promise.all([
          fetch("/api/sgc/ping").then(r => r.json()).catch(() => null),
          fetch("/api/monitor/ofitec").then(r => r.json()).catch(() => null),
          fetch("/api/facturas/bitacora?estado=todos").then(r => r.json()).catch(() => null),
          fetch("/api/dte/stats").then(r => r.json()).catch(() => null),
        ]);
        if (sgcRes) setSgcPingOk(sgcRes.pong === true || sgcRes.isAvailable === true);
        if (ofitecRes) setOfitecStatus({ disponible: ofitecRes.disponible === true });
        if (factRes && factRes.data) setFacturasBitacora(factRes.data);
        if (dteRes && (dteRes.data || dteRes.detalles)) setDteLogs(dteRes.data || dteRes.detalles);
      } catch (e) {
        console.error("Error fetching monitors in ClientsList:", e);
      }
    };
    fetchMonitors();
    const interval = setInterval(fetchMonitors, 30000);
    return () => clearInterval(interval);
  }, []);

  // Helper para obtener fecha (yyyy-MM-dd) y minutos transcurridos del día sin desfase de zona horaria UTC
  const parseLocalStringDate = (fechaStr: string) => {
    if (!fechaStr) return null;
    const match = String(fechaStr).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
    if (match) {
      return {
        dateStr: match[1],
        minutes: parseInt(match[2], 10) * 60 + parseInt(match[3], 10)
      };
    }
    const dDate = new Date(fechaStr);
    if (isNaN(dDate.getTime())) return null;
    return {
      dateStr: format(dDate, "yyyy-MM-dd"),
      minutes: dDate.getHours() * 60 + dDate.getMinutes()
    };
  };

  const isFacturasScheduleMissing = useMemo(() => {
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. Ofimundo / Stuedemann (14:00 PM y 23:30 PM)
    const window1400Start = 13 * 60 + 45; // 13:45 PM
    const alert1400Time = 15 * 60;        // 15:00 PM
    const window2330Start = 23 * 60;       // 23:00 PM
    const alert2330Time = 23 * 60 + 59;   // 23:59 PM (00:00)

    // 2. Antofagasta (12:00 PM - Rango 11:45 AM a 13:00 PM)
    const window1200AntofagastaStart = 11 * 60 + 45; // 11:45 AM
    const alert1200AntofagastaTime = 13 * 60;        // 13:00 PM

    const esHora1400Pasada = currentTimeInMinutes >= alert1400Time;
    const esHora2330Pasada = currentTimeInMinutes >= alert2330Time;
    const esHora1200AntofagastaPasada = currentTimeInMinutes >= alert1200AntofagastaTime;

    const hoyStr = format(now, "yyyy-MM-dd");

    const facturasStuedemannHoy = (facturasBitacora || []).filter((f: any) => {
      const isAntofagasta = (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA"));
      if (isAntofagasta) return false;
      const parsed = parseLocalStringDate(f.fecha_proceso);
      return parsed && parsed.dateStr === hoyStr;
    });

    const facturasAntofagastaHoy = (facturasBitacora || []).filter((f: any) => {
      const isAntofagasta = (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA"));
      if (!isAntofagasta) return false;
      const parsed = parseLocalStringDate(f.fecha_proceso);
      return parsed && parsed.dateStr === hoyStr;
    });

    const ejecucion1400Registrada = facturasStuedemannHoy.some((f: any) => {
      const parsed = parseLocalStringDate(f.fecha_proceso);
      if (!parsed) return false;
      return parsed.minutes >= window1400Start && parsed.minutes <= alert1400Time;
    });

    const ejecucion2330Registrada = facturasStuedemannHoy.some((f: any) => {
      const parsed = parseLocalStringDate(f.fecha_proceso);
      if (!parsed) return false;
      return parsed.minutes >= window2330Start && parsed.minutes <= alert2330Time;
    });

    const ejecucion1200AntofagastaRegistrada = facturasAntofagastaHoy.some((f: any) => {
      const parsed = parseLocalStringDate(f.fecha_proceso);
      if (!parsed) return false;
      return parsed.minutes >= window1200AntofagastaStart && parsed.minutes <= alert1200AntofagastaTime;
    });

    const falta1400 = esHora1400Pasada && !ejecucion1400Registrada;
    const falta2330 = esHora2330Pasada && !ejecucion2330Registrada;
    const falta1200Antofagasta = esHora1200AntofagastaPasada && !ejecucion1200AntofagastaRegistrada;

    return falta1400 || falta2330 || falta1200Antofagasta;
  }, [facturasBitacora]);

  const isDteScheduleMissing = useMemo(() => {
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. Primera ejecución 13:30: Rango 12:45 a 15:00, alerta desde las 15:00
    const window1330Start = 12 * 60 + 45; // 12:45 PM
    const alert1330Time = 15 * 60;        // 15:00 PM
    
    // 2. Segunda ejecución 23:00: Rango 22:30 a 23:59, alerta desde las 23:59 (00:00)
    const window2300Start = 22 * 60 + 30; // 22:30 PM
    const alert2300Time = 23 * 60 + 59;   // 23:59 PM (00:00)

    const esHora1330Pasada = currentTimeInMinutes >= alert1330Time;
    const esHora2300Pasada = currentTimeInMinutes >= alert2300Time;

    const hoyStr = format(now, "yyyy-MM-dd");

    const dteHoy = (dteLogs || []).filter((d: any) => {
      const fecha = d.fecha_inicio_ejecucion || d.fecha_proceso;
      const parsed = parseLocalStringDate(fecha);
      return parsed && parsed.dateStr === hoyStr;
    });

    const ejecucion1330Registrada = dteHoy.some((d: any) => {
      const fecha = d.fecha_inicio_ejecucion || d.fecha_proceso;
      const parsed = parseLocalStringDate(fecha);
      if (!parsed) return false;
      return parsed.minutes >= window1330Start && parsed.minutes <= alert1330Time;
    });

    const ejecucion2300Registrada = dteHoy.some((d: any) => {
      const fecha = d.fecha_inicio_ejecucion || d.fecha_proceso;
      const parsed = parseLocalStringDate(fecha);
      if (!parsed) return false;
      return parsed.minutes >= window2300Start && parsed.minutes <= alert2300Time;
    });

    const falta1330 = esHora1330Pasada && !ejecucion1330Registrada;
    const falta2300 = esHora2300Pasada && !ejecucion2300Registrada;

    return falta1330 || falta2300;
  }, [dteLogs]);

  // Obtener cliente con datos reales sincronizados
  const getClientWithRealData = (client: Client): Client => {
    const isSgcDown = client.services?.includes("sgc") && !sgcPingOk;
    const isOfitecDown = client.services?.includes("ofitec") && !ofitecStatus.disponible;

    const isAntofagasta = client.id === "cl_cmds_antofagasta" || client.name.toUpperCase().includes("ANTOFAGASTA");
    const isCorpesca = client.id === "cl_corpesca" || client.name.toUpperCase().includes("CORPESCA");
    const isAutomovil = client.id === "cl_automovil_club" || client.name.toUpperCase().includes("AUTOMOVIL");

    let isFacturasDown = false;
    if (client.services?.includes("facturas") || client.services?.includes("facturas-artesanales")) {
      const now = new Date();
      const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
      const hoyStr = format(now, "yyyy-MM-dd");

      const ayer = new Date(now);
      ayer.setDate(ayer.getDate() - 1);
      const ayerStr = format(ayer, "yyyy-MM-dd");

      const checkClientScheduleDown = (filterFn: (f: any) => boolean, alertTimeMinutes: number) => {
        const esHoraPasada = currentTimeInMinutes >= alertTimeMinutes;
        const ejecucionHoy = (facturasBitacora || []).some((f: any) => {
          if (!filterFn(f)) return false;
          const parsed = parseLocalStringDate(f.fecha_proceso);
          return parsed && parsed.dateStr === hoyStr;
        });
        const ejecucionAyer = (facturasBitacora || []).some((f: any) => {
          if (!filterFn(f)) return false;
          const parsed = parseLocalStringDate(f.fecha_proceso);
          return parsed && parsed.dateStr === ayerStr;
        });

        if (esHoraPasada && !ejecucionHoy) return true;
        if (!ejecucionHoy && !ejecucionAyer) return true;
        return false;
      };

      if (isCorpesca) {
        // Horario 22:00 PM (Alerta 23:00 PM)
        isFacturasDown = checkClientScheduleDown(
          (f: any) => (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA")),
          23 * 60
        );
      } else if (isAntofagasta) {
        // Horario 12:00 PM (Alerta 13:00 PM)
        isFacturasDown = checkClientScheduleDown(
          (f: any) => (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA")),
          13 * 60
        );
      } else if (isAutomovil) {
        // Horario 10:05 AM (Alerta 11:00 AM)
        isFacturasDown = checkClientScheduleDown(
          (f: any) => (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL")),
          11 * 60
        );
      } else {
        // Stuedemann: Horario 14:00 PM (Alerta 15:30 PM) y 23:30 PM (Alerta 23:59 PM)
        isFacturasDown = checkClientScheduleDown(
          (f: any) => {
            const isAnt = (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA"));
            const isCorp = (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA"));
            const isAuto = (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL"));
            return !isAnt && !isCorp && !isAuto;
          },
          15 * 60 + 30
        );
      }
    }

    if (isSgcDown || isOfitecDown || isFacturasDown) {
      return {
        ...client,
        status: "error",
        errorPercentage: 100
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
            const hasTelemetryData = 
              client.id === "cl_ofimundo" || 
              client.id === "cl_stuedemann" || 
              client.id === "cl_cmds_antofagasta" ||
              client.id === "cl_corpesca" ||
              client.id === "cl_automovil_club" ||
              client.name.toLowerCase().includes("ofimundo") || 
              client.name.toLowerCase().includes("stuedemann") || 
              client.name.toLowerCase().includes("antofagasta") ||
              client.name.toLowerCase().includes("corpesca") ||
              client.name.toLowerCase().includes("automovil") ||
              (client.rut || "").includes("76.452.910") || 
              (client.rut || "").includes("96.502.540") ||
              (client.rut || "").includes("70.892.100") ||
              (client.rut || "").includes("96.893.820") ||
              (client.rut || "").includes("70.016.920");
            
            const rawClientWithData = getClientWithRealData(client);
            const clientWithData = hasTelemetryData ? rawClientWithData : {
              ...rawClientWithData,
              status: "success" as const,
              errorPercentage: 0
            };

            const clientServices = getClientServices(client.id);
            const successRate = 100 - clientWithData.errorPercentage;
            const firstService = clientServices[0];
            
            return (
              <Card
                key={client.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between p-2.5 border rounded-lg bg-card text-xs",
                  clientWithData.status === "error"
                    ? "border-red-200 bg-red-50/40 hover:bg-red-50/70 dark:bg-red-950/20"
                    : clientWithData.status === "warning"
                    ? "border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-950/20"
                    : "border-emerald-200/80 bg-emerald-50/30 hover:bg-emerald-50/60 dark:bg-emerald-950/20"
                )}
                onClick={() => hasTelemetryData && handleOpenDashboard(clientWithData)}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-muted-foreground mb-0.5">
                    <span className="uppercase tracking-wider flex items-center gap-1 truncate text-primary/80">
                      <Building className="h-2.5 w-2.5 shrink-0" />
                      {client.rut || "CLIENTE"}
                    </span>
                    <Badge
                      className={cn(
                        "text-[9px] font-bold py-0 px-1 shrink-0 h-4 flex items-center",
                        clientWithData.status === "error"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : clientWithData.status === "warning"
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      )}
                    >
                      {`${clientWithData.errorPercentage}% err`}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      {clientWithData.status === "error" ? (
                        <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      ) : clientWithData.status === "warning" ? (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      )}
                      <h4 className="font-bold text-xs text-foreground truncate" title={client.name}>
                        {client.name}
                      </h4>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px]">
                    <span className="text-[9.5px] font-medium text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/60 truncate">
                      {clientServices.length} {clientServices.length === 1 ? "servicio activo" : "servicios activos"}
                    </span>
                    {(client.id === "cl_automovil_club" || client.name.toUpperCase().includes("AUTOMOVIL")) && (
                      <span className="text-[9.5px] font-medium text-amber-800 bg-amber-50 px-1 rounded border border-amber-200 truncate">
                        ⏰ 10:05 hrs
                      </span>
                    )}
                    {(client.id === "cl_cmds_antofagasta" || client.name.toUpperCase().includes("ANTOFAGASTA")) && (
                      <span className="text-[9.5px] font-medium text-amber-800 bg-amber-50 px-1 rounded border border-amber-200 truncate">
                        ⏰ 12:00 hrs
                      </span>
                    )}
                    {(client.id === "cl_corpesca" || client.name.toUpperCase().includes("CORPESCA")) && (
                      <span className="text-[9.5px] font-medium text-amber-800 bg-amber-50 px-1 rounded border border-amber-200 truncate">
                        ⏰ 22:00 hrs
                      </span>
                    )}
                    {(client.id === "cl_stuedemann" || client.name.toUpperCase().includes("STUEDEMANN")) && (
                      <span className="text-[9.5px] font-medium text-amber-800 bg-amber-50 px-1 rounded border border-amber-200 truncate">
                        ⏰ 14:00 & 23:30
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-6 text-[10px] font-medium px-1 text-muted-foreground hover:text-foreground", !hasTelemetryData && "opacity-50 cursor-not-allowed")}
                    disabled={!hasTelemetryData}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasTelemetryData) handleOpenDashboard(clientWithData);
                    }}
                  >
                    <Eye className="mr-1 h-2.5 w-2.5" />
                    Dashboard
                  </Button>

                  {hasTelemetryData ? (
                    clientServices.length > 1 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] font-semibold text-primary hover:bg-primary/10 px-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <LayoutDashboard className="mr-1 h-2.5 w-2.5" />
                            Monitorear...
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {clientServices.map((service) => (
                            <DropdownMenuItem
                              key={service.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGoToServiceMonitoring(service.id, service.name);
                              }}
                              className="cursor-pointer text-xs"
                            >
                              <Briefcase className="h-3.5 w-3.5 mr-2 text-primary" />
                              <span>{service.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : firstService ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] font-semibold text-primary hover:bg-primary/10 px-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGoToServiceMonitoring(firstService.id, firstService.name);
                        }}
                      >
                        <LayoutDashboard className="mr-1 h-2.5 w-2.5" />
                        Monitorear
                        <ArrowRight className="ml-1 h-2.5 w-2.5" />
                      </Button>
                    ) : null
                  ) : (
                    <span className="text-[9.5px] text-muted-foreground px-1 py-0.5">Próximamente</span>
                  )}
                </div>
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
              key={selectedClient.id}
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