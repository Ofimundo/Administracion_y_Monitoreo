// app/components/command-center.tsx
"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { services, type Service } from "@/lib/services-data";
import {
  RefreshCw,
  Send,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionLog {
  id: string;
  action: string;
  service: string;
  serviceId: string;
  timestamp: Date;
  status: "success" | "pending" | "error";
  message?: string;
}

export function CommandCenter() {
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, action: "", description: "", onConfirm: () => {} });

  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Simular ejecución de acción con progreso
  const executeAction = async (action: string, description: string, actionFn?: () => Promise<void>) => {
    if (!selectedService) return;

    setConfirmDialog({
      open: true,
      action,
      description,
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, open: false });
        setIsExecuting(true);
        setExecutionProgress(0);

        // Add pending log
        const newLog: ActionLog = {
          id: Date.now().toString(),
          action,
          service: selectedService.name,
          serviceId: selectedService.id,
          timestamp: new Date(),
          status: "pending",
        };
        setActionLogs((prev) => [newLog, ...prev]);

        // Simular progreso
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
          if (actionFn) {
            await actionFn();
          } else {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }

          setActionLogs((prev) =>
            prev.map((log) =>
              log.id === newLog.id
                ? {
                    ...log,
                    status: "success",
                    message: `Acción "${action}" ejecutada correctamente en ${selectedService.name}`,
                  }
                : log
            )
          );
          
          console.log(`✅ ${action} completado en ${selectedService.name}`);
        } catch (error) {
          setActionLogs((prev) =>
            prev.map((log) =>
              log.id === newLog.id
                ? {
                    ...log,
                    status: "error",
                    message: `Error al ejecutar "${action}" en ${selectedService.name}`,
                  }
                : log
            )
          );
          console.error(`❌ Error en ${action}:`, error);
        } finally {
          clearInterval(interval);
          setIsExecuting(false);
          setExecutionProgress(0);
        }
      },
    });
  };

  const handleReiniciar = async () => {
    console.log(`Reiniciando servicio: ${selectedService?.name}`);
    if (selectedServiceId === "facturas") {
      const res = await fetch("/api/facturas/sincronizar", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Error al sincronizar con Softland.");
      }
    }
  };

  const handleReenviarFallidos = async () => {
    console.log(`Reenviando fallidos para: ${selectedService?.name}`);
    if (selectedServiceId === "facturas") {
      const res = await fetch("/api/facturas/sincronizar", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Error al resincronizar.");
      }
    }
  };

  const handleNotificarCliente = async () => {
    console.log(`Notificando cliente para: ${selectedService?.name}`);
  };

  const handleEscalarSoporte = async () => {
    console.log(`Escalando a soporte para: ${selectedService?.name}`);
  };

  const handleIniciarProceso = async () => {
    console.log(`Iniciando proceso para: ${selectedService?.name}`);
    if (selectedServiceId === "facturas") {
      const res = await fetch("/api/facturas/ejecutar", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "La ejecución del motor RPA falló.");
      }
    }
  };

  const handleDetenerServicio = async () => {
    console.log(`Deteniendo servicio: ${selectedService?.name}`);
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
      icon: Send,
      label: "Reenviar Fallidos",
      description: "Reenvía todos los documentos que fallaron en el procesamiento",
      color: "text-amber-500",
      bgColor: "bg-amber-50 hover:bg-amber-100",
      borderColor: "border-amber-200",
      actionFn: handleReenviarFallidos,
    },
    {
      icon: Bell,
      label: "Notificar Cliente",
      description: "Envía una notificación al cliente sobre el estado del servicio",
      color: "text-purple-500",
      bgColor: "bg-purple-50 hover:bg-purple-100",
      borderColor: "border-purple-200",
      actionFn: handleNotificarCliente,
    },
    {
      icon: Headphones,
      label: "Escalar a Soporte",
      description: "Crea un ticket de soporte técnico urgente para este servicio",
      color: "text-red-500",
      bgColor: "bg-red-50 hover:bg-red-100",
      borderColor: "border-red-200",
      actionFn: handleEscalarSoporte,
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
  };

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
                    onClick={() => executeAction(action.label, action.description, action.actionFn)}
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

      {/* Diálogo de confirmación - CORREGIDO: eliminado DialogDescription problemático */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Confirmar Acción
            </DialogTitle>
          </DialogHeader>
          
          {/* Contenido del diálogo sin usar DialogDescription */}
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