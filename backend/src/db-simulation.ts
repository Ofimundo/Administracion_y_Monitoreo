// lib/db-simulation.ts
import fs from "fs";
import path from "path";

// INTERFACES DE BASE DE DATOS
export interface DteDocCab {
  TipoDTE: number; // 33: Factura, 34: Factura Exenta, 61: Nota Crédito
  Folio: number;
  RutEmisor: string;
  RazonSocialEmisor: string;
  MontoTotal: number;
  FechaEmision: string;
  FechaVencimiento: string;
  EnProceso: number | null; // NULL/0: Pendiente RPA, 1: Aprobado, 2: Rechazado, 3: Manual, 4: Pendiente Espera
  AceptadoCliente: number | null; // 0/1
  Motivo: string | null;
}

export interface DteDocRef {
  TipoDTE: number;
  Folio: number;
  TpoDocRef: string; // "801" para OC
  FolioRef: string; // Número de OC
  FchRef?: string;
}

export interface DteDocDet {
  TipoDTE: number;
  Folio: number;
  Linea: number;
  CodigoProducto: string;
  NombreProducto: string;
  Cantidad: number;
  PrecioUnitario: number;
  MontoLinea: number;
}

export interface Oordencom {
  NroOrden: string;
  RutProveedor: string;
  FechaOrden: string;
  Estado: "Aprobada" | "Nula" | "Pendiente" | "En Proceso";
  Etapa: "Recepcionada" | "Sin Recepción" | "Recepción Parcial";
  Moneda: "PES" | "UF" | "DOL";
  MontoTotal: number;
}

export interface VtDatosOrdenCompra {
  NroOrden: string;
  CantidadTotalOC: number;
  CantidadRecibida: number;
  MontoTotalOC: number;
  MontoRecibido: number;
  Productos: {
    Codigo: string;
    Nombre: string;
    CantidadPedida: number;
    CantidadRecibida: number;
    PrecioUnitario: number;
  }[];
}

export interface CWTAuxiAttr {
  RutAux: string;
  Atributo18: string | null; // Tipo Proveedor: "Mayorista", "Minorista", "Servicio", null
  Atributo21: string | null; // Tipo Servicio: "Energía", "Arriendo", "Mantenimiento", null
}

export interface Cwteqmo {
  Fecha: string;
  Moneda: "UF" | "DOL";
  Valor: number;
}

export interface BitacoraAceptacionRechazo {
  folio_documento: number;
  tipo_documento: number;
  orden_compra: string | null;
  razon_social: string;
  rut_proveedor: string;
  dias_por_vencer: number;
  estado: "Aprobado" | "Rechazado" | "Pendiente" | "Manual" | "Pendiente Espera" | null;
  id_regla: number | null;
  motivo: string | null;
  horas_por_revisar: number | null;
  fecha_proceso: string;
  fecha_modificacion: string | null;
}

export interface SimulatedDatabase {
  dte_doccab: DteDocCab[];
  dte_docref: DteDocRef[];
  dte_docdet: DteDocDet[];
  owordencom: Oordencom[];
  vt_datos_orden_compra: VtDatosOrdenCompra[];
  cwt_auxi_attr: CWTAuxiAttr[];
  cwteqmo: Cwteqmo[];
  feriados: string[]; // Fechas en formato "YYYY-MM-DD"
  bitacora: BitacoraAceptacionRechazo[];
}

// RUTA DE PERSISTENCIA LOCAL
const SIMULATED_DB_FILE = fs.existsSync(path.join(__dirname, "simulated-db.json"))
  ? path.join(__dirname, "simulated-db.json")
  : path.join(__dirname, "..", "src", "simulated-db.json");

// FERIADOS CHILENOS 2026 DE EJEMPLO
const DEFAULT_FERIADOS = [
  "2026-01-01", // Año Nuevo
  "2026-04-03", // Viernes Santo
  "2026-04-04", // Sábado Santo
  "2026-05-01", // Día del Trabajo
  "2026-05-21", // Día de las Glorias Navales
  "2026-06-29", // San Pedro y San Pablo
  "2026-07-16", // Día de la Virgen del Carmen
  "2026-08-15", // Asunción de la Virgen
  "2026-09-18", // Fiestas Patrias
  "2026-09-19", // Glorias del Ejército
  "2026-10-12", // Encuentro de Dos Mundos
  "2026-10-31", // Día de las Iglesias Evangélicas
  "2026-11-01", // Día de Todos los Santos
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25", // Navidad
];

// MONEDAS INDICADORES DE EJEMPLO
const DEFAULT_CWTEQMO: Cwteqmo[] = [
  { Fecha: "2026-05-18", Moneda: "UF", Valor: 38240.50 },
  { Fecha: "2026-05-18", Moneda: "DOL", Valor: 924.80 },
  { Fecha: "2026-05-17", Moneda: "UF", Valor: 38238.10 },
  { Fecha: "2026-05-17", Moneda: "DOL", Valor: 924.80 }, // Fin de semana mantiene el del viernes
  { Fecha: "2026-05-16", Moneda: "UF", Valor: 38235.80 },
  { Fecha: "2026-05-16", Moneda: "DOL", Valor: 924.80 },
  { Fecha: "2026-05-15", Moneda: "UF", Valor: 38233.40 },
  { Fecha: "2026-05-15", Moneda: "DOL", Valor: 924.80 },
];

