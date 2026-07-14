"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Printer,
  CheckCircle,
  TrendingUp,
  Coins,
  Percent,
  Briefcase,
  AlertCircle,
  MapPin,
  BarChart3,
  Calendar,
  AlertTriangle,
  Building2,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";

interface EquiposSummary {
  total: number;
  active: number;
  in_warehouse: number;
  monthly_revenue: number;
}

interface EquiposAlerts {
  sin_lectura_30: number;
  vencer_30: number;
  sin_contrato: number;
  lecturas_fallidas: number;
}

interface EquiposVolume {
  avg_bn: number;
  avg_col: number;
  low_volume: number;
  inactive_3_months: number;
}

interface TopModel {
  modelo: string;
  count: number;
}

interface GeoDist {
  santiago_count: number;
  regiones_count: number;
}

interface TopComuna {
  comuna: string;
  count: number;
}

interface EquiposDashboardViewProps {
  summary: EquiposSummary;
  alerts: EquiposAlerts;
  volume: EquiposVolume;
  topModels: TopModel[];
  geo: GeoDist;
  topComunas: TopComuna[];
  loading: boolean;
  error: string | null;
}

export function EquiposDashboardView({
  summary,
  alerts,
  volume,
  topModels,
  geo,
  topComunas,
  loading,
  error
}: EquiposDashboardViewProps) {
  const formatCLP = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);
  };

  // Geo pie chart data
  const geoChartData = useMemo(() => {
    if (!geo) return [];
    return [
      { name: "Santiago", value: geo.santiago_count, color: "#3b82f6" },
      { name: "Regiones", value: geo.regiones_count, color: "#f59e0b" }
    ];
  }, [geo]);

  const geoTotal = useMemo(() => {
    if (!geo) return 0;
    return geo.santiago_count + geo.regiones_count;
  }, [geo]);

  // Model statistics with percentage calculation
  const modelsWithPercent = useMemo(() => {
    if (!topModels || !summary?.total) return [];
    return topModels.map(item => ({
      ...item,
      percentage: (item.count / summary.total) * 100
    }));
  }, [topModels, summary]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="h-10 w-10 border-4 border-t-amber-500 border-r-amber-500 border-b-muted border-l-muted rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Obteniendo datos de parque de equipos desde SGCX...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5 text-rose-500" />
          <span>Error al consultar la base de datos de equipos</span>
        </div>
        <p className="text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      
      {/* 📊 DASHBOARD GENERAL DE EQUIPOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Equipos */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Total Equipos</span>
              <Printer className="h-4 w-4 text-blue-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">{formatNumber(summary.total)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Registrados en SGCX</p>
          </CardContent>
        </Card>

        {/* Activos */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Activos</span>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-emerald-600">{formatNumber(summary.active)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Estado de servicio: ACTIVO</p>
          </CardContent>
        </Card>

        {/* En Bodega */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>En Bodega / Retirados</span>
              <Building2 className="h-4 w-4 text-indigo-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-indigo-650">{formatNumber(summary.in_warehouse)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Ubicación física en bodega</p>
          </CardContent>
        </Card>

        {/* Ingreso Recurrente */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Ingreso Recurrente Mensual</span>
              <Coins className="h-4 w-4 text-amber-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xl font-extrabold text-amber-600 truncate" title={formatCLP(summary.monthly_revenue)}>
              {formatCLP(summary.monthly_revenue)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5">Cargo fijo consolidado en CLP</p>
          </CardContent>
        </Card>

      </div>


      {/* 📈 INDICADORES DE VOLUMEN Y TOP MODELOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Volume & Model stats */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1 text-slate-800">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Indicadores de Volumen y Actividad
            </CardTitle>
            <CardDescription className="text-xs">Medias de copias BN/Color e inactividades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            
            {/* BN and Color Averages */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Copias BN promedio / mes</span>
                <p className="text-xl font-extrabold text-slate-700 mt-1">{formatNumber(volume.avg_bn)}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Copias Color promedio / mes</span>
                <p className="text-xl font-extrabold text-amber-600 mt-1">{formatNumber(volume.avg_col)}</p>
              </div>
            </div>

            {/* Inactivity checks */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Volumen bajo (&lt;100 copias/mes):</span>
                  <span className="font-bold text-slate-700">{formatNumber(volume.low_volume)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-slate-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, (volume.low_volume / summary.total) * 100)}%` }} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Inactivos (&gt;3 meses/0 copias):</span>
                  <span className="font-bold text-amber-600">{formatNumber(volume.inactive_3_months)}</span>
                </div>
                <div className="w-full bg-amber-100 rounded-full h-1.5">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (volume.inactive_3_months / summary.total) * 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Top Modelos list */}
            <div className="pt-2 border-t space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">🏆 Top Modelos en Parque</span>
              <div className="space-y-2">
                {modelsWithPercent.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold truncate max-w-[280px]">{idx + 1}. {item.modelo}</span>
                      <span className="text-muted-foreground shrink-0">{formatNumber(item.count)} eq. ({item.percentage.toFixed(1)}%)</span>
                    </div>
                    <Progress value={item.percentage} className={cn("h-1.5", idx === 0 ? "[&>div]:bg-blue-500" : idx === 1 ? "[&>div]:bg-indigo-500" : "[&>div]:bg-teal-500")} />
                  </div>
                ))}
              </div>
            </div>

          </CardContent>
        </Card>

        {/* 📍 DISTRIBUCION GEOGRAFICA */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1 text-slate-800">
              <MapPin className="h-4 w-4 text-emerald-500" />
              Distribución Geográfica de la Flota
            </CardTitle>
            <CardDescription className="text-xs">Ubicación de equipos en Santiago (RM) vs Regiones</CardDescription>
          </CardHeader>
          <CardContent className="h-72 flex flex-col justify-between pt-2">
            
            {/* Pie chart and legend */}
            <div className="flex items-center justify-around flex-1">
              <div className="h-36 w-36 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={geoChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {geoChartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(value: any) => [`${formatNumber(value)} equipos`, 'Cantidad']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend with percentages */}
              <div className="space-y-2 text-xs">
                {geoChartData.map((entry, idx) => {
                  const percent = geoTotal > 0 ? (entry.value / geoTotal) * 100 : 0;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="font-semibold">{entry.name}:</span>
                      <span className="text-muted-foreground">{percent.toFixed(1)}% ({formatNumber(entry.value)})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top comunas list */}
            <div className="border-t pt-2 mt-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">📍 Top Comunas con Más Equipos</span>
              <div className="flex flex-wrap gap-1.5">
                {topComunas.slice(0, 8).map((comunaObj, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px] bg-slate-50/50 hover:bg-slate-50 border-slate-200">
                    {comunaObj.comuna}: {formatNumber(comunaObj.count)}
                  </Badge>
                ))}
              </div>
            </div>

          </CardContent>
        </Card>

      </div>

    </div>
  );
}
