"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusIndicator } from "@/components/status-indicator"
import type { Service, Client } from "@/lib/services-data"
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Users, 
  FileText,
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ServiceDetailModalProps {
  service: Service | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onViewClientDetail?: (service: Service, client: Client) => void
}

export function ServiceDetailModal({ 
  service, 
  open, 
  onOpenChange,
  onViewClientDetail 
}: ServiceDetailModalProps) {
  if (!service) return null

  const getLogIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-success" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning-foreground" />
      case "error":
        return <XCircle className="h-4 w-4 text-error" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{service.name}</DialogTitle>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <StatusIndicator 
              status={service.status} 
              percentage={service.errorPercentage}
            />
          </div>
          <DialogDescription className="sr-only">
            Detalles del servicio {service.name}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="logs" className="mt-4 flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="logs">
              <Clock className="mr-2 h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="description">
              <FileText className="mr-2 h-4 w-4" />
              Descripción
            </TabsTrigger>
            <TabsTrigger value="clients">
              <Users className="mr-2 h-4 w-4" />
              Clientes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="mt-4 flex-1 overflow-hidden">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {service.status === "success" ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-success" />
                      No hay errores
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-error" />
                      Registro de actividad
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {service.logs.map((log) => (
                      <div 
                        key={log.id}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3",
                          log.type === "error" && "border-error/30 bg-error/5",
                          log.type === "warning" && "border-warning/30 bg-warning/5",
                          log.type === "success" && "border-success/30 bg-success/5",
                          log.type === "info" && "border-border"
                        )}
                      >
                        {getLogIcon(log.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{log.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {log.timestamp}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="description" className="mt-4 flex-1 overflow-auto">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Descripción del servicio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {service.description}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients" className="mt-4 flex-1 overflow-hidden">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-sm font-medium">
                  Clientes con este servicio ({service.clients.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {service.clients.map((client) => (
                      <div 
                        key={client.id}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <StatusIndicator 
                            status={client.status}
                            percentage={client.errorPercentage}
                            showPercentage={false}
                            size="sm"
                          />
                          <span className="font-medium text-sm">{client.name}</span>
                          {client.errorPercentage > 0 && (
                            <Badge 
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                client.status === "error" && "bg-error/10 text-error",
                                client.status === "warning" && "bg-warning/30 text-warning-foreground"
                              )}
                            >
                              {client.errorPercentage}% errores
                            </Badge>
                          )}
                        </div>
                        
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