// DATOS DE PRUEBA INICIALES (MOCK DATABASE)
export const INITIAL_DATABASE: SimulatedDatabase = {
  dte_doccab: [
    {
      TipoDTE: 33,
      Folio: 101,
      RutEmisor: "76.123.456-7",
      RazonSocialEmisor: "Distribuidora Mayorista S.A.",
      MontoTotal: 1250000,
      FechaEmision: "2026-05-10",
      FechaVencimiento: "2026-06-10",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 61,
      Folio: 201,
      RutEmisor: "76.123.456-7",
      RazonSocialEmisor: "Distribuidora Mayorista S.A.",
      MontoTotal: 250000,
      FechaEmision: "2026-05-12",
      FechaVencimiento: "2026-06-12",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 102,
      RutEmisor: "77.234.567-8",
      RazonSocialEmisor: "Servicios Industriales Ltda.",
      MontoTotal: 500000,
      FechaEmision: "2026-05-17",
      FechaVencimiento: "2026-05-19", // Vence en 1 día!
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 103,
      RutEmisor: "79.999.999-9", // No tiene asignación en CWTAuxiAttr
      RazonSocialEmisor: "Servicios Fantasma SpA",
      MontoTotal: 850000,
      FechaEmision: "2026-05-14",
      FechaVencimiento: "2026-06-14",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 104,
      RutEmisor: "76.123.456-7",
      RazonSocialEmisor: "Distribuidora Mayorista S.A.",
      MontoTotal: 950000,
      FechaEmision: "2026-05-12",
      FechaVencimiento: "2026-06-12",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 105,
      RutEmisor: "76.123.456-7",
      RazonSocialEmisor: "Distribuidora Mayorista S.A.",
      MontoTotal: 1500000,
      FechaEmision: "2026-05-11",
      FechaVencimiento: "2026-06-11",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 106,
      RutEmisor: "76.123.456-7",
      RazonSocialEmisor: "Distribuidora Mayorista S.A.",
      MontoTotal: 3000000,
      FechaEmision: "2026-05-10",
      FechaVencimiento: "2026-06-10",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 107,
      RutEmisor: "76.123.456-7",
      RazonSocialEmisor: "Distribuidora Mayorista S.A.",
      MontoTotal: 1800000,
      FechaEmision: "2026-05-12",
      FechaVencimiento: "2026-06-12",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 108,
      RutEmisor: "76.123.456-7",
      RazonSocialEmisor: "Distribuidora Mayorista S.A.",
      MontoTotal: 1200000,
      FechaEmision: "2026-05-13",
      FechaVencimiento: "2026-06-13",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 109,
      RutEmisor: "76.123.456-7",
      RazonSocialEmisor: "Distribuidora Mayorista S.A.",
      MontoTotal: 4500000, // En UF, error de moneda/monto!
      FechaEmision: "2026-05-13",
      FechaVencimiento: "2026-06-13",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 110,
      RutEmisor: "76.123.456-7",
      RazonSocialEmisor: "Distribuidora Mayorista S.A.",
      MontoTotal: 2000000, // Completa, pero hay exceso de productos!
      FechaEmision: "2026-05-14",
      FechaVencimiento: "2026-06-14",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 111,
      RutEmisor: "76.123.456-7",
      RazonSocialEmisor: "Distribuidora Mayorista S.A.",
      MontoTotal: 450000,
      FechaEmision: "2026-05-14",
      FechaVencimiento: "2026-06-14",
      EnProceso: null, // Sin OC de referencia!
      AceptadoCliente: null,
      Motivo: null,
    },
    {
      TipoDTE: 33,
      Folio: 112,
      RutEmisor: "78.345.678-9",
      RazonSocialEmisor: "Servicios Generales A&B SpA",
      MontoTotal: 1200000, // Servicio Especial. Desviación 10% vs promedio 6 meses!
      FechaEmision: "2026-05-15",
      FechaVencimiento: "2026-06-15",
      EnProceso: null,
      AceptadoCliente: null,
      Motivo: null,
    }
  ],
  dte_docref: [
    { TipoDTE: 33, Folio: 101, TpoDocRef: "801", FolioRef: "OC-8001" },
    { TipoDTE: 61, Folio: 201, TpoDocRef: "33", FolioRef: "101", FchRef: "2026-05-10" },
    { TipoDTE: 33, Folio: 102, TpoDocRef: "801", FolioRef: "OC-8002" },
    { TipoDTE: 33, Folio: 103, TpoDocRef: "801", FolioRef: "OC-8003" },
    { TipoDTE: 33, Folio: 104, TpoDocRef: "801", FolioRef: "OC-8004" }, // OC no existe
    { TipoDTE: 33, Folio: 105, TpoDocRef: "801", FolioRef: "OC-8005" }, // OC muy antigua (>4 meses)
    { TipoDTE: 33, Folio: 106, TpoDocRef: "801", FolioRef: "OC-8006" }, // RUT Proveedor no coincide
    { TipoDTE: 33, Folio: 107, TpoDocRef: "801", FolioRef: "OC-8007" }, // OC Nula
    { TipoDTE: 33, Folio: 108, TpoDocRef: "801", FolioRef: "OC-8008" }, // OC Pendiente
    { TipoDTE: 33, Folio: 109, TpoDocRef: "801", FolioRef: "OC-8009" }, // Validación Moneda (UF)
    { TipoDTE: 33, Folio: 110, TpoDocRef: "801", FolioRef: "OC-8010" }, // Exceso cantidad productos
    { TipoDTE: 33, Folio: 112, TpoDocRef: "801", FolioRef: "OC-8012" }  // Servicio Especial
  ],
  dte_docdet: [
    { TipoDTE: 33, Folio: 101, Linea: 1, CodigoProducto: "PROD-01", NombreProducto: "Escritorio Ejecutivo Moderno", Cantidad: 10, PrecioUnitario: 125000, MontoLinea: 1250000 },
    { TipoDTE: 33, Folio: 102, Linea: 1, CodigoProducto: "SERV-01", NombreProducto: "Soporte TI Urgente", Cantidad: 1, PrecioUnitario: 500000, MontoLinea: 500000 },
    { TipoDTE: 33, Folio: 103, Linea: 1, CodigoProducto: "SERV-99", NombreProducto: "Servicio General", Cantidad: 1, PrecioUnitario: 850000, MontoLinea: 850000 },
    { TipoDTE: 33, Folio: 104, Linea: 1, CodigoProducto: "PROD-01", NombreProducto: "Escritorio Ejecutivo Moderno", Cantidad: 8, PrecioUnitario: 118750, MontoLinea: 950000 },
    { TipoDTE: 33, Folio: 105, Linea: 1, CodigoProducto: "PROD-02", NombreProducto: "Silla Ergonomica Gamer", Cantidad: 20, PrecioUnitario: 75000, MontoLinea: 1500000 },
    { TipoDTE: 33, Folio: 106, Linea: 1, CodigoProducto: "PROD-01", NombreProducto: "Escritorio Ejecutivo Moderno", Cantidad: 24, PrecioUnitario: 125000, MontoLinea: 3000000 },
    { TipoDTE: 33, Folio: 107, Linea: 1, CodigoProducto: "PROD-01", NombreProducto: "Escritorio Ejecutivo Moderno", Cantidad: 14, PrecioUnitario: 128571, MontoLinea: 1800000 },
    { TipoDTE: 33, Folio: 108, Linea: 1, CodigoProducto: "PROD-01", NombreProducto: "Escritorio Ejecutivo Moderno", Cantidad: 10, PrecioUnitario: 120000, MontoLinea: 1200000 },
    { TipoDTE: 33, Folio: 109, Linea: 1, CodigoProducto: "PROD-01", NombreProducto: "Escritorio Ejecutivo Moderno", Cantidad: 10, PrecioUnitario: 450000, MontoLinea: 4500000 },
    { TipoDTE: 33, Folio: 110, Linea: 1, CodigoProducto: "PROD-03", NombreProducto: "Monitor Curvo 34'' LG", Cantidad: 10, PrecioUnitario: 200000, MontoLinea: 2000000 },
    { TipoDTE: 33, Folio: 111, Linea: 1, CodigoProducto: "PROD-01", NombreProducto: "Escritorio Ejecutivo Moderno", Cantidad: 4, PrecioUnitario: 112500, MontoLinea: 450000 },
    { TipoDTE: 33, Folio: 112, Linea: 1, CodigoProducto: "SERV-02", NombreProducto: "Servicio de Limpieza e Higienización", Cantidad: 1, PrecioUnitario: 1200000, MontoLinea: 1200000 }
  ],
  owordencom: [
    { NroOrden: "OC-8001", RutProveedor: "76.123.456-7", FechaOrden: "2026-05-05", Estado: "Aprobada", Etapa: "Recepcionada", Moneda: "PES", MontoTotal: 1250000 },
    { NroOrden: "OC-8002", RutProveedor: "77.234.567-8", FechaOrden: "2026-05-15", Estado: "Aprobada", Etapa: "Sin Recepción", Moneda: "PES", MontoTotal: 500000 },
    { NroOrden: "OC-8003", RutProveedor: "79.999.999-9", FechaOrden: "2026-05-10", Estado: "Aprobada", Etapa: "Recepcionada", Moneda: "PES", MontoTotal: 850000 },
    { NroOrden: "OC-8005", RutProveedor: "76.123.456-7", FechaOrden: "2025-12-01", Estado: "Aprobada", Etapa: "Recepcionada", Moneda: "PES", MontoTotal: 1500000 }, // >4 meses
    { NroOrden: "OC-8006", RutProveedor: "99.888.777-6", FechaOrden: "2026-05-02", Estado: "Aprobada", Etapa: "Recepcionada", Moneda: "PES", MontoTotal: 3000000 }, // RUT Mismatch
    { NroOrden: "OC-8007", RutProveedor: "76.123.456-7", FechaOrden: "2026-05-05", Estado: "Nula", Etapa: "Sin Recepción", Moneda: "PES", MontoTotal: 1800000 },   // Nula
    { NroOrden: "OC-8008", RutProveedor: "76.123.456-7", FechaOrden: "2026-05-05", Estado: "Pendiente", Etapa: "Sin Recepción", Moneda: "PES", MontoTotal: 1200000 }, // Pendiente
    { NroOrden: "OC-8009", RutProveedor: "76.123.456-7", FechaOrden: "2026-05-10", Estado: "Aprobada", Etapa: "Recepcionada", Moneda: "UF", MontoTotal: 100 },     // 100 UF = ~3.8 Millones, Factura dice 4.5 Millones (Desvío)
    { NroOrden: "OC-8010", RutProveedor: "76.123.456-7", FechaOrden: "2026-05-12", Estado: "Aprobada", Etapa: "Recepción Parcial", Moneda: "PES", MontoTotal: 2000000 },
    { NroOrden: "OC-8012", RutProveedor: "78.345.678-9", FechaOrden: "2026-05-14", Estado: "Aprobada", Etapa: "Recepcionada", Moneda: "PES", MontoTotal: 1200000 }
  ],
  vt_datos_orden_compra: [
    {
      NroOrden: "OC-8001",
      CantidadTotalOC: 10,
      CantidadRecibida: 10,
      MontoTotalOC: 1250000,
      MontoRecibido: 1250000,
      Productos: [{ Codigo: "PROD-01", Nombre: "Escritorio Ejecutivo Moderno", CantidadPedida: 10, CantidadRecibida: 10, PrecioUnitario: 125000 }]
    },
    {
      NroOrden: "OC-8002",
      CantidadTotalOC: 1,
      CantidadRecibida: 0,
      MontoTotalOC: 500000,
      MontoRecibido: 0,
      Productos: [{ Codigo: "SERV-01", Nombre: "Soporte TI Urgente", CantidadPedida: 1, CantidadRecibida: 0, PrecioUnitario: 500000 }]
    },
    {
      NroOrden: "OC-8003",
      CantidadTotalOC: 1,
      CantidadRecibida: 1,
      MontoTotalOC: 850000,
      MontoRecibido: 850000,
      Productos: [{ Codigo: "SERV-99", Nombre: "Servicio General", CantidadPedida: 1, CantidadRecibida: 1, PrecioUnitario: 850000 }]
    },
    {
      NroOrden: "OC-8005",
      CantidadTotalOC: 20,
      CantidadRecibida: 20,
      MontoTotalOC: 1500000,
      MontoRecibido: 1500000,
      Productos: [{ Codigo: "PROD-02", Nombre: "Silla Ergonomica Gamer", CantidadPedida: 20, CantidadRecibida: 20, PrecioUnitario: 75000 }]
    },
    {
      NroOrden: "OC-8006",
      CantidadTotalOC: 24,
      CantidadRecibida: 24,
      MontoTotalOC: 3000000,
      MontoRecibido: 3000000,
      Productos: [{ Codigo: "PROD-01", Nombre: "Escritorio Ejecutivo Moderno", CantidadPedida: 24, CantidadRecibida: 24, PrecioUnitario: 125000 }]
    },
    {
      NroOrden: "OC-8007",
      CantidadTotalOC: 14,
      CantidadRecibida: 0,
      MontoTotalOC: 1800000,
      MontoRecibido: 0,
      Productos: [{ Codigo: "PROD-01", Nombre: "Escritorio Ejecutivo Moderno", CantidadPedida: 14, CantidadRecibida: 0, PrecioUnitario: 128571 }]
    },
    {
      NroOrden: "OC-8008",
      CantidadTotalOC: 10,
      CantidadRecibida: 0,
      MontoTotalOC: 1200000,
      MontoRecibido: 0,
      Productos: [{ Codigo: "PROD-01", Nombre: "Escritorio Ejecutivo Moderno", CantidadPedida: 10, CantidadRecibida: 0, PrecioUnitario: 120000 }]
    },
    {
      NroOrden: "OC-8009",
      CantidadTotalOC: 100,
      CantidadRecibida: 100,
      MontoTotalOC: 100, // en UF
      MontoRecibido: 100,
      Productos: [{ Codigo: "PROD-01", Nombre: "Escritorio Ejecutivo Moderno", CantidadPedida: 10, CantidadRecibida: 10, PrecioUnitario: 10 }] // en UF
    },
    {
      NroOrden: "OC-8010",
      CantidadTotalOC: 10,
      CantidadRecibida: 5, // Recepción Parcial! Recibió 5, pero facturó 10!
      MontoTotalOC: 2000000,
      MontoRecibido: 1000000,
      Productos: [{ Codigo: "PROD-03", Nombre: "Monitor Curvo 34'' LG", CantidadPedida: 10, CantidadRecibida: 5, PrecioUnitario: 200000 }]
    },
    {
      NroOrden: "OC-8012",
      CantidadTotalOC: 1,
      CantidadRecibida: 1,
      MontoTotalOC: 1200000,
      MontoRecibido: 1200000,
      Productos: [{ Codigo: "SERV-02", Nombre: "Servicio de Limpieza e Higienización", CantidadPedida: 1, CantidadRecibida: 1, PrecioUnitario: 1200000 }]
    }
  ],
  cwt_auxi_attr: [
    { RutAux: "76.123.456-7", Atributo18: "Mayorista", Atributo21: null },
    { RutAux: "77.234.567-8", Atributo18: "Minorista", Atributo21: null },
    { RutAux: "78.345.678-9", Atributo18: "Servicio", Atributo21: "Soporte Técnico" },
    { RutAux: "99.888.777-6", Atributo18: "Mayorista", Atributo21: null }
  ],
  cwteqmo: DEFAULT_CWTEQMO,
  feriados: DEFAULT_FERIADOS,
  bitacora: []
};

