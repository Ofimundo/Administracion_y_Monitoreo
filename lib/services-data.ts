// app/lib/services-data.ts
export interface Service {
  id: string;
  name: string;
  description: string;
  errorPercentage: number;
  status: "success" | "warning" | "error";
  clients: Client[];
  logs: Log[];
  isComingSoon?: boolean; // Nueva propiedad para indicar si está próximo
}

export interface Client {
  id: string;
  name: string;
  rut?: string;
  email?: string;
  phone?: string;
  errorPercentage: number;
  status: "success" | "warning" | "error";
  services?: string[]; // IDs de servicios contratados
}

export interface Log {
  id: string;
  message: string;
  timestamp: string;
  type: "success" | "error" | "warning" | "info" | "comingSoon";
  details?: string;
  estado?: string;
}

export type ServiceStatus = "success" | "warning" | "error";
export type LogEntry = Log;

export interface MetricDataPoint {
  id: string;
  timestamp: string;
  date: Date;
  successCount: number;
  errorCount: number;
  responseTime: number;
  throughput: number;
  serviceName: string;
  endpoint: string;
  reglaNegocioCount?: number;
}

// Clientes globales (para poder ver sus servicios contratados)
export const clients: Client[] = [
  { id: "cl_ofimundo", name: "Ofimundo S.A.", rut: "76.452.910-K", email: "contacto@ofimundo.cl", phone: "+56 2 2840 9300", errorPercentage: 0, status: "success", services: ["facturas", "oficore", "ofitec", "sgc", "dte", "mi-cuenta"] },
];

// Servicios que están próximamente (muestran mensaje especial)
const COMING_SOON_SERVICES = [
  "saldos",
  "finiquitos", 
  "cuentas",
  "contabilizacion",
  "notas-credito"
];

// Datos base de servicios
const baseServices: Service[] = [
  {
    id: "facturas",
    name: "Aceptación y Rechazo de Facturas",
    description: "El proyecto tiene como objetivo automatizar el flujo de aceptación y rechazo de facturas electrónicas registradas en el sistema, permitiendo una gestión eficiente y reduciendo la intervención manual.",
    errorPercentage: 0,
    status: "success",
    clients: [
      { id: "cl_ofimundo", name: "Ofimundo S.A.", errorPercentage: 0, status: "success" },
    ],
    logs: [
      { id: "1", message: "Servicio inicializado correctamente", timestamp: new Date().toISOString(), type: "success" },
      { id: "2", message: "Procesamiento de facturas completado", timestamp: new Date().toISOString(), type: "success" },
    ],
    isComingSoon: false,
  },
  {
    id: "saldos",
    name: "Saldos Bancarios",
    description: "🚀 Próximamente - Sistema automatizado para la consulta y consolidación de saldos bancarios de múltiples instituciones financieras.",
    errorPercentage: 0,
    status: "success",
    clients: [],
    logs: [],
    isComingSoon: true,
  },
  {
    id: "finiquitos",
    name: "Finiquitos",
    description: "🚀 Próximamente - Gestión automatizada del proceso de finiquitos laborales, incluyendo cálculo de indemnizaciones y generación de documentos legales.",
    errorPercentage: 0,
    status: "success",
    clients: [],
    logs: [],
    isComingSoon: true,
  },
  {
    id: "cuentas",
    name: "Cuentas Básicas",
    description: "🚀 Próximamente - Sistema de gestión de cuentas básicas bancarias que permite la apertura, modificación y cierre de cuentas de manera automatizada.",
    errorPercentage: 0,
    status: "success",
    clients: [],
    logs: [],
    isComingSoon: true,
  },
  {
    id: "dte",
    name: "DTE",
    description: "Sistema de Documentos Tributarios Electrónicos (DTE) que monitorea las ejecuciones del bot de facturas, boletas y notas de crédito en SII y Softland.",
    errorPercentage: 0,
    status: "success",
    clients: [
      { id: "cl_ofimundo", name: "Ofimundo S.A.", errorPercentage: 0, status: "success" },
    ],
    logs: [],
    isComingSoon: false,
  },
  {
    id: "contabilizacion",
    name: "Contabilización",
    description: "🚀 Próximamente - Automatización del proceso de contabilización de documentos tributarios, incluyendo asientos contables y cuadratura de cuentas.",
    errorPercentage: 0,
    status: "success",
    clients: [],
    logs: [],
    isComingSoon: true,
  },
  {
    id: "notas-credito",
    name: "Notas de Crédito",
    description: "🚀 Próximamente - Sistema automatizado para la emisión y gestión de notas de crédito electrónicas.",
    errorPercentage: 0,
    status: "success",
    clients: [],
    logs: [],
    isComingSoon: true,
  },
  {
    id: "oficore",
    name: "OFICORE",
    description: "Servicio de consulta e información sobre incidencias, tickets ingresados, tickets resueltos y técnicos resolutores de la plataforma OFICORE.",
    errorPercentage: 0,
    status: "success",
    clients: [
      { id: "cl_ofimundo", name: "Ofimundo S.A.", errorPercentage: 0, status: "success" },
    ],
    logs: [],
    isComingSoon: false,
  },
  {
    id: "ofitec",
    name: "OFITEC",
    description: "Monitoreo y consulta de llamadas de servicio técnico en terreno, incluyendo tickets ingresados, resueltos y asignación de técnicos.",
    errorPercentage: 0,
    status: "success",
    clients: [
      { id: "cl_ofimundo", name: "Ofimundo S.A.", errorPercentage: 0, status: "success" },
    ],
    logs: [],
    isComingSoon: false,
  },
  {
    id: "sgc",
    name: "SGC",
    description: "Control de gestión y visualización de documentos y ventas de tipo Picking y OD, origen SGC y Softland.",
    errorPercentage: 0,
    status: "success",
    clients: [
      { id: "cl_ofimundo", name: "Ofimundo S.A.", errorPercentage: 0, status: "success" },
    ],
    logs: [],
    isComingSoon: false,
  },
  {
    id: "mi-cuenta",
    name: "Portal Mi Cuenta",
    description: "Portal de autoservicio de clientes para la gestión de solicitudes, pedidos de suministros de impresoras y equipos, generación de tickets y seguimiento de peticiones por cliente.",
    errorPercentage: 0,
    status: "success",
    clients: [
      { id: "cl_ofimundo", name: "Ofimundo S.A.", errorPercentage: 0, status: "success" },
    ],
    logs: [],
    isComingSoon: false,
  },
];

