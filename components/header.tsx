"use client"

import Image from "next/image"

export function Header() {
  return (
    <header className="relative overflow-hidden w-full">
      {/* Gradient background matching corporate colors */}
      <div 
        className="absolute inset-0 rounded-b-xl sm:rounded-b-2xl"
        style={{
          background: "linear-gradient(to right, oklch(0.55 0.25 330), oklch(0.5 0.2 300))",
        }}
      />
      
      <div className="relative px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 md:py-2">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            {/* Título y subtítulo a la izquierda */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white text-balance">
                Administración y Monitoreo de Servicios
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-white/80">
                Panel de control para monitorear el estado de los servicios automatizados
              </p>
            </div>
            
            {/* Logo a la derecha - Adaptable a móvil y escritorio */}
            <div className="flex-shrink-0">
              <Image
                src="/ofilab_blanco.png"
                alt="Ofilab"
                width={260}
                height={75}
                className="w-[160px] sm:w-[200px] md:w-[260px] h-auto object-contain"
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