"use client"

import { Activity } from "lucide-react"

export function Header() {
  return (
    <header className="relative overflow-hidden">
      {/* Gradient background matching corporate colors */}
      <div 
        className="absolute inset-0 rounded-b-3xl"
        style={{
          background: "linear-gradient(to right, oklch(0.55 0.25 330), oklch(0.5 0.2 300))",
        }}
      />
      
      <div className="relative px-6 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Activity className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl text-balance">
                Administración y Monitoreo de Servicios
              </h1>
              <p className="mt-1 text-sm text-white/80">
                Panel de control para monitorear el estado de los servicios automatizados
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
