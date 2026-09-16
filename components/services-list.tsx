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
import { services, clients, getClientById, getClientServices, subscribeToData, initializeDatabaseData, type Service, type Client } from "@/lib/services-data";
import { StatusIndicator } from "@/components/status-indicator";
import { ClientDashboard } from "@/components/client-dashboard";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
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
  LayoutGrid,
  List,
  Flame,
  Briefcase,
  Building,
} from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface Filters {
  search: string;
  status: string[];
  minError: number;
  maxError: number;
  showComingSoon: boolean;
}

// Lista de servicios que están próximamente
const COMING_SOON_SERVICES = ["saldos", "finiquitos", "cuentas", "contabilizacion", "notas-credito"];

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: ["success", "warning", "error"],
    minError: 0,
    maxError: 100,
    showComingSoon: false,
  });
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDashboard, setShowClientDashboard] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  
  // Modal de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );
  const [selectAll, setSelectAll] = useState(true);

  const [sgcPingOk, setSgcPingOk] = useState<boolean>(true);
  const [ofitecStatus, setOfitecStatus] = useState<{ disponible: boolean }>({ disponible: true });
  const [facturasBitacora, setFacturasBitacora] = useState<any[]>([]);
  const [dteLogs, setDteLogs] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchMonitors = async () => {
      try {
        const now = new Date();
        const primerDiaMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const [sgcRes, ofitecRes, factRes, dteRes, corpescaRes] = await Promise.all([
          fetch("/api/sgc/ping").then(r => r.json()).catch(() => null),
          fetch("/api/monitor/ofitec").then(r => r.json()).catch(() => null),
          fetch(`/api/facturas/bitacora?estado=todos&fechaDesde=${primerDiaMes}`).then(r => r.json()).catch(() => null),
          fetch(`/api/dte/stats?fechaDesde=${primerDiaMes}`).then(r => r.json()).catch(() => null),
          fetch(`/api/facturas/bitacora?cliente=cl_corpesca&fechaDesde=${primerDiaMes}`).then(r => r.json()).catch(() => null),
        ]);
        if (isMounted) {
          if (sgcRes) setSgcPingOk(sgcRes.pong === true || sgcRes.isAvailable === true);
          if (ofitecRes) setOfitecStatus({ disponible: ofitecRes.disponible === true });
          let allFacturas: any[] = [];
          if (factRes && factRes.data) allFacturas.push(...factRes.data);
          if (corpescaRes && corpescaRes.data) allFacturas.push(...corpescaRes.data);
          setFacturasBitacora(allFacturas);
          if (dteRes && (dteRes.data || dteRes.detalles)) setDteLogs(dteRes.data || dteRes.detalles);
        }
      } catch (e) {
        console.error("Error fetching monitors in ServicesList:", e);
      }
    };
    fetchMonitors();
    const interval = setInterval(fetchMonitors, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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
    const hoyStr = format(now, "yyyy-MM-dd");

    const alert1005AutoTime = 11 * 60;
    const alert1200AntofagastaTime = 13 * 60;
    const alert1400Time = 15 * 60 + 30;
    const alert2330Time = 23 * 60 + 59;
    const alert2200CorpescaTime = 23 * 60;

    const esHora1005AutoPasada = currentTimeInMinutes >= alert1005AutoTime;
    const esHora1200AntofagastaPasada = currentTimeInMinutes >= alert1200AntofagastaTime;
    const esHora1400Pasada = currentTimeInMinutes >= alert1400Time;
    const esHora2330Pasada = currentTimeInMinutes >= alert2330Time;
    const esHora2200CorpescaPasada = currentTimeInMinutes >= alert2200CorpescaTime;

    const facturasAutoClubHoy = (facturasBitacora || []).filter((f: any) => {
      const isAuto = (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL"));
      if (!isAuto) return false;
      const parsed = parseLocalStringDate(f.fecha_proceso);
      return parsed && parsed.dateStr === hoyStr;
    });

    const facturasAntofagastaHoy = (facturasBitacora || []).filter((f: any) => {
      const isAnt = (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA"));
      if (!isAnt) return false;
      const parsed = parseLocalStringDate(f.fecha_proceso);
      return parsed && parsed.dateStr === hoyStr;
    });

    if (facturasBitacora && facturasBitacora.length > 0) {
      return false;
    }

    return false;
  }, [facturasBitacora]);

  // Verificar si falta ejecución de 13:30 o 23:00 para DTE
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

  // Suscribirse a cambios en los datos reales de la base de datos
  useEffect(() => {
    initializeDatabaseData();
    return subscribeToData(() => {
      setDataVersion(v => v + 1);
    });
  }, []);

  // Función para verificar si un servicio está próximo
  const isComingSoon = (serviceId: string): boolean => {
    return COMING_SOON_SERVICES.includes(serviceId);
  };

  // ✅ Función para obtener el estado real de un servicio
  const getRealServiceStatus = (service: Service): "success" | "warning" | "error" => {
    if (isComingSoon(service.id)) {
      return "success";
    }
    
    if (service.id === "sgc") {
      return sgcPingOk ? "success" : "error";
    }

    if (service.id === "ofitec") {
      return ofitecStatus.disponible ? "success" : "error";
    }

    if (service.id === "oficore") {
      return "success";
    }

    if (service.id === "mi-cuenta" || service.id === "micuenta") {
      return "success";
    }

    if (service.id === "dte") {
      return isDteScheduleMissing ? "error" : "success";
    }

    if (service.id === "facturas-artesanales") {
      const now = new Date();
      const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
      const hoyStr = format(now, "yyyy-MM-dd");
      const ayer = new Date(now);
      ayer.setDate(ayer.getDate() - 1);
      const ayerStr = format(ayer, "yyyy-MM-dd");

      const esHoraPasada = currentTimeInMinutes >= (23 * 60);
      const tieneHoy = (facturasBitacora || []).some((f: any) => {
        const isCorp = (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA"));
        if (!isCorp) return false;
        const parsed = parseLocalStringDate(f.fecha_proceso);
        return parsed && parsed.dateStr === hoyStr;
      });
      const tieneAyer = (facturasBitacora || []).some((f: any) => {
        const isCorp = (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA"));
        if (!isCorp) return false;
        const parsed = parseLocalStringDate(f.fecha_proceso);
        return parsed && parsed.dateStr === ayerStr;
      });

      const isCorpDown = (esHoraPasada && !tieneHoy) || (!tieneHoy && !tieneAyer);
      return isCorpDown ? "error" : "success";
    }

    if (service.id === "facturas") {
      const now = new Date();
      const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
      const hoyStr = format(now, "yyyy-MM-dd");
      const ayer = new Date(now);
      ayer.setDate(ayer.getDate() - 1);
      const ayerStr = format(ayer, "yyyy-MM-dd");

      const checkDown = (filterFn: (f: any) => boolean, alertTimeMinutes: number) => {
        const esPasada = currentTimeInMinutes >= alertTimeMinutes;
        const tieneHoy = (facturasBitacora || []).some((f: any) => {
          if (!filterFn(f)) return false;
          const parsed = parseLocalStringDate(f.fecha_proceso);
          return parsed && parsed.dateStr === hoyStr;
        });
        const tieneAyer = (facturasBitacora || []).some((f: any) => {
          if (!filterFn(f)) return false;
          const parsed = parseLocalStringDate(f.fecha_proceso);
          return parsed && parsed.dateStr === ayerStr;
        });
        if (esPasada && !tieneHoy) return true;
        if (!tieneHoy && !tieneAyer) return true;
        return false;
      };

      const autoDown = checkDown((f: any) => (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL")), 11 * 60);
      const antDown = checkDown((f: any) => (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA")), 13 * 60);
      const stueDown = checkDown((f: any) => {
        const isAnt = (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA"));
        const isCorp = (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA"));
        const isAuto = (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL"));
        return !isAnt && !isCorp && !isAuto;
      }, 15 * 60 + 30);

      if (autoDown || antDown || stueDown) return "error";
      return "success";
    }
    
    return "success";
  };

  // ✅ Función para obtener el porcentaje de error real
  const getRealErrorPercentage = (service: Service): number => {
    if (isComingSoon(service.id)) {
      return 0;
    }
    
    if (service.id === "sgc") {
      return sgcPingOk ? 0 : 100;
    }

    if (service.id === "ofitec") {
      return ofitecStatus.disponible ? 0 : 100;
    }

    if (service.id === "oficore") {
      return 0;
    }

    if (service.id === "mi-cuenta" || service.id === "micuenta") {
      return 0;
    }

    if (service.id === "dte") {
      return isDteScheduleMissing ? 100 : 0;
    }

    if (service.id === "facturas-artesanales") {
      const now = new Date();
      const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
      const hoyStr = format(now, "yyyy-MM-dd");
      const ayer = new Date(now);
      ayer.setDate(ayer.getDate() - 1);
      const ayerStr = format(ayer, "yyyy-MM-dd");

      const esHoraPasada = currentTimeInMinutes >= (23 * 60);
      const tieneHoy = (facturasBitacora || []).some((f: any) => {
        const isCorp = (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA"));
        if (!isCorp) return false;
        const parsed = parseLocalStringDate(f.fecha_proceso);
        return parsed && parsed.dateStr === hoyStr;
      });
      const tieneAyer = (facturasBitacora || []).some((f: any) => {
        const isCorp = (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA"));
        if (!isCorp) return false;
        const parsed = parseLocalStringDate(f.fecha_proceso);
        return parsed && parsed.dateStr === ayerStr;
      });

      const isCorpDown = (esHoraPasada && !tieneHoy) || (!tieneHoy && !tieneAyer);
      return isCorpDown ? 100 : 0;
    }

    if (service.id === "facturas") {
      const now = new Date();
      const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
      const hoyStr = format(now, "yyyy-MM-dd");
      const ayer = new Date(now);
      ayer.setDate(ayer.getDate() - 1);
      const ayerStr = format(ayer, "yyyy-MM-dd");

      const checkDown = (filterFn: (f: any) => boolean, alertTimeMinutes: number) => {
        const esPasada = currentTimeInMinutes >= alertTimeMinutes;
        const tieneHoy = (facturasBitacora || []).some((f: any) => {
          if (!filterFn(f)) return false;
          const parsed = parseLocalStringDate(f.fecha_proceso);
          return parsed && parsed.dateStr === hoyStr;
        });
        const tieneAyer = (facturasBitacora || []).some((f: any) => {
          if (!filterFn(f)) return false;
          const parsed = parseLocalStringDate(f.fecha_proceso);
          return parsed && parsed.dateStr === ayerStr;
        });
        if (esPasada && !tieneHoy) return true;
        if (!tieneHoy && !tieneAyer) return true;
        return false;
      };

      const autoDown = checkDown((f: any) => (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL")), 11 * 60);
      const antDown = checkDown((f: any) => (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA")), 13 * 60);
      const stueDown = checkDown((f: any) => {
        const isAnt = (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA"));
        const isCorp = (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA"));
        const isAuto = (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL"));
        return !isAnt && !isCorp && !isAuto;
      }, 15 * 60 + 30);

      let downCount = 0;
      if (autoDown) downCount++;
      if (antDown) downCount++;
      if (stueDown) downCount++;

      return downCount > 0 ? Math.round((downCount / 3) * 100) : 0;
    }
    
    return 0;
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
  }, [services, dataVersion]);

  const filteredServices = useMemo(() => {
    let result = [...services];

    // ✅ Ocultar por defecto los servicios "Próximamente" (en desarrollo) salvo que el usuario active la casilla showComingSoon o busque por nombre
    if (!filters.showComingSoon && !filters.search) {
      result = result.filter(service => !isComingSoon(service.id));
    }

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

  // ✅ Desglosar en 1 ítem/tarjeta por cada cliente de cada servicio
  const serviceClientItems = useMemo(() => {
    const items: Array<{
      key: string;
      service: Service;
      client: Client | null;
      isComingSoon: boolean;
      status: "success" | "warning" | "error";
      errorPercentage: number;
      clientDown: boolean;
    }> = [];

    filteredServices.forEach(service => {
      const comingSoon = isComingSoon(service.id);
      const effectiveClients = (service.id === "oficore" || service.id === "ofitec" || service.id === "sgc" || service.id === "mi-cuenta")
        ? service.clients.filter(c => c.id === "cl_stuedemann" || c.name.toUpperCase().includes("STUEDEMANN") || c.name.toUpperCase().includes("OFIMUNDO"))
        : service.clients;

      if (!effectiveClients || effectiveClients.length === 0) {
        const realStatus = getRealServiceStatus(service);
        const realError = getRealErrorPercentage(service);
        items.push({
          key: service.id,
          service,
          client: null,
          isComingSoon: comingSoon,
          status: realStatus,
          errorPercentage: realError,
          clientDown: realStatus === "error"
        });
      } else {
        effectiveClients.forEach(client => {
          let clientDown = false;
          if (service.id === "facturas") {
            const now = new Date();
            const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
            const hoyStr = format(now, "yyyy-MM-dd");
            const ayer = new Date(now);
            ayer.setDate(ayer.getDate() - 1);
            const ayerStr = format(ayer, "yyyy-MM-dd");

            const isAuto = client.id === "cl_automovil_club" || client.name.toUpperCase().includes("AUTOMOVIL");
            const isAnt = client.id === "cl_cmds_antofagasta" || client.name.toUpperCase().includes("ANTOFAGASTA");
            const isCorp = client.id === "cl_corpesca" || client.name.toUpperCase().includes("CORPESCA");

            const checkDown = (filterFn: (f: any) => boolean, alertTimeMinutes: number) => {
              const esPasada = currentTimeInMinutes >= alertTimeMinutes;
              const tieneHoy = (facturasBitacora || []).some((f: any) => {
                if (!filterFn(f)) return false;
                const parsed = parseLocalStringDate(f.fecha_proceso);
                return parsed && parsed.dateStr === hoyStr;
              });
              const tieneAyer = (facturasBitacora || []).some((f: any) => {
                if (!filterFn(f)) return false;
                const parsed = parseLocalStringDate(f.fecha_proceso);
                return parsed && parsed.dateStr === ayerStr;
              });
              if (esPasada && !tieneHoy) return true;
              if (!tieneHoy && !tieneAyer) return true;
              return false;
            };

            if (isAuto) {
              clientDown = checkDown(
                (f: any) => (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL")),
                11 * 60
              );
            } else if (isAnt) {
              clientDown = checkDown(
                (f: any) => (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA")),
                13 * 60
              );
            } else if (isCorp) {
              clientDown = checkDown(
                (f: any) => (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA")),
                23 * 60
              );
            } else {
              clientDown = checkDown(
                (f: any) => {
                  const matchAnt = (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA"));
                  const matchCorp = (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA"));
                  const matchAuto = (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL"));
                  return !matchAnt && !matchCorp && !matchAuto;
                },
                15 * 60 + 30
              );
            }
          }

          const baseStatus = getRealServiceStatus(service);
          const baseError = getRealErrorPercentage(service);

          // Si el servicio se desglosa por clientes, la tarjeta de este cliente solo debe ser "error" si este cliente en particular falló (clientDown)
          const finalStatus = clientDown 
            ? "error" 
            : (service.id === "facturas" ? "success" : baseStatus);
            
          const finalError = clientDown 
            ? 100 
            : (service.id === "facturas" ? 0 : baseError);

          items.push({
            key: `${service.id}-${client.id}`,
            service,
            client,
            isComingSoon: comingSoon,
            status: finalStatus,
            errorPercentage: finalError,
            clientDown
          });
        });
      }
    });

    return items;
  }, [filteredServices, facturasBitacora, dteLogs, sgcPingOk, ofitecStatus]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status.length < 3) count++;
    if (filters.minError > 0) count++;
    if (filters.maxError < 100) count++;
    if (filters.showComingSoon) count++;
    return count;
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      search: "",
      status: ["success", "warning", "error"],
      minError: 0,
      maxError: 100,
      showComingSoon: false,
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

  const getErrorBadgeColor = (service: Service, itemErrorOverride?: number) => {
    const comingSoon = isComingSoon(service.id);
    if (comingSoon) return "bg-gray-100 text-gray-600 border-gray-200";
    const realError = itemErrorOverride !== undefined ? itemErrorOverride : getRealErrorPercentage(service);
    if (realError === 0) return "bg-green-100 text-green-700 border-green-200";
    if (realError <= 10) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  const renderClientBadges = (service: Service) => {
    const comingSoon = isComingSoon(service.id);
    if (comingSoon) return null;
    const effectiveClients = (service.id === "oficore" || service.id === "ofitec" || service.id === "sgc" || service.id === "mi-cuenta")
      ? service.clients.filter(c => c.id === "cl_stuedemann" || c.name.toUpperCase().includes("STUEDEMANN") || c.name.toUpperCase().includes("OFIMUNDO"))
      : service.clients;
    if (!effectiveClients || effectiveClients.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {effectiveClients.map(c => {
          const now = new Date();
          const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
          const hoyStr = format(now, "yyyy-MM-dd");
          const ayer = new Date(now);
          ayer.setDate(ayer.getDate() - 1);
          const ayerStr = format(ayer, "yyyy-MM-dd");

          const isAuto = c.id === "cl_automovil_club" || c.name.toUpperCase().includes("AUTOMOVIL");
          const isAnt = c.id === "cl_cmds_antofagasta" || c.name.toUpperCase().includes("ANTOFAGASTA");
          const isCorp = c.id === "cl_corpesca" || c.name.toUpperCase().includes("CORPESCA");

          const checkDown = (filterFn: (f: any) => boolean, alertTimeMinutes: number) => {
            const esPasada = currentTimeInMinutes >= alertTimeMinutes;
            const tieneHoy = (facturasBitacora || []).some((f: any) => {
              if (!filterFn(f)) return false;
              const parsed = parseLocalStringDate(f.fecha_proceso);
              return parsed && parsed.dateStr === hoyStr;
            });
            const tieneAyer = (facturasBitacora || []).some((f: any) => {
              if (!filterFn(f)) return false;
              const parsed = parseLocalStringDate(f.fecha_proceso);
              return parsed && parsed.dateStr === ayerStr;
            });
            if (esPasada && !tieneHoy) return true;
            if (!tieneHoy && !tieneAyer) return true;
            return false;
          };
          
          let clientDown = false;
          if (isAuto) {
            clientDown = checkDown(
              (f: any) => (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL")),
              11 * 60
            );
          } else if (isAnt) {
            clientDown = checkDown(
              (f: any) => (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA")),
              13 * 60
            );
          } else if (isCorp) {
            clientDown = checkDown(
              (f: any) => (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA")),
              23 * 60
            );
          } else {
            clientDown = checkDown(
              (f: any) => {
                const matchAnt = (f.cliente_id && f.cliente_id.includes("antofagasta")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("ANTOFAGASTA"));
                const matchCorp = (f.cliente_id && f.cliente_id.includes("corpesca")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("CORPESCA"));
                const matchAuto = (f.cliente_id && f.cliente_id.includes("automovil")) || (f.cliente_nombre && f.cliente_nombre.toUpperCase().includes("AUTOMOVIL"));
                return !matchAnt && !matchCorp && !matchAuto;
              },
              15 * 60 + 30
            );
          }

          return (
            <Badge 
              key={c.id} 
              variant="outline" 
              className={cn(
                "text-[10px] flex items-center gap-1 py-0.5 px-2 cursor-pointer transition-all",
                clientDown 
                  ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300" 
                  : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              )}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/clientes?cliente=${c.id}`);
              }}
              title={`Ver cliente ${c.name}`}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", clientDown ? "bg-red-500 animate-pulse" : "bg-emerald-500")} />
              <span className="font-medium">{c.name}</span>
              {clientDown && <span className="text-[8px] font-bold text-red-600 dark:text-red-400 ml-0.5">Sin ejec.</span>}
            </Badge>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Barra de filtros y selector de vistas */}
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

        <div className="flex items-center gap-3">
          {/* Selector de Vistas */}
          <div className="flex items-center gap-1 border rounded-xl p-1 bg-muted/40 shadow-xs">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={viewMode === "grid" ? "default" : "ghost"} 
                    size="sm"
                    className={cn(
                      "h-8 px-2.5 rounded-lg transition-all",
                      viewMode === "grid" && "bg-primary text-primary-foreground shadow-xs font-medium"
                    )}
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
                    className={cn(
                      "h-8 px-2.5 rounded-lg transition-all",
                      viewMode === "list" && "bg-primary text-primary-foreground shadow-xs font-medium"
                    )}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vista lista</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Button variant="outline" size="sm" onClick={handleOpenExportModal}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar a Excel
          </Button>
        </div>
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

              <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={filters.showComingSoon}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showComingSoon: !!checked }))}
                    id="show-coming-soon"
                  />
                  <Label htmlFor="show-coming-soon" className="cursor-pointer text-xs font-medium flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    🚀 Mostrar servicios "Próximamente" (en desarrollo)
                  </Label>
                </div>

                {activeFiltersCount > 0 && (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <X className="mr-2 h-4 w-4" />
                    Limpiar todos los filtros ({activeFiltersCount})
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contador de resultados */}
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
          {filters.showComingSoon && (
            <Badge variant="secondary" className="gap-1 bg-gray-100 text-gray-700">
              🚀 Con Próximamente
            </Badge>
          )}
          <span className="text-sm text-muted-foreground ml-auto">
            Mostrando {serviceClientItems.length} tarjetas ({filteredServices.length} servicios)
          </span>
        </div>
      )}

      {/* Lista de tarjetas independientes por Cliente + Servicio */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
          {serviceClientItems.map((item) => {
            return (
              <Card
                key={item.key}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between p-2.5 border rounded-lg bg-card text-xs",
                  item.clientDown
                    ? "border-red-300 bg-red-50/50 hover:bg-red-50 dark:bg-red-950/20"
                    : item.status === "error"
                    ? "border-red-200 bg-red-50/40 hover:bg-red-50/70 dark:bg-red-950/20"
                    : item.status === "warning"
                    ? "border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-950/20"
                    : "border-emerald-200/80 bg-emerald-50/30 hover:bg-emerald-50/60 dark:bg-emerald-950/20"
                )}
                onClick={() => !item.isComingSoon && setSelectedService(item.service)}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-muted-foreground mb-0.5">
                    <span className="uppercase tracking-wider flex items-center gap-1 truncate text-primary/80">
                      <Building className="h-2.5 w-2.5 shrink-0" />
                      {item.client ? item.client.name : "General"}
                    </span>
                    {item.isComingSoon ? (
                      <Badge variant="outline" className="text-[8px] bg-gray-100 text-gray-600 border-gray-200 shrink-0 px-1 py-0 h-4">
                        🚀 Próximamente
                      </Badge>
                    ) : (
                      <Badge className={cn("text-[9px] font-bold py-0 px-1 shrink-0 h-4 flex items-center", item.clientDown ? "bg-red-100 text-red-700 border-red-200" : getErrorBadgeColor(item.service, item.errorPercentage))}>
                        {`${item.errorPercentage}% err`}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      {item.clientDown ? (
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      ) : item.status === "success" ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : item.status === "warning" ? (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      )}
                      <h4 className="font-bold text-xs text-foreground truncate">
                        {item.service.name}
                      </h4>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    {item.isComingSoon ? "🚀 Servicio en desarrollo." : item.service.description}
                  </p>

                  {item.clientDown && (
                    <div className="mt-1 text-[9px] font-bold text-red-700 bg-red-100/70 dark:bg-red-950/60 p-1 rounded border border-red-200 flex items-center gap-1">
                      <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-600" />
                      <span>Sin ejecución hoy</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end pt-1.5 mt-1.5 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">

                  {item.isComingSoon ? (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-gray-400 cursor-not-allowed px-1" disabled>
                      <Clock className="mr-1 h-2.5 w-2.5" /> Próximamente
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] font-semibold text-primary hover:bg-primary/10 px-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/servicio/${item.service.id}`);
                      }}
                    >
                      <LayoutDashboard className="mr-1 h-2.5 w-2.5" />
                      Monitorear
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : viewMode === "list" ? (
        <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[200px]">Cliente</TableHead>
                <TableHead className="w-[180px]">Servicio</TableHead>
                <TableHead className="min-w-[220px]">Descripción</TableHead>
                <TableHead className="text-center w-[110px]">Error Técnico</TableHead>
                <TableHead className="text-center w-[110px]">Estado</TableHead>
                <TableHead className="text-right w-[180px]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceClientItems.map((item) => {
                return (
                  <TableRow 
                    key={item.key} 
                    className="hover:bg-muted/40 transition-colors cursor-pointer text-xs"
                    onClick={() => !item.isComingSoon && setSelectedService(item.service)}
                  >
                    <TableCell className="font-medium py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{item.client ? item.client.name : "General"}</span>
                        {item.clientDown && <span className="text-[9px] font-bold text-red-600 ml-1">(Sin ejec.)</span>}
                      </div>
                    </TableCell>

                    <TableCell className="font-bold py-2.5">
                      <div className="flex items-center gap-1.5">
                        {item.clientDown ? (
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                        ) : item.status === "success" ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : item.status === "warning" ? (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        )}
                        <span>{item.service.name}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground leading-relaxed py-2.5">
                      {item.service.description}
                    </TableCell>

                    <TableCell className="text-center py-2.5">
                      <Badge className={cn("text-[10px] font-bold py-0.5 px-2", item.clientDown ? "bg-red-100 text-red-700 border-red-200" : getErrorBadgeColor(item.service, item.errorPercentage))}>
                        {item.isComingSoon ? "Próximamente" : `${item.errorPercentage}%`}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center py-2.5">
                      {!item.isComingSoon ? (
                        <StatusIndicator status={item.status} percentage={item.errorPercentage} size="sm" />
                      ) : (
                        <span className="text-gray-400 font-medium">Próximamente</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right py-2.5">
                      {item.isComingSoon ? (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-400 cursor-not-allowed" disabled>
                          <Clock className="mr-1 h-3.5 w-3.5" /> Próximamente
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs font-semibold text-primary hover:bg-primary/10 border-primary/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/servicio/${item.service.id}`);
                          }}
                        >
                          <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                          Monitorear Servicio
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {serviceClientItems.map((item) => {
            const healthPercent = item.isComingSoon ? 100 : (item.errorPercentage === 100 ? 0 : 100 - item.errorPercentage);

            const heatBg = item.isComingSoon
              ? "bg-gray-50/80 border-gray-200 dark:bg-gray-900/30"
              : item.clientDown || item.errorPercentage === 100
              ? "bg-red-50/90 border-red-300 dark:bg-red-950/40"
              : item.errorPercentage > 10
              ? "bg-rose-50/80 border-rose-200 dark:bg-rose-950/30"
              : item.errorPercentage > 0
              ? "bg-amber-50/80 border-amber-200 dark:bg-amber-950/30"
              : "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30";

            return (
              <div
                key={item.key}
                className={cn(
                  "rounded-xl border p-3 transition-all hover:shadow-md cursor-pointer flex flex-col justify-between gap-2.5",
                  heatBg
                )}
                onClick={() => !item.isComingSoon && setSelectedService(item.service)}
              >
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Building className="h-2.5 w-2.5 shrink-0 text-primary/80" />
                    <span>{item.client ? item.client.name : "General"}</span>
                  </div>

                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.clientDown ? (
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      ) : item.status === "success" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      )}
                      <h4 className="font-bold text-sm text-foreground">{item.service.name}</h4>
                    </div>
                    <Badge className={cn("text-[10px] font-bold py-0.5 px-1.5 shrink-0", item.clientDown ? "bg-red-100 text-red-700 border-red-200" : getErrorBadgeColor(item.service, item.errorPercentage))}>
                      {item.isComingSoon ? "Próximamente" : `${item.errorPercentage}% error`}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-2.5">
                    {item.isComingSoon ? "🚀 Servicio en desarrollo. Próximamente disponible." : item.service.description}
                  </p>

                  {item.clientDown && (
                    <div className="mb-2 text-[10px] font-bold text-red-700 bg-red-100/80 p-1.5 rounded border border-red-200 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0 text-red-600" />
                      <span>Sin ejecución hoy</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                      <span>Salud del servicio</span>
                      <span>{healthPercent}%</span>
                    </div>
                    <Progress value={healthPercent} className="h-1.5" />
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full h-7 text-xs font-semibold text-primary bg-background/90 hover:bg-background border border-primary/20 shadow-2xs mt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/servicio/${item.service.id}`);
                  }}
                  disabled={item.isComingSoon}
                >
                  <LayoutDashboard className="mr-1 h-3 w-3" />
                  {item.isComingSoon ? "Próximamente" : "Monitorear Servicio"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {serviceClientItems.length === 0 && (
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
              key={selectedClient.id}
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