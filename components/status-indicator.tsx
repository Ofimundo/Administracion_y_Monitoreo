"use client"

import { cn } from "@/lib/utils"
import type { ServiceStatus } from "@/lib/services-data"

interface StatusIndicatorProps {
  status: ServiceStatus
  percentage: number
  showPercentage?: boolean
  size?: "sm" | "md" | "lg"
}

export function StatusIndicator({ 
  status, 
  percentage, 
  showPercentage = true,
  size = "md" 
}: StatusIndicatorProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "rounded-full",
          sizeClasses[size],
          status === "success" && "bg-success",
          status === "warning" && "bg-warning",
          status === "error" && "bg-error"
        )}
      />
      {showPercentage && (
        <span 
          className={cn(
            "font-medium",
            textSizeClasses[size],
            status === "success" && "text-success",
            status === "warning" && "text-warning-foreground",
            status === "error" && "text-error"
          )}
        >
          {percentage}% de errores
        </span>
      )}
    </div>
  )
}
