"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";

interface DespachoRecord {
  id: number;
  fecha_emision: string;
  hora_emision?: string;
  n_picking: number;
  rut_cliente?: string;
  nombre?: string;
  serie?: string;
  n_parte?: string;
  vendedor?: string;
  observacion?: string;
  estado?: number;
  aprobador?: string;
  fecha_apro?: string;
  hora_apro?: string;
}

interface DespachosDashboardViewProps {
  stats: {
    kpis: {
      total_hoy: number;
      total_semana: number;
      total_mes: number;
      tasa_exito: number;
      tiempo_promedio: number;
    };
    alerts: {
      pendientes_24h: number;
      sin_aprobar_48h: number;
      rechazados_hoy: number;
      sin_cliente: number;
    };
    states: {
      pendiente: number;
      pendiente_pct: number;
      en_proceso: number;
      en_proceso_pct: number;
      despachado: number;
      despachado_pct: number;
      anulado_rechazado: number;
      anulado_rechazado_pct: number;
      total: number;
    };
    recent: DespachoRecord[];
  } | null;
  loading: boolean;
  error: string | null;
}

export function DespachosDashboardView({ stats, loading, error }: DespachosDashboardViewProps) {
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="h-10 w-10 border-4 border-t-blue-600 border-r-blue-600 border-b-muted border-l-muted rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Consultando base de datos de despachos SGCX...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5 text-rose-500" />
          <span>Error al consultar base de datos SGCX (dbo.Despacho_All_In)</span>
        </div>
        <p className="text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const { kpis, states } = stats;

  return (
    <div className="space-y-6">
      
      {/* 📦 DASHBOARD DESPACHOS - KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Hoy */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Despachos Hoy</span>
              <Truck className="h-4 w-4 text-blue-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">{formatNumber(kpis.total_hoy)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Registrados hoy en SGCX</p>
          </CardContent>
        </Card>

        {/* Semana */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Semana</span>
              <Truck className="h-4 w-4 text-purple-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">{formatNumber(kpis.total_semana)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Últimos 7 días corridos</p>
          </CardContent>
        </Card>

        {/* Mes */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-cyan-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Mes</span>
              <Truck className="h-4 w-4 text-cyan-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">{formatNumber(kpis.total_mes)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Últimos 30 días corridos</p>
          </CardContent>
        </Card>

        {/* Tasa Éxito */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Tasa de Éxito</span>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-emerald-600">{kpis.tasa_exito}%</p>
            <p className="text-[10px] text-muted-foreground mt-1">Éxito en entregas (último mes)</p>
          </CardContent>
        </Card>

        {/* Tiempo Promedio */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Tiempo Promedio</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">
              {kpis.tiempo_promedio > 0 ? `${kpis.tiempo_promedio}h` : "N/A"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Emisión a aprobación</p>
          </CardContent>
        </Card>

      </div>

      {/* 📊 ESTADO DE DESPACHOS */}
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Estado de Despachos (Últimos 30 días)</span>
            <Badge variant="outline" className="text-[9px] uppercase font-bold text-muted-foreground">Distribución</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Desglose porcentual y numérico de despachos en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-4">
          
          {/* Pendiente */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Pendiente
              </span>
              <span className="text-muted-foreground">{formatNumber(states.pendiente)} ({states.pendiente_pct}%)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div className="bg-amber-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${states.pendiente_pct}%` }} />
            </div>
          </div>

          {/* En proceso */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                En proceso
              </span>
              <span className="text-muted-foreground">{formatNumber(states.en_proceso)} ({states.en_proceso_pct}%)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${states.en_proceso_pct}%` }} />
            </div>
          </div>

          {/* Despachado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Despachado
              </span>
              <span className="text-muted-foreground">{formatNumber(states.despachado)} ({states.despachado_pct}%)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${states.despachado_pct}%` }} />
            </div>
          </div>

          {/* Anulado/Rechazado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Anulado/Rechazado
              </span>
              <span className="text-muted-foreground">{formatNumber(states.anulado_rechazado)} ({states.anulado_rechazado_pct}%)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div className="bg-red-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${states.anulado_rechazado_pct}%` }} />
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
