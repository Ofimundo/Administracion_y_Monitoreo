// app/components/events-timeline.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { services, type Service, type LogEntry } from "@/lib/services-data";
import { cn } from "@/lib/utils";
import {
  Clock,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Search,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, subDays, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

interface TimelineEvent {
  id: string;
  serviceName: string;
  serviceId: string;
  log: LogEntry;
  service: Service;
}

interface EventsTimelineProps {
  onSelectService?: (service: Service) => void;
}

interface Filters {
  search: string;
  types: string[];
  serviceId: string;
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

// Valores por defecto - AHORA SIN FILTROS ACTIVOS
const DEFAULT_FILTERS: Filters = {
  search: "",
  types: ["success", "error", "warning", "info"],
  serviceId: "all",
  dateRange: { from: undefined, to: undefined }, // Sin rango de fechas por defecto
};

export function EventsTimeline({ onSelectService }: EventsTimelineProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Collect all logs from all services and sort by timestamp
  const allEvents: TimelineEvent[] = useMemo(() => {
    return services
      .flatMap((service) =>
        service.logs.map((log) => ({
          id: `${service.id}-${log.id}`,
          serviceName: service.name,
          serviceId: service.id,
          log,
          service,
        }))
      )
      .sort((a, b) => new Date(b.log.timestamp).getTime() - new Date(a.log.timestamp).getTime());
  }, []);

  // Aplicar filtros
  const filteredEvents = useMemo(() => {
    let result = [...allEvents];

    // Filtro de búsqueda
    if (filters.search) {
      result = result.filter(event =>
        event.log.message.toLowerCase().includes(filters.search.toLowerCase()) ||
        event.serviceName.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Filtro de tipos de log
    if (filters.types.length > 0 && filters.types.length < 4) {
      result = result.filter(event => filters.types.includes(event.log.type));
    }

    // Filtro de servicio
    if (filters.serviceId !== "all") {
      result = result.filter(event => event.serviceId === filters.serviceId);
    }

    // Filtro de rango de fechas - SOLO si ambos valores están definidos
    if (filters.dateRange.from && filters.dateRange.to) {
      result = result.filter(event => {
        const eventDate = new Date(event.log.timestamp);
        return isWithinInterval(eventDate, {
          start: filters.dateRange.from!,
          end: filters.dateRange.to!,
        });
      });
    }

    return result;
  }, [allEvents, filters]);

  // Contar filtros activos - COMPARACIÓN CORRECTA
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search !== DEFAULT_FILTERS.search) count++;
    if (filters.types.length !== DEFAULT_FILTERS.types.length) count++;
    if (filters.serviceId !== DEFAULT_FILTERS.serviceId) count++;
    // Solo contar si hay fechas seleccionadas
    if (filters.dateRange.from || filters.dateRange.to) count++;
    return count;
  }, [filters]);

  // Limpiar filtros - Restablece a valores por defecto SIN filtros activos
  const resetFilters = () => {
    setFilters({
      search: "",
      types: ["success", "error", "warning", "info"],
      serviceId: "all",
      dateRange: { from: undefined, to: undefined },
    });
  };

  // Toggle tipo de log
  const toggleType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type]
    }));
  };

  const getTypeIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTypeColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "border-l-emerald-500 bg-emerald-50/50 hover:bg-emerald-50";
      case "warning":
        return "border-l-amber-500 bg-amber-50/50 hover:bg-amber-50";
      case "error":
        return "border-l-red-500 bg-red-50/50 hover:bg-red-50";
      default:
        return "border-l-blue-500 bg-blue-50/50 hover:bg-blue-50";
    }
  };

  const getTypeBadge = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return <span className="text-[10px] px-1.5 py-0 text-emerald-600 bg-emerald-100 rounded-full">Éxito</span>;
      case "warning":
        return <span className="text-[10px] px-1.5 py-0 text-amber-600 bg-amber-100 rounded-full">Alerta</span>;
      case "error":
        return <span className="text-[10px] px-1.5 py-0 text-red-600 bg-red-100 rounded-full">Error</span>;
      default:
        return <span className="text-[10px] px-1.5 py-0 text-blue-600 bg-blue-100 rounded-full">Info</span>;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month} ${hours}:${minutes}`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5" />
            Línea de Tiempo
          </CardTitle>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-7 text-xs"
          >
            <Filter className="mr-1 h-3 w-3" />
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
          <div className="space-y-3 pt-2 border-t">
            {/* Búsqueda */}
            <div>
              <Label className="text-xs font-medium mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por servicio o mensaje..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-7 h-8 text-xs"
                />
              </div>
            </div>

            {/* Filtro por servicio */}
            <div>
              <Label className="text-xs font-medium mb-1 block">Servicio</Label>
              <Select value={filters.serviceId} onValueChange={(value) => setFilters({ ...filters, serviceId: value })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos los servicios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌐 Todos los servicios</SelectItem>
                  {services.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({service.errorPercentage}% error)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por rango de fechas */}
            <div>
              <Label className="text-xs font-medium mb-1 block">Rango de fechas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-8 text-xs">
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {filters.dateRange.from ? (
                      filters.dateRange.to ? (
                        <>
                          {format(filters.dateRange.from, "dd/MM/yy")} -{" "}
                          {format(filters.dateRange.to, "dd/MM/yy")}
                        </>
                      ) : (
                        format(filters.dateRange.from, "dd/MM/yy")
                      )
                    ) : (
                      <span>Seleccionar fechas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={filters.dateRange}
                    onSelect={(range) => setFilters({ ...filters, dateRange: range || { from: undefined, to: undefined } })}
                    numberOfMonths={2}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtro por tipo de evento */}
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
                    variant={filters.types.includes(type.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleType(type.value)}
                    className="h-6 text-xs gap-1"
                  >
                    <div className={cn("w-2 h-2 rounded-full", type.color)} />
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Botón limpiar filtros */}
            {activeFiltersCount > 0 && (
              <div className="flex justify-end pt-1">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={resetFilters} 
                  className="h-7 text-xs"
                >
                  <X className="mr-1 h-3 w-3" />
                  Limpiar todos los filtros ({activeFiltersCount})
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Indicadores de filtros activos */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
            {filters.search && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Search className="h-2 w-2" />
                {filters.search}
              </Badge>
            )}
            {filters.serviceId !== "all" && (
              <Badge variant="secondary" className="text-[10px]">
                {services.find(s => s.id === filters.serviceId)?.name}
              </Badge>
            )}
            {filters.types.length < 4 && (
              <Badge variant="secondary" className="text-[10px]">
                Tipo: {filters.types.map(t => t === "success" ? "Éxito" : t === "error" ? "Error" : t === "warning" ? "Alerta" : "Info").join(", ")}
              </Badge>
            )}
            {(filters.dateRange.from || filters.dateRange.to) && (
              <Badge variant="secondary" className="text-[10px]">
                📅 {filters.dateRange.from && format(filters.dateRange.from, "dd/MM/yy")}
                {filters.dateRange.from && filters.dateRange.to && " - "}
                {filters.dateRange.to && format(filters.dateRange.to, "dd/MM/yy")}
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetFilters} 
              className="h-5 text-[10px] px-2 ml-auto"
            >
              <X className="h-2 w-2 mr-1" />
              Limpiar
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="max-h-[500px] overflow-y-auto">
        <div className="space-y-2">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onSelectService && onSelectService(event.service)}
                className={cn(
                  "w-full text-left rounded-lg border-l-4 p-3 transition-all hover:shadow-md cursor-pointer",
                  getTypeColor(event.log.type)
                )}
              >
                <div className="flex items-start gap-2">
                  {getTypeIcon(event.log.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-medium px-1.5 py-0 bg-gray-100 rounded-full">
                        {event.serviceName}
                      </span>
                      {getTypeBadge(event.log.type)}
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(event.log.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground line-clamp-2">
                      {event.log.message}
                    </p>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No hay eventos que coincidan con los filtros</p>
              <Button variant="link" size="sm" onClick={resetFilters} className="mt-2">
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}