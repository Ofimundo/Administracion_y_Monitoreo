// app/components/client-dashboard.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { 
  TrendingUp, 
  Activity, 
  Clock,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  Building,
  Star,
  Briefcase,
  X,
  Filter,
  Search,
  Calendar as CalendarIcon,
  Zap,
  ChevronDown,
  FileText,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clients, getClientServices } from "@/lib/services-data";
import { StatusIndicator } from "@/components/status-indicator";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import * as XLSX from "xlsx";

interface ClientDashboardProps {
  clientId: string;
  onClose?: () => void;
}

// Lista de servicios que están próximamente
const COMING_SOON_SERVICES = ["saldos", "finiquitos", "cuentas", "dte", "contabilizacion", "notas-credito"];

// Mapeo de códigos de estado de OFITEC a sus descripciones
const OFITEC_STATUS_MAP: Record<string, string> = {
  "1": "PENDIENTE",
  "2": "DESPACHADO",
  "3": "INCOMPLETO",
  "4": "FINALIZADO",
  "5": "SOPORTE TELEFONICO INICIO",
  "6": "SOPORTE TELEFONICO FINALIZADO",
  "7": "POR COORDINAR",
  "8": "ANULADA CON ASIGNACION",
  "9": "ANULADA SIN ASIGNACION",
  "10": "INCOMPLETA REALIZADA",
  "11": "PRESUPUESTO PENDIENTE",
  "12": "CHEQUEO PENDIENTE",
  "15": "REPORTE COMPLETADO POR SOLUCION TEL.",
  "16": "LLAMADAS SIN SOLUCION",
  "17": "SOPORTE TELEFONICO",
  "20": "HABILITACION POR COORDINAR",
  "22": "INCOMPLETO TECNICO EN TERRENO",
  "24": "TERMINADO",
  "30": "DESPACHADA HISTORICO",
  "33": "INCOMPLETO POR REPUESTO",
  "75": "CONFIRMACION DE EQUIPO EN CLIENTE"
};

// Función para verificar si un servicio está próximo
const isServiceComingSoon = (serviceId: string): boolean => {
  return COMING_SOON_SERVICES.includes(serviceId);
};


// Función para normalizar fecha
const normalizeDate = (dateInput: any): Date => {
  if (!dateInput) return new Date();
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return new Date();
    return date;
  } catch {
    return new Date();
  }
};

// Función para generar datos mensuales a partir de datos filtrados
const generateMonthlyData = (filteredData: any[]) => {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthlyData: { [key: string]: any } = {};
  
  months.forEach(month => {
    monthlyData[month] = { month, aprobadas: 0, rechazadas: 0, manuales: 0, pendientes: 0 };
  });
  
  filteredData.forEach((item: any) => {
    const date = normalizeDate(item.fecha_proceso);
    const monthName = months[date.getMonth()];
    if (monthlyData[monthName]) {
      switch (item.estado) {
        case "Aprobado":
          monthlyData[monthName].aprobadas++;
          break;
        case "Rechazado":
          monthlyData[monthName].rechazadas++;
          break;
        case "Manual":
          monthlyData[monthName].manuales++;
          break;
        default:
          monthlyData[monthName].pendientes++;
          break;
      }
    }
  });
  
  return Object.values(monthlyData).filter(m => m.aprobadas > 0 || m.rechazadas > 0 || m.manuales > 0 || m.pendientes > 0).slice(-6);
};

// Función para detectar errores de infraestructura
const isInfraestructuraError = (motivo: string): boolean => {
  if (!motivo) return false;
  const erroresTecnicos = [
    "error de conexión", "timeout", "servidor no responde", "softland no disponible",
    "sii no responde", "connection failed", "failed to connect", "could not connect",
    "connection refused", "network error", "500", "503"
  ];
  const motivoLower = motivo.toLowerCase();
  return erroresTecnicos.some(term => motivoLower.includes(term.toLowerCase()));
};

// Mapa de servicios a sus rutas de API
const SERVICE_API_MAP: Record<string, string> = {
  "facturas": "/api/facturas/bitacora?estado=todos",
  "oficore": "/api/oficore/stats",
  "ofitec": "/api/ofitec/stats",
  "sgc": "/api/sgc/stats",
};

