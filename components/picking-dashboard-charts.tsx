"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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

export interface PickingDashboardChartsProps {
  pickingStats: {
    byDay: Array<{ fecha: string; count: number }>;
    byWeek: Array<{ anio: number; semana: number; count: number }>;
    byMonth: Array<{ anio: number; mes: number; count: number }>;
    productivity: Array<{ estado: number; count: number }>;
    topProducts: Array<{ producto: string; cantidad: number; transacciones: number }>;
  };
}

export function PickingDashboardCharts({ pickingStats }: PickingDashboardChartsProps) {
  const [pickingPeriod, setPickingPeriod] = useState<"day" | "week" | "month">("day");

  return (
    <>
      {/* 2. Charts Row (Volume and Productivity) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        {/* Volume Chart (2/3 width) */}
        <Card className="lg:col-span-2 border border-border/50 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Cantidad de Picking por Período</CardTitle>
              <CardDescription className="text-xs">Conteo de folios únicos en el rango seleccionado</CardDescription>
            </div>
            <div className="flex bg-muted p-0.5 rounded-lg border border-border/50 text-[10px]">
              <button
                onClick={() => setPickingPeriod("day")}
                className={cn("px-2 py-0.5 font-medium rounded-md", pickingPeriod === "day" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
              >
                Día
              </button>
              <button
                onClick={() => setPickingPeriod("week")}
                className={cn("px-2 py-0.5 font-medium rounded-md", pickingPeriod === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
              >
                Semana
              </button>
              <button
                onClick={() => setPickingPeriod("month")}
                className={cn("px-2 py-0.5 font-medium rounded-md", pickingPeriod === "month" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
              >
                Mes
              </button>
            </div>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={
                  pickingPeriod === "day"
                    ? pickingStats.byDay.map((d: any) => ({ name: format(new Date(d.fecha), "dd/MM"), cantidad: d.count }))
                    : pickingPeriod === "week"
                    ? pickingStats.byWeek.map((w: any) => ({ name: `Sem ${w.semana}`, cantidad: w.count }))
                    : pickingStats.byMonth.map((m: any) => ({ name: format(new Date(m.anio, m.mes - 1), "MMM yy", { locale: es }), cantidad: m.count }))
                }
              >
                <defs>
                  <linearGradient id="colorPicking" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Area type="monotone" dataKey="cantidad" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPicking)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Productivity/States Chart (1/3 width) */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Productividad por Estado</CardTitle>
            <CardDescription className="text-xs">Distribución actual de picking</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex flex-col justify-between">
            <div className="h-44 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pickingStats.productivity.map((p: any) => {
                      let name = `Estado ${p.estado}`;
                      let color = "#cbd5e1";
                      if (p.estado === 0) { name = "Pendiente"; color = "#f59e0b"; }
                      else if (p.estado === 1) { name = "En Proceso"; color = "#3b82f6"; }
                      else if (p.estado === 2) { name = "Finalizado"; color = "#10b981"; }
                      else if (p.estado === 4) { name = "Anulado"; color = "#ef4444"; }
                      return { name, value: p.count, color };
                    })}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pickingStats.productivity.map((p: any, idx: number) => {
                      let color = "#cbd5e1";
                      if (p.estado === 0) color = "#f59e0b";
                      else if (p.estado === 1) color = "#3b82f6";
                      else if (p.estado === 2) color = "#10b981";
                      else if (p.estado === 4) color = "#ef4444";
                      return <Cell key={`cell-${idx}`} fill={color} />;
                    })}
                  </Pie>
                  <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
              {pickingStats.productivity.map((p: any, idx: number) => {
                let name = `Estado ${p.estado}`;
                let colorBg = "bg-slate-300";
                if (p.estado === 0) { name = "Pendiente"; colorBg = "bg-amber-500"; }
                else if (p.estado === 1) { name = "En Proceso"; colorBg = "bg-blue-500"; }
                else if (p.estado === 2) { name = "Finalizado"; colorBg = "bg-emerald-500"; }
                else if (p.estado === 4) { name = "Anulado"; colorBg = "bg-red-500"; }
                return (
                  <div key={idx} className="flex items-center gap-1.5 truncate">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", colorBg)} />
                    <span className="text-muted-foreground truncate">{name}:</span>
                    <span className="font-semibold text-foreground shrink-0">{p.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Top Products */}
      <div className="mt-6">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 5 Productos con Mayor Movimiento</CardTitle>
            <CardDescription className="text-xs">Movimientos agrupados por código de despacho</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={pickingStats.topProducts}
                margin={{ left: 20, right: 10, top: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis dataKey="producto" type="category" tick={{ fontSize: 9 }} width={90} />
                <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="cantidad" name="Cantidad" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
