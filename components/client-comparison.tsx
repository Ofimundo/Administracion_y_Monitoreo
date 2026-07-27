"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { services, subscribeToData, initializeDatabaseData, type Service } from "@/lib/services-data"
import { cn } from "@/lib/utils"
import { Users, TrendingUp, TrendingDown, Minus, CheckCircle } from "lucide-react"

export function ClientComparison() {
  const [selectedServiceId, setSelectedServiceId] = useState<string>("facturas")
  const [dataVersion, setDataVersion] = useState(0)

  useEffect(() => {
    initializeDatabaseData()
    return subscribeToData(() => {
      setDataVersion((v) => v + 1)
    })
  }, [])

  const selectedService = services.find((s) => s.id === selectedServiceId) || services[0]

  // Ordenar clientes por porcentaje de error (o de manera ordenada)
  const sortedClients = [...(selectedService?.clients || [])].sort(
    (a, b) => b.errorPercentage - a.errorPercentage
  )

  // Calcular promedio de errores del servicio
  const totalClientsCount = selectedService?.clients?.length || 0
  const avgError = totalClientsCount > 0
    ? selectedService.clients.reduce((sum, c) => sum + (c.errorPercentage || 0), 0) / totalClientsCount
    : 0

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
          <Users className="h-5 w-5 text-emerald-600" />
          Comparador de Clientes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Compara el rendimiento y los errores entre clientes contratantes de un mismo servicio
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
                {service.name} {service.isComingSoon ? "🚀 (Próximamente)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Promedio de errores técnicos:</span>
            <span className="font-semibold text-emerald-600">{avgError.toFixed(1)}%</span>
          </div>
        </div>

        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {sortedClients.map((client) => {
            const err = client.errorPercentage || 0
            const successRate = 100 - err

            return (
              <div
                key={client.id}
                className={cn(
                  "rounded-lg border p-3 transition-all",
                  err > avgError && err > 5
                    ? "border-red-200 bg-red-50/50"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{client.name}</span>
                    {client.rut && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {client.rut}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {getComparisonIcon(err)}
                    <span className="text-muted-foreground">
                      {getComparisonText(err)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress
                    value={successRate}
                    className="h-2 flex-1"
                  />
                  <span
                    className={cn(
                      "text-xs font-semibold min-w-[50px] text-right",
                      err === 0
                        ? "text-emerald-600"
                        : err <= 10
                        ? "text-amber-600"
                        : "text-red-600"
                    )}
                  >
                    {err}% err
                  </span>
                </div>
                {err === 0 && (
                  <p className="mt-1.5 text-[11px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Excelente rendimiento (100% de operaciones exitosas)
                  </p>
                )}
                {err > avgError && err > 5 && (
                  <p className="mt-1.5 text-[11px] text-red-600">
                    ⚠️ Este cliente presenta una tasa de error superior al promedio
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {sortedClients.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            No hay clientes asociados a este servicio actualmente
          </p>
        )}
      </CardContent>
    </Card>
  )
}
