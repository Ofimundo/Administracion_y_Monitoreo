// app/service/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Header } from "@/components/header";
import { StatusIndicator } from "@/components/status-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { services, type Client, type LogEntry } from "@/lib/services-data";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  FileText,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  RefreshCw,
  Send,
  Bell,
  Settings,
  Eye,
  Filter,
  Search,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, subDays, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

interface LogFilters {
  search: string;
  types: string[];
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showLogFilters, setShowLogFilters] = useState(false);
  const [logFilters, setLogFilters] = useState<LogFilters>({
    search: "",
    types: ["success", "error", "warning", "info"],
    dateRange: { from: subDays(new Date(), 7), to: new Date() },
  });

  const service = services.find((s) => s.id === params.id);

  if (!service) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Servicio no encontrado</h1>
            <Button onClick={() => router.push("/")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Filtrar logs
  const filteredLogs = useMemo(() => {
    let result = [...service.logs];

    if (logFilters.search) {
      result = result.filter(log =>
        log.message.toLowerCase().includes(logFilters.search.toLowerCase())
      );
    }

    if (logFilters.types.length > 0 && logFilters.types.length < 4) {
      result = result.filter(log => logFilters.types.includes(log.type));
    }

    if (logFilters.dateRange.from && logFilters.dateRange.to) {
      result = result.filter(log => {
        const logDate = new Date(log.timestamp);
        return isWithinInterval(logDate, {
          start: logFilters.dateRange.from!,
          end: logFilters.dateRange.to!,
        });
      });
    }

    return result;
  }, [service.logs, logFilters]);

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (logFilters.search) count++;
    if (logFilters.types.length < 4) count++;
    if (logFilters.dateRange.from || logFilters.dateRange.to) count++;
    return count;
  }, [logFilters]);

  // Resetear filtros
  const resetLogFilters = () => {
    setLogFilters({
      search: "",
      types: ["success", "error", "warning", "info"],
      dateRange: { from: subDays(new Date(), 7), to: new Date() },
    });
  };

  // Toggle tipo de log
  const toggleLogType = (type: string) => {
    setLogFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type]
    }));
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLogBgColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "bg-emerald-50 border-emerald-200";
      case "error":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-amber-50 border-amber-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const getLogBadge = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return <Badge variant="success" className="text-[10px] px-1.5">Éxito</Badge>;
      case "error":
        return <Badge variant="destructive" className="text-[10px] px-1.5">Error</Badge>;
      case "warning":
        return <Badge variant="warning" className="text-[10px] px-1.5">Advertencia</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-1.5">Info</Badge>;
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${day}/${month} ${hours}:${minutes}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        {/* Back button and title */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="mb-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la lista de servicios
          </Button>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-foreground">{service.name}</h1>
              <StatusIndicator status={service.status} errorPercentage={service.errorPercentage} size="lg" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reiniciar
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Configurar
              </Button>
            </div>
          </div>
        </div>

        {/* Main content with tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left side - Main content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="logs" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="logs" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Logs ({filteredLogs.length})
                </TabsTrigger>
                <TabsTrigger value="description" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Descripción
                </TabsTrigger>
                <TabsTrigger value="clients" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Clientes ({service.clients.length})
                </TabsTrigger>
              </TabsList>

              {/* Logs Tab con filtros */}
              <TabsContent value="logs">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-medium flex items-center gap-2">
                        {service.status === "success" ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            Sin errores - Funcionando correctamente
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Registro de actividad
                          </>
                        )}
                      </CardTitle>
                      <Button
                        variant={showLogFilters ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowLogFilters(!showLogFilters)}
                      >
                        <Filter className="mr-2 h-3 w-3" />
                        Filtros
                        {activeFiltersCount > 0 && (
                          <Badge variant="secondary" className="ml-1 text-[10px]">
                            {activeFiltersCount}
                          </Badge>
                        )}
                      </Button>
                    </div>

                    {/* Panel de filtros para logs */}
                    {showLogFilters && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        <div>
                          <Label className="text-xs font-medium mb-1 block">Buscar</Label>
                          <div className="relative">
                            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                            <Input
                              placeholder="Buscar en mensajes..."
                              value={logFilters.search}
                              onChange={(e) => setLogFilters({ ...logFilters, search: e.target.value })}
                              className="pl-7 h-8 text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-medium mb-1 block">Tipo de evento</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: "success", label: "Éxito", color: "bg-emerald-500" },
                              { value: "error", label: "Error", color: "bg-red-500" },
                              { value: "warning", label: "Alerta", color: "bg-amber-500" },
                              { value: "info", label: "Info", color: "bg-blue-500" },
                            ].map(type => (
                              <Button
                                key={type.value}
                                variant={logFilters.types.includes(type.value) ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleLogType(type.value)}
                                className="h-6 text-xs gap-1"
                              >
                                <div className={cn("w-2 h-2 rounded-full", type.color)} />
                                {type.label}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-medium mb-1 block">Rango de fechas</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal h-8 text-xs">
                                <CalendarIcon className="mr-2 h-3 w-3" />
                                {logFilters.dateRange.from ? (
                                  logFilters.dateRange.to ? (
                                    <>
                                      {format(logFilters.dateRange.from, "dd/MM/yy")} -{" "}
                                      {format(logFilters.dateRange.to, "dd/MM/yy")}
                                    </>
                                  ) : (
                                    format(logFilters.dateRange.from, "dd/MM/yy")
                                  )
                                ) : (
                                  <span>Seleccionar fechas</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="range"
                                selected={logFilters.dateRange}
                                onSelect={(range) => setLogFilters({ ...logFilters, dateRange: range || { from: undefined, to: undefined } })}
                                numberOfMonths={2}
                                locale={es}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        {activeFiltersCount > 0 && (
                          <div className="flex justify-end pt-1">
                            <Button variant="destructive" size="sm" onClick={resetLogFilters} className="h-7 text-xs">
                              <X className="mr-1 h-3 w-3" />
                              Limpiar filtros ({activeFiltersCount})
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Indicadores de filtros activos */}
                    {activeFiltersCount > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
                        {logFilters.search && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Search className="h-2 w-2" />
                            {logFilters.search}
                          </Badge>
                        )}
                        {logFilters.types.length < 4 && (
                          <Badge variant="secondary" className="text-[10px]">
                            Tipo: {logFilters.types.map(t => 
                              t === "success" ? "Éxito" : t === "error" ? "Error" : t === "warning" ? "Alerta" : "Info"
                            ).join(", ")}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {filteredLogs.length > 0 ? (
                          filteredLogs.map((log) => (
                            <div
                              key={log.id}
                              className={cn(
                                "p-4 rounded-lg border transition-colors",
                                getLogBgColor(log.type as LogEntry["type"])
                              )}
                            >
                              <div className="flex items-start gap-3">
                                {getLogIcon(log.type as LogEntry["type"])}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    {getLogBadge(log.type as LogEntry["type"])}
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(log.timestamp)}
                                    </span>
                                  </div>
                                  <p className="font-medium text-foreground">{log.message}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No hay logs que coincidan con los filtros</p>
                            <Button variant="link" size="sm" onClick={resetLogFilters} className="mt-2">
                              Limpiar filtros
                            </Button>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Description Tab */}
              <TabsContent value="description">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Información del Servicio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Descripción</h3>
                      <p className="text-muted-foreground leading-relaxed">{service.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Card className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground">Estado actual</div>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusIndicator status={service.status} errorPercentage={service.errorPercentage} />
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground">Total de clientes</div>
                          <div className="text-2xl font-bold text-foreground mt-1">{service.clients.length}</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Características</h3>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        <li>Procesamiento automatizado en tiempo real</li>
                        <li>Integración con sistemas externos</li>
                        <li>Reportes y estadísticas detalladas</li>
                        <li>Soporte técnico 24/7</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Clients Tab */}
              <TabsContent value="clients">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Clientes con este servicio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {service.clients.map((client) => (
                          <div
                            key={client.id}
                            className={cn(
                              "p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md",
                              selectedClient?.id === client.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            )}
                            onClick={() => setSelectedClient(client)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                                    client.status === "success" && "bg-emerald-500",
                                    client.status === "warning" && "bg-amber-500",
                                    client.status === "error" && "bg-red-500"
                                  )}
                                >
                                  {client.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">{client.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {client.errorPercentage}% de errores
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusIndicator status={client.status} errorPercentage={client.errorPercentage} />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedClient(client);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right side - Quick actions and client detail */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium">Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full justify-start" variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reiniciar servicio
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Send className="mr-2 h-4 w-4" />
                  Reenviar fallidos
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Bell className="mr-2 h-4 w-4" />
                  Notificar clientes
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Settings className="mr-2 h-4 w-4" />
                  Configuración
                </Button>
              </CardContent>
            </Card>

            {/* Selected Client Detail */}
            {selectedClient && (
              <Card className="border-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-medium flex items-center justify-between">
                    <span>Detalle del Cliente</span>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg",
                        selectedClient.status === "success" && "bg-emerald-500",
                        selectedClient.status === "warning" && "bg-amber-500",
                        selectedClient.status === "error" && "bg-red-500"
                      )}
                    >
                      {selectedClient.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{selectedClient.name}</p>
                      <StatusIndicator status={selectedClient.status} errorPercentage={selectedClient.errorPercentage} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-foreground">
                        {1000 - selectedClient.errorPercentage * 10}
                      </div>
                      <div className="text-xs text-muted-foreground">Transacciones</div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-foreground">{selectedClient.errorPercentage}%</div>
                      <div className="text-xs text-muted-foreground">Errores</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button className="w-full" size="sm">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resincronizar
                    </Button>
                    <Button className="w-full" variant="outline" size="sm">
                      <Bell className="mr-2 h-4 w-4" />
                      Contactar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium">Estadísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-semibold text-emerald-600">99.9%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Última actividad</span>
                  <span className="font-semibold">Hace 2 min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Transacciones hoy</span>
                  <span className="font-semibold">1,234</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Errores hoy</span>
                  <span className="font-semibold text-red-500">{service.errorPercentage}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Sistema de Administración y Monitoreo de Servicios &copy; 2026
        </div>
      </footer>
    </div>
  );
}