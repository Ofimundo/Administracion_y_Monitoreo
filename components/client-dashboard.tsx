// app/components/client-dashboard.tsx
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  Building,
  Star,
  Briefcase,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clients, services, getClientServices, type Client } from "@/lib/services-data";
import { StatusIndicator } from "@/components/status-indicator";

interface ClientDashboardProps {
  clientId: string;
  onClose?: () => void;
}

// Generar métricas simuladas para el cliente
const generateClientMetrics = (clientId: string, clientServices: any[]) => {
  const metrics = [];
  const now = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    let totalTransactions = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    
    for (const service of clientServices) {
      const serviceTransactions = 500 + Math.random() * 500;
      const errorRate = service.errorPercentage / 100;
      totalTransactions += serviceTransactions;
      totalErrors += serviceTransactions * (errorRate + (Math.random() * 0.05 - 0.025));
      totalResponseTime += 100 + Math.random() * 400;
    }
    
    metrics.push({
      id: `${clientId}-${date.toISOString()}`,
      clientId,
      date,
      transactions: Math.floor(totalTransactions),
      errors: Math.floor(Math.max(0, totalErrors)),
      responseTime: Math.floor(totalResponseTime / Math.max(1, clientServices.length)),
      satisfaction: Math.floor(70 + Math.random() * 30),
    });
  }
  
  return metrics.sort((a, b) => a.date.getTime() - b.date.getTime());
};

export function ClientDashboard({ clientId, onClose }: ClientDashboardProps) {
  const client = clients.find(c => c.id === clientId);
  const clientServices = client ? getClientServices(clientId) : [];
  const [metrics] = useState(() => generateClientMetrics(clientId, clientServices));
  const [activeTab, setActiveTab] = useState("overview");

  if (!client) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Cliente no encontrado</p>
          <Button onClick={onClose} className="mt-4">Cerrar</Button>
        </CardContent>
      </Card>
    );
  }

  // Calcular estadísticas del cliente
  const stats = useMemo(() => {
    const totalTransactions = metrics.reduce((sum, m) => sum + m.transactions, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const avgSatisfaction = metrics.reduce((sum, m) => sum + m.satisfaction, 0) / metrics.length;
    const errorRate = totalTransactions > 0 ? (totalErrors / totalTransactions) * 100 : 0;
    
    const servicesByStatus = {
      success: clientServices.filter(s => s.status === "success").length,
      warning: clientServices.filter(s => s.status === "warning").length,
      error: clientServices.filter(s => s.status === "error").length,
    };
    
    return {
      totalTransactions,
      totalErrors,
      avgResponseTime: Math.round(avgResponseTime),
      avgSatisfaction: Math.round(avgSatisfaction),
      errorRate: errorRate.toFixed(2),
      servicesByStatus,
    };
  }, [metrics, clientServices]);

  // Datos para gráficos
  const chartData = metrics.map(m => ({
    date: `${m.date.getDate()}/${m.date.getMonth() + 1}`,
    transactions: m.transactions,
    errors: m.errors,
    responseTime: m.responseTime,
    satisfaction: m.satisfaction,
  }));

  const pieData = [
    { name: "Exitosas", value: Math.max(0, stats.totalTransactions - stats.totalErrors), color: "#10b981" },
    { name: "Con Error", value: stats.totalErrors, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      {/* Header del cliente con botón cerrar */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
          <X className="h-4 w-4" />
          Cerrar
        </Button>
      </div>

      {/* Información del cliente */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full -mr-16 -mt-16" />
        <CardContent className="pt-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white",
                client.status === "success" ? "bg-emerald-500" :
                client.status === "warning" ? "bg-amber-500" : "bg-red-500"
              )}>
                {client.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold">{client.name}</h2>
                  <StatusIndicator status={client.status} errorPercentage={client.errorPercentage} size="md" />
                </div>
                <div className="flex flex-wrap gap-4 mt-2">
                  {client.rut && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building className="h-3 w-3" />
                      <span>RUT: {client.rut}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Transacciones</p>
                <p className="text-2xl font-bold">{stats.totalTransactions.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tasa de Error</p>
                <p className={cn(
                  "text-2xl font-bold",
                  parseFloat(stats.errorRate) > 10 ? "text-red-500" :
                  parseFloat(stats.errorRate) > 5 ? "text-amber-500" : "text-emerald-500"
                )}>
                  {stats.errorRate}%
                </p>
              </div>
              <TrendingDown className={cn(
                "h-8 w-8",
                parseFloat(stats.errorRate) > 10 ? "text-red-500" : "text-muted-foreground"
              )} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tiempo Respuesta</p>
                <p className="text-2xl font-bold">{stats.avgResponseTime} ms</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Satisfacción</p>
                <p className="text-2xl font-bold flex items-center gap-1">
                  {stats.avgSatisfaction}%
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs del dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">📊 Resumen</TabsTrigger>
          <TabsTrigger value="services">📦 Servicios ({clientServices.length})</TabsTrigger>
          <TabsTrigger value="metrics">📈 Métricas</TabsTrigger>
        </TabsList>

        {/* Tab Resumen */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Evolución de Transacciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="transactions" stroke="#3b82f6" name="Transacciones" strokeWidth={2} />
                      <Line type="monotone" dataKey="errors" stroke="#ef4444" name="Errores" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Distribución de Peticiones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Estado de Servicios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-emerald-50 rounded-lg">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Excelente
                    </span>
                    <span className="font-bold">{stats.servicesByStatus.success}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-amber-50 rounded-lg">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Warning
                    </span>
                    <span className="font-bold">{stats.servicesByStatus.warning}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Crítico
                    </span>
                    <span className="font-bold">{stats.servicesByStatus.error}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Nivel de Satisfacción</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center h-[200px]">
                  <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="12"
                        strokeDasharray={`${(stats.avgSatisfaction / 100) * 352} 352`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">{stats.avgSatisfaction}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">Índice de satisfacción general</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Servicios */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {clientServices.map((service) => (
              <Card key={service.id} className={cn(
                "transition-all hover:shadow-md",
                service.status === "success" ? "border-l-4 border-l-emerald-500" :
                service.status === "warning" ? "border-l-4 border-l-amber-500" :
                "border-l-4 border-l-red-500"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold">{service.name}</h3>
                        <StatusIndicator status={service.status} errorPercentage={service.errorPercentage} size="sm" />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
                    </div>
                    <Badge variant="outline" className={cn(
                      service.errorPercentage === 0 ? "text-emerald-600" :
                      service.errorPercentage <= 10 ? "text-amber-600" : "text-red-600"
                    )}>
                      {service.errorPercentage}% error
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab Métricas */}
        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tendencia de Errores y Satisfacción</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="errors" stroke="#ef4444" name="Errores" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="satisfaction" stroke="#f59e0b" name="Satisfacción" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tiempo de Respuesta por Día</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="responseTime" fill="#8b5cf6" name="Tiempo Respuesta (ms)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}