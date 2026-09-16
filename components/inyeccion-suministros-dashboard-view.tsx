"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Bell, 
  Mail, 
  Search, 
  Calendar, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  FileText,
  Filter,
  X,
  Hash
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface NotificacionRecord {
  id_notificacion: number | string;
  fecha: string;
  asunto: string;
  correos: string;
}

interface InyeccionSuministrosDashboardViewProps {
  data: NotificacionRecord[];
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
}

export function InyeccionSuministrosDashboardView({
  data = [],
  loading,
  error,
  onRefresh
}: InyeccionSuministrosDashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);
  };

  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    if (!searchTerm.trim()) return data;

    const term = searchTerm.toLowerCase();
    return data.filter((item) => {
      const idStr = String(item.id_notificacion || "").toLowerCase();
      const asuntoStr = (item.asunto || "").toLowerCase();
      const correosStr = (item.correos || "").toLowerCase();
      return idStr.includes(term) || asuntoStr.includes(term) || correosStr.includes(term);
    });
  }, [data, searchTerm]);

  // KPIs
  const totalNotificaciones = data.length;
  const ultimaFechaStr = data.length > 0 && data[0].fecha
    ? format(new Date(data[0].fecha), "dd/MM/yyyy HH:mm", { locale: es })
    : "Sin registros";

  const totalCorreosUnicos = useMemo(() => {
    if (!data) return 0;
    const emailsSet = new Set<string>();
    data.forEach((item) => {
      if (item.correos) {
        item.correos.split(",").forEach((e) => {
          const clean = e.trim().toLowerCase();
          if (clean) emailsSet.add(clean);
        });
      }
    });
    return emailsSet.size;
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="h-10 w-10 border-4 border-t-emerald-600 border-r-emerald-600 border-b-muted border-l-muted rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground animate-pulse font-medium">
          Consultando [THE_COOLER_SGCX].[OIG].[notificaciones]...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2 text-rose-800 dark:text-rose-300">
        <div className="flex items-center gap-2 font-bold">
          <AlertCircle className="h-5 w-5 text-rose-500" />
          <span>Error al consultar notificaciones de SGCX</span>
        </div>
        <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} className="mt-2 border-rose-300">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reintentar Consulta
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* 📦 KPIs INYECCIÓN DE SUMINISTROS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Notificaciones */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between text-muted-foreground">
              <span>Total Notificaciones</span>
              <Bell className="h-4 w-4 text-emerald-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">{formatNumber(totalNotificaciones)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Registros de notificaciones enviadas</p>
          </CardContent>
        </Card>

        {/* Última Actividad */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between text-muted-foreground">
              <span>Última Notificación</span>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-lg font-bold text-foreground truncate">{ultimaFechaStr}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Fecha más reciente</p>
          </CardContent>
        </Card>

        {/* Correos Destinatarios */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md border-border/80">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between text-muted-foreground">
              <span>Correos Destinatarios</span>
              <Mail className="h-4 w-4 text-indigo-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-extrabold text-foreground">{formatNumber(totalCorreosUnicos)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Destinatarios únicos en sistema</p>
          </CardContent>
        </Card>

      </div>

      {/* 🔍 BARRA DE BÚSQUEDA Y TABLA */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Bell className="h-4 w-4 text-emerald-600" />
                Registros de Inyección de Suministros
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Tabla en tiempo real de notificaciones enviadas sobre inyección y reposición de suministros.
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID, Asunto o Correo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh} className="h-9 px-3 text-xs gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Actualizar</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="border-t border-border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[120px] text-xs font-bold">
                    <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> ID Notificación</span>
                  </TableHead>
                  <TableHead className="w-[170px] text-xs font-bold">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Fecha Notificación</span>
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Asunto</span>
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Correos Notificados</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((row) => {
                    const fechaFormatted = row.fecha
                      ? format(new Date(row.fecha), "dd/MM/yyyy HH:mm:ss", { locale: es })
                      : "—";

                    const emailsList = row.correos ? row.correos.split(",").map((e) => e.trim()) : [];

                    return (
                      <TableRow key={String(row.id_notificacion)} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          #{row.id_notificacion}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {fechaFormatted}
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[350px]">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-[10px] px-1.5 py-0">
                              OIG
                            </Badge>
                            <span className="truncate">{row.asunto}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[400px]">
                          <div className="flex flex-wrap gap-1">
                            {emailsList.map((email, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[10px] bg-muted/60 text-muted-foreground font-mono font-normal">
                                {email}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground">
                      {searchTerm ? "No se encontraron notificaciones que coincidan con la búsqueda." : "No se registraron notificaciones de inyección de suministros."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>Mostrando {filteredData.length} de {data.length} notificaciones</span>
            <span>Consulta en tiempo real SGCX</span>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
