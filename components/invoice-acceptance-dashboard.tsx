// components/invoice-acceptance-dashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Play,
  RefreshCw,
  FileText,
  Database,
  Terminal as TerminalIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Activity,
  Edit2,
  Trash2,
  Sparkles,
  Mail,
  Loader2,
  X,
  Calendar as CalendarIcon,
  Filter,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";

interface BitacoraEntry {
  id_proceso?: number;
  folio_documento: number;
  tipo_documento: number;
  orden_compra: string | null;
  razon_social: string;
  rut_proveedor: string;
  dias_por_vencer: number;
  estado: "Aprobado" | "Rechazado" | "Pendiente" | "Manual" | "Pendiente Espera" | null;
  id_regla: number | null;
  motivo: string | null;
  horas_por_revisar: number | null;
  fecha_proceso: string;
  fecha_modificacion: string | null;
}

interface LogLine {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  folio?: number;
}

interface Filters {
  search: string;
  estado: string;
  tipoDocumento: string;
  fechaDesde: Date | null;
  fechaHasta: Date | null;
}

const EXPORT_FIELDS = [
  { id: "tipo", label: "Tipo Documento", default: true },
  { id: "folio", label: "Folio Documento", default: true },
  { id: "rut_proveedor", label: "RUT Proveedor", default: true },
  { id: "razon_social", label: "Razón Social", default: true },
  { id: "orden_compra", label: "Orden de Compra (OC)", default: true },
  { id: "dias_por_vencer", label: "Días por Vencer", default: true },
  { id: "estado", label: "Estado Proceso", default: true },
  { id: "fecha_proceso", label: "Fecha de Proceso", default: true },
  { id: "motivo", label: "Motivo / Detalle", default: true },
  { id: "id_proceso", label: "ID Proceso", default: false },
  { id: "id_regla", label: "ID Regla Aplicada", default: false },
  { id: "horas_por_revisar", label: "Horas por Revisar", default: false },
  { id: "fecha_modificacion", label: "Fecha Modificación", default: false },
  { id: "exportDate", label: "Fecha de Exportación", default: true },
];

