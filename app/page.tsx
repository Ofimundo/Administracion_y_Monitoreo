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
import { ClientsList } from "@/components/clients-list";
import { ClientDashboard } from "@/components/client-dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Service, Client } from "@/lib/services-data";
import {
  LayoutDashboard,
  Flame,
  Briefcase,
  Clock,
  Users,
  Terminal,
  UserCircle,
} from "lucide-react";

export default function HomePage() {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDashboard, setShowClientDashboard] = useState(false);

  // Función para manejar la selección de servicio desde el mapa de calor
  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    console.log("Servicio seleccionado:", service.name);
  };

  // Función para manejar la selección de cliente
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setShowClientDashboard(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="w-full">
          {/* TabsList responsivo con scroll horizontal e iconos */}
          <div className="relative mb-6">
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="inline-flex w-auto min-w-full md:min-w-0 h-auto p-1 bg-muted rounded-lg gap-1">
                <TabsTrigger 
                  value="dashboard" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm gap-2"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger 
                  value="heatmap" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm gap-2"
                >
                  <Flame className="h-4 w-4" />
                  Mapa de Calor
                </TabsTrigger>
                <TabsTrigger 
                  value="services" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm gap-2"
                >
                  <Briefcase className="h-4 w-4" />
                  Servicios
                </TabsTrigger>
                <TabsTrigger 
                  value="clients" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm gap-2"
                >
                  <Users className="h-4 w-4" />
                  Clientes
                </TabsTrigger>
                <TabsTrigger 
                  value="timeline" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Línea de Tiempo
                </TabsTrigger>
                <TabsTrigger 
                  value="comparison" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm gap-2"
                >
                  <UserCircle className="h-4 w-4" />
                  Comparador Clientes
                </TabsTrigger>
                <TabsTrigger 
                  value="command-center" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm gap-2"
                >
                  <Terminal className="h-4 w-4" />
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

          <TabsContent value="clients">
            <ClientsList onSelectClient={handleSelectClient} />
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
            <div className="bg-primary text-primary-foreground rounded-lg p-3 shadow-lg flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Servicio seleccionado:</p>
                <p className="text-xs">{selectedService.name}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Sistema de Administración y Monitoreo de Servicios &copy; 2026
        </div>
      </footer>

      {/* Modal del Dashboard del Cliente */}
      <Dialog open={showClientDashboard} onOpenChange={setShowClientDashboard}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Dashboard del Cliente
            </DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <ClientDashboard 
              clientId={selectedClient.id} 
              onClose={() => {
                setShowClientDashboard(false);
                setSelectedClient(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}