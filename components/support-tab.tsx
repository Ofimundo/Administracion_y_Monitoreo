// components/support-tab.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { 
  Ticket, 
  Search, 
  RefreshCw, 
  Download, 
  Filter, 
  UserCheck, 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ExternalLink,
  FileSpreadsheet,
  History,
  PlayCircle,
  FileText,
  ArrowRight,
  CheckCircle,
  Clock3,
  User,
  Activity
} from "lucide-react";
import { format, startOfMonth, startOfYear, subDays, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";

export interface TicketHistoryItem {
  fecha_detalle?: string;
  id_accion?: number;
  estado_descripcion?: string;
  tecnico?: string;
  area_nombre?: string;
  codigo_cliente?: string;
  contacto_nombre?: string;
}

export interface TicketItem {
  id_incidencia: number;
  codigo_cliente?: string;
  contacto_nombre?: string;
  id_area?: number | string;
  area_nombre?: string;
  fecha_detalle?: string;
  id_accion?: number;
  tecnico?: string;
  estado_descripcion?: string;
  historial?: TicketHistoryItem[];
  fecha_creacion?: string;
  fecha_asignacion?: string;
  fecha_gestion?: string;
  fecha_resolucion?: string;
}

// Normalizador flexible de texto (elimina tildes, espacios extra y convierte a minúsculas)
const normalizeText = (text?: string) => {
  if (!text) return "";
  return String(text)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const formatTicketDate = (fechaStr?: string) => {
  if (!fechaStr) return "N/A";
  const cleanStr = String(fechaStr).replace("Z", "");
  const match = cleanStr.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/);
  if (match) {
    const [_, datePart, hh, mm] = match;
    const [yyyy, MM, dd] = datePart.split("-");
    return `${dd}/${MM}/${yyyy} ${hh}:${mm}`;
  }
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return fechaStr;
  return format(d, "dd/MM/yyyy HH:mm");
};

const getDurationString = (startStr?: string, endStr?: string) => {
  if (!startStr || !endStr) return null;
  const d1 = new Date(startStr);
  const d2 = new Date(endStr);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  const diffMs = d2.getTime() - d1.getTime();
  if (diffMs < 0) return null;
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${diffMins} min`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
};

const EXPORT_FIELDS = [
  { id: "id_incidencia", label: "N° Ticket", default: true },
  { id: "area_nombre", label: "Área Asignada", default: true },
  { id: "estado_descripcion", label: "Estado Actual", default: true },
  { id: "tecnico", label: "Responsable / Técnico", default: true },
  { id: "contacto_nombre", label: "Cliente / Contacto", default: true },
  { id: "codigo_cliente", label: "Código Cliente", default: true },
  { id: "fecha_detalle", label: "Último Cambio", default: true },
  { id: "fecha_creacion", label: "Fecha Registro / Ingreso", default: true },
  { id: "fecha_asignacion", label: "Fecha Asignación", default: true },
  { id: "fecha_gestion", label: "Fecha Inicio Gestión", default: true },
  { id: "fecha_resolucion", label: "Fecha Resolución", default: true },
  { id: "total_cambios", label: "Cantidad de Cambios de Estado", default: true },
  { id: "exportDate", label: "Fecha de Exportación", default: false },
];

export function SupportTab({ initialArea }: { initialArea?: string }) {
  const [rawDetalles, setRawDetalles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>(initialArea || "todos");
  const [selectedEstado, setSelectedEstado] = useState<string>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    if (initialArea) {
      setSelectedArea(initialArea);
    }
  }, [initialArea]);

  // Estados de Filtro de Rango de Fechas (por defecto mes en curso para soporte)
  const [fechaDesde, setFechaDesde] = useState<Date>(() => startOfMonth(new Date()));
  const [fechaHasta, setFechaHasta] = useState<Date>(() => new Date());

  // Modal de Historial
  const [selectedTicketHistory, setSelectedTicketHistory] = useState<TicketItem | null>(null);

  // Modal de Exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(() =>
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );
  const [selectAll, setSelectAll] = useState(true);

  const fetchTickets = async (desde: Date = fechaDesde, hasta: Date = fechaHasta) => {
    setLoading(true);
    try {
      const fDesde = format(desde, "yyyyMMdd");
      const fHasta = format(hasta, "yyyyMMdd");

      const res = await fetch(`/api/oficore/stats?fechaDesde=${fDesde}&fechaHasta=${fHasta}`);
      const data = await res.json();

      if (data.success && data.detalles) {
        setRawDetalles(data.detalles);
      } else {
        setRawDetalles([]);
      }
    } catch (err) {
      console.error("Error al cargar tickets de soporte:", err);
      setRawDetalles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Agrupar rawDetalles por id_incidencia para eliminar duplicados
  const tickets: TicketItem[] = useMemo(() => {
    if (!rawDetalles || rawDetalles.length === 0) return [];

    const map = new Map<number, { latest: any; history: TicketHistoryItem[] }>();

    // Ordenar de más reciente a más antiguo por fecha_detalle
    const sorted = [...rawDetalles].sort((a, b) => {
      const timeA = a.fecha_detalle ? new Date(a.fecha_detalle).getTime() : 0;
      const timeB = b.fecha_detalle ? new Date(b.fecha_detalle).getTime() : 0;
      return timeB - timeA;
    });

    sorted.forEach(item => {
      const id = item.id_incidencia;
      if (!id && id !== 0) return;

      const historyItem: TicketHistoryItem = {
        fecha_detalle: item.fecha_detalle,
        id_accion: item.id_accion,
        estado_descripcion: item.estado_descripcion,
        tecnico: item.tecnico,
        area_nombre: item.area_nombre,
        codigo_cliente: item.codigo_cliente,
        contacto_nombre: item.contacto_nombre,
      };

      if (!map.has(id)) {
        map.set(id, {
          latest: { ...item },
          history: [historyItem],
        });
      } else {
        map.get(id)!.history.push(historyItem);
      }
    });

    const result: TicketItem[] = [];

    map.forEach((value, id) => {
      // Ordenar historial cronológicamente (más antiguo primero) para la línea de tiempo
      const chronoHistory = [...value.history].sort((a, b) => {
        const timeA = a.fecha_detalle ? new Date(a.fecha_detalle).getTime() : 0;
        const timeB = b.fecha_detalle ? new Date(b.fecha_detalle).getTime() : 0;
        return timeA - timeB;
      });

      const fecha_creacion = chronoHistory[0]?.fecha_detalle;

      // Hito: Asignación
      const asig = chronoHistory.find(h => 
        h.id_accion === 3 || 
        normalizeText(h.estado_descripcion).includes("asignado") ||
        (h.tecnico && normalizeText(h.tecnico) !== "sin asignar")
      );
      const fecha_asignacion = asig?.fecha_detalle;

      // Hito: Inicio de Gestión
      const gest = chronoHistory.find(h => 
        h.id_accion === 4 || 
        normalizeText(h.estado_descripcion).includes("gestion")
      );
      const fecha_gestion = gest?.fecha_detalle;

      // Hito: Resolución
      const res = chronoHistory.find(h => 
        h.id_accion === 5 || 
        normalizeText(h.estado_descripcion).includes("resuelto")
      );
      const fecha_resolucion = res?.fecha_detalle;

      const ticketArea = value.latest?.area_nombre?.trim() || 
        chronoHistory.find(h => h.area_nombre && h.area_nombre.trim())?.area_nombre?.trim() || 
        "Tecnología";

      result.push({
        ...value.latest,
        area_nombre: ticketArea,
        historial: chronoHistory,
        fecha_creacion,
        fecha_asignacion,
        fecha_gestion,
        fecha_resolucion,
      });
    });

    // Ordenar tickets finales por fecha de último cambio (más reciente primero)
    return result.sort((a, b) => {
      const timeA = a.fecha_detalle ? new Date(a.fecha_detalle).getTime() : 0;
      const timeB = b.fecha_detalle ? new Date(b.fecha_detalle).getTime() : 0;
      return timeB - timeA;
    });
  }, [rawDetalles]);

  const handleDateFromChange = (val: string) => {
    if (!val) return;
    const parts = val.split("-");
    const newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0);
    setFechaDesde(newDate);
    setCurrentPage(1);
    fetchTickets(newDate, fechaHasta);
  };

  const handleDateToChange = (val: string) => {
    if (!val) return;
    const parts = val.split("-");
    const newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59);
    setFechaHasta(newDate);
    setCurrentPage(1);
    fetchTickets(fechaDesde, newDate);
  };

  const applyDatePreset = (preset: "hoy" | "7dias" | "mes" | "30dias" | "ano") => {
    const now = new Date();
    let desde = startOfMonth(now);
    let hasta = now;

    if (preset === "hoy") {
      desde = startOfDay(now);
      hasta = endOfDay(now);
    } else if (preset === "7dias") {
      desde = startOfDay(subDays(now, 7));
      hasta = endOfDay(now);
    } else if (preset === "mes") {
      desde = startOfMonth(now);
      hasta = endOfDay(now);
    } else if (preset === "30dias") {
      desde = startOfDay(subDays(now, 30));
      hasta = endOfDay(now);
    } else if (preset === "ano") {
      desde = new Date(now.getFullYear(), 0, 1);
      hasta = endOfDay(now);
    }

    setFechaDesde(desde);
    setFechaHasta(hasta);
    setCurrentPage(1);
    fetchTickets(desde, hasta);
  };

  // Áreas oficiales maestras de la plataforma
  const OFFICIAL_AREAS = [
    "Control Gestión",
    "Experiencia",
    "Gerencia",
    "Mesa De Ayuda",
    "Servicio",
    "Tecnología"
  ];

  // Áreas disponibles (oficiales + cualquier variante de BD)
  const areasDisponibles = useMemo(() => {
    const map = new Map<string, string>();
    
    // Primero registrar las áreas oficiales maestras
    OFFICIAL_AREAS.forEach(area => {
      map.set(normalizeText(area), area);
    });

    // Registrar cualquier otra área traída dinámicamente de tickets
    tickets.forEach(t => {
      const areaVal = t.area_nombre || "Tecnología";
      if (areaVal && areaVal.trim()) {
        const norm = normalizeText(areaVal);
        if (!map.has(norm)) {
          map.set(norm, areaVal.trim());
        }
      }
      if (t.historial && Array.isArray(t.historial)) {
        t.historial.forEach(h => {
          if (h.area_nombre && h.area_nombre.trim()) {
            const norm = normalizeText(h.area_nombre);
            if (!map.has(norm)) {
              map.set(norm, h.area_nombre.trim());
            }
          }
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [tickets]);

  // Estados únicos de tickets (normalizados)
  const estadosDisponibles = useMemo(() => {
    const map = new Map<string, string>();
    tickets.forEach(t => {
      if (t.estado_descripcion && t.estado_descripcion.trim()) {
        const norm = normalizeText(t.estado_descripcion);
        if (!map.has(norm)) {
          map.set(norm, t.estado_descripcion.trim());
        }
      }
    });
    if (map.size === 0) {
      ["Asignado", "Gestionando", "Recibido", "Resuelto", "Re-Abierto", "Incompleto", "Anulado", "Serv. Técnico"].forEach(e => {
        map.set(normalizeText(e), e);
      });
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  // Evaluador flexible para filtrado por área
  const isAreaMatch = (ticketArea: string | undefined, selectedArea: string, historial?: TicketHistoryItem[]): boolean => {
    if (!selectedArea || selectedArea === "todos") return true;

    const normSelected = normalizeText(selectedArea);
    if (!normSelected) return true;

    const testAreaString = (rawArea?: string): boolean => {
      const effective = (rawArea && rawArea.trim()) ? rawArea.trim() : "Tecnología";
      const normArea = normalizeText(effective);

      if (normArea === normSelected) return true;
      if (normArea.includes(normSelected) || normSelected.includes(normArea)) return true;

      // Equivalencias y familias de áreas
      if (
        (normSelected.includes("mesa") || normSelected.includes("ayuda") || normSelected === "mda") &&
        (normArea.includes("mesa") || normArea.includes("ayuda") || normArea === "mda" || normArea.includes("soporte"))
      ) return true;

      if (
        normSelected.includes("control") && normSelected.includes("gestion") &&
        normArea.includes("control") && normArea.includes("gestion")
      ) return true;

      if (
        normSelected.includes("servicio") && normArea.includes("servicio")
      ) return true;

      if (
        (normSelected.includes("tecnolog") || normSelected === "ti" || normSelected.includes("sistemas")) &&
        (normArea.includes("tecnolog") || normArea === "ti" || normArea.includes("sistemas") || normArea.includes("desarrollo"))
      ) return true;

      if (
        normSelected.includes("experiencia") && normArea.includes("experiencia")
      ) return true;

      if (
        normSelected.includes("gerencia") && normArea.includes("gerencia")
      ) return true;

      return false;
    };

    if (testAreaString(ticketArea)) return true;

    if (historial && Array.isArray(historial)) {
      if (historial.some(h => testAreaString(h.area_nombre))) return true;
    }

    return false;
  };

  // Filtrado dinámico robusto con normalización de texto, concordancia de áreas y rango de fechas
  const filteredTickets = useMemo(() => {
    const normSearch = normalizeText(searchTerm);
    const normSelectedEstado = normalizeText(selectedEstado);
    const targetFrom = startOfDay(fechaDesde);
    const targetTo = endOfDay(fechaHasta);

    return tickets.filter(t => {
      // 1. Filtro Búsqueda por texto libre
      const matchesSearch = 
        normSearch === "" ||
        t.id_incidencia?.toString().includes(normSearch) ||
        normalizeText(t.area_nombre).includes(normSearch) ||
        normalizeText(t.estado_descripcion).includes(normSearch) ||
        normalizeText(t.tecnico).includes(normSearch) ||
        normalizeText(t.contacto_nombre).includes(normSearch) ||
        normalizeText(t.codigo_cliente).includes(normSearch);

      // 2. Filtro por Área
      const matchesArea = isAreaMatch(t.area_nombre, selectedArea, t.historial);

      // 3. Filtro por Estado (con equivalencias por id_accion)
      const normEstado = normalizeText(t.estado_descripcion);
      const matchesEstado = 
        selectedEstado === "todos" || 
        normEstado === normSelectedEstado ||
        (normSelectedEstado === "resuelto" && (t.id_accion === 5 || normEstado.includes("resuelto"))) ||
        (normSelectedEstado === "asignado" && (t.id_accion === 3 || normEstado.includes("asignado"))) ||
        (normSelectedEstado === "gestionando" && (t.id_accion === 4 || normEstado.includes("gestion"))) ||
        (normSelectedEstado === "recibido" && (t.id_accion === 1 || normEstado.includes("recibido")));

      // 4. Filtro estricto por Rango de Fechas (Del mes en curso / fechaDesde a fechaHasta)
      let matchesDate = true;
      if (t.fecha_detalle) {
        const d = new Date(t.fecha_detalle);
        if (!isNaN(d.getTime())) {
          matchesDate = d >= targetFrom && d <= targetTo;
        }
      }

      return matchesSearch && matchesArea && matchesEstado && matchesDate;
    });
  }, [tickets, searchTerm, selectedArea, selectedEstado, fechaDesde, fechaHasta]);

  // Paginación
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTickets.slice(start, start + itemsPerPage);
  }, [filteredTickets, currentPage]);

  // Métricas rápidas sobre tickets únicos
  const stats = useMemo(() => {
    const total = filteredTickets.length;
    const resueltos = filteredTickets.filter(t => t.id_accion === 5 || normalizeText(t.estado_descripcion).includes("resuelto")).length;
    const pendientes = total - resueltos;
    const tasaResolucion = total > 0 ? Math.round((resueltos / total) * 100) : 0;
    return { total, resueltos, pendientes, tasaResolucion };
  }, [filteredTickets]);

  // Exportación a Excel
  const handleOpenExportModal = () => {
    if (filteredTickets.length === 0) return;
    setShowExportModal(true);
  };

  const handleToggleField = (fieldId: string) => {
    setSelectedFields(prev => {
      const newSelection = prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId];
      
      setSelectAll(newSelection.length === EXPORT_FIELDS.length);
      return newSelection;
    });
  };

  const handleToggleAllFields = () => {
    if (selectAll) {
      setSelectedFields([]);
      setSelectAll(false);
    } else {
      setSelectedFields(EXPORT_FIELDS.map(f => f.id));
      setSelectAll(true);
    }
  };

  const handleExportToExcel = () => {
    if (selectedFields.length === 0 || filteredTickets.length === 0) return;

    const fieldMap: Record<string, (t: TicketItem) => any> = {
      id_incidencia: (t) => t.id_incidencia,
      area_nombre: (t) => t.area_nombre || "Sin Área",
      estado_descripcion: (t) => t.estado_descripcion || "Desconocido",
      tecnico: (t) => t.tecnico || "Sin Asignar",
      contacto_nombre: (t) => t.contacto_nombre || "Sin Nombre",
      codigo_cliente: (t) => t.codigo_cliente || "N/A",
      fecha_detalle: (t) => formatTicketDate(t.fecha_detalle),
      fecha_creacion: (t) => formatTicketDate(t.fecha_creacion),
      fecha_asignacion: (t) => formatTicketDate(t.fecha_asignacion),
      fecha_gestion: (t) => formatTicketDate(t.fecha_gestion),
      fecha_resolucion: (t) => formatTicketDate(t.fecha_resolucion),
      total_cambios: (t) => t.historial?.length || 1,
      exportDate: () => format(new Date(), "dd/MM/yyyy HH:mm:ss"),
    };

    const fieldLabels: Record<string, string> = {};
    EXPORT_FIELDS.forEach(f => fieldLabels[f.id] = f.label);

    const exportData = filteredTickets.map(t => {
      const row: Record<string, any> = {};
      selectedFields.forEach(fieldId => {
        const label = fieldLabels[fieldId] || fieldId;
        row[label] = fieldMap[fieldId](t);
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();

    const colWidths = selectedFields.map(() => ({ wch: 25 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Tickets Soporte Únicos");

    const summaryData = [
      { "Métrica": "Total Tickets Únicos", "Valor": stats.total },
      { "Métrica": "Tickets Resueltos", "Valor": stats.resueltos },
      { "Métrica": "Tickets Pendientes", "Valor": stats.pendientes },
      { "Métrica": "Tasa de Resolución", "Valor": `${stats.tasaResolucion}%` },
      { "Métrica": "Fecha Exportación", "Valor": format(new Date(), "dd/MM/yyyy HH:mm:ss") },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

    XLSX.writeFile(wb, `Tickets_Soporte_Tecnologia_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    setShowExportModal(false);
  };

  // Renderizar insignia de estado con estilos pulidos
  const renderEstadoBadge = (estado?: string, idAccion?: number) => {
    const name = estado || (idAccion === 5 ? "Resuelto" : "Ingresado");
    const est = normalizeText(name);

    if (idAccion === 5 || est.includes("resuelto")) {
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold shadow-2xs">Resuelto</Badge>;
    }
    if (idAccion === 3 || est.includes("asignado")) {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold shadow-2xs">Asignado</Badge>;
    }
    if (idAccion === 4 || est.includes("gestion")) {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold shadow-2xs">Gestionando</Badge>;
    }
    if (idAccion === 1 || est.includes("recibido")) {
      return <Badge className="bg-sky-100 text-sky-800 border-sky-300 font-semibold shadow-2xs">Recibido</Badge>;
    }
    if (idAccion === 9 || est.includes("reabierto") || est.includes("re-abierto")) {
      return <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-semibold shadow-2xs">Re-Abierto</Badge>;
    }
    if (idAccion === 6 || est.includes("incompleto")) {
      return <Badge className="bg-orange-100 text-orange-800 border-orange-300 font-semibold shadow-2xs">Incompleto</Badge>;
    }
    if (idAccion === 8 || est.includes("anulado")) {
      return <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-semibold shadow-2xs">Anulado</Badge>;
    }
    if (idAccion === 7 || est.includes("tecnico")) {
      return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold shadow-2xs">Serv. Técnico</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-800 border-slate-300 font-semibold shadow-2xs">{name}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Pestaña Soporte */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Ticket className="h-6 w-6 text-amber-500" />
            SOPORTE Y GESTIÓN DE INCIDENCIAS
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Vista unificada de tickets sin duplicaciones. Seguimiento del cambio de estado y trazabilidad completa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="default" 
            size="sm" 
            asChild
            className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs gap-1.5"
          >
            <a href="https://oficore.com/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver en Oficore
            </a>
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleOpenExportModal}
            disabled={filteredTickets.length === 0}
            className="h-9 text-xs bg-white border-slate-200 shadow-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Exportar Excel
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchTickets()}
            disabled={loading}
            className="h-9 w-9 p-0"
            title="Actualizar datos"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen (Tickets Únicos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tickets Únicos</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{stats.total}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Sin duplicar por estados</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Ticket className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tickets Resueltos</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{stats.resueltos}</p>
              <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">{stats.tasaResolucion}% de efectividad</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pendientes / En Proceso</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{stats.pendientes}</p>
              <p className="text-[9px] text-amber-600 font-semibold mt-0.5">En gestión técnica</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Áreas Activas</p>
              <p className="text-2xl font-black text-purple-600 mt-1">{areasDisponibles.length || 1}</p>
              <p className="text-[9px] text-purple-600 font-semibold mt-0.5">Departamentos asignados</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros de Búsqueda */}
      <Card className="bg-white border-slate-200 shadow-xs p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por N° ticket, área, estado, técnico o cliente..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-xs border-slate-200 w-full"
            />
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
            {/* Filtro de Rango de Fechas */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 bg-slate-50 p-1 rounded-md border border-slate-200 text-xs w-full sm:w-auto">
              <CalendarIcon className="h-3.5 w-3.5 text-blue-600 ml-1 shrink-0" />
              <span className="text-[11px] font-medium text-slate-600 hidden sm:inline">Desde:</span>
              <Input
                type="date"
                value={format(fechaDesde, "yyyy-MM-dd")}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="h-7 text-xs border-slate-200 bg-white w-full sm:w-[125px] px-1.5 focus-visible:ring-1"
                title="Fecha Desde"
              />
              <span className="text-slate-400 font-bold text-[11px] hidden sm:inline">-</span>
              <span className="text-[11px] font-medium text-slate-600 hidden sm:inline">Hasta:</span>
              <Input
                type="date"
                value={format(fechaHasta, "yyyy-MM-dd")}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="h-7 text-xs border-slate-200 bg-white w-full sm:w-[125px] px-1.5 focus-visible:ring-1"
                title="Fecha Hasta"
              />
              <div className="hidden lg:flex items-center gap-1 border-l border-slate-200 pl-1.5 ml-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyDatePreset("hoy")}
                  className="h-6 text-[10px] px-1.5 font-medium text-slate-600 hover:bg-slate-200"
                >
                  Hoy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyDatePreset("7dias")}
                  className="h-6 text-[10px] px-1.5 font-medium text-slate-600 hover:bg-slate-200"
                >
                  7 Días
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyDatePreset("mes")}
                  className="h-6 text-[10px] px-1.5 font-medium text-slate-600 hover:bg-slate-200"
                >
                  Este Mes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyDatePreset("ano")}
                  className="h-6 text-[10px] px-1.5 font-medium text-slate-600 hover:bg-slate-200"
                >
                  Este Año
                </Button>
              </div>
            </div>

            {/* Filtro por Área */}
            <Select 
              value={selectedArea} 
              onValueChange={(val) => {
                setSelectedArea(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs border-slate-200">
                <Building2 className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
                <SelectValue placeholder="Área Asignada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las Áreas</SelectItem>
                {areasDisponibles.map(area => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro por Estado */}
            <Select 
              value={selectedEstado} 
              onValueChange={(val) => {
                setSelectedEstado(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs border-slate-200">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
                <SelectValue placeholder="Estado del Ticket" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Estados</SelectItem>
                {estadosDisponibles.map(est => (
                  <SelectItem key={est} value={est}>{est}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchTerm || selectedArea !== "todos" || selectedEstado !== "todos") && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSearchTerm("");
                  setSelectedArea("todos");
                  setSelectedEstado("todos");
                  const now = new Date();
                  const firstOfMonth = startOfMonth(now);
                  setFechaDesde(firstOfMonth);
                  setFechaHasta(now);
                  setCurrentPage(1);
                  fetchTickets(firstOfMonth, now);
                }}
                className="h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                Limpiar Filtros
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabla Principal de Tickets (Sin Duplicados) */}
      <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-slate-500" />
            <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">
              Listado de Tickets Únicos ({filteredTickets.length})
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Página {currentPage} de {totalPages}
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : paginatedTickets.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">No se encontraron tickets registrados</p>
            <p className="text-xs text-slate-400 mt-1">Prueba ajustando los filtros de búsqueda o el rango de fechas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70 hover:bg-slate-50">
                  <TableHead className="w-[110px] text-[11px] font-bold text-slate-600">N° Ticket</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600">Área Asignada</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600">Estado Actual</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600">Responsable / Técnico</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600">Cliente / Contacto</TableHead>
                  <TableHead className="w-[140px] text-[11px] font-bold text-slate-600 text-right">Último Cambio</TableHead>
                  <TableHead className="w-[190px] text-[11px] font-bold text-slate-600 text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTickets.map((t) => (
                  <TableRow key={t.id_incidencia} className="hover:bg-slate-50/70 transition-colors">
                    {/* Número de Ticket */}
                    <TableCell className="font-bold text-xs text-blue-600">
                      #{t.id_incidencia}
                    </TableCell>

                    {/* Área Asignada */}
                    <TableCell className="text-xs font-semibold text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                        <span className="truncate max-w-[170px]">{t.area_nombre || "Tecnología"}</span>
                      </div>
                    </TableCell>

                    {/* Estado Actual (Insignia del último cambio) */}
                    <TableCell className="text-xs">
                      {renderEstadoBadge(t.estado_descripcion, t.id_accion)}
                    </TableCell>

                    {/* Responsable Actual del Ticket */}
                    <TableCell className="text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-medium">
                        <UserCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span>{t.tecnico || "Sin Asignar"}</span>
                      </div>
                    </TableCell>

                    {/* Cliente / Contacto */}
                    <TableCell className="text-xs text-slate-600">
                      <div className="truncate max-w-[180px]" title={t.contacto_nombre}>
                        {t.contacto_nombre || "Cliente No Especificado"}
                      </div>
                    </TableCell>

                    {/* Fecha de Último Cambio */}
                    <TableCell className="text-xs text-slate-500 font-mono text-right">
                      {formatTicketDate(t.fecha_detalle)}
                    </TableCell>

                    {/* Botones de Acción */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Botón Ver Historial */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTicketHistory(t)}
                          className="h-7 px-2 text-[11px] bg-slate-50 hover:bg-blue-50 border-slate-200 text-blue-700 font-semibold gap-1"
                          title="Ver historial completo de cambios de estado"
                        >
                          <History className="h-3.5 w-3.5 text-blue-600" />
                          <span>Historial</span>
                        </Button>

                        {/* Botón Ver más en Oficore */}
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 px-1.5 text-[11px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-medium"
                          title="Ver detalle en plataforma Oficore"
                        >
                          <a href="https://oficore.com/" target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginador */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 flex justify-between items-center bg-slate-50/30">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Anterior
            </Button>
            <span className="text-xs text-slate-500 font-semibold">
              Página {currentPage} de {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 text-xs"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </Card>

      {/* Modal de Historial Completo de la Incidencia */}
      <Dialog 
        open={!!selectedTicketHistory} 
        onOpenChange={(open) => !open && setSelectedTicketHistory(null)}
      >
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {selectedTicketHistory && (
            <div>
              {/* Header Modal */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/80 rounded-t-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-blue-100 text-blue-700">
                        <History className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          Historial de Incidencia #{selectedTicketHistory.id_incidencia}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Trazabilidad de asignación, inicio de gestión y resolución del ticket
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {renderEstadoBadge(selectedTicketHistory.estado_descripcion, selectedTicketHistory.id_accion)}
                  </div>
                </div>

                {/* Subdatos del ticket */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Cliente / Contacto:</span>
                    <p className="font-semibold text-slate-700 truncate">{selectedTicketHistory.contacto_nombre || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Área Asignada:</span>
                    <p className="font-semibold text-purple-700 truncate">{selectedTicketHistory.area_nombre || "Tecnología"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Técnico Responsable Actual:</span>
                    <p className="font-semibold text-blue-700 truncate">{selectedTicketHistory.tecnico || "Sin Asignar"}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-6">
                {/* Tarjetas de Hitos / Tiempos Clave */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-blue-600" />
                    Hitos Principales de la Incidencia
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Hito 1: Creación */}
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        <span>1. Fecha Registro</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1 font-mono">
                        {formatTicketDate(selectedTicketHistory.fecha_creacion)}
                      </p>
                      <span className="text-[10px] text-slate-400">Ingreso de la incidencia</span>
                    </div>

                    {/* Hito 2: Asignación */}
                    <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200">
                      <div className="flex items-center gap-1.5 text-amber-700 text-[11px] font-semibold">
                        <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                        <span>2. Fecha Asignación</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1 font-mono">
                        {selectedTicketHistory.fecha_asignacion ? formatTicketDate(selectedTicketHistory.fecha_asignacion) : "Sin asignar"}
                      </p>
                      {getDurationString(selectedTicketHistory.fecha_creacion, selectedTicketHistory.fecha_asignacion) ? (
                        <span className="text-[10px] text-amber-700 font-medium">
                          ⏱ {getDurationString(selectedTicketHistory.fecha_creacion, selectedTicketHistory.fecha_asignacion)} tras ingreso
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Asignación técnica</span>
                      )}
                    </div>

                    {/* Hito 3: Inicio de Gestión */}
                    <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200">
                      <div className="flex items-center gap-1.5 text-blue-700 text-[11px] font-semibold">
                        <PlayCircle className="h-3.5 w-3.5 text-blue-600" />
                        <span>3. Inicio Gestión</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1 font-mono">
                        {selectedTicketHistory.fecha_gestion ? formatTicketDate(selectedTicketHistory.fecha_gestion) : "En espera"}
                      </p>
                      {getDurationString(selectedTicketHistory.fecha_asignacion || selectedTicketHistory.fecha_creacion, selectedTicketHistory.fecha_gestion) ? (
                        <span className="text-[10px] text-blue-700 font-medium">
                          ⏱ {getDurationString(selectedTicketHistory.fecha_asignacion || selectedTicketHistory.fecha_creacion, selectedTicketHistory.fecha_gestion)} de espera
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Comienzo de atención</span>
                      )}
                    </div>

                    {/* Hito 4: Resolución */}
                    <div className={`p-3 rounded-lg border ${selectedTicketHistory.fecha_resolucion ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                      <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${selectedTicketHistory.fecha_resolucion ? "text-emerald-700" : "text-slate-500"}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>4. Fecha Resolución</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1 font-mono">
                        {selectedTicketHistory.fecha_resolucion ? formatTicketDate(selectedTicketHistory.fecha_resolucion) : "En desarrollo"}
                      </p>
                      {getDurationString(selectedTicketHistory.fecha_creacion, selectedTicketHistory.fecha_resolucion) ? (
                        <span className="text-[10px] text-emerald-700 font-medium">
                          🎉 Resuelto en {getDurationString(selectedTicketHistory.fecha_creacion, selectedTicketHistory.fecha_resolucion)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Cierre del ticket</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Línea de Tiempo Detallada de Transiciones */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-purple-600" />
                    Línea de Tiempo de Cambios de Estado ({selectedTicketHistory.historial?.length || 0})
                  </h3>

                  <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
                    {selectedTicketHistory.historial && selectedTicketHistory.historial.map((step, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === selectedTicketHistory.historial!.length - 1;

                      return (
                        <div key={idx} className="relative group">
                          {/* Nodo de la línea de tiempo */}
                          <div className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 bg-white flex items-center justify-center ${
                            isLast ? "border-emerald-500 bg-emerald-500 text-white" : "border-blue-500"
                          }`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${isLast ? "bg-white" : "bg-blue-500"}`} />
                          </div>

                          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400 font-mono">#{idx + 1}</span>
                                {renderEstadoBadge(step.estado_descripcion, step.id_accion)}
                                {isFirst && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">Ingreso Inicial</span>
                                )}
                                {isLast && (
                                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Estado Actual</span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 font-mono font-medium">
                                {formatTicketDate(step.fecha_detalle)}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="text-slate-400">Técnico:</span>
                                <span className="font-semibold text-slate-700">{step.tecnico || "Sin Asignar"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="text-slate-400">Área:</span>
                                <span className="font-semibold text-slate-700">{step.area_nombre || "Sin área"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end rounded-b-lg">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedTicketHistory(null)}
                  className="bg-white border-slate-200 font-semibold"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Exportación a Excel */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Seleccionar Campos para Exportar (Tickets Únicos)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Exportación limpia de tickets de soporte con trazabilidad de fechas de asignación y gestión.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleToggleAllFields}
                  id="select-all-support"
                />
                <Label htmlFor="select-all-support" className="font-semibold">
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
                    id={`field-support-${field.id}`}
                  />
                  <Label htmlFor={`field-support-${field.id}`} className="text-sm cursor-pointer">
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
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
