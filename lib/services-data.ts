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
  errorPercentage: number;
  status: "success" | "warning" | "error";
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

// Generar datos de métricas para el dashboard basados en los servicios reales
export const generateMetricsData = (): MetricDataPoint[] => {
  const data: MetricDataPoint[] = [];
  const now = new Date();
  
  // Endpoints por servicio
  const serviceEndpoints: Record<string, string[]> = {
    "Aceptación y Rechazo de Facturas": ["/api/facturas/aceptar", "/api/facturas/rechazar", "/api/facturas/estado"],
    "Saldos Bancarios": ["/api/saldos/consultar", "/api/saldos/consolidar", "/api/saldos/reporte"],
    "Finiquitos": ["/api/finiquitos/calcular", "/api/finiquitos/generar", "/api/finiquitos/firmar"],
    "Cuentas Básicas": ["/api/cuentas/apertura", "/api/cuentas/modificar", "/api/cuentas/cerrar"],
    "DTE": ["/api/dte/emitir", "/api/dte/recepcionar", "/api/dte/almacenar"],
    "Contabilización": ["/api/contabilidad/asientos", "/api/contabilidad/cuadratura", "/api/contabilidad/informes"],
    "Notas de Crédito": ["/api/notas/emitir", "/api/notas/anular", "/api/notas/estado"],
  };
  
  // Porcentajes de error reales por servicio
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
      
      // Simular peticiones basadas en el porcentaje de error real
      const totalRequests = 800 + Math.floor(Math.random() * 400);
      const errorCount = Math.floor(totalRequests * (errorRate + (Math.random() * 0.05 - 0.025)));
      const successCount = totalRequests - errorCount;
      
      // Tiempo de respuesta según el servicio
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