// Variable mutable para los servicios (permite actualización dinámica)
let services: Service[] = [...baseServices];

// Sistema de Suscripción para Reactividad
type DataListener = () => void;
const listeners = new Set<DataListener>();

export function subscribeToData(listener: DataListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyListeners(): void {
  listeners.forEach(listener => {
    try {
      listener();
    } catch (e) {
      console.error("Error in data listener:", e);
    }
  });
}

// Función para actualizar un servicio con datos reales
export function updateServiceStatus(serviceId: string, errorPercentage: number, status: "success" | "warning" | "error", logs?: Log[]) {
  const serviceIndex = services.findIndex(s => s.id === serviceId);
  if (serviceIndex !== -1 && !services[serviceIndex].isComingSoon) {
    services[serviceIndex] = {
      ...services[serviceIndex],
      status,
      errorPercentage,
      clients: services[serviceIndex].clients.map(client => ({
        ...client,
        errorPercentage,
        status,
      })),
      logs: logs || services[serviceIndex].logs,
    };
    
    // También actualizar el cliente global correspondiente
    const clientIndex = clients.findIndex(c => c.id === "cl_ofimundo");
    if (clientIndex !== -1 && serviceId === "facturas") {
      clients[clientIndex] = {
        ...clients[clientIndex],
        errorPercentage,
        status,
      };
    }
    notifyListeners();
  }
}

// Función para obtener los servicios (versión reactiva)
export function getServices(): Service[] {
  return [...services];
}

// Función para obtener un servicio por ID
export function getServiceById(serviceId: string): Service | undefined {
  return services.find(s => s.id === serviceId);
}

// Función para actualizar logs de un servicio
export function updateServiceLogs(serviceId: string, logs: Log[]) {
  const serviceIndex = services.findIndex(s => s.id === serviceId);
  if (serviceIndex !== -1 && !services[serviceIndex].isComingSoon) {
    services[serviceIndex] = {
      ...services[serviceIndex],
      logs: [...logs, ...services[serviceIndex].logs].slice(0, 100),
    };
    notifyListeners();
  }
}

// Exportar servicios como getter para mantener compatibilidad con código existente
export { services };

// Función para obtener servicios de un cliente
export const getClientServices = (clientId: string): Service[] => {
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.services) return [];
  return services.filter(service => client.services?.includes(service.id) && !service.isComingSoon);
};

