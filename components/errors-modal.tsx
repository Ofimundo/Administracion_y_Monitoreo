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
import type { Service } from "@/lib/services-data"
import { AlertTriangle, XCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface ErrorsModalProps {
  service: Service | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ErrorsModal({ service, open, onOpenChange }: ErrorsModalProps) {
  if (!service) return null

  const errorLogs = service.logs.filter(log => log.type === "error" || log.type === "warning")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-error" />
            <DialogTitle>Errores - {service.name}</DialogTitle>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <StatusIndicator 
              status={service.status} 
              percentage={service.errorPercentage}
            />
          </div>
          <DialogDescription className="sr-only">
            Lista de errores del servicio {service.name}
          </DialogDescription>
        </DialogHeader>

        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-error" />
                Registro de errores
              </span>
              <Badge variant="secondary" className="bg-error/10 text-error">
                {errorLogs.length} {errorLogs.length === 1 ? "error" : "errores"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errorLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay errores registrados
              </p>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {errorLogs.map((log) => (
                    <div 
                      key={log.id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3",
                        log.type === "error" && "border-error/30 bg-error/5",
                        log.type === "warning" && "border-warning/30 bg-warning/5"
                      )}
                    >
                      {log.type === "error" ? (
                        <XCircle className="h-4 w-4 text-error shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{log.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {log.timestamp}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
