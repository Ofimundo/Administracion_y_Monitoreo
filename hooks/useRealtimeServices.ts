// hooks/useRealtimeServices.ts
import { useState, useEffect } from "react";
import { Service, updateServiceStatus, getServices } from "@/lib/services-data";

export function useRealtimeServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAndUpdateServices = async () => {
    try {
      // Obtener datos de facturas
      const res = await fetch("/api/facturas/bitacora?estado=todos");
      const data = await res.json();
      
      if (data.success && data.data) {
        const totalDocs = data.data.length;
        const errorDocs = data.data.filter((e: any) => {
          const motivo = e.motivo || "";
          const erroresTecnicos = [
            "error de conexión", "timeout", "servidor no responde",
            "softland no disponible", "sii no responde", "connection failed",
            "failed to connect", "could not connect", "connection refused",
            "network error", "500", "503", "no se pudo conectar",
            "softland error", "sii error", "error de red"
          ];
          return erroresTecnicos.some(term => motivo.toLowerCase().includes(term.toLowerCase()));
        }).length;
        
        const errPercent = totalDocs > 0 ? Math.round((errorDocs / totalDocs) * 100) : 0;
        const status = errorDocs > 0 ? (errPercent > 40 ? "error" : "warning") : "success";
        
        // Actualizar el servicio en la memoria
        updateServiceStatus("facturas", errPercent, status);
      }
      
      // Obtener servicios actualizados
      setServices(getServices());
    } catch (error) {
      console.error("Error fetching service data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndUpdateServices();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(fetchAndUpdateServices, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { services, loading, refresh: fetchAndUpdateServices };
}