// Generar datos de muestra REALISTAS para cada servicio
const generateRealisticSampleData = (serviceId: string, count: number = 876) => {
  const data = [];
  const startDate = new Date(2026, 4, 1);
  
  let distribution: { estado: string; porcentaje: number }[];
  
  switch (serviceId) {
    case "oficore":
      distribution = [
        { estado: "Aprobado", porcentaje: 0.74 },
        { estado: "Rechazado", porcentaje: 0.04 },
        { estado: "Manual", porcentaje: 0.21 },
        { estado: "Pendiente", porcentaje: 0.01 },
      ];
      break;
    case "ofitec":
      distribution = [
        { estado: "Aprobado", porcentaje: 0.55 },
        { estado: "Rechazado", porcentaje: 0.15 },
        { estado: "Manual", porcentaje: 0.25 },
        { estado: "Pendiente", porcentaje: 0.05 },
      ];
      break;
    case "sgc":
      distribution = [
        { estado: "Aprobado", porcentaje: 0.45 },
        { estado: "Rechazado", porcentaje: 0.10 },
        { estado: "Manual", porcentaje: 0.35 },
        { estado: "Pendiente", porcentaje: 0.10 },
      ];
      break;
    default:
      distribution = [
        { estado: "Aprobado", porcentaje: 0.65 },
        { estado: "Rechazado", porcentaje: 0.08 },
        { estado: "Manual", porcentaje: 0.20 },
        { estado: "Pendiente", porcentaje: 0.07 },
      ];
  }
  
  const motivosRechazo = [
    "Error en formato del documento",
    "RUT del proveedor inválido",
    "Monto total no coincide con detalle",
    "Folio duplicado en el SII",
  ];
  
  const motivosManual = [
    "Error al conectar con el SII: No ha sido posible aprobar o rechazar el documento en el SII. Se deberá gestionar manualmente por el usuario.",
    "Documento requiere validación adicional por parte del usuario",
    "Inconsistencia en los datos del emisor",
  ];
  
  const proveedores = [
    "JOSE LUIS GONZALEZ DIAZ",
    "MARIA ELENA PEREZ SOTO",
    "CARLOS ANDRES MARTINEZ RUIZ",
    "ANA MARIA GONZALEZ SILVA",
    "PEDRO ANTONIO RAMIREZ CASTRO",
  ];
  
  const ruts = [
    "7179224-2", "8543210-5", "9345678-1", "7654321-K", "1234567-8",
  ];
  
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() - Math.floor(Math.random() * 30));
    date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
    
    let rand = Math.random();
    let estado = "Pendiente";
    let acumulado = 0;
    for (const dist of distribution) {
      acumulado += dist.porcentaje;
      if (rand < acumulado) {
        estado = dist.estado;
        break;
      }
    }
    
    let motivo = "";
    if (estado === "Rechazado") {
      motivo = motivosRechazo[Math.floor(Math.random() * motivosRechazo.length)];
    } else if (estado === "Manual") {
      motivo = motivosManual[Math.floor(Math.random() * motivosManual.length)];
    }
    
    const proveedorIndex = Math.floor(Math.random() * proveedores.length);
    
    data.push({
      id_proceso: i + 1,
      fecha_proceso: date.toISOString(),
      estado: estado,
      tipo_documento: ["33", "34", "61"][Math.floor(Math.random() * 3)],
      folio_documento: Math.floor(Math.random() * 9000) + 1000,
      razon_social: proveedores[proveedorIndex],
      rut_proveedor: ruts[proveedorIndex],
      motivo: motivo,
    });
  }
  
  data.sort((a, b) => new Date(b.fecha_proceso).getTime() - new Date(a.fecha_proceso).getTime());
  return data;
};

