// app/page.tsx
"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { ServicesList } from "@/components/services-list";
import { DashboardMetrics } from "@/components/dashboard-metrics";
import { CommandCenter } from "@/components/command-center";
import { EventsTimeline } from "@/components/events-timeline";
import { ClientComparison } from "@/components/client-comparison";
import { HeatMap } from "@/components/heat-map";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Service } from "@/lib/services-data";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export default function HomePage() {
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Función para manejar la selección de servicio desde el mapa de calor
  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    console.log("Servicio seleccionado:", service.name);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="w-full">
          {/* TabsList responsivo con scroll horizontal */}
          <div className="relative mb-6">
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="inline-flex w-auto min-w-full md:min-w-0 h-auto p-1 bg-muted rounded-lg">
                <TabsTrigger 
                  value="dashboard" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm"
                >
                  Dashboard
                </TabsTrigger>
                <TabsTrigger 
                  value="heatmap" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm"
                >
                  Mapa de Calor
                </TabsTrigger>
                <TabsTrigger 
                  value="services" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm"
                >
                  Servicios
                </TabsTrigger>
                <TabsTrigger 
                  value="timeline" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm"
                >
                  Línea de Tiempo
                </TabsTrigger>
                <TabsTrigger 
                  value="comparison" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm"
                >
                  Comparador Clientes
                </TabsTrigger>
                <TabsTrigger 
                  value="command-center" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm"
                >
                  Centro Comandos
                </TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" className="h-1.5" />
            </ScrollArea>
          </div>

          <TabsContent value="dashboard">
            <DashboardMetrics />
          </TabsContent>

          <TabsContent value="heatmap">
            <HeatMap onSelectService={handleSelectService} />
          </TabsContent>

          <TabsContent value="services">
            <ServicesList />
          </TabsContent>

          <TabsContent value="timeline">
            <EventsTimeline onSelectService={handleSelectService} />
          </TabsContent>

          <TabsContent value="comparison">
            <ClientComparison />
          </TabsContent>

          <TabsContent value="command-center">
            <CommandCenter />
          </TabsContent>
        </Tabs>

        {/* Mostrar servicio seleccionado (opcional) */}
        {selectedService && (
          <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-primary text-primary-foreground rounded-lg p-3 shadow-lg">
              <p className="text-sm font-medium">Servicio seleccionado:</p>
              <p className="text-xs">{selectedService.name}</p>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Sistema de Administración y Monitoreo de Servicios &copy; 2026
        </div>
      </footer>
    </div>
  );
}