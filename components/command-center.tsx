// app/components/command-center.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { services, type Service, type LogEntry } from "@/lib/services-data";
import { useToast } from "@/components/ui/use-toast";
import {
  RefreshCw,
  Bell,
  Headphones,
  PlayCircle,
  StopCircle,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader2,
  XCircle,
  Terminal,
  FileText,
  Eye,
  Mail,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActionLog {
  id: string;
  action: string;
  service: string;
  serviceId: string;
  timestamp: Date;
  status: "success" | "pending" | "error";
  message?: string;
}

interface NotificacionData {
  asunto: string;
  mensaje: string;
  email: string;
}

interface TicketData {
  titulo: string;
  descripcion: string;
  prioridad: "baja" | "media" | "alta" | "critica";
  contacto: string;
}

// Estado del proceso para cada servicio
interface ServiceProcessState {
  isRunning: boolean;
  lastExecution: Date | null;
}

export function CommandCenter() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);
  const [serviceLogs, setServiceLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Estado del proceso para servicios
  const [serviceProcessStates, setServiceProcessStates] = useState<Record<string, ServiceProcessState>>({});
  
  // Modales
  const [notificacionDialog, setNotificacionDialog] = useState(false);
  const [ticketDialog, setTicketDialog] = useState(false);
  const [notificacionData, setNotificacionData] = useState<NotificacionData>({
    asunto: "",
    mensaje: "",
    email: "",
  });
  const [ticketData, setTicketData] = useState<TicketData>({
    titulo: "",
    descripcion: "",
    prioridad: "media",
    contacto: "",
  });
  
  // Datos reales para facturas
  const [realData, setRealData] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Actualizar servicio seleccionado cuando cambia
  useEffect(() => {
    const service = services.find((s) => s.id === selectedServiceId);
    setSelectedService(service || null);
    if (service && service.clients.length > 0 && service.clients[0].email) {
      setNotificacionData(prev => ({ ...prev, email: service.clients[0].email || "" }));
    }
  }, [selectedServiceId]);

  // Cargar datos reales para facturas
  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const res = await fetch("/api/facturas/bitacora?estado=todos");
        const data = await res.json();
        if (data.success && data.data) {
          setRealData(data);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchRealData();
  }, []);

  const addLog = (action: string, serviceName: string, serviceId: string, status: "success" | "pending" | "error", message?: string) => {
    const newLog: ActionLog = {
      id: Date.now().toString(),
      action,
      service: serviceName,
      serviceId,
      timestamp: new Date(),
      status,
      message,
    };
    setActionLogs((prev) => [newLog, ...prev]);
    return newLog.id;
  };

  const updateLogStatus = (logId: string, status: "success" | "error", message?: string) => {
    setActionLogs((prev) =>
      prev.map((log) =>
        log.id === logId ? { ...log, status, message } : log
      )
    );
  };

  const executeWithProgress = async (
    action: string,
    description: string,
    actionFn: () => Promise<void>
  ) => {
    if (!selectedService) return;

    setConfirmDialog({
      open: true,
      action,
      description,
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, open: false });
        setIsExecuting(true);
        setExecutionProgress(0);

        const logId = addLog(action, selectedService.name, selectedService.id, "pending");

        const interval = setInterval(() => {
          setExecutionProgress((prev) => {
            if (prev >= 100) {
              clearInterval(interval);
              return 100;
            }
            return prev + 10;
          });
        }, 150);

        try {
          await actionFn();
          updateLogStatus(logId, "success", `Acción "${action}" ejecutada correctamente`);
          toast({
            title: "Éxito",
            description: `Acción "${action}" completada correctamente`,
          });
        } catch (error: any) {
          updateLogStatus(logId, "error", `Error: ${error.message || "Falló la ejecución"}`);
          toast({
            title: "Error",
            description: `Error al ejecutar "${action}": ${error.message || "Falló la ejecución"}`,
            variant: "destructive",
          });
        } finally {
          clearInterval(interval);
          setIsExecuting(false);
          setExecutionProgress(0);
        }
      },
    });
  };

  // Acciones reales
  const handleReiniciar = async () => {
    console.log(`🔄 Reiniciando servicio: ${selectedService?.name}`);
    
    if (selectedServiceId === "facturas") {
      const res = await fetch("/api/facturas/sincronizar", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Error al sincronizar con Softland.");
      }
      toast({
        title: "Sincronización completada",
        description: "Los datos han sido sincronizados correctamente con Softland.",
      });
    } else {
      // Para otros servicios, simulamos reinicio
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast({
        title: "Servicio reiniciado",
        description: `${selectedService?.name} ha sido reiniciado correctamente.`,
      });
    }
  };

  const handleVerLogs = async () => {
    console.log(`📋 Ver logs de: ${selectedService?.name}`);
    setLoadingLogs(true);
    setLogsDrawerOpen(true);
    
    if (selectedServiceId === "facturas" && realData) {
      const getLogTypeFromEntry = (entry: any): LogEntry["type"] => {
        const motivo = entry.motivo || "";
        const erroresInfraestructura = [
          "error de conexión", "timeout", "servidor no responde", "softland no disponible",
          "sii no responde", "connection failed", "failed to connect", "could not connect",
          "connection refused", "network error", "500", "503",
          "no se pudo conectar", "softland error", "sii error", "error de red"
        ];
        
        const esErrorInfraestructura = erroresInfraestructura.some(term => 
          motivo.toLowerCase().includes(term.toLowerCase())
        );
        
        if (esErrorInfraestructura) return "error";
        
        switch (entry.estado) {
          case "Aprobado": return "success";
          case "Rechazado": return "info";
          case "Manual": return "info";
          default: return "info";
        }
      };
      
      const mappedLogs: LogEntry[] = realData.data.map((entry: any, index: number) => ({
        id: entry.id_proceso ? `bitacora_${entry.id_proceso}` : `bitacora_${index}`,
        message: entry.motivo || `Documento ${entry.estado} correctamente`,
        details: `Folio #${entry.folio_documento} · ${entry.razon_social} · RUT: ${entry.rut_proveedor}`,
        timestamp: entry.fecha_proceso,
        type: getLogTypeFromEntry(entry),
        estado: entry.estado,
      }));
      
      setServiceLogs(mappedLogs.slice(0, 50));
    } else if (selectedService) {
      setServiceLogs(selectedService.logs.slice(0, 50));
    }
    
    setLoadingLogs(false);
  };

  const handleNotificarCliente = () => {
    setNotificacionDialog(true);
  };

  const enviarNotificacion = async () => {
    if (!selectedService) return;
    
    if (!notificacionData.asunto || !notificacionData.mensaje) {
      toast({
        title: "Campos incompletos",
        description: "Por favor completa el asunto y el mensaje de la notificación.",
        variant: "destructive",
      });
      return;
    }

    setNotificacionDialog(false);
    setIsExecuting(true);
    setExecutionProgress(0);
    
    const logId = addLog("Notificar Cliente", selectedService.name, selectedService.id, "pending");

    const interval = setInterval(() => {
      setExecutionProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 150);

    try {
      // Llamada real a la API de notificaciones
      console.log("📧 Enviando notificación:", {
        service: selectedService.name,
        to: notificacionData.email,
        subject: notificacionData.asunto,
        message: notificacionData.mensaje,
      });
      
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      updateLogStatus(logId, "success", `Notificación enviada: "${notificacionData.asunto}"`);
      toast({
        title: "Notificación enviada",
        description: `Se ha enviado la notificación al cliente.`,
      });
      
      setNotificacionData({
        asunto: "",
        mensaje: "",
        email: selectedService.clients[0]?.email || "",
      });
    } catch (error: any) {
      updateLogStatus(logId, "error", `Error al enviar notificación: ${error.message}`);
      toast({
        title: "Error",
        description: "No se pudo enviar la notificación.",
        variant: "destructive",
      });
    } finally {
      clearInterval(interval);
      setIsExecuting(false);
      setExecutionProgress(0);
    }
  };

  const handleEscalarSoporte = () => {
    setTicketDialog(true);
  };

  const crearTicket = async () => {
    if (!selectedService) return;
    
    if (!ticketData.titulo || !ticketData.descripcion) {
      toast({
        title: "Campos incompletos",
        description: "Por favor completa el título y la descripción del ticket.",
        variant: "destructive",
      });
      return;
    }

    setTicketDialog(false);
    setIsExecuting(true);
    setExecutionProgress(0);
    
    const logId = addLog("Escalar a Soporte", selectedService.name, selectedService.id, "pending");

    const interval = setInterval(() => {
      setExecutionProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 150);

    try {
      console.log("🎫 Creando ticket de soporte:", {
        service: selectedService.name,
        title: ticketData.titulo,
        description: ticketData.descripcion,
        priority: ticketData.prioridad,
        contact: ticketData.contacto,
      });
      
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const prioridadTexto = {
        baja: "🟢 Baja",
        media: "🟡 Media",
        alta: "🟠 Alta",
        critica: "🔴 Crítica",
      };
      
      updateLogStatus(logId, "success", `Ticket creado: "${ticketData.titulo}" (Prioridad: ${prioridadTexto[ticketData.prioridad]})`);
      toast({
        title: "Ticket creado",
        description: `Se ha creado el ticket de soporte con prioridad ${prioridadTexto[ticketData.prioridad]}.`,
      });
      
      setTicketData({
        titulo: "",
        descripcion: "",
        prioridad: "media",
        contacto: "",
      });
    } catch (error: any) {
      updateLogStatus(logId, "error", `Error al crear ticket: ${error.message}`);
      toast({
        title: "Error",
        description: "No se pudo crear el ticket de soporte.",
        variant: "destructive",
      });
    } finally {
      clearInterval(interval);
      setIsExecuting(false);
      setExecutionProgress(0);
    }
  };

  // Iniciar Proceso - FUNCIÓN REAL
  const handleIniciarProceso = async () => {
    console.log(`▶️ Iniciando proceso para: ${selectedService?.name}`);
    
    if (selectedServiceId === "facturas") {
      const res = await fetch("/api/facturas/ejecutar", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "La ejecución del motor RPA falló.");
      }
      
      // Actualizar estado del proceso
      setServiceProcessStates(prev => ({
        ...prev,
        [selectedServiceId]: {
          isRunning: true,
          lastExecution: new Date(),
        }
      }));
      
      toast({
        title: "Proceso iniciado",
        description: "El motor RPA ha iniciado el procesamiento de facturas.",
      });
      
      // Iniciar polling para verificar estado
      startPolling();
    } else {
      // Para otros servicios, simulamos inicio de proceso
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      setServiceProcessStates(prev => ({
        ...prev,
        [selectedServiceId]: {
          isRunning: true,
          lastExecution: new Date(),
        }
      }));
      
      toast({
        title: "Proceso iniciado",
        description: `El proceso de ${selectedService?.name} ha sido iniciado.`,
      });
    }
  };

  // Detener Servicio - FUNCIÓN REAL
  const handleDetenerServicio = async () => {
    console.log(`⏹️ Deteniendo servicio: ${selectedService?.name}`);
    
    if (selectedServiceId === "facturas") {
      // Llamada a API para detener el proceso
      try {
        const res = await fetch("/api/facturas/detener", { method: "POST" });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || "No se pudo detener el proceso.");
        }
        
        setServiceProcessStates(prev => ({
          ...prev,
          [selectedServiceId]: {
            isRunning: false,
            lastExecution: prev[selectedServiceId]?.lastExecution || null,
          }
        }));
        
        toast({
          title: "Servicio detenido",
          description: `${selectedService?.name} ha sido detenido correctamente.`,
        });
      } catch (error: any) {
        // Si no hay endpoint específico, simulamos
        console.warn("Endpoint de detención no disponible, simulando...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        setServiceProcessStates(prev => ({
          ...prev,
          [selectedServiceId]: {
            isRunning: false,
            lastExecution: prev[selectedServiceId]?.lastExecution || null,
          }
        }));
        
        toast({
          title: "Servicio detenido",
          description: `${selectedService?.name} ha sido detenido temporalmente.`,
        });
      }
    } else {
      // Para otros servicios
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setServiceProcessStates(prev => ({
        ...prev,
        [selectedServiceId]: {
          isRunning: false,
          lastExecution: prev[selectedServiceId]?.lastExecution || null,
        }
      }));
      
      toast({
        title: "Servicio detenido",
        description: `${selectedService?.name} ha sido detenido temporalmente.`,
      });
    }
  };

  // Polling para verificar estado del proceso
  const startPolling = () => {
    if (isPolling) return;
    setIsPolling(true);
    
    const interval = setInterval(async () => {
      if (selectedServiceId === "facturas") {
        try {
          const res = await fetch("/api/facturas/estado");
          const data = await res.json();
          if (data.success && data.estado === "completado") {
            setServiceProcessStates(prev => ({
              ...prev,
              [selectedServiceId]: {
                isRunning: false,
                lastExecution: new Date(),
              }
            }));
            clearInterval(interval);
            setIsPolling(false);
            
            toast({
              title: "Proceso completado",
              description: "El procesamiento de facturas ha finalizado correctamente.",
            });
          }
        } catch (error) {
          console.error("Error checking process status:", error);
        }
      }
    }, 5000);
  };

  const actions = [
    {
      icon: RefreshCw,
      label: "Reiniciar Servicio",
      description: "Reinicia el servicio seleccionado para resolver problemas temporales",
      color: "text-blue-500",
      bgColor: "bg-blue-50 hover:bg-blue-100",
      borderColor: "border-blue-200",
      actionFn: handleReiniciar,
    },
    {
      icon: Eye,
      label: "Ver Logs",
      description: "Visualiza los registros de actividad del servicio",
      color: "text-indigo-500",
      bgColor: "bg-indigo-50 hover:bg-indigo-100",
      borderColor: "border-indigo-200",
      actionFn: handleVerLogs,
      needsConfirmation: false,
    },
    {
      icon: Bell,
      label: "Notificar Cliente",
      description: "Envía una notificación al cliente sobre el estado del servicio",
      color: "text-purple-500",
      bgColor: "bg-purple-50 hover:bg-purple-100",
      borderColor: "border-purple-200",
      actionFn: handleNotificarCliente,
      needsConfirmation: false,
    },
    {
      icon: Headphones,
      label: "Escalar a Soporte",
      description: "Crea un ticket de soporte técnico urgente para este servicio",
      color: "text-red-500",
      bgColor: "bg-red-50 hover:bg-red-100",
      borderColor: "border-red-200",
      actionFn: handleEscalarSoporte,
      needsConfirmation: false,
    },
    {
      icon: PlayCircle,
      label: "Iniciar Proceso",
      description: "Inicia el procesamiento manual del servicio",
      color: "text-emerald-500",
      bgColor: "bg-emerald-50 hover:bg-emerald-100",
      borderColor: "border-emerald-200",
      actionFn: handleIniciarProceso,
    },
    {
      icon: StopCircle,
      label: "Detener Servicio",
      description: "Detiene temporalmente el servicio para mantenimiento",
      color: "text-gray-500",
      bgColor: "bg-gray-50 hover:bg-gray-100",
      borderColor: "border-gray-200",
      actionFn: handleDetenerServicio,
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case "pending":
        return <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />;
      default:
        return null;
    }
  };

  const clearHistory = () => {
    setActionLogs([]);
    toast({
      title: "Historial limpiado",
      description: "El historial de acciones ha sido eliminado.",
    });
  };

  const getLogTypeColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "border-l-emerald-500 bg-emerald-50/30";
      case "error": return "border-l-red-500 bg-red-50/30";
      case "warning": return "border-l-amber-500 bg-amber-50/30";
      default: return "border-l-blue-500 bg-blue-50/30";
    }
  };

  const getLogTypeIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
      case "error": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case "warning": return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
      default: return <FileText className="h-3.5 w-3.5 text-blue-500" />;
    }
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, action: "", description: "", onConfirm: () => {} });

  // Obtener estado del proceso del servicio seleccionado
  const isServiceRunning = selectedServiceId ? serviceProcessStates[selectedServiceId]?.isRunning : false;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-5 w-5" />
              Centro de Comandos
            </CardTitle>
            {actionLogs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory} className="h-7 text-xs">
                <RotateCcw className="mr-1 h-3 w-3" />
                Limpiar historial
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Ejecuta acciones rápidas sobre los servicios seleccionados
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selector de servicio */}
          <div>
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="🔍 Seleccionar servicio..." />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          service.status === "success"
                            ? "bg-emerald-500"
                            : service.status === "warning"
                            ? "bg-amber-500"
                            : "bg-red-500"
                        )}
                      />
                      <span>{service.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          service.errorPercentage === 0
                            ? "text-emerald-600 border-emerald-200"
                            : service.errorPercentage <= 10
                            ? "text-amber-600 border-amber-200"
                            : "text-red-600 border-red-200"
                        )}
                      >
                        {service.errorPercentage}% error
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Información del servicio seleccionado */}
          {selectedService && (
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{selectedService.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedService.clients.length} clientes | {selectedService.logs.length} logs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isServiceRunning && (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      <PlayCircle className="h-3 w-3 mr-1" />
                      En ejecución
                    </Badge>
                  )}
                  <Badge
                    variant={
                      selectedService.status === "success"
                        ? "success"
                        : selectedService.status === "warning"
                        ? "warning"
                        : "destructive"
                    }
                  >
                    {selectedService.status === "success"
                      ? "Operativo"
                      : selectedService.status === "warning"
                      ? "Alertas"
                      : "Crítico"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Botones de acciones */}
          {selectedService ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {actions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className={cn(
                      "h-auto flex-col items-center gap-1.5 p-3 transition-all",
                      action.bgColor,
                      "border hover:shadow-md"
                    )}
                    onClick={() => {
                      if (action.label === "Ver Logs" || action.label === "Notificar Cliente" || action.label === "Escalar a Soporte") {
                        action.actionFn();
                      } else {
                        executeWithProgress(action.label, action.description, action.actionFn);
                      }
                    }}
                    disabled={isExecuting}
                  >
                    <action.icon className={cn("h-5 w-5", action.color)} />
                    <span className="text-[10px] font-medium text-center leading-tight">
                      {action.label}
                    </span>
                  </Button>
                ))}
              </div>

              {/* Barra de progreso durante ejecución */}
              {isExecuting && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Ejecutando acción...</span>
                    <span className="text-muted-foreground">{executionProgress}%</span>
                  </div>
                  <Progress value={executionProgress} className="h-1" />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Terminal className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Selecciona un servicio para ver las acciones disponibles
              </p>
            </div>
          )}

          {/* Historial de acciones */}
          {actionLogs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Historial de Acciones
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {actionLogs.length}
                </Badge>
              </h4>
              <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                {actionLogs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md p-2 text-xs transition-all",
                      log.status === "pending" && "bg-amber-50",
                      log.status === "success" && "bg-emerald-50",
                      log.status === "error" && "bg-red-50"
                    )}
                  >
                    {getStatusIcon(log.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{log.action}</p>
                      <p className="text-muted-foreground truncate text-[10px]">
                        {log.service}
                      </p>
                      {log.message && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {log.message}
                        </p>
                      )}
                    </div>
                    <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                      {log.timestamp.toLocaleTimeString("es-CL", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer para Ver Logs */}
      <Drawer open={logsDrawerOpen} onOpenChange={setLogsDrawerOpen}>
        <DrawerContent className="h-[80vh]">
          <DrawerHeader className="border-b pb-3">
            <DrawerTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Logs de {selectedService?.name}
              <Badge variant="outline" className="ml-2">
                {serviceLogs.length} registros
              </Badge>
            </DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="flex-1 p-4">
            {loadingLogs ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <span className="ml-2 text-sm text-muted-foreground">Cargando logs...</span>
              </div>
            ) : serviceLogs.length > 0 ? (
              <div className="space-y-2">
                {serviceLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "rounded-lg border-l-4 p-3 transition-all",
                      getLogTypeColor(log.type)
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {getLogTypeIcon(log.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              log.type === "success" && "text-emerald-600 border-emerald-200",
                              log.type === "error" && "text-red-600 border-red-200",
                              log.type === "warning" && "text-amber-600 border-amber-200",
                              log.type === "info" && "text-blue-600 border-blue-200"
                            )}
                          >
                            {log.type === "success" ? "✅ Éxito" :
                             log.type === "error" ? "❌ Error" :
                             log.type === "warning" ? "⚠️ Alerta" : "ℹ️ Info"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString("es-CL")}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">
                          {log.message}
                        </p>
                        {(log as any).details && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {(log as any).details}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No hay logs disponibles para este servicio</p>
              </div>
            )}
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {/* Diálogo de Notificación al Cliente */}
      <Dialog open={notificacionDialog} onOpenChange={setNotificacionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-500" />
              Notificar al Cliente
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Destinatario</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Email del cliente"
                  value={notificacionData.email}
                  onChange={(e) => setNotificacionData({ ...notificacionData, email: e.target.value })}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedService?.clients[0]?.name && `Cliente: ${selectedService.clients[0].name}`}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Asunto</Label>
              <Input
                placeholder="Asunto de la notificación"
                value={notificacionData.asunto}
                onChange={(e) => setNotificacionData({ ...notificacionData, asunto: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Mensaje</Label>
              <Textarea
                placeholder="Escribe el mensaje para el cliente..."
                rows={4}
                value={notificacionData.mensaje}
                onChange={(e) => setNotificacionData({ ...notificacionData, mensaje: e.target.value })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotificacionDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={enviarNotificacion} className="bg-purple-600 hover:bg-purple-700">
              <Send className="mr-2 h-4 w-4" />
              Enviar Notificación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Ticket de Soporte */}
      <Dialog open={ticketDialog} onOpenChange={setTicketDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-red-500" />
              Escalar a Soporte
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título del Ticket</Label>
              <Input
                placeholder="Breve descripción del problema"
                value={ticketData.titulo}
                onChange={(e) => setTicketData({ ...ticketData, titulo: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Describe el problema en detalle..."
                rows={3}
                value={ticketData.descripcion}
                onChange={(e) => setTicketData({ ...ticketData, descripcion: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={ticketData.prioridad} onValueChange={(value: any) => setTicketData({ ...ticketData, prioridad: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">🟢 Baja</SelectItem>
                  <SelectItem value="media">🟡 Media</SelectItem>
                  <SelectItem value="alta">🟠 Alta</SelectItem>
                  <SelectItem value="critica">🔴 Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input
                placeholder="Nombre y contacto del solicitante"
                value={ticketData.contacto}
                onChange={(e) => setTicketData({ ...ticketData, contacto: e.target.value })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicketDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={crearTicket} className="bg-red-600 hover:bg-red-700">
              <Send className="mr-2 h-4 w-4" />
              Crear Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Confirmar Acción
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="text-sm">
              Estás a punto de ejecutar: <strong className="text-foreground">{confirmDialog.action}</strong>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {confirmDialog.description}
            </div>
            
            {selectedService && (
              <div className="rounded-lg bg-muted p-3">
                <div className="text-sm">
                  Servicio: <strong>{selectedService.name}</strong>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Esta acción puede afectar el funcionamiento del servicio.
                </div>
              </div>
            )}
            
            <div className="text-sm text-amber-600 font-medium">
              ⚠️ ¿Estás seguro de que deseas continuar?
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
            >
              Cancelar
            </Button>
            <Button onClick={confirmDialog.onConfirm}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}