// Función para obtener cliente por ID con datos completos
export const getClientById = (clientId: string): Client | undefined => {
  return clients.find(c => c.id === clientId);
};

// Función para resetear servicios a estado base (útil para recarga)
export const resetServicesToBase = () => {
  services = [...baseServices];
  notifyListeners();
};


// Generar datos de métricas para el dashboard basados en los servicios reales
export const generateMetricsData = (): MetricDataPoint[] => {
  const data: MetricDataPoint[] = [];
  const now = new Date();
  
  const serviceEndpoints: Record<string, string[]> = {
    "Aceptación y Rechazo de Facturas": ["/api/facturas/aceptar", "/api/facturas/rechazar", "/api/facturas/estado"],
    "Saldos Bancarios": ["/api/saldos/consultar", "/api/saldos/consolidar", "/api/saldos/reporte"],
    "Finiquitos": ["/api/finiquitos/calcular", "/api/finiquitos/generar", "/api/finiquitos/firmar"],
    "Cuentas Básicas": ["/api/cuentas/apertura", "/api/cuentas/modificar", "/api/cuentas/cerrar"],
    "DTE": ["/api/dte/emitir", "/api/dte/recepcionar", "/api/dte/almacenar"],
    "Contabilización": ["/api/contabilidad/asientos", "/api/contabilidad/cuadratura", "/api/contabilidad/informes"],
    "Notas de Crédito": ["/api/notas/emitir", "/api/notas/anular", "/api/notas/estado"],
  };
  
  // Solo generar métricas para servicios activos (no coming soon)
  const activeServices = services.filter(s => !s.isComingSoon);
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    for (const service of activeServices) {
      const endpoints = serviceEndpoints[service.name] || ["/api/endpoint"];
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const errorRate = service.errorPercentage / 100;
      
      const totalRequests = 800 + Math.floor(Math.random() * 400);
      const errorCount = Math.floor(totalRequests * (errorRate + (Math.random() * 0.05 - 0.025)));
      const successCount = totalRequests - errorCount;
      
      let responseTime = 100;
      if (service.name.includes("DTE")) responseTime = 800 + Math.random() * 400;
      else if (service.name.includes("Cuentas")) responseTime = 300 + Math.random() * 200;
      else responseTime = 100 + Math.random() * 150;
      
      data.push({
        id: `${service.name}-${date.toISOString()}`,
        timestamp: date.toISOString(),
        date,
        successCount,
        errorCount,
        responseTime: Math.floor(responseTime),
        throughput: Math.floor(50 + Math.random() * 150),
        serviceName: service.name,
        endpoint,
      });
    }
  }
  
  return data;
};

// Función para verificar si un servicio está próximo
export const isServiceComingSoon = (serviceId: string): boolean => {
  const service = services.find(s => s.id === serviceId);
  return service?.isComingSoon || false;
};

// Mapeo de códigos de base de datos a IDs del frontend
const serviceIdMap: Record<string, string> = {
  "ACRF_01": "facturas",
  "DTE_01": "dte",
  "OFI_01": "oficore",
  "SGC_01": "sgc",
  "OFT_01": "ofitec",
  "MIC_01": "mi-cuenta"
};

// Variables mutables para prospectos y proyectos
export let prospectos: any[] = [];
export let proyectos: any[] = [];

