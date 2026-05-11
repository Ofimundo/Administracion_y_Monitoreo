"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { services, type Service } from "@/lib/services-data"
import { cn } from "@/lib/utils"
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react"

export function ClientComparison() {
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0].id)

  const selectedService = services.find((s) => s.id === selectedServiceId) || services[0]

  // Sort clients by error percentage (worst first for highlighting issues)
  const sortedClients = [...selectedService.clients].sort(
    (a, b) => b.errorPercentage - a.errorPercentage
  )

  // Calculate average error for comparison
  const avgError =
    selectedService.clients.reduce((sum, c) => sum + c.errorPercentage, 0) /
    selectedService.clients.length

  const getStatusColor = (errorPercentage: number) => {
    if (errorPercentage === 0) return "bg-emerald-500"
    if (errorPercentage <= 10) return "bg-amber-500"
    return "bg-red-500"
  }

  const getComparisonIcon = (errorPercentage: number) => {
    if (errorPercentage < avgError) {
      return <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
    }
    if (errorPercentage > avgError) {
      return <TrendingUp className="h-3.5 w-3.5 text-red-500" />
    }
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  }

  const getComparisonText = (errorPercentage: number) => {
    const diff = errorPercentage - avgError
    if (Math.abs(diff) < 0.5) return "En promedio"
    if (diff < 0) return `${Math.abs(diff).toFixed(1)}% mejor`
    return `${diff.toFixed(1)}% peor`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5" />
          Comparador de Clientes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Compara el rendimiento entre clientes de un mismo servicio
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar servicio" />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Promedio de errores:</span>
            <span className="font-semibold">{avgError.toFixed(1)}%</span>
          </div>
        </div>

        <div className="space-y-3">
          {sortedClients.map((client) => (
            <div
              key={client.id}
              className={cn(
                "rounded-lg border p-3 transition-all",
                client.errorPercentage > avgError && client.errorPercentage > 5
                  ? "border-red-200 bg-red-50/50"
                  : "border-border"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{client.name}</span>
                <div className="flex items-center gap-1.5 text-xs">
                  {getComparisonIcon(client.errorPercentage)}
                  <span className="text-muted-foreground">
                    {getComparisonText(client.errorPercentage)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress
                  value={100 - client.errorPercentage}
                  className="h-2 flex-1"
                />
                <span
                  className={cn(
                    "text-xs font-semibold min-w-[40px] text-right",
                    client.errorPercentage === 0
                      ? "text-emerald-600"
                      : client.errorPercentage <= 10
                      ? "text-amber-600"
                      : "text-red-600"
                  )}
                >
                  {client.errorPercentage}% err
                </span>
              </div>
              {client.errorPercentage > avgError && client.errorPercentage > 5 && (
                <p className="mt-2 text-xs text-red-600">
                  Este cliente tiene una configuración problemática
                </p>
              )}
            </div>
          ))}
        </div>

        {selectedService.clients.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            No hay clientes registrados para este servicio
          </p>
        )}
      </CardContent>
    </Card>
  )
}
