"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react"

export function StatusLegend() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Leyenda de Estados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success">
            <CheckCircle className="h-4 w-4 text-success-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Funciona al 100%</p>
            <p className="text-xs text-muted-foreground">Sin ningún error</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No funciona al 100%</p>
            <p className="text-xs text-muted-foreground">Tiene como mínimo 1 o 2 errores</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-error">
            <XCircle className="h-4 w-4 text-error-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No funciona al 100%</p>
            <p className="text-xs text-muted-foreground">Tiene varios errores que impiden que funcione</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
