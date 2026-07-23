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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  FileSpreadsheet
} from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";

interface TicketItem {
  id_incidencia: number;
  codigo_cliente?: string;
  contacto_nombre?: string;
  id_area?: number | string;
  area_nombre?: string;
  fecha_detalle?: string;
  id_accion?: number;
  tecnico?: string;
  estado_descripcion?: string;
}

const EXPORT_FIELDS = [
  { id: "id_incidencia", label: "N° Ticket", default: true },
  { id: "area_nombre", label: "Área Asignada", default: true },
  { id: "estado_descripcion", label: "Estado Incidencia", default: true },
  { id: "tecnico", label: "Responsable / Técnico", default: true },
  { id: "contacto_nombre", label: "Cliente / Contacto", default: true },
  { id: "codigo_cliente", label: "Código Cliente", default: true },
  { id: "fecha_detalle", label: "Fecha Registro", default: true },
  { id: "id_area", label: "ID Área", default: false },
  { id: "id_accion", label: "ID Acción Estado", default: false },
  { id: "exportDate", label: "Fecha de Exportación", default: true },
];

export function SupportTab() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("todos");
  const [selectedEstado, setSelectedEstado] = useState<string>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Estados de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(() =>
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );
  const [selectAll, setSelectAll] = useState(true);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const fechaDesde = format(startOfMonth(now), "yyyyMMdd");
      const fechaHasta = format(now, "yyyyMMdd");

      const res = await fetch(`/api/oficore/stats?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`);
      const data = await res.json();

      if (data.success && data.detalles) {
        setTickets(data.detalles);
      } else {
        setTickets([]);
      }
    } catch (err) {
      console.error("Error al cargar tickets de soporte:", err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Áreas oficiales maestras de la base de datos (MDA.area_responsable)
  const areasDisponibles = useMemo(() => {
    const oficiales = ["COMERCIAL", "TECNOLOGÍA", "SERVICIO", "MESA DE AYUDA", "EXPERIENCIA", "CONTROL GESTIÓN", "GERENCIA"];
    const setAreas = new Set<string>(oficiales);
    tickets.forEach(t => {
      if (t.area_nombre) setAreas.add(t.area_nombre);
    });
    return Array.from(setAreas);
  }, [tickets]);

  // Estados únicos
  const estadosDisponibles = useMemo(() => {
    const setEst = new Set<string>();
    tickets.forEach(t => {
      if (t.estado_descripcion) setEst.add(t.estado_descripcion);
    });
    return Array.from(setEst).sort();
  }, [tickets]);

  // Filtrado dinámico
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // Búsqueda por texto (N° ticket, área, estado, responsable, cliente)
      const matchesSearch = 
        searchTerm === "" ||
        t.id_incidencia?.toString().includes(searchTerm) ||
        (t.area_nombre && t.area_nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.estado_descripcion && t.estado_descripcion.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.tecnico && t.tecnico.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.contacto_nombre && t.contacto_nombre.toLowerCase().includes(searchTerm.toLowerCase()));

      // Filtro por Área
      const matchesArea = selectedArea === "todos" || t.area_nombre === selectedArea;

      // Filtro por Estado
      const matchesEstado = selectedEstado === "todos" || t.estado_descripcion === selectedEstado;

      return matchesSearch && matchesArea && matchesEstado;
    });
  }, [tickets, searchTerm, selectedArea, selectedEstado]);

  // Paginación
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTickets.slice(start, start + itemsPerPage);
  }, [filteredTickets, currentPage]);

  // Métricas rápidas
  const stats = useMemo(() => {
    const total = filteredTickets.length;
    const resueltos = filteredTickets.filter(t => t.id_accion === 5 || t.estado_descripcion?.toLowerCase().includes("resuelto")).length;
    const pendientes = total - resueltos;
    const tasaResolucion = total > 0 ? Math.round((resueltos / total) * 100) : 0;
    return { total, resueltos, pendientes, tasaResolucion };
  }, [filteredTickets]);

  // Modal y Exportación a Excel
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
      fecha_detalle: (t) => t.fecha_detalle ? format(new Date(t.fecha_detalle), "dd/MM/yyyy HH:mm") : "N/A",
      id_area: (t) => t.id_area ?? "N/A",
      id_accion: (t) => t.id_accion ?? "N/A",
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

    XLSX.utils.book_append_sheet(wb, ws, "Tickets Soporte");

    const summaryData = [
      { "Métrica": "Total Tickets", "Valor": stats.total },
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

  // Badge de estado con estilos armoniosos
  const renderEstadoBadge = (estado?: string, idAccion?: number) => {
    const est = (estado || "").toLowerCase();
    if (idAccion === 5 || est.includes("resuelto")) {
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200">Resuelto</Badge>;
    }
    if (est.includes("cerrado")) {
      return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Cerrado</Badge>;
    }
    if (est.includes("proceso") || est.includes("asignado")) {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">En Proceso</Badge>;
    }
    if (est.includes("re-abierto") || est.includes("reabierto")) {
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Re-Abierto</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200">{estado || "Ingresado"}</Badge>;
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
            Monitoreo en tiempo real de tickets asignados por área, estado y responsable técnico
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
              Ver más detalles
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
            onClick={fetchTickets}
            disabled={loading}
            className="h-9 w-9 p-0"
            title="Actualizar datos"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tickets</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{stats.total}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">En el mes en curso</p>
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
      <Card className="bg-white border-slate-200 shadow-xs p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por N° ticket, área, estado, técnico o cliente..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-xs border-slate-200"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Filtro por Área */}
            <Select 
              value={selectedArea} 
              onValueChange={(val) => {
                setSelectedArea(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs border-slate-200">
                <Building2 className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
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
              <SelectTrigger className="w-[170px] h-9 text-xs border-slate-200">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
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
                  setCurrentPage(1);
                }}
                className="h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                Limpiar Filtros
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabla Principal de Tickets */}
      <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-slate-500" />
            <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">
              Listado de Tickets ({filteredTickets.length})
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
                  <TableHead className="w-[120px] text-[11px] font-bold text-slate-600">N° Ticket</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600">Área Asignada</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600">Estado del Ticket</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600">Responsable / Técnico</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600">Cliente / Contacto</TableHead>
                  <TableHead className="w-[140px] text-[11px] font-bold text-slate-600 text-right">Fecha Registro</TableHead>
                  <TableHead className="w-[110px] text-[11px] font-bold text-slate-600 text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTickets.map((t) => (
                  <TableRow key={`${t.id_incidencia}_${t.fecha_detalle}`} className="hover:bg-slate-50/70 transition-colors">
                    {/* Número de Ticket */}
                    <TableCell className="font-bold text-xs text-blue-600">
                      #{t.id_incidencia}
                    </TableCell>

                    {/* Área Asignada */}
                    <TableCell className="text-xs font-semibold text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                        <span className="truncate max-w-[180px]">{t.area_nombre || "Tecnología"}</span>
                      </div>
                    </TableCell>

                    {/* Estado en el que se encuentra */}
                    <TableCell className="text-xs">
                      {renderEstadoBadge(t.estado_descripcion, t.id_accion)}
                    </TableCell>

                    {/* Responsable del Ticket */}
                    <TableCell className="text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-medium">
                        <UserCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span>{t.tecnico || "Sin Asignar"}</span>
                      </div>
                    </TableCell>

                    {/* Cliente / Contacto */}
                    <TableCell className="text-xs text-slate-600">
                      <div className="truncate max-w-[200px]" title={t.contacto_nombre}>
                        {t.contacto_nombre || "Cliente No Especificado"}
                      </div>
                    </TableCell>

                    {/* Fecha de Registro */}
                    <TableCell className="text-xs text-slate-500 font-mono text-right">
                      {t.fecha_detalle ? format(new Date(t.fecha_detalle), "dd/MM/yyyy HH:mm") : "N/A"}
                    </TableCell>

                    {/* Botón Ver más detalle */}
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 px-2 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-semibold gap-1"
                        title="Ver más detalles en Oficore"
                      >
                        <a href="https://oficore.com/" target="_blank" rel="noopener noreferrer">
                          <span>Ver más</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
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

      {/* Modal de Exportación a Excel */}
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
