"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  DollarSign,
  ClipboardList,
  RefreshCw,
  Bookmark,
  Calendar
} from "lucide-react";

interface OrdenesRetiroViewProps {
  stats: {
    header: {
      total: number;
      esteMes: number;
      hoy: number;
      montoTotal: number;
      promedio: number;
      renovaciones: number;
      renovacionesPct: number;
      reservas: number;
      reservasPct: number;
    };
    alerts: {
      sinContrato: number;
      sinCliente: number;
      sinFecha: number;
      renovacionSinContrato: number;
    };
    distribution: Array<{
      nombre: string;
      pct: number;
      count: number;
    }>;
    trends: string[];
  } | null;
  loading: boolean;
  error: string | null;
}

export function OrdenesRetiroView({ stats, loading, error }: OrdenesRetiroViewProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="h-10 w-10 border-4 border-t-emerald-600 border-r-emerald-600 border-b-muted border-l-muted rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Consultando base de datos SGCX (INV_ORDEN_RETIRO_EQ_CAB)...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <span>Error al consultar la base de datos SGCX</span>
        </div>
        <p className="text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const { header, alerts, distribution, trends } = stats;

  return (
    <div className="space-y-6">
      
      {/* 📋 DASHBOARD ÓRDENES DE RETIRO - CABECERA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total órdenes */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Total Órdenes</span>
              <ClipboardList className="h-4 w-4 text-emerald-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">{formatNumber(header.total)}</p>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
              <span>Este mes: <strong>{header.esteMes}</strong></span>
              <span>Hoy: <strong>{header.hoy}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Monto Total & Promedio */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-sky-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Monto Total</span>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">{formatCurrency(header.montoTotal)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Promedio: <strong>{formatCurrency(header.promedio)}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Renovaciones */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Renovaciones</span>
              <RefreshCw className="h-4 w-4 text-indigo-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">
              {formatNumber(header.renovaciones)}
              <span className="text-xs font-semibold text-muted-foreground ml-2">({header.renovacionesPct}%)</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Órdenes marcadas como renovación</p>
          </CardContent>
        </Card>

        {/* Reservas */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Reservas</span>
              <Bookmark className="h-4 w-4 text-amber-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">
              {formatNumber(header.reservas)}
              <span className="text-xs font-semibold text-muted-foreground ml-2">({header.reservasPct}%)</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Órdenes de retiro con reserva</p>
          </CardContent>
        </Card>

      </div>

      {/* Grid de Distribución y Tendencias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 📊 DISTRIBUCIÓN POR TIPO DE RETIRO */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              <span>Distribución por Tipo de Retiro</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Mapeo de motivos y causales de retiro registradas en SGCX
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3.5">
            {distribution.map((item, index) => {
              const barColors = [
                "bg-emerald-500",
                "bg-blue-500",
                "bg-indigo-500",
                "bg-purple-500",
                "bg-amber-500",
                "bg-gray-500"
              ];
              const colorClass = barColors[index % barColors.length];

              return (
                <div key={item.nombre} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                      {item.nombre}
                    </span>
                    <span className="text-muted-foreground">
                      {formatNumber(item.count)} ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className={`${colorClass} h-2 rounded-full transition-all duration-500`} 
                      style={{ width: `${item.pct}%` }} 
                    />
                  </div>
                </div>
              );
            })}
            {distribution.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No hay datos de distribución disponibles.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 📅 TENDENCIAS MENSUALES */}
        <Card className="border border-border/50 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span>Tendencias Mensuales e Indicadores Comerciales</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Métricas comparativas calculadas sobre el periodo de análisis
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              {trends.map((trend, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 border border-border/40 rounded-xl shadow-xs">
                  <Calendar className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-foreground leading-relaxed">
                      {trend}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </div>
        </Card>

      </div>
    </div>
  );
}
