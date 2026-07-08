// app/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { clients, services, type Service, type Client } from "@/lib/services-data";
import Image from "next/image";
import {
  LayoutDashboard,
  Flame,
  Briefcase,
  Clock,
  Users,
  Terminal,
  UserCircle,
  ArrowLeft,
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
  // ✅ CAMBIADO: Dashboard como pestaña activa por defecto
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
        // 1. Monitoreo de Facturas desde la Base de Datos
        let facturasErrPercent = 0;
        let facturasStatus = "success";
        try {
          const resFacturas = await fetch("/api/facturas/bitacora?estado=todos");
          const dataFacturas = await resFacturas.json();
          
          if (!isSubscribed || !mountedRef.current) return;
          
          if (dataFacturas.success && dataFacturas.data) {
            const totalDocs = dataFacturas.data.length;
            const technicalErrors = [
              "error de conexión", "timeout", "servidor no responde",
              "softland no disponible", "sii no responde", "connection failed",
              "failed to connect", "could not connect", "connection refused",
              "network error", "no se pudo conectar",
              "softland error", "sii error", "error de red"
            ];
            
            const errorDocs = dataFacturas.data.filter((e: any) => {
              const motivo = e.motivo || "";
              const motivoLower = motivo.toLowerCase();
              const hasTextError = technicalErrors.some(term => motivoLower.includes(term.toLowerCase()));
              if (hasTextError) return true;
              return ["500", "502", "503", "504"].some(code => new RegExp(`\\b${code}\\b`).test(motivoLower));
            }).length;
            
            facturasErrPercent = totalDocs > 0 ? Math.round((errorDocs / totalDocs) * 100) : 0;
            facturasStatus = errorDocs > 0 ? (facturasErrPercent > 40 ? "error" : "warning") : "success";
          } else {
            facturasErrPercent = 100;
            facturasStatus = "error";
          }
        } catch (err) {
          facturasErrPercent = 100;
          facturasStatus = "error";
        }
        
        const srvFacturas = services.find(s => s.id === "facturas");
        if (srvFacturas && mountedRef.current) {
          srvFacturas.errorPercentage = facturasErrPercent;
          srvFacturas.status = facturasStatus as any;
          if (srvFacturas.clients && srvFacturas.clients[0]) {
            srvFacturas.clients[0].errorPercentage = facturasErrPercent;
            srvFacturas.clients[0].status = facturasStatus as any;
          }
          if (facturasStatus === "error") {
            srvFacturas.logs = [
              { id: "err_bd", message: "Error crítico de base de datos o consulta de facturas fallida", timestamp: new Date().toISOString(), type: "error" },
              ...srvFacturas.logs.filter(l => l.id !== "err_bd")
            ];
          }
        }

        // 2. Monitoreo de OFICORE desde la Base de Datos
        let oficoreErrPercent = 0;
        let oficoreStatus = "success";
        try {
          const resOficore = await fetch("/api/oficore/stats");
          const dataOficore = await resOficore.json();
          if (!isSubscribed || !mountedRef.current) return;

          if (dataOficore.success) {
            oficoreStatus = "success";
            oficoreErrPercent = 0;
          } else {
            oficoreStatus = "error";
            oficoreErrPercent = 100;
            const srvOficore = services.find(s => s.id === "oficore");
            if (srvOficore) {
              srvOficore.logs = [
                { id: "err_oficore", message: `Error BD MDA: ${dataOficore.message || "Consulta fallida"}`, timestamp: new Date().toISOString(), type: "error" },
                ...srvOficore.logs.filter(l => l.id !== "err_oficore")
              ];
            }
          }
        } catch (errOfi) {
          oficoreStatus = "error";
          oficoreErrPercent = 100;
        }
        
        const srvOficore = services.find(s => s.id === "oficore");
        if (srvOficore && mountedRef.current) {
          srvOficore.status = oficoreStatus as any;
          srvOficore.errorPercentage = oficoreErrPercent;
          if (srvOficore.clients && srvOficore.clients[0]) {
            srvOficore.clients[0].errorPercentage = oficoreErrPercent;
            srvOficore.clients[0].status = oficoreStatus as any;
          }
        }

        // 3. Monitoreo de OFITEC desde la Base de Datos
        let ofitecErrPercent = 0;
        let ofitecStatus = "success";
        try {
          const resOfitec = await fetch("/api/ofitec/stats");
          const dataOfitec = await resOfitec.json();
          if (!isSubscribed || !mountedRef.current) return;

          if (dataOfitec.success) {
            ofitecStatus = "success";
            ofitecErrPercent = 0;
          } else {
            ofitecStatus = "error";
            ofitecErrPercent = 100;
            const srvOfitec = services.find(s => s.id === "ofitec");
            if (srvOfitec) {
              srvOfitec.logs = [
                { id: "err_ofitec", message: `Error BD OFITEC: ${dataOfitec.message || "Consulta fallida"}`, timestamp: new Date().toISOString(), type: "error" },
                ...srvOfitec.logs.filter(l => l.id !== "err_ofitec")
              ];
            }
          }
        } catch (errTec) {
          ofitecStatus = "error";
          ofitecErrPercent = 100;
        }
        
        const srvOfitec = services.find(s => s.id === "ofitec");
        if (srvOfitec && mountedRef.current) {
          srvOfitec.status = ofitecStatus as any;
          srvOfitec.errorPercentage = ofitecErrPercent;
          if (srvOfitec.clients && srvOfitec.clients[0]) {
            srvOfitec.clients[0].errorPercentage = ofitecErrPercent;
            srvOfitec.clients[0].status = ofitecStatus as any;
          }
        }

        // 4. Monitoreo de SGC desde la Base de Datos (captura errores de permisos reales)
        let sgcErrPercent = 0;
        let sgcStatus = "success";
        try {
          const resSgc = await fetch("/api/sgc/stats");
          const dataSgc = await resSgc.json();
          if (!isSubscribed || !mountedRef.current) return;

          if (dataSgc.success) {
            sgcStatus = "success";
            sgcErrPercent = 0;
          } else {
            sgcStatus = "error";
            sgcErrPercent = 100;
            const srvSgc = services.find(s => s.id === "sgc");
            if (srvSgc) {
              srvSgc.logs = [
                { id: "err_sgc", message: dataSgc.message || "Error al conectar con la base de datos SGC", timestamp: new Date().toISOString(), type: "error" },
                ...srvSgc.logs.filter(l => l.id !== "err_sgc")
              ];
            }
          }
        } catch (errSgc) {
          sgcStatus = "error";
          sgcErrPercent = 100;
        }
        
        const srvSgc = services.find(s => s.id === "sgc");
        if (srvSgc && mountedRef.current) {
          srvSgc.status = sgcStatus as any;
          srvSgc.errorPercentage = sgcErrPercent;
          if (srvSgc.clients && srvSgc.clients[0]) {
            srvSgc.clients[0].errorPercentage = sgcErrPercent;
            srvSgc.clients[0].status = sgcStatus as any;
          }
        }

        // Sincronizar estado global del cliente Ofimundo
        const globalClient = clients.find(c => c.id === "cl_ofimundo");
        if (globalClient && mountedRef.current) {
          const clientServices = [srvFacturas, srvOficore, srvOfitec, srvSgc];
          const hasError = clientServices.some(s => s && s.status === "error");
          const hasWarning = clientServices.some(s => s && s.status === "warning");
          
          globalClient.status = hasError ? "error" : (hasWarning ? "warning" : "success");
          globalClient.errorPercentage = hasError ? 100 : (hasWarning ? 15 : 0);
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

  // ✅ Configuración de tabs - Dashboard primero
  const tabsConfig = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, component: DashboardMetrics, hasServiceCallback: false, hasClientCallback: false },
    { id: "heatmap", label: "Mapa de Calor", icon: Flame, component: HeatMap, hasServiceCallback: true, hasClientCallback: false },
    { id: "services", label: "Servicios", icon: Briefcase, component: ServicesList, hasServiceCallback: false, hasClientCallback: false },
    { id: "clients", label: "Clientes", icon: Users, component: ClientsList, hasServiceCallback: false, hasClientCallback: true },
    { id: "timeline", label: "Línea de Tiempo", icon: Clock, component: EventsTimeline, hasServiceCallback: true, hasClientCallback: false },
    { id: "comparison", label: "Comparador Clientes", icon: UserCircle, component: ClientComparison, hasServiceCallback: false, hasClientCallback: false },
    { id: "command-center", label: "Centro Comandos", icon: Terminal, component: CommandCenter, hasServiceCallback: false, hasClientCallback: false },
  ];

  // Si se está mostrando el dashboard del cliente, renderizar solo eso
  if (showClientDashboard && selectedClient) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <Button 
            variant="ghost" 
            onClick={handleCloseClientDashboard} 
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al panel principal
          </Button>
          <ClientDashboard 
            key={selectedClient.id}
            clientId={selectedClient.id} 
            onClose={handleCloseClientDashboard}
          />
        </main>
        <footer className="border-t border-border mt-8 py-4">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            Sistema de Administración y Monitoreo de Servicios &copy; 2026
          </div>
        </footer>
      </div>
    );
  }

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
                  if (tab.id === "dashboard") {
                    props.onNavigateToServices = () => setActiveTab("services");
                    props.onNavigateToTimeline = () => setActiveTab("timeline");
                    props.onNavigateToHeatMap = () => setActiveTab("heatmap");
                    props.onNavigateToClients = () => setActiveTab("clients");
                  }
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
  <div className="container mx-auto px-4">
    <div className="flex items-center justify-center gap-4">
      <Image
        src="/logo.png"
        alt="Ofilab"
        width={160}
        height={50}
        className="h-12 w-auto object-contain"
        priority={false}
      />
      <span className="text-sm text-muted-foreground">
        Sistema de Administración y Monitoreo de Servicios &copy; 2026
      </span>
    </div>
  </div>
</footer>
    </div>
  );
}