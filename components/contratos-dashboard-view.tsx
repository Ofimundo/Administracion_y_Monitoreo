"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Coins,
  Percent,
  Briefcase,
  AlertCircle,
  ThumbsUp,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { es } from "date-fns/locale";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ContratosStats {
  total: number;
  active: number;
  portfolio_value: number;
  avg_value: number;
  vencer_7_dias: number;
  sin_firma: number;
  sin_valor: number;
  current_month_qty: number;
  last_month_qty: number;
  current_quarter_avg: number;
  last_quarter_avg: number;
  approval_rate: number;
}

interface MonthlyData {
  anio: number;
  mes: number;
  count: number;
}

interface CurrencyData {
  moneda: string;
  count: number;
  val_clp: number;
}

interface ContratosDashboardViewProps {
  stats: ContratosStats;
  byMonth: MonthlyData[];
  byCurrency: CurrencyData[];
  loading: boolean;
  error: string | null;
}

export function ContratosDashboardView({ stats, byMonth, byCurrency, loading, error }: ContratosDashboardViewProps) {
  const formatCLP = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const activePercent = useMemo(() => {
    if (!stats || !stats.total) return 0;
    return (stats.active / stats.total) * 100;
  }, [stats]);

  // MoM new contracts trend
  const momNewContractsTrend = useMemo(() => {
    if (!stats) return { percentage: 0, direction: "up" as const, label: "Sin datos previos" };
    const curr = stats.current_month_qty || 0;
    const prev = stats.last_month_qty || 0;
    if (prev === 0) {
      return { percentage: curr > 0 ? 100 : 0, direction: "up" as const, label: `${curr} nuevos contratos` };
    }
    const diff = ((curr - prev) / prev) * 100;
    return {
      percentage: Math.abs(diff),
      direction: diff >= 0 ? ("up" as const) : ("down" as const),
      label: `${curr} este mes vs ${prev} mes anterior`
    };
  }, [stats]);

  // QoQ average value trend
  const qoqAvgValueTrend = useMemo(() => {
    if (!stats) return { percentage: 0, direction: "up" as const, label: "Sin datos previos" };
    const curr = stats.current_quarter_avg || 0;
    const prev = stats.last_quarter_avg || 0;
    if (prev === 0) {
      return { percentage: curr > 0 ? 100 : 0, direction: "up" as const, label: "Sin promedio anterior" };
    }
    const diff = ((curr - prev) / prev) * 100;
    return {
      percentage: Math.abs(diff),
      direction: diff >= 0 ? ("up" as const) : ("down" as const),
      label: `${formatCLP(curr)} este trim. vs ${formatCLP(prev)} trim. anterior`
    };
  }, [stats]);

  // Chronological monthly new contracts data
  const chartMonthlyData = useMemo(() => {
    if (!byMonth || !Array.isArray(byMonth)) return [];
    
    // Nombres de meses en español abreviados
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    // Invertir para que quede en orden cronológico
    return [...byMonth].reverse().map((item) => {
      const mesNombre = meses[item.mes - 1] || `${item.mes}`;
      return {
        name: `${mesNombre} ${item.anio.toString().slice(-2)}`,
        contratos: item.count
      };
    });
  }, [byMonth]);

  // Currency distribution pie chart data
  const chartCurrencyData = useMemo(() => {
    if (!byCurrency || !Array.isArray(byCurrency)) return [];
    
    return byCurrency.map((item) => {
      let name = `Moneda ${item.moneda}`;
      let color = "#cbd5e1";
      
      const monStr = item.moneda?.toString().trim();
      if (monStr === "1") {
        name = "Pesos (CLP)";
        color = "#10b981"; // Emerald
      } else if (monStr === "2") {
        name = "Dólares (USD)";
        color = "#3b82f6"; // Blue
      } else if (monStr === "5") {
        name = "UF";
        color = "#6366f1"; // Indigo
      }
      
      return {
        name,
        value: item.count,
        valClp: item.val_clp,
        color
      };
    });
  }, [byCurrency]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="h-10 w-10 border-4 border-t-emerald-500 border-r-emerald-500 border-b-muted border-l-muted rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Obteniendo datos de contratos en tiempo real desde SGCX...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5 text-rose-500" />
          <span>Error al consultar la base de datos de contratos</span>
        </div>
        <p className="text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      
      {/* 📊 RESÚMEN GENERAL DE CONTRATOS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Resumen General de Contratos</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Total */}
          <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Total Contratos</span>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-extrabold text-foreground">{stats.total.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Registrados en SGCX</p>
            </CardContent>
          </Card>

          {/* Card 2: Activos */}
          <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Activos</span>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-extrabold text-emerald-600">{stats.active.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Estado de servicio: VIGENTE</p>
            </CardContent>
          </Card>

          {/* Card 3: % Activos */}
          <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-indigo-500" />
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                <span>% de Actividad</span>
                <Percent className="h-4 w-4 text-teal-500" />
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-extrabold text-foreground">{formatPercent(activePercent)}</p>
              <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-gradient-to-r from-teal-500 to-emerald-500 h-1.5 rounded-full" style={{ width: `${activePercent}%` }} />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Valor Cartera */}
          <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80 sm:col-span-2 lg:col-span-1">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Valor Cartera (Activos)</span>
                <DollarSign className="h-4 w-4 text-indigo-500" />
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xl font-extrabold text-indigo-600 truncate" title={formatCLP(stats.portfolio_value)}>
                {formatCLP(stats.portfolio_value)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5">Consolidado en CLP</p>
            </CardContent>
          </Card>

          {/* Card 5: Promedio */}
          <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] border-border/80 sm:col-span-2 lg:col-span-1">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Promedio Contrato</span>
                <Coins className="h-4 w-4 text-purple-500" />
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xl font-extrabold text-foreground truncate" title={formatCLP(stats.avg_value)}>
                {formatCLP(stats.avg_value)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5">Valor medio por contrato</p>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* 📈 GRAFICOS Y DISTRIBUCION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Historial de Creación (2/3 de ancho) */}
        <Card className="lg:col-span-2 border border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Historial de Creación de Contratos</CardTitle>
            <CardDescription className="text-xs">Cantidad de nuevos contratos ingresados por mes (últimos 12 meses)</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartMonthlyData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value: any) => [`${value} contratos`, 'Ingresados']}
                />
                <Bar dataKey="contratos" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribución por Monedas (1/3 de ancho) */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Distribución por Monedas</CardTitle>
            <CardDescription className="text-xs">Distribución de contratos activos por divisa</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex flex-col justify-between pt-2">
            <div className="h-40 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartCurrencyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartCurrencyData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(value: any, name: any, props: any) => {
                      const valClpFormatted = formatCLP(props.payload.valClp);
                      return [`${value} contratos (${valClpFormatted})`, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Leyenda del gráfico circular */}
            <div className="grid grid-cols-1 gap-1.5 text-[10px] mt-2">
              {chartCurrencyData.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0")} style={{ backgroundColor: entry.color }} />
                    <span className="text-muted-foreground truncate">{entry.name}:</span>
                  </div>
                  <span className="font-semibold text-foreground shrink-0">{entry.value} ({formatCLP(entry.valClp)})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* 📈 TENDENCIAS Y CONTROL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Trend 1: MoM Nuevos Contratos */}
        <Card className="shadow-sm border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-muted-foreground">
              <span>Nuevos Contratos</span>
              <span className="text-[10px] font-bold uppercase bg-muted px-2 py-0.5 rounded-full text-foreground">Mensual</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-foreground">{stats.current_month_qty}</p>
              <span className={cn(
                "flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-md",
                momNewContractsTrend.direction === "up" 
                  ? "bg-emerald-100 text-emerald-700" 
                  : "bg-rose-100 text-rose-700"
              )}>
                {momNewContractsTrend.direction === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {formatPercent(momNewContractsTrend.percentage)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{momNewContractsTrend.label}</p>
          </CardContent>
        </Card>

        {/* Trend 2: QoQ Valor Promedio */}
        <Card className="shadow-sm border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-muted-foreground">
              <span>Valor Promedio</span>
              <span className="text-[10px] font-bold uppercase bg-muted px-2 py-0.5 rounded-full text-foreground">Trimestral</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-extrabold text-foreground truncate max-w-[160px]" title={formatCLP(stats.current_quarter_avg)}>
                {formatCLP(stats.current_quarter_avg)}
              </p>
              <span className={cn(
                "flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-md shrink-0",
                qoqAvgValueTrend.direction === "up" 
                  ? "bg-emerald-100 text-emerald-700" 
                  : "bg-rose-100 text-rose-700"
              )}>
                {qoqAvgValueTrend.direction === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {formatPercent(qoqAvgValueTrend.percentage)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate leading-snug" title={qoqAvgValueTrend.label}>
              {qoqAvgValueTrend.label}
            </p>
          </CardContent>
        </Card>

        {/* Trend 3: Aprobación Comercial */}
        <Card className="shadow-sm border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-muted-foreground">
              <span>Aprobación Comercial</span>
              <ThumbsUp className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-foreground">{formatPercent(stats.approval_rate)}</p>
              <span className="text-xs text-emerald-600 font-semibold">Tasa de aprobación</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${stats.approval_rate}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Porcentaje de contratos con estado de aprobación comercial AP sobre el total general.
            </p>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
