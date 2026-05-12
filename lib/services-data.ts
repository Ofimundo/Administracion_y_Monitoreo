// app/lib/services-data.ts
export interface Service {
  id: string;
  name: string;
  description: string;
  errorPercentage: number;
  status: "success" | "warning" | "error";
  clients: Client[];
  logs: Log[];
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
}

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
}

// Clientes globales (para poder ver sus servicios contratados)
export const clients: Client[] = [
  { id: "cl1", name: "Empresa A", rut: "76.123.456-7", email: "contacto@empresaa.cl", phone: "+56 2 1234 5678", errorPercentage: 0, status: "success", services: ["facturas", "saldos"] },
  { id: "cl2", name: "Empresa B", rut: "77.234.567-8", email: "info@empresab.cl", phone: "+56 2 2345 6789", errorPercentage: 0, status: "success", services: ["facturas"] },
  { id: "cl3", name: "Empresa C", rut: "78.345.678-9", email: "gerencia@empresac.cl", phone: "+56 2 3456 7890", errorPercentage: 0, status: "success", services: ["facturas", "finiquitos"] },
  { id: "cl4", name: "Banco Santander", rut: "79.456.789-0", email: "soporte@santander.cl", phone: "+56 2 4567 8901", errorPercentage: 0, status: "success", services: ["saldos"] },
  { id: "cl5", name: "Banco Chile", rut: "80.567.890-1", email: "atencion@bancochile.cl", phone: "+56 2 5678 9012", errorPercentage: 0, status: "success", services: ["saldos"] },
  { id: "cl6", name: "Recursos Humanos SA", rut: "81.678.901-2", email: "contacto@rrhhsa.cl", phone: "+56 2 6789 0123", errorPercentage: 0, status: "success", services: ["finiquitos"] },
  { id: "cl8", name: "Banco Estado", rut: "82.789.012-3", email: "servicios@bancoestado.cl", phone: "+56 2 7890 1234", errorPercentage: 2, status: "warning", services: ["cuentas"] },
  { id: "cl9", name: "Coopeuch", rut: "83.890.123-4", email: "atencion@coopeuch.cl", phone: "+56 2 8901 2345", errorPercentage: 1, status: "success", services: ["cuentas"] },
  { id: "cl10", name: "Servicio de Impuestos Internos", rut: "84.901.234-5", email: "sii@hacienda.cl", phone: "+56 2 9012 3456", errorPercentage: 85, status: "error", services: ["dte"] },
  { id: "cl12", name: "Auditores Asociados", rut: "85.012.345-6", email: "contacto@auditores.cl", phone: "+56 2 0123 4567", errorPercentage: 2, status: "warning", services: ["contabilizacion"] },
  { id: "cl14", name: "Distribuidora Nacional", rut: "86.123.456-7", email: "ventas@distribuidora.cl", phone: "+56 2 1234 5678", errorPercentage: 0, status: "success", services: ["notas-credito"] },
];