// Inicializar dinámicamente los clientes y servicios desde la base de datos
export async function initializeDatabaseData(): Promise<boolean> {
  try {
    const [res, resProspectos, resProyectos] = await Promise.all([
      fetch("/api/mon/services-data"),
      fetch("/api/mon/fichas-prospecto"),
      fetch("/api/mon/proyectos")
    ]);
    
    const data = await res.json();
    const dataProspectos = await resProspectos.json();
    const dataProyectos = await resProyectos.json();
    
    if (dataProspectos.success && dataProspectos.data) {
      prospectos.length = 0;
      const normalized = dataProspectos.data.map((f: any) => ({
        id: f.Id !== undefined ? f.Id : f.id,
        codigo: f.Codigo !== undefined ? f.Codigo : f.codigo,
        nombreProyecto: f.NombreProyecto !== undefined ? f.NombreProyecto : f.nombreProyecto,
        estado: f.Estado !== undefined ? f.Estado : f.estado,
        cliente: f.Cliente !== undefined ? f.Cliente : f.cliente,
        gestorComercial: f.GestorComercial !== undefined ? f.GestorComercial : f.gestorComercial,
        valorServicio: f.ValorServicio !== undefined ? f.ValorServicio : (f.valorServicio || 0),
        lineaServicio: f.LineaServicio !== undefined ? f.LineaServicio : (f.lineaServicio || 'ACRF_01')
      }));
      prospectos.push(...normalized);
    }
    
    if (dataProyectos.success && dataProyectos.data) {
      proyectos.length = 0;
      const normalized = dataProyectos.data.map((p: any) => ({
        id: p.Id !== undefined ? p.Id : p.id,
        codigo: p.Codigo !== undefined ? p.Codigo : p.codigo,
        nombreProyecto: p.NombreProyecto !== undefined ? p.NombreProyecto : p.nombreProyecto,
        cliente: p.Cliente !== undefined ? p.Cliente : p.cliente,
        lider: p.Lider !== undefined ? p.Lider : p.lider,
        estado: p.Estado !== undefined ? p.Estado : p.estado,
        avance: p.Avance !== undefined ? p.Avance : p.avance,
        venta: p.Venta !== undefined ? p.Venta : p.venta,
        hhPlanificadas: p.HHPlanificadas !== undefined ? p.HHPlanificadas : p.hhPlanificadas,
        hhReal: p.HHReal !== undefined ? p.HHReal : p.hhReal,
        fechaInicio: p.FechaInicio !== undefined ? p.FechaInicio : p.fechaInicio,
        fechaFin: p.FechaFin !== undefined ? p.FechaFin : p.fechaFin,
        descripcion: p.Descripcion !== undefined ? p.Descripcion : p.descripcion
      }));
      proyectos.push(...normalized);
    }

    if (data.success && data.clientes && data.servicios && data.relaciones) {
      // 1. Mapear servicios de base de datos
      const dbServices: Service[] = data.servicios.map((s: any) => {
        const mappedId = serviceIdMap[s.Codigo_Servicio] || s.Codigo_Servicio.toLowerCase();
        
        // Buscar definición de servicio base para heredar propiedades visuales
        const existing = baseServices.find(b => b.id === mappedId);
        
        return {
          id: mappedId,
          name: s.Nombre_Servicio,
          description: s.Descripcion || existing?.description || "",
          errorPercentage: 0,
          status: "success",
          clients: [],
          logs: existing?.logs || [],
          isComingSoon: false
        };
      });

      // 2. Mapear clientes de base de datos
      const dbClients: Client[] = data.clientes.map((c: any) => {
        return {
          id: `client_${c.Cliente_ID}`,
          name: c.Nombre_cliente || `Cliente ${c.Codigo_Cliente}`,
          rut: c.Rut_Cliente,
          email: c.Usuario_Creacion || `contacto@${(c.Nombre_cliente || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'cliente'}.cl`,
          phone: "+56 2 2840 9300",
          errorPercentage: 0,
          status: "success",
          services: []
        };
      });

      // 3. Establecer relaciones de asignación
      data.relaciones.forEach((r: any) => {
        const client = dbClients.find(c => c.id === `client_${r.Cliente_ID}`);
        const dbSrv = data.servicios.find((s: any) => s.Servicio_ID === r.Servicio_ID);
        if (client && dbSrv) {
          const mappedServiceId = serviceIdMap[dbSrv.Codigo_Servicio] || dbSrv.Codigo_Servicio.toLowerCase();
          
          // Asociar servicio al cliente
          if (client.services && !client.services.includes(mappedServiceId)) {
            client.services.push(mappedServiceId);
          }
          
          // Asociar cliente al servicio
          const service = dbServices.find(s => s.id === mappedServiceId);
          if (service) {
            if (!service.clients) service.clients = [];
            if (!service.clients.some(cl => cl.id === client.id)) {
              service.clients.push({
                id: client.id,
                name: client.name,
                errorPercentage: 0,
                status: "success"
              });
            }
          }
        }
      });

      // 4. Actualizar arreglos exportados in-place para conservar las referencias importadas
      clients.length = 0;
      clients.push(...dbClients);

      const comingSoonSrvs = baseServices.filter(s => s.isComingSoon);
      services.length = 0;
      services.push(...dbServices, ...comingSoonSrvs);

      console.log(`✅ Creados y cargados dinámicamente ${clients.length} clientes y ${services.length} servicios.`);
      notifyListeners();
      return true;
    }
  } catch (error) {
    console.error("❌ Error al inicializar datos de monitoreo:", error);
  }
  return false;
}