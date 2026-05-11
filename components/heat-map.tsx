"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { services, type Service } from "@/lib/services-data"
import { cn } from "@/lib/utils"
import { Activity } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface HeatMapProps {
  onSelectService: (service: Service) => void
}

export function HeatMap({ onSelectService }: HeatMapProps) {
  // Calculate transaction volume based on clients count and logs
  const getVolumeSize = (service: Service) => {
    const volume = service.clients.length * 20 + service.logs.length * 10
    if (volume >= 80) return "large"
    if (volume >= 50) return "medium"
    return "small"
  }

  const getStatusColor = (service: Service) => {
    switch (service.status) {
      case "success":
        return "bg-emerald-500 hover:bg-emerald-400"
      case "warning":
        return "bg-amber-500 hover:bg-amber-400"
      case "error":
        return "bg-red-500 hover:bg-red-400 animate-pulse"
    }
  }

  const getSizeClasses = (size: string) => {
    switch (size) {
      case "large":
        return "col-span-2 row-span-2"
      case "medium":
        return "col-span-2 row-span-1"
      default:
        return "col-span-1 row-span-1"
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5" />
          Mapa de Calor - Estado de Servicios
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Tamaño = volumen de transacciones | Color = estado del servicio
        </p>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid auto-rows-[60px] grid-cols-4 gap-2">
            {services.map((service) => {
              const size = getVolumeSize(service)
              return (
                <Tooltip key={service.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelectService(service)}
                      className={cn(
                        "flex items-center justify-center rounded-lg p-2 text-white font-medium text-xs transition-all cursor-pointer shadow-md",
                        getStatusColor(service),
                        getSizeClasses(size)
                      )}
                    >
                      <span className="text-center line-clamp-2 text-white">
                        {service.name}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <div className="space-y-1">
                      <p className="font-semibold">{service.name}</p>
                      <p className="text-xs">Errores: {service.errorPercentage}%</p>
                      <p className="text-xs">Clientes: {service.clients.length}</p>
                      <p className="text-xs">Volumen: {size === "large" ? "Alto" : size === "medium" ? "Medio" : "Bajo"}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-emerald-500" />
            <span>Sin errores</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-amber-500" />
            <span>Alertas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-red-500" />
            <span>Errores</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