export function ClientDashboard({ clientId, onClose }: ClientDashboardProps) {
  const { toast } = useToast();
  const [selectedServiceId, setSelectedServiceId] = useState("facturas");
  const [allData, setAllData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showFilters, setShowFilters] = useState(false);
  const [availableTipos, setAvailableTipos] = useState<string[]>([]);
  
  const exportFields = useMemo(() => {
    if (selectedServiceId === "facturas") {
      return [
        { id: "fecha", label: "Fecha", default: true, description: "Fecha de procesamiento del documento" },
        { id: "tipoDocumento", label: "Tipo Documento", default: true, description: "Tipo de documento (33, 34, 61)" },
        { id: "folio", label: "Folio", default: true, description: "Número de folio del documento" },
        { id: "rutProveedor", label: "RUT Proveedor", default: false, description: "RUT del proveedor emisor" },
        { id: "razonSocial", label: "Razón Social", default: true, description: "Nombre del proveedor" },
        { id: "estado", label: "Estado", default: true, description: "Estado de aprobación en el SII" },
        { id: "tipo", label: "Tipo Error (Infra/Regla)", default: false, description: "Clasificación de errores de infraestructura" },
        { id: "motivo", label: "Motivo / Comentario", default: true, description: "Detalle o motivo del resultado" },
      ];
    }
    if (selectedServiceId === "oficore") {
      return [
        { id: "fecha", label: "Fecha", default: true, description: "Fecha de registro de la incidencia" },
        { id: "tipoDocumento", label: "ID Acción", default: true, description: "ID de la acción ejecutada" },
        { id: "folio", label: "ID Incidencia", default: true, description: "Correlativo de la incidencia" },
        { id: "rutProveedor", label: "Código Cliente", default: false, description: "Código único de cliente en OFICORE" },
        { id: "razonSocial", label: "Contacto / Cliente", default: true, description: "Nombre del contacto registrado" },
        { id: "estado", label: "Estado", default: true, description: "Resolución de la incidencia" },
        { id: "motivo", label: "Detalle Incidencia", default: true, description: "Detalle o comentario del estado" },
      ];
    }
    if (selectedServiceId === "ofitec") {
      return [
        { id: "fecha", label: "Fecha", default: true, description: "Fecha de la llamada" },
        { id: "folio", label: "Correlativo Llamada", default: true, description: "ID de correlativo de llamada en OFITEC" },
        { id: "rutProveedor", label: "Código Cliente", default: false, description: "Código del cliente en SAST" },
        { id: "razonSocial", label: "Nombre Contacto", default: true, description: "Nombre de la persona que contacta" },
        { id: "estado", label: "Estado", default: true, description: "Clasificación actual de la llamada" },
        { id: "motivo", label: "Estado / Comentario", default: true, description: "Comentario del operador técnico" },
      ];
    }
    if (selectedServiceId === "sgc") {
      return [
        { id: "fecha", label: "Fecha Documento", default: true, description: "Fecha del documento en SGC" },
        { id: "tipoDocumento", label: "Tipo Documento", default: true, description: "Clasificación del documento (Factura, Guía, etc.)" },
        { id: "folio", label: "Cantidad", default: true, description: "Cantidad de documentos procesados" },
        { id: "razonSocial", label: "Sistema Origen", default: true, description: "Sistema ERP de origen del documento" },
        { id: "estado", label: "Estado", default: true, description: "Estado de integración" },
        { id: "motivo", label: "Tipo de Venta", default: true, description: "Canal o tipo de venta asociado" },
      ];
    }
    return [];
  }, [selectedServiceId]);

  // Modal de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  useEffect(() => {
    setSelectedFields(exportFields.filter(f => f.default).map(f => f.id));
  }, [selectedServiceId, exportFields]);

  const [filters, setFilters] = useState({
    fechaDesde: null as Date | null,
    fechaHasta: null as Date | null,
    tipoDocumento: "todos",
    estado: "todos",
  });

  // Cargar datos para el servicio seleccionado del cliente
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const apiUrl = SERVICE_API_MAP[selectedServiceId];
        
        // El cliente Ofimundo es el único que tiene API real configurada en este momento
        const clientHasApi = clientId === "cl_ofimundo";
        
        if (clientHasApi && apiUrl) {
          const res = await fetch(apiUrl);
          const responseData = await res.json();
          
          if (responseData.success) {
            let rawData: any[] = [];
            if (selectedServiceId === "facturas") {
              rawData = responseData.data || [];
            } else if (selectedServiceId === "oficore") {
              rawData = responseData.detalles || [];
            } else if (selectedServiceId === "ofitec") {
              rawData = responseData.detalles || [];
            } else if (selectedServiceId === "sgc") {
              rawData = responseData.data || [];
            }
            
            // Normalizar a formato unificado
            const normalizedData = rawData.map((item: any, index: number) => {
              const fecha = item.fecha_proceso || item.fecha_detalle || item.LLA_FEC_LLAMADA || item.fecha_documento || new Date().toISOString();
              let estado = item.estado;
              
              if (selectedServiceId === "oficore") {
                estado = item.id_accion === 5 ? "Aprobado" : "Pendiente";
              } else if (selectedServiceId === "ofitec") {
                const resolvedStatuses = ['4', '24', '6', '8', '9', '15', '16', '7'];
                const inProcessStatuses = ['1', '2', '17', '20', '5', '30'];
                const incompletoStatuses = ['3', '10', '22', '33', '11', '12'];
                
                const estStr = item.LLA_ESTADO?.toString().trim();
                if (resolvedStatuses.includes(estStr)) {
                  estado = "Aprobado";
                } else if (inProcessStatuses.includes(estStr)) {
                  estado = "Manual";
                } else if (incompletoStatuses.includes(estStr)) {
                  estado = "Rechazado";
                } else {
                  estado = "Pendiente";
                }
              } else if (selectedServiceId === "sgc") {
                if (item.tipo_de_documento === "FACTURA") {
                  estado = "Aprobado";
                } else if (item.tipo_de_documento === "GUIA") {
                  estado = "Rechazado";
                } else if (item.tipo_de_documento === "NOTA DE CREDITO") {
                  estado = "Manual";
                } else {
                  estado = "Pendiente";
                }
              }
              
              return {
                ...item,
                id_proceso: item.id_proceso || item.id_incidencia || item.LLA_CORRELATIVO || index + 1,
                fecha_proceso: fecha,
                estado: estado || "Pendiente",
                tipo_documento: item.tipo_documento || item.tipo_de_documento || item.id_accion || item.LLA_CORRELATIVO || "N/A",
                folio_documento: item.folio_documento || item.id_incidencia || item.LLA_CORRELATIVO || item.cantidad || index + 1,
                razon_social: item.razon_social || item.contacto_nombre || item.SISTEMA_ORIGEN || "N/A",
                rut_proveedor: item.rut_proveedor || item.codigo_cliente || "N/A",
                motivo: item.motivo || item.estado_descripcion || (item.LLA_ESTADO_DESC ? `Estado: ${item.LLA_ESTADO_DESC}` : (item.LLA_ESTADO ? `Estado: ${OFITEC_STATUS_MAP[item.LLA_ESTADO.toString().trim()] || item.LLA_ESTADO}` : null)) || (item.tipo_de_venta ? `Venta: ${item.tipo_de_venta}` : null) || "",
              };
            });
            
            setAllData(normalizedData);
            setFilteredData(normalizedData);
            
            const tipos = new Set<string>();
            normalizedData.forEach((item: any) => {
              if (item.tipo_documento) {
                tipos.add(String(item.tipo_documento));
              }
            });
            setAvailableTipos(Array.from(tipos).sort());
          } else {
            const sampleData = generateRealisticSampleData(selectedServiceId);
            setAllData(sampleData);
            setFilteredData(sampleData);
            setAvailableTipos(["33", "34", "61"]);
          }
        } else {
          const sampleData = generateRealisticSampleData(selectedServiceId);
          setAllData(sampleData);
          setFilteredData(sampleData);
          setAvailableTipos(["33", "34", "61"]);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        const sampleData = generateRealisticSampleData(selectedServiceId);
        setAllData(sampleData);
        setFilteredData(sampleData);
        setAvailableTipos(["33", "34", "61"]);
      } finally {
        setTimeout(() => {
          setLoading(false);
        }, 200);
      }
    };
    
    loadData();
  }, [clientId, selectedServiceId]);

  const applyFilters = () => {
    let filtered = [...allData];
    
    if (filters.tipoDocumento !== "todos") {
      filtered = filtered.filter((item: any) => 
        String(item.tipo_documento) === filters.tipoDocumento
      );
    }
    
    if (filters.estado !== "todos") {
      let estadoValue = "";
      switch (filters.estado) {
        case "aprobado": estadoValue = "Aprobado"; break;
        case "rechazado": estadoValue = "Rechazado"; break;
        case "manual": estadoValue = "Manual"; break;
        case "pendiente": estadoValue = "Pendiente"; break;
        default: estadoValue = filters.estado;
      }
      filtered = filtered.filter((item: any) => item.estado === estadoValue);
    }
    
    if (filters.fechaDesde) {
      const desde = startOfDay(filters.fechaDesde);
      filtered = filtered.filter((item: any) => {
        const itemDate = normalizeDate(item.fecha_proceso);
        return itemDate >= desde;
      });
    }
    
    if (filters.fechaHasta) {
      const hasta = endOfDay(filters.fechaHasta);
      filtered = filtered.filter((item: any) => {
        const itemDate = normalizeDate(item.fecha_proceso);
        return itemDate <= hasta;
      });
    }
    
    setFilteredData(filtered);
    setShowFilters(false);
    
    toast({
      title: filtered.length === 0 ? "Sin resultados" : "Filtros aplicados",
      description: filtered.length === 0 
        ? "No se encontraron documentos con los filtros seleccionados"
        : `Se encontraron ${filtered.length} documentos`,
      variant: filtered.length === 0 ? "destructive" : "default",
    });
  };

  const resetFilters = () => {
    setFilters({
      fechaDesde: null,
      fechaHasta: null,
      tipoDocumento: "todos",
      estado: "todos",
    });
    setFilteredData(allData);
    toast({ 
      title: "Filtros limpiados", 
      description: "Se han eliminado todos los filtros" 
    });
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
    if (selectedFields.length === exportFields.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(exportFields.map(f => f.id));
    }
  };

  // Exportar a Excel con campos seleccionados
  const handleExportToExcel = () => {
    if (selectedFields.length === 0) {
      toast({
        title: "Error",
        description: "Por favor selecciona al menos un campo para exportar.",
        variant: "destructive",
      });
      return;
    }

    const fieldMap: Record<string, (item: any) => any> = {
      fecha: (item) => format(normalizeDate(item.fecha_proceso), "dd/MM/yyyy HH:mm"),
      tipoDocumento: (item) => {
        const tipo = item.tipo_documento;
        if (tipo === 33 || tipo === "33") return "Factura (33)";
        if (tipo === 34 || tipo === "34") return "Factura Exenta (34)";
        if (tipo === 61 || tipo === "61") return "Nota Crédito (61)";
        return String(tipo || "N/A");
      },
      folio: (item) => item.folio_documento || "N/A",
      rutProveedor: (item) => item.rut_proveedor || "N/A",
      razonSocial: (item) => item.razon_social || "N/A",
      estado: (item) => item.estado || "N/A",
      tipo: (item) => {
        const motivo = item.motivo || "";
        return isInfraestructuraError(motivo) ? "❌ Error Infraestructura" : 
               (item.estado === "Rechazado" || item.estado === "Manual" ? "⚠️ Regla de Negocio" : "📋 Normal");
      },
      motivo: (item) => item.motivo || "-",
    };

    const fieldLabels: Record<string, string> = {};
    exportFields.forEach(f => fieldLabels[f.id] = f.label);

    const exportData = filteredData.map(item => {
      const row: Record<string, any> = {};
      selectedFields.forEach(fieldId => {
        const label = fieldLabels[fieldId] || fieldId;
        row[label] = fieldMap[fieldId](item);
      });
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    const colWidths = selectedFields.map(() => ({ wch: 30 }));
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "Documentos");
    
    const summaryData = [
      { "Métrica": "Total Documentos", "Valor": filteredData.length },
      { "Métrica": "Aprobados", "Valor": filteredData.filter((e: any) => e.estado === "Aprobado").length },
      { "Métrica": "Rechazados", "Valor": filteredData.filter((e: any) => e.estado === "Rechazado").length },
      { "Métrica": "Manuales", "Valor": filteredData.filter((e: any) => e.estado === "Manual").length },
      { "Métrica": "Pendientes", "Valor": filteredData.filter((e: any) => e.estado === "Pendiente" || e.estado === "Pendiente Espera").length },
      { "Métrica": "Errores Infraestructura", "Valor": filteredData.filter((e: any) => isInfraestructuraError(e.motivo || "")).length },
      { "Métrica": "Fecha Exportación", "Valor": format(new Date(), "dd/MM/yyyy HH:mm:ss") },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    
    XLSX.writeFile(wb, `dashboard_cliente_${clientId}_${format(new Date(), "yyyy-MM-dd_HHmmss")}.xlsx`);
    
    setShowExportModal(false);
    toast({
      title: "Exportación completada",
      description: `Se exportaron ${filteredData.length} documentos con ${selectedFields.length} campos.`,
    });
  };

  const stats = useMemo(() => {
    const totalTransactions = filteredData.length;
    const approvedDocs = filteredData.filter((e: any) => e.estado === "Aprobado").length;
    const rejectedDocs = filteredData.filter((e: any) => e.estado === "Rechazado").length;
    const manualDocs = filteredData.filter((e: any) => e.estado === "Manual").length;
    const pendingDocs = filteredData.filter((e: any) => e.estado === "Pendiente" || e.estado === "Pendiente Espera").length;
    
    const successRate = totalTransactions > 0 ? ((approvedDocs / totalTransactions) * 100).toFixed(1) : "0";
    const satisfaction = totalTransactions > 0 ? Math.round((approvedDocs / totalTransactions) * 100) : 100;
    
    const errorDocs = filteredData.filter((e: any) => isInfraestructuraError(e.motivo || "")).length;
    const errorRate = totalTransactions > 0 ? Math.round((errorDocs / totalTransactions) * 100) : 0;
    const avgResponseTime = totalTransactions > 0 ? Math.min(800, Math.max(50, 300 + Math.floor(totalTransactions / 100) * 10)) : 300;
    
    return {
      totalTransactions,
      avgResponseTime,
      avgSatisfaction: satisfaction,
      approved: approvedDocs,
      rejected: rejectedDocs,
      manual: manualDocs,
      pending: pendingDocs,
      successRate,
      errorRate,
    };
  }, [filteredData]);

  const kpiCards = useMemo(() => {
    if (selectedServiceId === "facturas") {
      return [
        { label: "Total Documentos", value: stats.totalTransactions.toLocaleString(), color: "text-foreground", bg: "bg-blue-100", iconColor: "text-blue-600", icon: Activity },
        { label: "Aprobados", value: stats.approved.toLocaleString(), color: "text-emerald-600", bg: "bg-emerald-100", iconColor: "text-emerald-600", icon: CheckCircle },
        { label: "Rechazados", value: stats.rejected.toLocaleString(), color: "text-red-600", bg: "bg-red-100", iconColor: "text-red-600", icon: X },
        { label: "Manuales", value: stats.manual.toLocaleString(), color: "text-amber-600", bg: "bg-amber-100", iconColor: "text-amber-600", icon: Clock },
        { label: "Pendientes", value: stats.pending.toLocaleString(), color: "text-blue-600", bg: "bg-blue-100", iconColor: "text-blue-600", icon: AlertCircle },
      ];
    }
    if (selectedServiceId === "oficore") {
      const errorCount = filteredData.filter((e: any) => isInfraestructuraError(e.motivo || "")).length;
      return [
        { label: "Incidencias Ingresadas", value: stats.totalTransactions.toLocaleString(), color: "text-foreground", bg: "bg-blue-100", iconColor: "text-blue-600", icon: Activity },
        { label: "Incidencias Resueltas", value: stats.approved.toLocaleString(), color: "text-emerald-600", bg: "bg-emerald-100", iconColor: "text-emerald-600", icon: CheckCircle },
        { label: "Incidencias Pendientes", value: stats.pending.toLocaleString(), color: "text-amber-600", bg: "bg-amber-100", iconColor: "text-amber-600", icon: Clock },
        { label: "Errores", value: errorCount.toLocaleString(), color: "text-red-600", bg: "bg-red-100", iconColor: "text-red-600", icon: X },
        { label: "Tasa de Éxito", value: stats.successRate + "%", color: "text-blue-600", bg: "bg-blue-100", iconColor: "text-blue-600", icon: AlertCircle },
      ];
    }
    if (selectedServiceId === "ofitec") {
      return [
        { label: "Total Llamadas", value: stats.totalTransactions.toLocaleString(), color: "text-foreground", bg: "bg-blue-100", iconColor: "text-blue-600", icon: Activity },
        { label: "Resueltas", value: stats.approved.toLocaleString(), color: "text-emerald-600", bg: "bg-emerald-100", iconColor: "text-emerald-600", icon: CheckCircle },
        { label: "Pendientes", value: stats.pending.toLocaleString(), color: "text-blue-600", bg: "bg-blue-100", iconColor: "text-blue-600", icon: AlertCircle },
        { label: "En Proceso", value: stats.manual.toLocaleString(), color: "text-amber-600", bg: "bg-amber-100", iconColor: "text-amber-600", icon: Clock },
        { label: "Incompletas/Canceladas", value: stats.rejected.toLocaleString(), color: "text-red-600", bg: "bg-red-100", iconColor: "text-red-600", icon: X },
      ];
    }
    if (selectedServiceId === "sgc") {
      return [
        { label: "Total Documentos", value: stats.totalTransactions.toLocaleString(), color: "text-foreground", bg: "bg-blue-100", iconColor: "text-blue-600", icon: Activity },
        { label: "Facturas", value: stats.approved.toLocaleString(), color: "text-blue-600", bg: "bg-blue-100", iconColor: "text-blue-600", icon: CheckCircle },
        { label: "Guías", value: stats.rejected.toLocaleString(), color: "text-orange-600", bg: "bg-orange-100", iconColor: "text-orange-600", icon: X },
        { label: "Notas de Crédito", value: stats.manual.toLocaleString(), color: "text-indigo-600", bg: "bg-indigo-100", iconColor: "text-indigo-600", icon: Clock },
        { label: "Notas de Débito", value: stats.pending.toLocaleString(), color: "text-rose-600", bg: "bg-rose-100", iconColor: "text-rose-600", icon: AlertCircle },
      ];
    }
    return [];
  }, [selectedServiceId, stats, filteredData]);

  const chartLegends = useMemo(() => {
    if (selectedServiceId === "facturas") {
      return { aprobadas: "Aprobadas", rechazadas: "Rechazadas", manuales: "Manuales", pendientes: "Pendientes" };
    }
    if (selectedServiceId === "oficore") {
      return { aprobadas: "Resueltas", rechazadas: "Errores", manuales: "Manuales", pendientes: "Pendientes" };
    }
    if (selectedServiceId === "ofitec") {
      return { aprobadas: "Resueltas", rechazadas: "Incompletas/Canceladas", manuales: "En Proceso", pendientes: "Pendientes" };
    }
    if (selectedServiceId === "sgc") {
      return { aprobadas: "Facturas", rechazadas: "Guías", manuales: "Notas de Crédito", pendientes: "Notas de Débito" };
    }
    return { aprobadas: "Aprobadas", rechazadas: "Rechazadas", manuales: "Manuales", pendientes: "Pendientes" };
  }, [selectedServiceId]);

  const pieData = useMemo(() => {
    let names = {
      approved: "Aprobadas",
      rejected: "Rechazadas",
      manual: "Manuales",
      pending: "Pendientes"
    };
    if (selectedServiceId === "oficore") {
      names = { approved: "Resueltas", rejected: "Errores", manual: "Manuales", pending: "Pendientes" };
    } else if (selectedServiceId === "ofitec") {
      names = { approved: "Resueltas", rejected: "Incompletas/Canceladas", manual: "En Proceso", pending: "Pendientes" };
    } else if (selectedServiceId === "sgc") {
      names = { approved: "Facturas", rejected: "Guías", manual: "Notas de Crédito", pending: "Notas de Débito" };
    }
    return [
      { name: names.approved, value: stats.approved, color: "#10b981" },
      { name: names.rejected, value: stats.rejected, color: "#ef4444" },
      { name: names.manual, value: stats.manual, color: "#f59e0b" },
      { name: names.pending, value: stats.pending, color: "#3b82f6" },
    ].filter(item => item.value > 0);
  }, [stats.approved, stats.rejected, stats.manual, stats.pending, selectedServiceId]);

  const chartData = useMemo(() => {
    return generateMonthlyData(filteredData);
  }, [filteredData]);

  const client = useMemo(() => {
    return clients.find(c => c.id === clientId);
  }, [clientId]);

  const clientServices = useMemo(() => {
    if (!client) return [];
    const allServices = getClientServices(clientId);
    return allServices.filter(service => !isServiceComingSoon(service.id));
  }, [client, clientId]);

  const hasApiEndpoint = clientId === "cl_ofimundo";

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.tipoDocumento !== "todos") count++;
    if (filters.estado !== "todos") count++;
    if (filters.fechaDesde || filters.fechaHasta) count++;
    return count;
  }, [filters]);

  const getTipoNombre = (tipo: string): string => {
    switch (tipo) {
      case "33": return "Factura";
      case "34": return "Factura Exenta";
      case "61": return "Nota Crédito";
      default: return `Tipo ${tipo}`;
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Cargando datos del cliente...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button onClick={handleClose} variant="outline" className="mt-4">
          Cerrar
        </Button>
      </div>
    );
  }

  // ============================================================
  // ELIMINADO: El bloque que mostraba "Dashboard en desarrollo"
  // AHORA TODOS los clientes ven el dashboard completo
  // ============================================================

  return (
    <div className="space-y-5">
      {/* Botón de cierre y exportación */}
      <div className="flex justify-end gap-3 pt-2 pb-1">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleOpenExportModal}
          className="gap-2 px-4"
          disabled={filteredData.length === 0}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleClose}
          className="gap-2 text-sm text-muted-foreground hover:text-red-500 transition-colors px-4"
        >
          Cerrar
        </Button>
      </div>

      {/* Info Cliente */}
      <div className="rounded-lg border bg-gradient-to-r from-emerald-500/5 to-transparent p-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md">
            {client.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="text-lg font-bold">{client.name}</h2>
              <StatusIndicator status={stats.errorRate === 0 ? "success" : stats.errorRate <= 10 ? "warning" : "error"} percentage={stats.errorRate} size="sm" />
              <Badge className={cn(
                "border-0 text-xs px-2",
                stats.errorRate === 0 ? "bg-emerald-100 text-emerald-700" :
                stats.errorRate <= 10 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
              )}>
                {stats.errorRate}% error técnico
              </Badge>
              <Badge variant="outline" className={cn(
                "text-xs",
                hasApiEndpoint ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"
              )}>
                {hasApiEndpoint ? "📡 Datos en tiempo real" : "📊 Datos de ejemplo"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {client.rut && (
                <div className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  <span>{client.rut}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{client.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Servicio */}
      {clientServices.length > 0 && (
        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Servicio:</span>
          <div className="flex gap-2 flex-wrap">
            {clientServices.map((service) => (
              <Button
                key={service.id}
                variant={selectedServiceId === service.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedServiceId(service.id)}
                className={cn(
                  "h-8 text-xs font-semibold px-3 transition-colors",
                  selectedServiceId === service.id && "bg-emerald-600 hover:bg-emerald-700 text-white"
                )}
              >
                {service.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Botón Mostrar/Ocultar Filtros */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button 
          variant="outline" 
          onClick={() => setShowFilters(!showFilters)} 
          className="flex items-center gap-2 text-sm h-9 px-4"
        >
          <Filter className="h-4 w-4" />
          <span>{showFilters ? "Ocultar filtros" : "Mostrar filtros"}</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs px-2">{activeFiltersCount}</Badge>
          )}
          <ChevronDown className={cn("h-4 w-4 transition-transform", showFilters && "rotate-180")} />
        </Button>
        
        {activeFiltersCount > 0 && (
          <Button variant="ghost" onClick={resetFilters} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 h-9">
            <X className="h-4 w-4" />
            <span>Limpiar filtros</span>
          </Button>
        )}
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-emerald-500" />
                Rango de Fechas
              </Label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left h-10">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fechaDesde ? format(filters.fechaDesde, "dd/MM/yyyy") : "Desde"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.fechaDesde || undefined}
                      onSelect={(date) => setFilters({ ...filters, fechaDesde: date || null })}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
                
                <span className="text-muted-foreground text-center">→</span>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left h-10">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fechaHasta ? format(filters.fechaHasta, "dd/MM/yyyy") : "Hasta"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedServiceId === "facturas" ? (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-500" />
                    Tipo Documento
                  </Label>
                  <Select value={filters.tipoDocumento} onValueChange={(value) => setFilters({ ...filters, tipoDocumento: value })}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">📄 Todos</SelectItem>
                      {availableTipos.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {getTipoNombre(tipo)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className={cn("space-y-2", selectedServiceId !== "facturas" && "col-span-2")}>
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Estado
                </Label>
                <Select value={filters.estado} onValueChange={(value) => setFilters({ ...filters, estado: value })}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">🎯 Todos</SelectItem>
                    <SelectItem value="aprobado">✅ Aprobados</SelectItem>
                    <SelectItem value="rechazado">❌ Rechazados</SelectItem>
                    <SelectItem value="manual">✋ Manuales</SelectItem>
                    <SelectItem value="pendiente">⏳ Pendientes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t">
              <Button 
                variant="outline" 
                onClick={resetFilters} 
                className="flex-1 gap-2 h-10"
              >
                <X className="h-4 w-4" />
                Limpiar todos
              </Button>
              <Button 
                onClick={applyFilters} 
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 h-10"
              >
                <Search className="h-4 w-4" />
                Aplicar filtros
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de filtros activos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
          <span className="text-xs font-medium text-emerald-700">Filtros activos:</span>
          {filters.tipoDocumento !== "todos" && (
            <Badge variant="secondary" className="bg-white text-xs">
              Tipo: {getTipoNombre(filters.tipoDocumento)}
            </Badge>
          )}
          {filters.estado !== "todos" && (
            <Badge variant="secondary" className="bg-white text-xs">
              Estado: {filters.estado === "aprobado" ? "Aprobados" : 
                       filters.estado === "rechazado" ? "Rechazados" : 
                       filters.estado === "manual" ? "Manuales" : "Pendientes"}
            </Badge>
          )}
          {(filters.fechaDesde || filters.fechaHasta) && (
            <Badge variant="secondary" className="bg-white text-xs">
              📅 {filters.fechaDesde ? format(filters.fechaDesde, "dd/MM/yy") : "Inicio"} 
              {" → "} 
              {filters.fechaHasta ? format(filters.fechaHasta, "dd/MM/yy") : "Hoy"}
            </Badge>
          )}
          <span className="text-xs text-emerald-600 ml-auto">
            {filteredData.length} documentos encontrados
          </span>
        </div>
      )}

      {/* KPIs - EXACTAMENTE COMO EN LA IMAGEN */}
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx}>
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">{card.label}</p>
                    <p className={cn("text-xl font-bold mt-0.5", card.color)}>{card.value}</p>
                  </div>
                  <div className={cn("p-1.5 rounded-lg", card.bg)}>
                    <Icon className={cn("h-3.5 w-3.5", card.iconColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-0.5 rounded-lg h-9">
          <TabsTrigger value="overview" className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📊 Resumen
          </TabsTrigger>
          <TabsTrigger value="services" className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📦 Servicios ({clientServices.length})
          </TabsTrigger>
          <TabsTrigger value="metrics" className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📈 Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Evolución Mensual</CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  {filteredData.length} documentos analizados
                </p>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[260px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: '11px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="aprobadas" fill="#10b981" name={chartLegends.aprobadas} radius={[3,3,0,0]} />
                        <Bar dataKey="rechazadas" fill="#ef4444" name={chartLegends.rechazadas} radius={[3,3,0,0]} />
                        <Bar dataKey="manuales" fill="#f59e0b" name={chartLegends.manuales} radius={[3,3,0,0]} />
                        <Bar dataKey="pendientes" fill="#3b82f6" name={chartLegends.pendientes} radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      No hay datos para mostrar
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Distribución por Estado</CardTitle>
                <p className="text-[10px] text-muted-foreground">Proporción de documentos procesados</p>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[260px]">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {pieData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      No hay datos para mostrar
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Total: {stats.totalTransactions} documentos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Último error de infraestructura - COMO EN LA IMAGEN */}
          {(() => {
            const ultimoError = filteredData.find((e: any) => isInfraestructuraError(e.motivo || ""));
            if (ultimoError) {
              return (
                <Card className="border-red-200 bg-red-50/50">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-4 w-4" />
                      Último error de infraestructura
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      <p className="font-medium">{ultimoError.razon_social || "Proveedor"}</p>
                      <p className="text-xs text-muted-foreground">
                        Folio #{ultimoError.folio_documento} • {ultimoError.tipo_documento === "33" ? "Factura" : ultimoError.tipo_documento === "34" ? "Factura Exenta" : "Nota Crédito"}
                      </p>
                      <p className="text-xs text-red-600 mt-1">{ultimoError.motivo}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(normalizeDate(ultimoError.fecha_proceso), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <div className="grid grid-cols-1 gap-3">
            {clientServices.length > 0 ? (
              clientServices.map((service) => (
                <Card key={service.id} className="border-l-3 border-l-emerald-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold text-base">{service.name}</h3>
                          <StatusIndicator status="success" percentage={0} size="sm" />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {service.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p className="text-sm">No hay servicios activos para este cliente</p>
                <p className="text-xs">Los servicios están en desarrollo y estarán disponibles próximamente</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-3 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-xl font-bold text-emerald-600">{stats.approved.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">✅ {chartLegends.aprobadas}</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-xl font-bold text-red-600">{stats.rejected.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">❌ {chartLegends.rechazadas}</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-xl font-bold text-amber-600">{stats.manual.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">✋ {chartLegends.manuales}</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-xl font-bold text-blue-600">{stats.pending.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">⏳ {chartLegends.pendientes}</p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold">Tendencia Mensual</CardTitle>
              <p className="text-[10px] text-muted-foreground">Evolución de aprobaciones vs rechazos</p>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[280px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Line type="monotone" dataKey="aprobadas" stroke="#10b981" name={chartLegends.aprobadas} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="rechazadas" stroke="#ef4444" name={chartLegends.rechazadas} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="manuales" stroke="#f59e0b" name={chartLegends.manuales} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No hay datos para mostrar
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DE EXPORTACIÓN */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader className="border-b pb-4 mb-4">
            <DialogTitle className="text-2xl flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <span className="font-bold">Seleccionar Campos</span>
                <p className="text-sm font-normal text-muted-foreground mt-0.5">
                  Elige los campos que deseas incluir en el archivo Excel
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedFields.length === exportFields.length}
                  onCheckedChange={handleSelectAllFields}
                  id="select-all"
                  className="h-5 w-5"
                />
                <Label htmlFor="select-all" className="font-semibold text-base cursor-pointer">
                  Seleccionar todos
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {selectedFields.length} / {exportFields.length} campos
                </Badge>
                {selectedFields.length === exportFields.length && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    ✅ Todos seleccionados
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {exportFields.map((field) => (
                <div 
                  key={field.id} 
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-all hover:bg-muted/30",
                    selectedFields.includes(field.id) && "border-emerald-200 bg-emerald-50/30"
                  )}
                >
                  <Checkbox
                    checked={selectedFields.includes(field.id)}
                    onCheckedChange={() => handleToggleField(field.id)}
                    id={`field-${field.id}`}
                    className="mt-0.5 h-5 w-5"
                  />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`field-${field.id}`} className="text-sm font-medium cursor-pointer">
                      {field.label}
                    </Label>
                    {field.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {field.description}
                      </p>
                    )}
                  </div>
                  {selectedFields.includes(field.id) && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                      ✓
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {selectedFields.length === 0 && (
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700">Debes seleccionar al menos un campo</p>
                  <p className="text-xs text-red-600">Selecciona uno o más campos para poder exportar</p>
                </div>
              </div>
            )}

            {selectedFields.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="p-1.5 bg-blue-100 rounded-full">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">
                    Exportarás {filteredData.length} documentos con {selectedFields.length} campos
                  </p>
                  <p className="text-xs text-blue-600">
                    Los datos se exportarán en formato Excel (.xlsx)
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4 mt-2 gap-3">
            <Button 
              variant="outline" 
              onClick={handleCloseExportModal}
              className="min-w-[100px]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleExportToExcel} 
              className="min-w-[140px] bg-emerald-600 hover:bg-emerald-700"
              disabled={selectedFields.length === 0 || filteredData.length === 0}
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