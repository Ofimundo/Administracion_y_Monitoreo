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
  type: "success" | "error" | "warning" | "info";
  details?: string;
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
  { id: "cl_ofimundo", name: "Ofimundo S.A.", rut: "76.452.910-K", email: "contacto@ofimundo.cl", phone: "+56 2 2840 9300", errorPercentage: 0, status: "success", services: ["facturas", "oficore", "ofitec", "sgc"] },
  { id: "cl1", name: "Empresa A", rut: "76.123.456-7", email: "contacto@empresaa.cl", phone: "+56 2 1234 5678", errorPercentage: 0, status: "success", services: [] },
  { id: "cl2", name: "Empresa B", rut: "77.234.567-8", email: "info@empresab.cl", phone: "+56 2 2345 6789", errorPercentage: 0, status: "success", services: [] },
  { id: "cl3", name: "Empresa C", rut: "78.345.678-9", email: "gerencia@empresac.cl", phone: "+56 2 3456 7890", errorPercentage: 0, status: "success", services: [] },
  { id: "cl4", name: "Banco Santander", rut: "79.456.789-0", email: "soporte@santander.cl", phone: "+56 2 4567 8901", errorPercentage: 0, status: "success", services: [] },
  { id: "cl5", name: "Banco Chile", rut: "80.567.890-1", email: "atencion@bancochile.cl", phone: "+56 2 5678 9012", errorPercentage: 0, status: "success", services: [] },
  { id: "cl6", name: "Recursos Humanos SA", rut: "81.678.901-2", email: "contacto@rrhhsa.cl", phone: "+56 2 6789 0123", errorPercentage: 0, status: "success", services: [] },
  { id: "cl8", name: "Banco Estado", rut: "82.789.012-3", email: "servicios@bancoestado.cl", phone: "+56 2 7890 1234", errorPercentage: 0, status: "success", services: [] },
  { id: "cl9", name: "Coopeuch", rut: "83.890.123-4", email: "atencion@coopeuch.cl", phone: "+56 2 8901 2345", errorPercentage: 0, status: "success", services: [] },
  { id: "cl10", name: "Servicio de Impuestos Internos", rut: "84.901.234-5", email: "sii@hacienda.cl", phone: "+56 2 9012 3456", errorPercentage: 0, status: "success", services: [] },
  { id: "cl12", name: "Auditores Asociados", rut: "85.012.345-6", email: "contacto@auditores.cl", phone: "+56 2 0123 4567", errorPercentage: 0, status: "success", services: [] },
  { id: "cl14", name: "Distribuidora Nacional", rut: "86.123.456-7", email: "ventas@distribuidora.cl", phone: "+56 2 1234 5678", errorPercentage: 0, status: "success", services: [] },
];

// Servicios que están próximamente (muestran mensaje especial)
const COMING_SOON_SERVICES = [
  "saldos",
  "finiquitos", 
  "cuentas",
  "dte",
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
    description: "🚀 Próximamente - Sistema de Documentos Tributarios Electrónicos que gestiona la emisión, recepción y almacenamiento de facturas, boletas y notas.",
    errorPercentage: 0,
    status: "success",
    clients: [],
    logs: [],
    isComingSoon: true,
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
];

// Variable mutable para los servicios (permite actualización dinámica)
let services: Service[] = [...baseServices];

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