"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusIndicator } from "@/components/status-indicator"
import { Button } from "@/components/ui/button"
import type { Service, Client } from "@/lib/services-data"
import { 
  Building2, 
  Activity, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Mail,
  Phone,
  Settings
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ClientDetailModalProps {
  service: Service | null
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClientDetailModal({ 
  service, 
  client, 
  open, 
  onOpenChange 
}: ClientDetailModalProps) {
  if (!service || !client) return null

  // Simulated client-specific data
  const clientData = {
    contactEmail: `contacto@${client.name.toLowerCase().replace(/\s+/g, "")}.cl`,
    contactPhone: "+56 2 2XXX XXXX",
    lastSync: "2026-04-28 10:15:00",
    totalTransactions: Math.floor(Math.random() * 5000) + 500,
    successfulTransactions: 0,
    failedTransactions: 0,
  }
  
  clientData.failedTransactions = Math.floor(clientData.totalTransactions * (client.errorPercentage / 100))
  clientData.successfulTransactions = clientData.totalTransactions - clientData.failedTransactions

  // Simulated recent activity for this client
  const recentActivity = [
    { id: "1", action: "Documento procesado", status: "success", time: "10:25" },
    { id: "2", action: "Sincronización completada", status: "success", time: "10:20" },
    { id: "3", action: client.errorPercentage > 0 ? "Error en validación" : "Validación exitosa", status: client.errorPercentage > 0 ? "error" : "success", time: "10:15" },
    { id: "4", action: "Conexión establecida", status: "success", time: "10:10" },
    { id: "5", action: "Proceso iniciado", status: "info", time: "10:05" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">{client.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Servicio: {service.name}
              </p>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Detalles del cliente {client.name} para el servicio {service.name}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Status Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Estado del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <StatusIndicator 
                  status={client.status}
                  percentage={client.errorPercentage}
                />
                <Badge 
                  variant="outline"
                  className={cn(
                    client.status === "success" && "border-emerald-500 text-emerald-600",
                    client.status === "warning" && "border-amber-500 text-amber-600",
                    client.status === "error" && "border-red-500 text-red-600"
                  )}
                >
                  {client.status === "success" ? "Operativo" : client.status === "warning" ? "Con alertas" : "Con errores"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{clientData.totalTransactions.toLocaleString()}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                Exitosas
              </p>
              <p className="text-lg font-bold text-emerald-600">{clientData.successfulTransactions.toLocaleString()}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                Fallidas
              </p>
              <p className="text-lg font-bold text-red-600">{clientData.failedTransactions.toLocaleString()}</p>
            </Card>
          </div>



          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[120px]">
                <div className="space-y-2">
                  {recentActivity.map((activity) => (
                    <div 
                      key={activity.id}
                      className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        {activity.status === "success" ? (
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                        ) : activity.status === "error" ? (
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        ) : (
                          <Activity className="h-3 w-3 text-blue-500" />
                        )}
                        <span className={cn(
                          activity.status === "error" && "text-red-600"
                        )}>
                          {activity.action}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Resincronizar
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Mail className="h-4 w-4 mr-2" />
              Contactar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