// MOTOR DE LA BASE DE DATOS MOCK (READ/WRITE)
export function getSimulatedDatabase(): SimulatedDatabase {
  try {
    if (fs.existsSync(SIMULATED_DB_FILE)) {
      const data = fs.readFileSync(SIMULATED_DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("⚠️ Error leyendo archivo simulated-db.json, cayendo a in-memory:", error);
  }
  
  // Guardar datos iniciales si no existe el archivo
  saveSimulatedDatabase(INITIAL_DATABASE);
  return INITIAL_DATABASE;
}

export function saveSimulatedDatabase(db: SimulatedDatabase): boolean {
  try {
    // Asegurarse de que el directorio existe
    const dir = path.dirname(SIMULATED_DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SIMULATED_DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("⚠️ Error guardando archivo simulated-db.json:", error);
    return false;
  }
}

// CÁLCULO DE DÍAS HÁBILES Y TIEMPOS DE REVISIÓN
export function isWeekendOrHoliday(dateStr: string, feriados: string[]): boolean {
  const date = new Date(dateStr + "T12:00:00");
  const day = date.getDay();
  // 0 = Domingo, 6 = Sábado
  if (day === 0 || day === 6) return true;
  return feriados.includes(dateStr);
}

export function getPreviousWorkDay(dateStr: string, feriados: string[]): string {
  let currDate = new Date(dateStr + "T12:00:00");
  
  while (true) {
    currDate.setDate(currDate.getDate() - 1);
    const yyyy = currDate.getFullYear();
    const mm = String(currDate.getMonth() + 1).padStart(2, "0");
    const dd = String(currDate.getDate()).padStart(2, "0");
    const testStr = `${yyyy}-${mm}-${dd}`;
    
    if (!isWeekendOrHoliday(testStr, feriados)) {
      return testStr;
    }
  }
}

// SIMULACIONES DE LOS PROCEDIMIENTOS ALMACENADOS

/**
 * 2. [RPA].[PA_INS_BITACORA_ACEPTACION_RECHAZO]
 * Inserta o actualiza un registro en la bitácora de control
 */
export function PA_INS_BITACORA_ACEPTACION_RECHAZO(
  db: SimulatedDatabase,
  params: {
    folio: number;
    tipo_documento: number;
    orden_compra: string | null;
    razon_social: string;
    rut_proveedor: string;
    dias_por_vencer: number;
    estado: BitacoraAceptacionRechazo["estado"];
    id_regla: number | null;
    motivo: string | null;
    horas_por_revisar?: number | null;
  }
): SimulatedDatabase {
  const nowStr = new Date().toISOString();
  const existingIdx = db.bitacora.findIndex(
    (b) => b.folio_documento === params.folio && b.tipo_documento === params.tipo_documento
  );

  const entry: BitacoraAceptacionRechazo = {
    folio_documento: params.folio,
    tipo_documento: params.tipo_documento,
    orden_compra: params.orden_compra,
    razon_social: params.razon_social,
    rut_proveedor: params.rut_proveedor,
    dias_por_vencer: params.dias_por_vencer,
    estado: params.estado,
    id_regla: params.id_regla,
    motivo: params.motivo,
    horas_por_revisar: params.horas_por_revisar !== undefined ? params.horas_por_revisar : null,
    fecha_proceso: nowStr,
    fecha_modificacion: existingIdx >= 0 ? nowStr : null,
  };

  if (existingIdx >= 0) {
    db.bitacora[existingIdx] = entry;
  } else {
    db.bitacora.push(entry);
  }

  return db;
}

/**
 * 9. [RPA].[PA_INS_ONBOARDING_ACEPTACION_RECHAZO]
 * Inserta un registro inicial en la bitácora sin sobreescribir si ya existe
 */
export function PA_INS_ONBOARDING_ACEPTACION_RECHAZO(
  db: SimulatedDatabase,
  params: {
    folio: number;
    tipo_documento: number;
    rut_proveedor: string;
    dias_por_vencer: number;
  }
): SimulatedDatabase {
  const existing = db.bitacora.find(
    (b) => b.folio_documento === params.folio && b.tipo_documento === params.tipo_documento
  );
  if (existing) return db; // Ya existe, no se hace nada

  const doc = db.dte_doccab.find((d) => d.Folio === params.folio && d.TipoDTE === params.tipo_documento);
  
  return PA_INS_BITACORA_ACEPTACION_RECHAZO(db, {
    folio: params.folio,
    tipo_documento: params.tipo_documento,
    orden_compra: null,
    razon_social: doc?.RazonSocialEmisor || "Desconocido",
    rut_proveedor: params.rut_proveedor,
    dias_por_vencer: params.dias_por_vencer,
    estado: null,
    id_regla: null,
    motivo: "Onboarding inicial del documento en bitácora",
  });
}

/**
 * 3. [RPA].[PA_UPD_ESTADO_ACEPTACION_RECHAZO]
 * Busca pendientes por falta de asignación y verifica si ya se asignó en Softland.
 * Si ya tiene asignación, resetea su estado para re-evaluación.
 */
export function PA_UPD_ESTADO_ACEPTACION_RECHAZO(db: SimulatedDatabase): {
  db: SimulatedDatabase;
  updatedCount: number;
} {
  let updatedCount = 0;
  
  db.bitacora = db.bitacora.map((entry) => {
    if (
      entry.estado === "Pendiente" &&
      entry.motivo &&
      entry.motivo.toLowerCase().includes("no tiene asignación")
    ) {
      // Validar si el proveedor ya tiene asignación de Atributo18
      const attr = db.cwt_auxi_attr.find((a) => a.RutAux === entry.rut_proveedor);
      if (attr && attr.Atributo18) {
        // Encontrado! Se resetea el estado en la bitácora y en la cabecera del documento
        updatedCount++;
        const docIdx = db.dte_doccab.findIndex(
          (d) => d.Folio === entry.folio_documento && d.TipoDTE === entry.tipo_documento
        );
        if (docIdx >= 0) {
          db.dte_doccab[docIdx].EnProceso = null; // para que sea re-evaluado
          db.dte_doccab[docIdx].Motivo = null;
        }
        
        return {
          ...entry,
          estado: null,
          id_regla: null,
          motivo: "Re-evaluación: Se detectó asignación de atributo de proveedor en Softland",
          fecha_modificacion: new Date().toISOString(),
        };
      }
    }
    return entry;
  });

  return { db, updatedCount };
}

/**
 * 6. [RPA].[PA_UPD_BITACORA_ACEPTACION_RECHAZO]
 * Sincroniza documentos gestionados manualmente por usuarios directamente en Softland.
 */
export function PA_UPD_BITACORA_ACEPTACION_RECHAZO(db: SimulatedDatabase): {
  db: SimulatedDatabase;
  syncedCount: number;
} {
  let syncedCount = 0;

  db.bitacora = db.bitacora.map((entry) => {
    // Si estaba pendiente o manual en la bitácora
    if (entry.estado === "Pendiente" || entry.estado === "Manual" || entry.estado === "Pendiente Espera") {
      const doc = db.dte_doccab.find(
        (d) => d.Folio === entry.folio_documento && d.TipoDTE === entry.tipo_documento
      );
      
      // Si en Softland el documento ya fue Aprobado (EnProceso=1) o Rechazado (EnProceso=2)
      if (doc && (doc.EnProceso === 1 || doc.EnProceso === 2)) {
        syncedCount++;
        return {
          ...entry,
          estado: doc.EnProceso === 1 ? "Aprobado" : "Rechazado",
          id_regla: 999, // Código de regla para sincronización manual
          motivo: `Sincronizado: Gestionado manualmente en Softland (Estado: ${
            doc.EnProceso === 1 ? "Aprobado" : "Rechazado"
          })`,
          fecha_modificacion: new Date().toISOString(),
        };
      }
    }
    return entry;
  });

  return { db, syncedCount };
}

/**
 * 5. [RPA].[PA_SEL_INDICADORES]
 * Obtiene el valor de UF o DOL para una fecha específica.
 * Si la fecha es feriado o fin de semana, busca el día hábil anterior.
 */
export function PA_SEL_INDICADORES(
  db: SimulatedDatabase,
  params: { fecha: string; moneda: "UF" | "DOL" }
): number {
  let dateStr = params.fecha;
  
  // Si la fecha es fin de semana o feriado, retrocedemos al día hábil anterior
  if (isWeekendOrHoliday(dateStr, db.feriados)) {
    dateStr = getPreviousWorkDay(dateStr, db.feriados);
  }

  // Buscar valor del indicador
  const ind = db.cwteqmo.find((c) => c.Fecha === dateStr && c.Moneda === params.moneda);
  if (ind) return ind.Valor;

  // Si no se encuentra para ese día hábil específico, retornar el último registrado en la lista
  const list = db.cwteqmo.filter((c) => c.Moneda === params.moneda);
  if (list.length > 0) return list[0].Valor;

  // Defaults fallback
  return params.moneda === "UF" ? 38240.50 : 924.80;
}

/**
 * 4. [RPA].[PA_CORREO_ACEPTACION_RECHAZO]
 * Envía un correo simulado y retorna los detalles del envío
 */
export interface SentMailLog {
  to: string;
  cco: string;
  subject: string;
  body: string;
  timestamp: string;
}

export function PA_CORREO_ACEPTACION_RECHAZO(params: {
  rut: string;
  razonSocial: string;
  tipoProveedor: string;
  tipoDTE: number;
  folio: number;
  oc: string | null;
  monto: number;
  estado: string;
  motivo: string;
}): SentMailLog {
  const to = "contabilidad@ofimundo.cl; adquisiciones@ofimundo.cl";
  const cco = "bburgos@ofimundo.cl; amoris@ofimundo.cl";
  const subject = `⚠️ RPA ALERTA: Documento Folio ${params.folio} de ${params.razonSocial} en estado ${params.estado}`;
  
  const body = `
  Estimado equipo,
  
  El proceso RPA de Aceptación/Rechazo automático ha procesado un documento con la siguiente información:
  
  - RUT Emisor: ${params.rut}
  - Razón Social: ${params.razonSocial}
  - Tipo Documento: ${params.tipoDTE === 33 ? "Factura Electrónica (33)" : params.tipoDTE === 34 ? "Factura Exenta (34)" : "Nota de Crédito (61)"}
  - Folio: ${params.folio}
  - Orden de Compra: ${params.oc || "NO REGISTRA"}
  - Monto Total: $${params.monto.toLocaleString("es-CL")}
  - Tipo Proveedor: ${params.tipoProveedor || "SIN ASIGNACIÓN"}
  
  -------------------------------------------------------------
  🚨 ESTADO DEL RPA: ${params.estado.toUpperCase()}
  🎯 MOTIVO/REGLA: ${params.motivo}
  -------------------------------------------------------------
  
  Acción requerida: Por favor, revisar este caso en el Portal SGCX o en Softland ERP para realizar la gestión manual correspondiente si fuese necesario.
  
  Atentamente,
  Robot RPA - Aceptación & Rechazo de Facturas
  Grupo Ofimundo
  `;

  console.log(`📧 [Simulado] Correo enviado a ${to} sobre Folio ${params.folio} (${params.estado})`);

  return {
    to,
    cco,
    subject,
    body,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 7. [RPA].[PA_SII_ACEPTACION_RECHAZO]
 * Simula llamada a API de SII externa (URL: http://192.168.1.13:7001/api/aceptacion-rechazo/)
 */
export async function PA_SII_ACEPTACION_RECHAZO(
  db: SimulatedDatabase,
  params: {
    rutCliente: string;
    tipoDocumento: number;
    folio: number;
    motivo: string;
    accion: "ERM" | "RFT"; // ERM = Aceptar, RFT = Rechazar
  }
): Promise<{ db: SimulatedDatabase; code: number; message: string }> {
  // Simular llamada http a la API del SII
  // URL: http://192.168.1.13:7001/api/aceptacion-rechazo/
  
  console.log(`🌐 [API SII] POST http://192.168.1.13:7001/api/aceptacion-rechazo/`);
  console.log(`📦 Body:`, {
    rut_emisor: params.rutCliente,
    tipo_documento: params.tipoDocumento,
    folio: params.folio,
    accion: params.accion,
  });

  // Retornamos éxito simulado (Código 0 = Aceptado SII, Código 27 = Ya aceptado)
  const successCode = 0; 
  
  // Actualizar tabla softland.dte_doccab en base al resultado
  const docIdx = db.dte_doccab.findIndex(
    (d) => d.Folio === params.folio && d.TipoDTE === params.tipoDocumento
  );

  if (docIdx >= 0) {
    db.dte_doccab[docIdx].AceptadoCliente = 1;
    db.dte_doccab[docIdx].EnProceso = params.accion === "ERM" ? 1 : 2; // 1: Aprobado, 2: Rechazado
    db.dte_doccab[docIdx].Motivo = params.motivo;
  }

  return {
    db,
    code: successCode,
    message: `Documento procesado correctamente en SII. Código retornado: ${successCode}`,
  };
}

/**
 * 8. [RPA].[PA_NOTAS_CREDITO_ACEPTACION_RECHAZO]
 * Especial para notas de crédito (tipo 61). Valida el estado de la factura referenciada.
 */
export function PA_NOTAS_CREDITO_ACEPTACION_RECHAZO(
  db: SimulatedDatabase,
  params: {
    folioNC: number;
  }
): {
  db: SimulatedDatabase;
  estado: "Aprobado" | "Rechazado" | "Pendiente";
  motivo: string;
} {
  // Buscar la referencia de la nota de crédito
  const ref = db.dte_docref.find((r) => r.TipoDTE === 61 && r.Folio === params.folioNC);
  if (!ref) {
    return {
      db,
      estado: "Pendiente",
      motivo: "Nota de crédito no registra documento referenciado en dte_docref",
    };
  }

  const folioFacturaRef = parseInt(ref.FolioRef);
  const tipoFacturaRef = parseInt(ref.TpoDocRef); // debería ser 33 o 34

  // Buscar factura referenciada
  const factura = db.dte_doccab.find((d) => d.Folio === folioFacturaRef && d.TipoDTE === tipoFacturaRef);
  
  if (!factura) {
    return {
      db,
      estado: "Pendiente",
      motivo: `Factura referenciada Tipo ${tipoFacturaRef} Folio ${folioFacturaRef} no existe en Softland`,
    };
  }

  // Si la factura ya fue aprobada
  if (factura.EnProceso === 1) {
    const ncIdx = db.dte_doccab.findIndex((d) => d.Folio === params.folioNC && d.TipoDTE === 61);
    if (ncIdx >= 0) {
      db.dte_doccab[ncIdx].EnProceso = 1;
      db.dte_doccab[ncIdx].AceptadoCliente = 1;
      db.dte_doccab[ncIdx].Motivo = `Aprobado automáticamente: Factura referenciada #${folioFacturaRef} está APROBADA en Softland`;
    }
    return {
      db,
      estado: "Aprobado",
      motivo: `Factura referenciada #${folioFacturaRef} está Aprobada`,
    };
  }

  // Si la factura fue rechazada
  if (factura.EnProceso === 2) {
    const ncIdx = db.dte_doccab.findIndex((d) => d.Folio === params.folioNC && d.TipoDTE === 61);
    if (ncIdx >= 0) {
      db.dte_doccab[ncIdx].EnProceso = 2;
      db.dte_doccab[ncIdx].AceptadoCliente = 1;
      db.dte_doccab[ncIdx].Motivo = `Rechazado automáticamente: Factura referenciada #${folioFacturaRef} está RECHAZADA en Softland`;
    }
    return {
      db,
      estado: "Rechazado",
      motivo: `Factura referenciada #${folioFacturaRef} está Rechazada`,
    };
  }

  // Si la factura sigue en proceso (null) o manual (3)
  return {
    db,
    estado: "Pendiente",
    motivo: `Factura referenciada #${folioFacturaRef} se encuentra en estado Pendiente/Manual (esperando resolución de factura)`,
  };
}

// ENGINE PRINCIPAL DEL RPA: PA_EJECUCION_ACEPTACION_RECHAZO
export interface ExecutionLog {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  folio?: number;
}

export interface ExecutionResult {
  success: boolean;
  processedCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  manualCount: number;
  logs: ExecutionLog[];
  sentMails: SentMailLog[];
}

export async function PA_EJECUCION_ACEPTACION_RECHAZO(): Promise<ExecutionResult> {
  const startTime = new Date();
  const db = getSimulatedDatabase();
  const logs: ExecutionLog[] = [];
  const sentMails: SentMailLog[] = [];
  
  const addLog = (message: string, type: ExecutionLog["type"] = "info", folio?: number) => {
    logs.push({
      timestamp: new Date().toISOString(),
      message,
      type,
      folio,
    });
    console.log(`🤖 [RPA LOG] [${type.toUpperCase()}] ${message}`);
  };

  addLog("🤖 Iniciando proceso principal RPA_EJECUCION_ACEPTACION_RECHAZO", "info");

  // PASO DE PREPARACIÓN 1: Sincronizar cambios manuales de Softland
  addLog("🔄 Sincronizando gestión manual con PA_UPD_BITACORA_ACEPTACION_RECHAZO...", "info");
  const syncRes = PA_UPD_BITACORA_ACEPTACION_RECHAZO(db);
  if (syncRes.syncedCount > 0) {
    addLog(`Sincronizados ${syncRes.syncedCount} documentos gestionados manualmente en Softland.`, "success");
  }

  // PASO DE PREPARACIÓN 2: Restablecer pendientes por asignación resueltos
  addLog("🔄 Restableciendo pendientes asignados con PA_UPD_ESTADO_ACEPTACION_RECHAZO...", "info");
  const stateRes = PA_UPD_ESTADO_ACEPTACION_RECHAZO(db);
  if (stateRes.updatedCount > 0) {
    addLog(`Restablecidos ${stateRes.updatedCount} documentos que ya obtuvieron tipo de proveedor o servicio.`, "success");
  }

  // OBTENER TODOS LOS DOCUMENTOS PENDIENTES
  // Documentos en softland.dte_doccab donde EnProceso es NULL o 0 (Pendientes)
  const pendingDocs = db.dte_doccab.filter((d) => d.EnProceso === null || d.EnProceso === 0);
  addLog(`Encontrados ${pendingDocs.length} documentos pendientes para evaluar.`, "info");

  let approvedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;
  let manualCount = 0;

  for (const doc of pendingDocs) {
    const fId = `[Tipo ${doc.TipoDTE} Folio ${doc.Folio}]`;
    addLog(`-----------------------------------------------------------------`, "info", doc.Folio);
    addLog(`Evaluando documento ${fId} - Emisor: ${doc.RazonSocialEmisor} - Monto: $${doc.MontoTotal.toLocaleString("es-CL")}`, "info", doc.Folio);

    // Calcular días por vencer
    const today = new Date();
    const expiry = new Date(doc.FechaVencimiento + "T12:00:00");
    const diffTime = expiry.getTime() - today.getTime();
    const diasPorVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    addLog(`Días por vencer: ${diasPorVencer}`, "info", doc.Folio);

    // Insertar onboarding inicial si no existe en la bitácora
    PA_INS_ONBOARDING_ACEPTACION_RECHAZO(db, {
      folio: doc.Folio,
      tipo_documento: doc.TipoDTE,
      rut_proveedor: doc.RutEmisor,
      dias_por_vencer: diasPorVencer,
    });

    let decision: "Aprobado" | "Rechazado" | "Pendiente" | "Manual" | "Pendiente Espera" | null = null;
    let ruleApplied = 0;
    let motive = "";
    let horasEspera: number | null = null;

    // =========================================================================
    // REGLA 1: NOTA DE CRÉDITO (TIPO 61)
    // =========================================================================
    if (doc.TipoDTE === 61) {
      addLog(`👉 Regla 1: Evaluando Nota de Crédito Especial...`, "info", doc.Folio);
      const ncRes = PA_NOTAS_CREDITO_ACEPTACION_RECHAZO(db, { folioNC: doc.Folio });
      
      decision = ncRes.estado;
      motive = ncRes.motivo;
      ruleApplied = 1;
      
      if (decision === "Aprobado") {
        approvedCount++;
        addLog(`✅ Regla 1 superada: Nota de Crédito aprobada automáticamente. Factura de referencia OK.`, "success", doc.Folio);
      } else if (decision === "Rechazado") {
        rejectedCount++;
        addLog(`❌ Regla 1: Nota de Crédito rechazada. Factura de referencia RECHAZADA.`, "error", doc.Folio);
      } else {
        pendingCount++;
        addLog(`⏳ Regla 1: Nota de Crédito en espera de que se defina factura de referencia.`, "warning", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 2-3: DÍAS POR VENCER (SI QUEDAN <= 2 DÍAS)
    // =========================================================================
    if (!decision && diasPorVencer <= 2) {
      addLog(`👉 Regla 2-3: Evaluando plazo de vencimiento crítico (<= 2 días)...`, "info", doc.Folio);
      // Si el documento vence pronto y no tiene OC, rechazamos o dejamos en espera 24h
      const refOC = db.dte_docref.find((r) => r.TipoDTE === doc.TipoDTE && r.Folio === doc.Folio && r.TpoDocRef === "801");
      
      if (!refOC) {
        decision = "Rechazado";
        motive = "Regla 3: Documento vence en <= 2 días y NO registra Orden de Compra (campo 801). Rechazo automático de seguridad.";
        ruleApplied = 3;
        rejectedCount++;
        addLog(`❌ Regla 3: Rechazo por vencimiento crítico sin OC de respaldo.`, "error", doc.Folio);
      } else {
        decision = "Pendiente";
        motive = "Regla 2: Documento con plazo crítico (<= 2 días) con OC. En espera de resolución express (24 horas).";
        ruleApplied = 2;
        horasEspera = 24;
        pendingCount++;
        addLog(`⏳ Regla 2: En espera 24h debido a vencimiento crítico.`, "warning", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 4-5: TIPO DE PROVEEDOR O SERVICIO SIN ASIGNACIÓN (ATRIBUTOS SOFTLAND)
    // =========================================================================
    let providerAttr = db.cwt_auxi_attr.find((a) => a.RutAux === doc.RutEmisor);
    if (!decision && (!providerAttr || !providerAttr.Atributo18)) {
      addLog(`👉 Regla 4-5: Evaluando asignación de Atributo de Proveedor (Atributo 18)...`, "info", doc.Folio);
      decision = "Pendiente";
      motive = `Regla 4: Proveedor RUT ${doc.RutEmisor} no tiene asignado tipo de proveedor (Atributo 18 en Softland).`;
      ruleApplied = 4;
      horasEspera = 48;
      pendingCount++;
      addLog(`⏳ Regla 4: En espera. Falta clasificar proveedor en Softland.`, "warning", doc.Folio);
    }

    // =========================================================================
    // REGLAS 6-8: SERVICIOS ESPECIALES (DESVIACIÓN DEL 10% VS PROMEDIO 6 MESES)
    // =========================================================================
    if (!decision && providerAttr && providerAttr.Atributo18 === "Servicio") {
      addLog(`👉 Regla 6-8: Evaluando Servicio Especial y desviación del monto vs promedio 6 meses...`, "info", doc.Folio);
      
      // Calcular promedio histórico (simulado para este emisor)
      const historicalAvg = doc.MontoTotal * 0.8; // asumimos que el promedio es menor para forzar desvío en factura 112
      const deviation = Math.abs(doc.MontoTotal - historicalAvg) / historicalAvg;
      
      if (deviation > 0.10) { // Mayor al 10%
        decision = "Manual";
        motive = `Regla 7: El monto facturado ($${doc.MontoTotal.toLocaleString()}) se desvía más del 10% del promedio de los últimos 6 meses ($${historicalAvg.toLocaleString()}) para el proveedor de servicios.`;
        ruleApplied = 7;
        manualCount++;
        addLog(`🚨 Regla 7: Derivado a revisión manual debido a desvío de monto en servicios (>10%).`, "error", doc.Folio);
      } else {
        addLog(`Reglas 6-8: Desviación histórica de monto OK (${(deviation * 100).toFixed(1)}%).`, "success", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 9-10: FALTA CAMPO 801 (OC)
    // =========================================================================
    const refOC = db.dte_docref.find((r) => r.TipoDTE === doc.TipoDTE && r.Folio === doc.Folio && r.TpoDocRef === "801");
    if (!decision && !refOC) {
      addLog(`👉 Regla 9-10: Evaluando existencia de referencia a Orden de Compra (campo 801)...`, "info", doc.Folio);
      
      // Si no tiene referencia a OC en el XML
      // Revisar si ya lleva más de 4 días en estado pendiente
      const bitacoraEntry = db.bitacora.find((b) => b.folio_documento === doc.Folio && b.tipo_documento === doc.TipoDTE);
      const diasEnBitacora = bitacoraEntry ? Math.ceil((new Date().getTime() - new Date(bitacoraEntry.fecha_proceso).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      if (diasEnBitacora >= 4) {
        decision = "Manual";
        motive = "Regla 10: Documento superó las 96 horas de espera (4 días) sin registrar Orden de Compra de referencia. Se deriva a revisión manual.";
        ruleApplied = 10;
        manualCount++;
        addLog(`🚨 Regla 10: Derivado a manual por superar plazo máximo de espera sin OC (96 horas).`, "error", doc.Folio);
      } else {
        decision = "Pendiente";
        motive = "Regla 9: Falta ingresar referencia a Orden de Compra (campo 801 del DTE). En espera por 96 horas.";
        ruleApplied = 9;
        horasEspera = 96;
        pendingCount++;
        addLog(`⏳ Regla 9: En espera de ingreso de OC de referencia.`, "warning", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 11-12: OC NO EXISTE EN SOFTLAND
    // =========================================================================
    let ocData: Oordencom | undefined;
    if (!decision && refOC) {
      addLog(`👉 Regla 11-12: Evaluando existencia de OC ${refOC.FolioRef} en Softland...`, "info", doc.Folio);
      ocData = db.owordencom.find((o) => o.NroOrden === refOC.FolioRef);
      
      if (!ocData) {
        decision = "Rechazado";
        motive = `Regla 12: La Orden de Compra referenciada ${refOC.FolioRef} NO existe en la base de datos de Softland.`;
        ruleApplied = 12;
        rejectedCount++;
        addLog(`❌ Regla 12: La Orden de Compra ${refOC.FolioRef} no existe en Softland. Rechazo inmediato.`, "error", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 13-14: FECHA OC > 4 MESES
    // =========================================================================
    if (!decision && ocData) {
      addLog(`👉 Regla 13-14: Evaluando antigüedad de la Orden de Compra...`, "info", doc.Folio);
      const fOc = new Date(ocData.FechaOrden + "T12:00:00");
      const diffOcTime = today.getTime() - fOc.getTime();
      const mesesAntiguedad = diffOcTime / (1000 * 60 * 60 * 24 * 30);
      
      if (mesesAntiguedad > 4) {
        decision = "Rechazado";
        motive = `Regla 14: La Orden de Compra ${ocData.NroOrden} tiene una fecha de emisión de más de 4 meses (${mesesAntiguedad.toFixed(1)} meses). Rechazo por antigüedad.`;
        ruleApplied = 14;
        rejectedCount++;
        addLog(`❌ Regla 14: Rechazo por OC muy antigua (>4 meses).`, "error", doc.Folio);
      } else {
        addLog(`Regla 13: Antigüedad de OC OK (${mesesAntiguedad.toFixed(1)} meses).`, "success", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 15-16: OC SIN PRODUCTOS ASIGNADOS
    // =========================================================================
    let ocVista: VtDatosOrdenCompra | undefined;
    if (!decision && ocData) {
      addLog(`👉 Regla 15-16: Evaluando productos asignados en Orden de Compra...`, "info", doc.Folio);
      ocVista = db.vt_datos_orden_compra.find((v) => v.NroOrden === ocData?.NroOrden);
      
      if (!ocVista || ocVista.Productos.length === 0) {
        decision = "Rechazado";
        motive = `Regla 16: La Orden de Compra ${ocData.NroOrden} no registra ítems/productos asociados en Softland.`;
        ruleApplied = 16;
        rejectedCount++;
        addLog(`❌ Regla 16: Rechazo por OC sin productos asociados.`, "error", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 17-18: RUT PROVEEDOR NO COINCIDE EN FACTURA VS OC
    // =========================================================================
    if (!decision && ocData) {
      addLog(`👉 Regla 17-18: Validando correspondencia de RUT Proveedor entre DTE y OC...`, "info", doc.Folio);
      // Limpiar RUTs de puntos y guiones para comparar de forma segura
      const cleanRutDte = doc.RutEmisor.replace(/\./g, "").toLowerCase();
      const cleanRutOc = ocData.RutProveedor.replace(/\./g, "").toLowerCase();
      
      if (cleanRutDte !== cleanRutOc) {
        decision = "Rechazado";
        motive = `Regla 18: El RUT del emisor del DTE (${doc.RutEmisor}) no coincide con el RUT del proveedor registrado en la Orden de Compra (${ocData.RutProveedor}).`;
        ruleApplied = 18;
        rejectedCount++;
        addLog(`❌ Regla 18: Mismatch crítico de RUT del emisor (${doc.RutEmisor} vs OC: ${ocData.RutProveedor}).`, "error", doc.Folio);
      } else {
        addLog(`Regla 17: Coincidencia de RUT Proveedor OK.`, "success", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 19-20: OC ESTADO "NULA"
    // =========================================================================
    if (!decision && ocData) {
      addLog(`👉 Regla 19-20: Validando estado de la Orden de Compra...`, "info", doc.Folio);
      if (ocData.Estado === "Nula") {
        decision = "Rechazado";
        motive = `Regla 20: La Orden de Compra ${ocData.NroOrden} está en estado "NULA" en Softland.`;
        ruleApplied = 20;
        rejectedCount++;
        addLog(`❌ Regla 20: Rechazo. La Orden de Compra está anulada en Softland.`, "error", doc.Folio);
      } else {
        addLog(`Regla 19: Estado de la Orden de Compra OK: ${ocData.Estado}`, "success", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 21-22: OC ESTADO "PENDIENTE"
    // =========================================================================
    if (!decision && ocData) {
      addLog(`👉 Regla 21-22: Validando si la Orden de Compra está pendiente de aprobar en Softland...`, "info", doc.Folio);
      if (ocData.Estado === "Pendiente") {
        decision = "Rechazado";
        motive = `Regla 22: La Orden de Compra ${ocData.NroOrden} se encuentra en estado "PENDIENTE DE APROBACIÓN". Rechazo para evitar facturar OCs no autorizadas.`;
        ruleApplied = 22;
        rejectedCount++;
        addLog(`❌ Regla 22: Rechazo. La OC se encuentra pendiente de autorizar en Softland.`, "error", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 23-25: OC ETAPA "SIN RECEPCIÓN"
    // =========================================================================
    if (!decision && ocData) {
      addLog(`👉 Regla 23-25: Validando si la OC posee mercadería/servicios recepcionados...`, "info", doc.Folio);
      if (ocData.Etapa === "Sin Recepción") {
        decision = "Pendiente";
        motive = `Regla 23: La Orden de Compra ${ocData.NroOrden} está en etapa "SIN RECEPCIÓN". Se otorga espera express para recepción física de materiales.`;
        ruleApplied = 23;
        horasEspera = 96;
        pendingCount++;
        addLog(`⏳ Regla 23: En espera de recepción de mercadería (96 horas).`, "warning", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 26-29: RECEPCIÓN PARCIAL DE PRODUCTOS
    // =========================================================================
    if (!decision && ocData && ocData.Etapa === "Recepción Parcial") {
      addLog(`👉 Regla 26-29: Evaluando Recepción Parcial en Orden de Compra...`, "info", doc.Folio);
      // Validamos si la cantidad o montos facturados superan lo recepcionado en Softland
      if (ocVista) {
        // Encontrar productos detallados del DTE
        const dteDetalles = db.dte_docdet.filter((d) => d.TipoDTE === doc.TipoDTE && d.Folio === doc.Folio);
        let exceeds = false;
        let diffDetail = "";

        for (const line of dteDetalles) {
          const ocProduct = ocVista.Productos.find((p) => p.Codigo === line.CodigoProducto);
          if (ocProduct) {
            if (line.Cantidad > ocProduct.CantidadRecibida) {
              exceeds = true;
              diffDetail = `Producto ${line.CodigoProducto} facturó cantidad ${line.Cantidad} superando lo recibido físicamente (${ocProduct.CantidadRecibida})`;
              break;
            }
          }
        }

        if (exceeds) {
          decision = "Rechazado";
          motive = `Regla 27: Recepción Parcial Excedida. ${diffDetail}.`;
          ruleApplied = 27;
          rejectedCount++;
          addLog(`❌ Regla 27: Facturación supera la cantidad de mercadería físicamente recibida.`, "error", doc.Folio);
        } else {
          addLog(`Regla 26: Cantidades en Recepción Parcial coinciden con lo recibido. OK.`, "success", doc.Folio);
        }
      }
    }

    // =========================================================================
    // REGLAS 30-32: VALIDACIÓN DE MONEDA EXTRANJERA (UF / USD)
    // =========================================================================
    if (!decision && ocData && ocData.Moneda !== "PES") {
      addLog(`👉 Regla 30-32: Validando conversión de moneda extranjera (${ocData.Moneda})...`, "info", doc.Folio);
      // Obtener el tipo de cambio de la moneda para la fecha de emisión del documento
      const valorMoneda = PA_SEL_INDICADORES(db, {
        fecha: doc.FechaEmision,
        moneda: ocData.Moneda as "UF" | "DOL",
      });
      addLog(`Valor de la moneda ${ocData.Moneda} al ${doc.FechaEmision}: $${valorMoneda.toLocaleString("es-CL")}`, "info", doc.Folio);
      
      const totalEquivalenteClp = ocData.MontoTotal * valorMoneda;
      const desvio = Math.abs(doc.MontoTotal - totalEquivalenteClp) / totalEquivalenteClp;
      
      // Permitimos una tolerancia mínima de variación por redondeos (ej: 1.5%)
      if (desvio > 0.015) {
        decision = "Rechazado";
        motive = `Regla 31: Desviación excesiva de moneda extranjera. Monto factura $${doc.MontoTotal.toLocaleString()} vs OC en ${ocData.Moneda} ($${ocData.MontoTotal} * $${valorMoneda} = $${Math.round(totalEquivalenteClp).toLocaleString()}). Desvío de ${(desvio*100).toFixed(1)}%.`;
        ruleApplied = 31;
        rejectedCount++;
        addLog(`❌ Regla 31: Rechazo por diferencia de conversión monetaria vs Orden de Compra.`, "error", doc.Folio);
      } else {
        addLog(`Regla 30: Cuadratura monetaria en ${ocData.Moneda} OK (${(desvio*100).toFixed(2)}% desvío).`, "success", doc.Folio);
      }
    }

    // =========================================================================
    // REGLAS 33-43: RECEPCIÓN COMPLETA (CRUCE COMPLETO DE PRODUCTOS Y VALORES)
    // =========================================================================
    if (!decision && ocData && ocData.Etapa === "Recepcionada") {
      addLog(`👉 Regla 33-43: Realizando Cruce Completo de Factura vs Orden de Compra...`, "info", doc.Folio);
      
      if (ocVista) {
        const dteDetalles = db.dte_docdet.filter((d) => d.TipoDTE === doc.TipoDTE && d.Folio === doc.Folio);
        let matchError = false;
        let matchMotive = "";

        for (const line of dteDetalles) {
          const ocProduct = ocVista.Productos.find((p) => p.Codigo === line.CodigoProducto);
          
          if (!ocProduct) {
            matchError = true;
            matchMotive = `El producto ${line.CodigoProducto} (${line.NombreProducto}) facturado no existe en la Orden de Compra ${ocData.NroOrden}`;
            ruleApplied = 34;
            break;
          }

          if (line.Cantidad > ocProduct.CantidadPedida) {
            matchError = true;
            matchMotive = `Cantidad del producto ${line.CodigoProducto} facturada (${line.Cantidad}) supera la cantidad pedida en OC (${ocProduct.CantidadPedida})`;
            ruleApplied = 36;
            break;
          }

          // Validación de precios (toleramos desvío insignificante por redondeo)
          const precioDiff = Math.abs(line.PrecioUnitario - ocProduct.PrecioUnitario) / ocProduct.PrecioUnitario;
          if (precioDiff > 0.02) {
            matchError = true;
            matchMotive = `Precio unitario de ${line.CodigoProducto} facturado ($${line.PrecioUnitario}) difiere del precio en la OC ($${ocProduct.PrecioUnitario})`;
            ruleApplied = 38;
            break;
          }
        }

        if (matchError) {
          decision = "Rechazado";
          motive = `Regla 40: Cruce Fallido. ${matchMotive}.`;
          rejectedCount++;
          addLog(`❌ Regla 40: Cruce de productos DTE vs OC falló.`, "error", doc.Folio);
        } else {
          addLog(`Regla 33: Cruce completo de productos, cantidades y precios exitoso. OK.`, "success", doc.Folio);
        }
      }
    }

    // =========================================================================
    // REGLA 44: APROBACIÓN FINAL DEL DOCUMENTO EN SII Y SOFTLAND
    // =========================================================================
    if (!decision) {
      addLog(`👉 Regla 44: Ejecutando aprobación final y firma en el SII...`, "info", doc.Folio);
      
      // Llamar a la API del SII
      const siiResult = await PA_SII_ACEPTACION_RECHAZO(db, {
        rutCliente: doc.RutEmisor,
        tipoDocumento: doc.TipoDTE,
        folio: doc.Folio,
        motivo: "Aprobado por el motor de reglas automáticas de RPA (Cruce Exitoso)",
        accion: "ERM" // Aceptación
      });

      decision = "Aprobado";
      motive = "Regla 44: Documento cumple satisfactoriamente con la totalidad de las reglas de negocio de RPA. Aprobación y registro en SII automático realizado.";
      ruleApplied = 44;
      approvedCount++;
      addLog(`🎉 ¡DOCUMENTO ACEPTADO Y FIRMADO EN EL SII CORRECTAMENTE!`, "success", doc.Folio);
    }

    // ACTUALIZACIÓN DE ESTADOS FINALES EN BITÁCORA Y BASE DE DATOS
    const docIdx = db.dte_doccab.findIndex((d) => d.Folio === doc.Folio && d.TipoDTE === doc.TipoDTE);
    if (docIdx >= 0) {
      if (decision === "Aprobado") {
        db.dte_doccab[docIdx].EnProceso = 1; // Aprobado
        db.dte_doccab[docIdx].AceptadoCliente = 1;
      } else if (decision === "Rechazado") {
        db.dte_doccab[docIdx].EnProceso = 2; // Rechazado
        db.dte_doccab[docIdx].AceptadoCliente = 1;
      } else if (decision === "Manual") {
        db.dte_doccab[docIdx].EnProceso = 3; // Manual
      } else if (decision === "Pendiente") {
        db.dte_doccab[docIdx].EnProceso = 4; // Pendiente espera / En proceso de espera
      }
      db.dte_doccab[docIdx].Motivo = motive;
    }

    // Registrar en la bitácora de control
    PA_INS_BITACORA_ACEPTACION_RECHAZO(db, {
      folio: doc.Folio,
      tipo_documento: doc.TipoDTE,
      orden_compra: refOC?.FolioRef || null,
      razon_social: doc.RazonSocialEmisor,
      rut_proveedor: doc.RutEmisor,
      dias_por_vencer: diasPorVencer,
      estado: decision,
      id_regla: ruleApplied,
      motivo: motive,
      horas_por_revisar: horasEspera,
    });

    // =========================================================================
    // ENVÍO DE CORREOS EN CASO DE PENDIENTE / MANUAL / RECHAZADO
    // =========================================================================
    if (decision === "Manual" || decision === "Pendiente" || decision === "Rechazado") {
      const mailLog = PA_CORREO_ACEPTACION_RECHAZO({
        rut: doc.RutEmisor,
        razonSocial: doc.RazonSocialEmisor,
        tipoProveedor: providerAttr?.Atributo18 || "Sin Asignación",
        tipoDTE: doc.TipoDTE,
        folio: doc.Folio,
        oc: refOC?.FolioRef || null,
        monto: doc.MontoTotal,
        estado: decision,
        motivo: motive,
      });
      sentMails.push(mailLog);
    }
  }

  // Guardar estado actualizado en base de datos
  saveSimulatedDatabase(db);

  const durationMs = new Date().getTime() - startTime.getTime();
  addLog(`🏁 RPA completado en ${durationMs}ms. Resumen: Aprobados: ${approvedCount}, Rechazados: ${rejectedCount}, Pendientes: ${pendingCount}, Manuales: ${manualCount}`, "success");

  return {
    success: true,
    processedCount: pendingDocs.length,
    approvedCount,
    rejectedCount,
    pendingCount,
    manualCount,
    logs,
    sentMails,
  };
}
