// app/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Header } from "@/components/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { clients, services, type Service, type Client } from "@/lib/services-data";
import {
  LayoutDashboard,
  Flame,
  Briefcase,
  Clock,
  Users,
  Terminal,
  UserCircle,
} from "lucide-react";

// Lazy load components
const DashboardMetrics = lazy(() => import("@/components/dashboard-metrics").then(mod => ({ default: mod.DashboardMetrics })));
const ServicesList = lazy(() => import("@/components/services-list").then(mod => ({ default: mod.ServicesList })));
const HeatMap = lazy(() => import("@/components/heat-map").then(mod => ({ default: mod.HeatMap })));
const ClientsList = lazy(() => import("@/components/clients-list").then(mod => ({ default: mod.ClientsList })));
const EventsTimeline = lazy(() => import("@/components/events-timeline").then(mod => ({ default: mod.EventsTimeline })));
const ClientComparison = lazy(() => import("@/components/client-comparison").then(mod => ({ default: mod.ClientComparison })));
const CommandCenter = lazy(() => import("@/components/command-center").then(mod => ({ default: mod.CommandCenter })));
const ClientDashboard = lazy(() => import("@/components/client-dashboard").then(mod => ({ default: mod.ClientDashboard })));

// Loading fallback
const TabLoadingFallback = () => (
  <div className="space-y-4">
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

export default function HomePage() {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDashboard, setShowClientDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isInitialized, setIsInitialized] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setIsInitialized(true);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync real data from backend
  useEffect(() => {
    if (!isInitialized) return;

    let isSubscribed = true;
    let intervalId: NodeJS.Timeout;

    const syncData = async () => {
      try {
        const res = await fetch("/api/facturas/bitacora?estado=todos");
        const data = await res.json();
        
        if (!isSubscribed || !mountedRef.current) return;
        
        if (data.success && data.data) {
          const totalDocs = data.data.length;
          
          const technicalErrors = [
            "error de conexión", "timeout", "servidor no responde",
            "softland no disponible", "sii no responde", "connection failed",
            "failed to connect", "could not connect", "connection refused",
            "network error", "500", "503", "no se pudo conectar",
            "softland error", "sii error", "error de red"
          ];
          
          const errorDocs = data.data.filter((e: any) => {
            const motivo = e.motivo || "";
            return technicalErrors.some(term => motivo.toLowerCase().includes(term.toLowerCase()));
          }).length;
          
          const errPercent = totalDocs > 0 ? Math.round((errorDocs / totalDocs) * 100) : 0;
          const status = errorDocs > 0 ? (errPercent > 40 ? "error" : "warning") : "success";
          
          const globalClient = clients.find(c => c.id === "cl_ofimundo");
          if (globalClient && mountedRef.current) {
            globalClient.errorPercentage = errPercent;
            globalClient.status = status as any;
          }
          
          const globalService = services.find(s => s.id === "facturas");
          if (globalService && mountedRef.current) {
            globalService.errorPercentage = errPercent;
            globalService.status = status as any;
            if (globalService.clients && globalService.clients[0]) {
              globalService.clients[0].errorPercentage = errPercent;
              globalService.clients[0].status = status as any;
            }
          }
        }
      } catch (err) {
        console.error("Error syncing data:", err);
      }
    };

    syncData();
    intervalId = setInterval(syncData, 30000);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [isInitialized]);

  const handleSelectService = useCallback((service: Service) => {
    setSelectedService(service);
    setTimeout(() => {
      if (mountedRef.current) {
        setSelectedService(prev => prev?.id === service.id ? null : prev);
      }
    }, 3000);
  }, []);

  const handleSelectClient = useCallback((client: Client) => {
    setSelectedClient(client);
    setShowClientDashboard(true);
  }, []);

  const handleCloseClientDashboard = useCallback(() => {
    setShowClientDashboard(false);
    setSelectedClient(null);
  }, []);

  const tabsConfig = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, component: DashboardMetrics, hasServiceCallback: false, hasClientCallback: false },
    { id: "heatmap", label: "Mapa de Calor", icon: Flame, component: HeatMap, hasServiceCallback: true, hasClientCallback: false },
    { id: "services", label: "Servicios", icon: Briefcase, component: ServicesList, hasServiceCallback: false, hasClientCallback: false },
    { id: "clients", label: "Clientes", icon: Users, component: ClientsList, hasServiceCallback: false, hasClientCallback: true },
    { id: "timeline", label: "Línea de Tiempo", icon: Clock, component: EventsTimeline, hasServiceCallback: true, hasClientCallback: false },
    { id: "comparison", label: "Comparador Clientes", icon: UserCircle, component: ClientComparison, hasServiceCallback: false, hasClientCallback: false },
    { id: "command-center", label: "Centro Comandos", icon: Terminal, component: CommandCenter, hasServiceCallback: false, hasClientCallback: false },
  ];

  if (!isInitialized) {
    return <TabLoadingFallback />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="relative mb-6">
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="inline-flex w-auto min-w-full md:min-w-0 h-auto p-1 bg-muted rounded-lg gap-1">
                {tabsConfig.map((tab) => (
                  <TabsTrigger 
                    key={tab.id}
                    value={tab.id} 
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm gap-2"
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" className="h-1.5" />
            </ScrollArea>
          </div>

          {tabsConfig.map((tab) => (
            <TabsContent key={`tab-${tab.id}`} value={tab.id}>
              <Suspense fallback={<TabLoadingFallback />}>
                {activeTab === tab.id && (() => {
                  const props: any = {};
                  if (tab.hasServiceCallback) props.onSelectService = handleSelectService;
                  if (tab.hasClientCallback) props.onSelectClient = handleSelectClient;
                  return <tab.component {...props} />;
                })()}
              </Suspense>
            </TabsContent>
          ))}
        </Tabs>

        {/* Service selection indicator */}
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

      {/* Client Dashboard Modal */}
      <Dialog open={showClientDashboard} onOpenChange={handleCloseClientDashboard}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Dashboard del Cliente - {selectedClient?.name || ""}
            </DialogTitle>
          </DialogHeader>
          {selectedClient && showClientDashboard && (
            <ClientDashboard 
              key={selectedClient.id}
              clientId={selectedClient.id} 
              onClose={handleCloseClientDashboard}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}