"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusIndicator } from "@/components/status-indicator"
import type { Service } from "@/lib/services-data"
import { AlertCircle, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface ServiceCardProps {
  service: Service
  onViewErrors: (service: Service) => void
  onViewDetails?: (service: Service) => void
}

export function ServiceCard({ service, onViewErrors, onViewDetails }: ServiceCardProps) {
  const router = useRouter()

  const handleViewDetails = () => {
    router.push(`/servicio/${service.id}`)
  }
  return (
    <Card 
      className={cn(
        "transition-all hover:shadow-md cursor-pointer group",
        service.status === "error" && "border-error/50",
        service.status === "warning" && "border-warning/50"
      )}
      onDoubleClick={handleViewDetails}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-base font-semibold leading-tight group-hover:text-primary transition-colors">
            {service.name}
          </CardTitle>
          <StatusIndicator 
            status={service.status} 
            percentage={service.errorPercentage}
            size="sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
          {service.description}
        </p>
        
        <div className="flex items-center gap-2">
          {service.status !== "success" && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onViewErrors(service)
              }}
              className="text-error border-error/30 hover:bg-error/10 hover:text-error"
            >
              <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
              Ver errores
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleViewDetails()
            }}
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Ver detalle
          </Button>
        </div>
        
        <p className="mt-3 text-xs text-muted-foreground">
          Doble clic para ver el detalle del servicio
        </p>
      </CardContent>
    </Card>
  )
}
