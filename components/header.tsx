"use client"

import { Activity } from "lucide-react"
import Image from "next/image"

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
      
      <div className="relative px-2 py-1.5 md:px-3 md:py-1.5">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            {/* Título y subtítulo a la izquierda */}
            <div className="flex-1 min-w-0 pr-4">
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl text-balance">
                Administración y Monitoreo de Servicios
              </h1>
              <p className="mt-0.5 text-xs text-white/80 md:text-sm">
                Panel de control para monitorear el estado de los servicios automatizados
              </p>
            </div>
            
            {/* Logo a la derecha - MÁS AL BORDE */}
            <div className="flex-shrink-0">
              <Image
                src="/ofilab_blanco.png"
                alt="Ofilab"
                width={260}
                height={75}
                className="w-[260px] h-auto object-contain"
                priority
                unoptimized
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}