// SERVICIOS EXACTOS DE LA IMAGEN
export const services: Service[] = [
  {
    id: "facturas",
    name: "Aceptación y Rechazo de Facturas",
    description: "El proyecto tiene como objetivo automatizar el flujo de aceptación y rechazo de facturas electrónicas registradas en el sistema, permitiendo una gestión eficiente y reduciendo la intervención manual.",
    errorPercentage: 0,
    status: "success",
    clients: [
      { id: "cl1", name: "Empresa A", errorPercentage: 0, status: "success" },
      { id: "cl2", name: "Empresa B", errorPercentage: 0, status: "success" },
      { id: "cl3", name: "Empresa C", errorPercentage: 0, status: "success" },
    ],
    logs: [
      { id: "1", message: "Servicio inicializado correctamente", timestamp: new Date().toISOString(), type: "success" },
      { id: "2", message: "Procesamiento de facturas completado", timestamp: new Date().toISOString(), type: "success" },
    ],
  },
  {
    id: "saldos",
    name: "Saldos Bancarios",
    description: "Sistema automatizado para la consulta y consolidación de saldos bancarios de múltiples instituciones financieras. Permite obtener información actualizada de cuentas bancarias y generar reportes financieros.",
    errorPercentage: 0,
    status: "success",
    clients: [
      { id: "cl1", name: "Empresa A", errorPercentage: 0, status: "success" },
      { id: "cl4", name: "Banco Santander", errorPercentage: 0, status: "success" },
      { id: "cl5", name: "Banco Chile", errorPercentage: 0, status: "success" },
    ],
    logs: [
      { id: "1", message: "Conexión con bancos establecida", timestamp: new Date().toISOString(), type: "success" },
      { id: "2", message: "Saldos actualizados", timestamp: new Date().toISOString(), type: "success" },
    ],
  },
  {
    id: "finiquitos",
    name: "Finiquitos",
    description: "Gestión automatizada del proceso de finiquitos laborales, incluyendo cálculo de indemnizaciones, generación de documentos legales y registro de pagos.",
    errorPercentage: 0,
    status: "success",
    clients: [
      { id: "cl3", name: "Empresa C", errorPercentage: 0, status: "success" },
      { id: "cl6", name: "Recursos Humanos SA", errorPercentage: 0, status: "success" },
    ],
    logs: [
      { id: "1", message: "Cálculo de finiquitos procesado", timestamp: new Date().toISOString(), type: "success" },
    ],
  },
  {
    id: "cuentas",
    name: "Cuentas Básicas",
    description: "Sistema de gestión de cuentas básicas bancarias que permite la apertura, modificación y cierre de cuentas de manera automatizada, cumpliendo con la normativa financiera vigente.",
    errorPercentage: 2,
    status: "warning",
    clients: [
      { id: "cl8", name: "Banco Estado", errorPercentage: 2, status: "warning" },
      { id: "cl9", name: "Coopeuch", errorPercentage: 1, status: "success" },
    ],
    logs: [
      { id: "1", message: "Apertura masiva de cuentas procesada", timestamp: new Date().toISOString(), type: "success" },
      { id: "2", message: "Error en validación de RUT", timestamp: new Date().toISOString(), type: "error" },
    ],
  },
  {
    id: "dte",
    name: "DTE",
    description: "Sistema de Documentos Tributarios Electrónicos que gestiona la emisión, recepción y almacenamiento de facturas, boletas, notas de débito y crédito, garantizando el cumplimiento con el SII.",
    errorPercentage: 85,
    status: "error",
    clients: [
      { id: "cl10", name: "Servicio de Impuestos Internos", errorPercentage: 85, status: "error" },
    ],
    logs: [
      { id: "1", message: "Error masivo en emisión de DTE", timestamp: new Date().toISOString(), type: "error" },
      { id: "2", message: "Servicio no responde", timestamp: new Date().toISOString(), type: "error" },
    ],
  },
  {
    id: "contabilizacion",
    name: "Contabilización",
    description: "Automatización del proceso de contabilización de documentos tributarios, incluyendo asientos contables, cuadratura de cuentas y generación de informes financieros.",
    errorPercentage: 2,
    status: "warning",
    clients: [
      { id: "cl12", name: "Auditores Asociados", errorPercentage: 2, status: "warning" },
    ],
    logs: [
      { id: "1", message: "Asientos contables generados", timestamp: new Date().toISOString(), type: "success" },
      { id: "2", message: "Error de cuadratura detectado", timestamp: new Date().toISOString(), type: "error" },
    ],
  },
  {
    id: "notas-credito",
    name: "Notas de Crédito",
    description: "Sistema automatizado para la emisión y gestión de notas de crédito electrónicas. Permite anular o modificar facturas emitidas previamente con total trazabilidad.",
    errorPercentage: 0,
    status: "success",
    clients: [
      { id: "cl14", name: "Distribuidora Nacional", errorPercentage: 0, status: "success" },
    ],
    logs: [
      { id: "1", message: "Notas de crédito emitidas", timestamp: new Date().toISOString(), type: "success" },
    ],
  },
];

// Función para obtener servicios de un cliente
export const getClientServices = (clientId: string): Service[] => {
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.services) return [];
  return services.filter(service => client.services?.includes(service.id));
};

// Función para obtener cliente por ID con datos completos
export const getClientById = (clientId: string): Client | undefined => {
  return clients.find(c => c.id === clientId);
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
  
  const errorRates: Record<string, number> = {
    "Aceptación y Rechazo de Facturas": 0,
    "Saldos Bancarios": 0,
    "Finiquitos": 0,
    "Cuentas Básicas": 2,
    "DTE": 85,
    "Contabilización": 2,
    "Notas de Crédito": 0,
  };
  
  for (let i = 0; i < 90; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    for (const service of services) {
      const endpoints = serviceEndpoints[service.name] || ["/api/endpoint"];
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const errorRate = errorRates[service.name] / 100;
      
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