export function InvoiceAcceptanceDashboard() {
  const [activeTab, setActiveTab] = useState("bitacora");
  const [bitacora, setBitacora] = useState<BitacoraEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(() =>
    EXPORT_FIELDS.filter(f => f.default).map(f => f.id)
  );
  const [selectAll, setSelectAll] = useState(true);
  
  // Estados de filtros
  const [filters, setFilters] = useState<Filters>({
    search: "",
    estado: "todos",
    tipoDocumento: "todos",
    fechaDesde: null,
    fechaHasta: null,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Estados del Motor RPA
  const [rpaRunning, setRpaRunning] = useState(false);
  const [rpaLogs, setRpaLogs] = useState<LogLine[]>([]);
  const [rpaProgress, setRpaProgress] = useState(0);
  const [rpaStats, setRpaStats] = useState<any>(null);

  // Estados del Editor de BD
  const [selectedTable, setSelectedTable] = useState("dte_doccab");
  const [simulatedDb, setSimulatedDb] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [isSavingDb, setIsSavingDb] = useState(false);

  // Estados de Acción Manual
  const [selectedDoc, setSelectedDoc] = useState<BitacoraEntry | null>(null);
  const [manualActionType, setManualActionType] = useState<"ERM" | "RFT" | null>(null);
  const [manualMotive, setManualMotive] = useState("");
  const [isExecutingManual, setIsExecutingManual] = useState(false);

  // Contar filtros activos
  useEffect(() => {
    let count = 0;
    if (filters.search && filters.search.trim() !== "") count++;
    if (filters.estado !== "todos") count++;
    if (filters.tipoDocumento !== "todos") count++;
    if (filters.fechaDesde || filters.fechaHasta) count++;
    setActiveFiltersCount(count);
  }, [filters]);

  // Cargar datos iniciales
  useEffect(() => {
    fetchBitacora();
    fetchSimulatedDb();
  }, []);

  const fetchBitacora = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.search && filters.search.trim() !== "") {
        params.append("search", filters.search);
      }
      if (filters.estado !== "todos") {
        params.append("estado", filters.estado);
      }
      if (filters.tipoDocumento !== "todos") {
        params.append("tipoDocumento", filters.tipoDocumento);
      }
      if (filters.fechaDesde) {
        params.append("fechaDesde", format(filters.fechaDesde, "yyyy-MM-dd"));
      }
      if (filters.fechaHasta) {
        params.append("fechaHasta", format(filters.fechaHasta, "yyyy-MM-dd"));
      }
      
      const url = `/api/facturas/bitacora?${params.toString()}`;
      console.log("📊 [Frontend] URL de consulta:", url);
      
      const res = await fetch(url);
      const data = await res.json();
      
      console.log("📊 [Frontend] Respuesta:", { 
        success: data.success, 
        count: data.count, 
        mode: data.mode,
        primeraFecha: data.data?.[0]?.fecha_proceso
      });
      
      if (data.success) {
        setBitacora(data.data || []);
        if (data.data?.length === 0) {
          toast.info(`No se encontraron registros con los filtros aplicados`);
        } else {
          toast.success(`Se encontraron ${data.data.length} registros`);
        }
      } else {
        toast.error("Error al cargar la bitácora: " + data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Error de conexión al cargar la bitácora");
    } finally {
      setLoading(false);
    }
  };

  const fetchSimulatedDb = async () => {
    try {
      setDbLoading(true);
      const res = await fetch("/api/facturas/db-editor");
      const data = await res.json();
      if (data.success) {
        setSimulatedDb(data.db);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setDbLoading(false);
    }
  };

  const handleApplyFilters = () => {
    fetchBitacora();
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      estado: "todos",
      tipoDocumento: "todos",
      fechaDesde: null,
      fechaHasta: null,
    });
    setTimeout(() => {
      fetchBitacora();
    }, 100);
  };

  const handleOpenExportModal = () => {
    if (bitacora.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
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
    if (selectedFields.length === 0) {
      toast.error("Por favor selecciona al menos un campo para exportar.");
      return;
    }
    if (bitacora.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    try {
      const fieldMap: Record<string, (entry: BitacoraEntry) => any> = {
        tipo: (e) => e.tipo_documento === 33 ? "33 (Factura)" : e.tipo_documento === 34 ? "34 (Exenta)" : e.tipo_documento === 61 ? "61 (Nota Crédito)" : e.tipo_documento,
        folio: (e) => e.folio_documento,
        rut_proveedor: (e) => e.rut_proveedor,
        razon_social: (e) => e.razon_social,
        orden_compra: (e) => e.orden_compra || "—",
        dias_por_vencer: (e) => e.dias_por_vencer,
        estado: (e) => e.estado === "Pendiente Espera" ? "Espera Express" : (e.estado === "Manual" ? "Revisión Manual" : (e.estado || "No Procesado")),
        fecha_proceso: (e) => e.fecha_proceso ? format(new Date(e.fecha_proceso), "dd/MM/yyyy HH:mm:ss") : "N/A",
        motivo: (e) => e.motivo || "—",
        id_proceso: (e) => e.id_proceso ?? "N/A",
        id_regla: (e) => e.id_regla ?? "N/A",
        horas_por_revisar: (e) => e.horas_por_revisar ?? "N/A",
        fecha_modificacion: (e) => e.fecha_modificacion ? format(new Date(e.fecha_modificacion), "dd/MM/yyyy HH:mm:ss") : "N/A",
        exportDate: () => format(new Date(), "dd/MM/yyyy HH:mm:ss"),
      };

      const fieldLabels: Record<string, string> = {};
      EXPORT_FIELDS.forEach(f => fieldLabels[f.id] = f.label);

      const exportData = bitacora.map(entry => {
        const row: Record<string, any> = {};
        selectedFields.forEach(fieldId => {
          const label = fieldLabels[fieldId] || fieldId;
          row[label] = fieldMap[fieldId](entry);
        });
        return row;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      const colWidths = selectedFields.map(() => ({ wch: 25 }));
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, "Bitácora RPA");

      const summaryData = [
        { "Métrica": "Total Evaluadas", "Valor": stats.total },
        { "Métrica": "Aprobadas SII", "Valor": stats.aprobados },
        { "Métrica": "Rechazadas SII", "Valor": stats.rechazados },
        { "Métrica": "En Espera / Pendiente", "Valor": stats.pendientes },
        { "Métrica": "Revisión Manual", "Valor": stats.manuales },
        { "Métrica": "Fecha Exportación", "Valor": format(new Date(), "dd/MM/yyyy HH:mm:ss") },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

      XLSX.writeFile(wb, `reporte_aceptacion_rechazo_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xlsx`);
      toast.success(`Reporte Excel descargado (${selectedFields.length} campos)`);
      setShowExportModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al exportar a Excel");
    }
  };

  const handleRunRpa = async () => {
    if (rpaRunning) return;
    
    setRpaRunning(true);
    setRpaLogs([]);
    setRpaProgress(10);
    setRpaStats(null);
    setActiveTab("consola");

    const progressInterval = setInterval(() => {
      setRpaProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 150);

    try {
      toast.info("Ejecutando servicio RPA de Facturas...");
      const res = await fetch("/api/facturas/ejecutar", { method: "POST" });
      const data = await res.json();
      
      clearInterval(progressInterval);
      setRpaProgress(100);

      if (data.success) {
        setRpaLogs(data.logs || []);
        setRpaStats({
          processed: data.processedCount,
          approved: data.approvedCount,
          rejected: data.rejectedCount,
          pending: data.pendingCount,
          manual: data.manualCount,
          mode: data.mode,
          sentMails: data.sentMails || [],
        });
        toast.success("Ejecución del RPA finalizada exitosamente.");
        fetchBitacora();
        fetchSimulatedDb();
      } else {
        toast.error("El RPA falló: " + data.message);
      }
    } catch (error) {
      clearInterval(progressInterval);
      toast.error("Error al ejecutar el RPA en el servidor");
    } finally {
      setRpaRunning(false);
    }
  };

  const handleSyncSoftland = async () => {
    try {
      toast.loading("Sincronizando con Softland...");
      const res = await fetch("/api/facturas/sincronizar", { method: "POST" });
      const data = await res.json();
      toast.dismiss();

      if (data.success) {
        toast.success(data.message);
        fetchBitacora();
        fetchSimulatedDb();
      } else {
        toast.error("Error de sincronización: " + data.message);
      }
    } catch (error) {
      toast.dismiss();
      toast.error("Error de red al sincronizar con Softland");
    }
  };

  const handleResetDb = async () => {
    if (!confirm("¿Estás seguro de que deseas restablecer las bases de datos simuladas a los valores iniciales de fábrica? Esto borrará tus cambios.")) return;

    try {
      toast.loading("Restableciendo base de datos...");
      const res = await fetch("/api/facturas/db-editor", { method: "DELETE" });
      const data = await res.json();
      toast.dismiss();

      if (data.success) {
        toast.success("Base de datos restablecida correctamente.");
        setSimulatedDb(data.db);
        fetchBitacora();
      } else {
        toast.error("Error al restablecer: " + data.message);
      }
    } catch (error) {
      toast.dismiss();
      toast.error("Error de red al restablecer base de datos");
    }
  };

  const handleSaveDbEdit = async () => {
    if (!editRow) return;

    try {
      setIsSavingDb(true);
      const res = await fetch("/api/facturas/db-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: selectedTable,
          action: "update",
          data: editRow,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Fila actualizada correctamente.");
        setSimulatedDb(data.db);
        setEditRow(null);
        fetchBitacora();
      } else {
        toast.error("Error al guardar: " + data.message);
      }
    } catch (error) {
      toast.error("Error de red al guardar los cambios");
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleManualAction = async () => {
    if (!selectedDoc || !manualActionType) return;

    try {
      setIsExecutingManual(true);
      toast.loading("Enviando comando manual...");
      const res = await fetch("/api/facturas/accion-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folio: selectedDoc.folio_documento,
          tipoDocumento: selectedDoc.tipo_documento,
          accion: manualActionType,
          motivo: manualMotive || `Resolución manual forzada por el operador.`,
        }),
      });
      const data = await res.json();
      toast.dismiss();

      if (data.success) {
        toast.success(`Documento Folio ${selectedDoc.folio_documento} procesado en el SII de forma manual.`);
        setSelectedDoc(null);
        setManualActionType(null);
        setManualMotive("");
        fetchBitacora();
        fetchSimulatedDb();
      } else {
        toast.error("Error al ejecutar acción manual: " + data.message);
      }
    } catch (error) {
      toast.dismiss();
      toast.error("Error de red al ejecutar acción manual");
    } finally {
      setIsExecutingManual(false);
    }
  };

  const getStatusBadge = (estado: BitacoraEntry["estado"]) => {
    switch (estado) {
      case "Aprobado":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"><CheckCircle className="h-3 w-3" /> Aprobado</Badge>;
      case "Rechazado":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1"><XCircle className="h-3 w-3" /> Rechazado</Badge>;
      case "Pendiente":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1"><Activity className="h-3 w-3 animate-pulse" /> Pendiente</Badge>;
      case "Pendiente Espera":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white gap-1"><Activity className="h-3 w-3" /> Espera Express</Badge>;
      case "Manual":
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white gap-1"><AlertTriangle className="h-3 w-3" /> Revisión Manual</Badge>;
      default:
        return <Badge variant="secondary">No Procesado</Badge>;
    }
  };

  const getLogLineColor = (type: LogLine["type"]) => {
    switch (type) {
      case "success":
        return "text-emerald-400 font-medium";
      case "error":
        return "text-red-400 font-medium";
      case "warning":
        return "text-amber-400 font-medium";
      default:
        return "text-gray-300";
    }
  };

  const stats = {
    total: bitacora.length,
    aprobados: bitacora.filter(b => b.estado === "Aprobado").length,
    rechazados: bitacora.filter(b => b.estado === "Rechazado").length,
    pendientes: bitacora.filter(b => b.estado === "Pendiente" || b.estado === "Pendiente Espera").length,
    manuales: bitacora.filter(b => b.estado === "Manual").length,
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-gradient-to-r from-emerald-950/20 via-background to-background border rounded-xl gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <h1 className="text-2xl font-bold">Aceptación y Rechazo de Facturas</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Motor RPA automatizado que evalúa facturas de Softland contra 44 reglas de negocio complejas para decidir la aprobación o rechazo en el SII.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleRunRpa} disabled={rpaRunning} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            {rpaRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
            {rpaRunning ? "Ejecutando..." : "Iniciar Motor RPA"}
          </Button>
          <Button onClick={handleSyncSoftland} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Sincronizar Softland
          </Button>
          <Button onClick={handleOpenExportModal} variant="outline" className="gap-2 border-emerald-600/30 hover:bg-emerald-50 text-emerald-700 font-semibold">
            <FileSpreadsheet className="h-4 w-4" />
            Descargar Reporte
          </Button>
          <Button onClick={handleResetDb} variant="destructive" size="sm" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Resetear DB
          </Button>
        </div>
      </div>

      {/* METRICAS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { title: "Total Evaluadas", value: stats.total, color: "border-primary/50", desc: "Facturas en bitácora" },
          { title: "Aprobadas SII", value: stats.aprobados, color: "border-emerald-500/50", desc: "Aceptadas automáticamente" },
          { title: "Rechazadas SII", value: stats.rechazados, color: "border-red-500/50", desc: "Devueltas por incumplimiento" },
          { title: "En Espera / Pendiente", value: stats.pendientes, color: "border-amber-500/50", desc: "Esperando horas hábiles o OC" },
          { title: "Revisión Manual", value: stats.manuales, color: "border-orange-500/50", desc: "Requiere operador humano" },
        ].map((item, i) => (
          <Card key={i} className={cn("border shadow-sm", item.color)}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-3xl font-extrabold">{item.value}</div>
              <p className="text-[10px] text-muted-foreground mt-1">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 max-w-xl">
          <TabsTrigger value="bitacora" className="gap-2">
            <FileText className="h-4 w-4" />
            Bitácora RPA ({bitacora.length})
          </TabsTrigger>
          <TabsTrigger value="consola" className="gap-2">
            <TerminalIcon className="h-4 w-4" />
            Consola Ejecución
          </TabsTrigger>
          <TabsTrigger value="db" className="gap-2">
            <Database className="h-4 w-4" />
            Editor DB Prueba
          </TabsTrigger>
        </TabsList>

        {/* PESTAÑA BITÁCORA */}
        <TabsContent value="bitacora" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-500" />
                    Bitácora de Control y Decisiones RPA
                  </CardTitle>
                  <CardDescription>
                    Listado de la tabla `RPA.aceptacion_rechazo_bitacora`. Utiliza los filtros para buscar documentos específicos.
                  </CardDescription>
                </div>
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Panel de filtros */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Buscar</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Folio, RUT o Razón Social"
                          value={filters.search}
                          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Estado</Label>
                      <Select value={filters.estado} onValueChange={(value) => setFilters({ ...filters, estado: value })}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="aprobado">✅ Aprobados</SelectItem>
                          <SelectItem value="rechazado">❌ Rechazados</SelectItem>
                          <SelectItem value="pendiente">⏳ Pendientes</SelectItem>
                          <SelectItem value="pendiente espera">🕐 Espera Express</SelectItem>
                          <SelectItem value="manual">⚠️ Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Tipo Documento</Label>
                      <Select value={filters.tipoDocumento} onValueChange={(value) => setFilters({ ...filters, tipoDocumento: value })}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="33">Factura (33)</SelectItem>
                          <SelectItem value="34">Factura Exenta (34)</SelectItem>
                          <SelectItem value="61">Nota Crédito (61)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Rango de Fechas</Label>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="flex-1 justify-start text-left h-9 text-sm">
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {filters.fechaDesde ? format(filters.fechaDesde, "dd/MM/yy") : "Desde"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={filters.fechaDesde || undefined}
                              onSelect={(date) => setFilters({ ...filters, fechaDesde: date || null })}
                              locale={es}
                            />
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="flex-1 justify-start text-left h-9 text-sm">
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {filters.fechaHasta ? format(filters.fechaHasta, "dd/MM/yy") : "Hasta"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
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
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={handleResetFilters} className="h-8 text-xs">
                      <X className="mr-1 h-3 w-3" />
                      Limpiar filtros
                    </Button>
                    <Button size="sm" onClick={handleApplyFilters} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                      <Search className="mr-1 h-3 w-3" />
                      Aplicar filtros
                    </Button>
                  </div>
                </div>
              )}

              {/* Badges de filtros activos */}
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                  {filters.search && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Search className="h-3 w-3" />
                      {filters.search}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters({ ...filters, search: "" })} />
                    </Badge>
                  )}
                  {filters.estado !== "todos" && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      Estado: {filters.estado === "aprobado" ? "Aprobados" : 
                               filters.estado === "rechazado" ? "Rechazados" :
                               filters.estado === "pendiente" ? "Pendientes" :
                               filters.estado === "pendiente espera" ? "Espera Express" : "Manual"}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters({ ...filters, estado: "todos" })} />
                    </Badge>
                  )}
                  {filters.tipoDocumento !== "todos" && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      Tipo: {filters.tipoDocumento === "33" ? "Factura" : filters.tipoDocumento === "34" ? "Factura Exenta" : "Nota Crédito"}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters({ ...filters, tipoDocumento: "todos" })} />
                    </Badge>
                  )}
                  {(filters.fechaDesde || filters.fechaHasta) && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      Fechas: {filters.fechaDesde && format(filters.fechaDesde, "dd/MM/yy")}
                      {filters.fechaDesde && filters.fechaHasta && " → "}
                      {filters.fechaHasta && format(filters.fechaHasta, "dd/MM/yy")}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters({ ...filters, fechaDesde: null, fechaHasta: null })} />
                    </Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-24 text-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                  <p className="text-sm text-muted-foreground">Consultando bitácora...</p>
                </div>
              ) : bitacora.length > 0 ? (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Folio</TableHead>
                        <TableHead>RUT Proveedor</TableHead>
                        <TableHead>Razón Social</TableHead>
                        <TableHead>OC</TableHead>
                        <TableHead className="text-center">Días</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha Proceso</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bitacora.map((entry) => (
                        <TableRow key={entry.id_proceso || `${entry.tipo_documento}-${entry.folio_documento}`}>
                          <TableCell className="font-semibold">
                            {entry.tipo_documento === 33 ? "33" : entry.tipo_documento === 34 ? "34" : "61"}
                          </TableCell>
                          <TableCell className="font-semibold">#{entry.folio_documento}</TableCell>
                          <TableCell className="text-xs">{entry.rut_proveedor}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{entry.razon_social}</TableCell>
                          <TableCell>{entry.orden_compra || "—"}</TableCell>
                          <TableCell className={cn(
                            "text-center font-semibold",
                            entry.dias_por_vencer <= 2 ? "text-red-500" :
                            entry.dias_por_vencer <= 5 ? "text-amber-500" : "text-emerald-500"
                          )}>
                            {entry.dias_por_vencer}
                          </TableCell>
                          <TableCell>{getStatusBadge(entry.estado)}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(entry.fecha_proceso).toLocaleDateString("es-CL")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(entry)}>
                              Ver Reglas
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-16 text-center border border-dashed rounded-lg">
                  <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="font-semibold">No se encontraron registros</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Prueba cambiando los filtros o haz clic en "Limpiar filtros"
                  </p>
                  <Button variant="link" size="sm" onClick={handleResetFilters} className="mt-2">
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA CONSOLA RPA */}
        <TabsContent value="consola" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TerminalIcon className="h-5 w-5 text-emerald-500" />
                    Consola del Robot RPA
                  </CardTitle>
                  <CardDescription>
                    Log detallado de la ejecución del SP `PA_EJECUCION_ACEPTACION_RECHAZO`
                  </CardDescription>
                </div>
                {rpaRunning && <Badge className="bg-emerald-500 animate-pulse">PROCESANDO...</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rpaRunning && <Progress value={rpaProgress} className="h-1 rounded-none" />}
              
              <div className="bg-black text-gray-300 font-mono text-xs p-4 min-h-[400px] max-h-[500px] overflow-y-auto">
                {rpaLogs.length > 0 ? (
                  rpaLogs.map((log, i) => (
                    <div key={i} className={cn("py-0.5", getLogLineColor(log.type))}>
                      <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <TerminalIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Presiona "Iniciar Motor RPA" para ver la ejecución</p>
                    </div>
                  </div>
                )}
              </div>

              {rpaStats && (
                <div className="p-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Resumen</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Procesados: <strong>{rpaStats.processed}</strong></div>
                      <div>Aprobados: <strong className="text-emerald-500">{rpaStats.approved}</strong></div>
                      <div>Rechazados: <strong className="text-red-500">{rpaStats.rejected}</strong></div>
                      <div>Manuales: <strong className="text-amber-500">{rpaStats.manual}</strong></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Correos Enviados: {rpaStats.sentMails?.length || 0}</h4>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA EDITOR DB */}
        <TabsContent value="db" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5 text-emerald-500" />
                  Editor de Base de Datos de Prueba
                </CardTitle>
                <div className="flex gap-2">
                  <Select value={selectedTable} onValueChange={setSelectedTable}>
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dte_doccab">dte_doccab (Facturas)</SelectItem>
                      <SelectItem value="owordencom">owordencom (Órdenes Compra)</SelectItem>
                      <SelectItem value="cwt_auxi_attr">cwt_auxi_attr (Atributos)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={fetchSimulatedDb} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                Modifica las tablas simuladas para probar las reglas de negocio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dbLoading ? (
                <div className="py-24 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                </div>
              ) : simulatedDb ? (
                <div className="border rounded-lg overflow-x-auto max-h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      {selectedTable === "dte_doccab" && (
                        <TableRow>
                          <TableHead>TipoDTE</TableHead>
                          <TableHead>Folio</TableHead>
                          <TableHead>RUT Emisor</TableHead>
                          <TableHead>Razón Social</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Emisión</TableHead>
                          <TableHead>Vencimiento</TableHead>
                          <TableHead>EnProceso</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {selectedTable === "dte_doccab" && simulatedDb.dte_doccab?.map((row: any) => (
                        <TableRow key={`${row.TipoDTE}-${row.Folio}`}>
                          <TableCell>{row.TipoDTE}</TableCell>
                          <TableCell>#{row.Folio}</TableCell>
                          <TableCell>{row.RutEmisor}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.RazonSocialEmisor}</TableCell>
                          <TableCell>${row.MontoTotal?.toLocaleString()}</TableCell>
                          <TableCell>{row.FechaEmision}</TableCell>
                          <TableCell>{row.FechaVencimiento}</TableCell>
                          <TableCell>
                            {row.EnProceso === 1 ? <Badge className="bg-emerald-500">Aprobado</Badge> :
                             row.EnProceso === 2 ? <Badge variant="destructive">Rechazado</Badge> :
                             row.EnProceso === 3 ? <Badge className="bg-amber-500">Manual</Badge> :
                             <Badge variant="outline">Pendiente</Badge>}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setEditRow(row)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-24 text-center">Cargando...</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DETALLE DOCUMENTO */}
      {selectedDoc && (
        <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalle del Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Folio:</span> #{selectedDoc.folio_documento}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {selectedDoc.tipo_documento}</div>
                <div><span className="text-muted-foreground">RUT:</span> {selectedDoc.rut_proveedor}</div>
                <div><span className="text-muted-foreground">Razón Social:</span> {selectedDoc.razon_social}</div>
                <div><span className="text-muted-foreground">Orden Compra:</span> {selectedDoc.orden_compra || "N/A"}</div>
                <div><span className="text-muted-foreground">Días por vencer:</span> {selectedDoc.dias_por_vencer}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">Estado:</span>
                <div className="mt-1">{getStatusBadge(selectedDoc.estado)}</div>
              </div>
              {selectedDoc.motivo && (
                <div>
                  <span className="text-muted-foreground text-sm">Motivo:</span>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">{selectedDoc.motivo}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDoc(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
                  id="select-all-invoice"
                />
                <Label htmlFor="select-all-invoice" className="font-semibold">
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
                    id={`field-invoice-${field.id}`}
                  />
                  <Label htmlFor={`field-invoice-${field.id}`} className="text-sm cursor-pointer">
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