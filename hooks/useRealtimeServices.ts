// hooks/useRealtimeServices.ts
import { useState, useEffect } from "react";
import { Service, updateServiceStatus, getServices } from "@/lib/services-data";
import { isInfraestructuraError } from "@/lib/utils";

export function useRealtimeServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAndUpdateServices = async () => {
    try {
      // Obtener datos de facturas del mes en curso
      const now = new Date();
      const primerDiaMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const res = await fetch(`/api/facturas/bitacora?estado=todos&fechaDesde=${primerDiaMes}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        const totalDocs = data.data.length;
        const errorDocs = data.data.filter((e: any) => isInfraestructuraError(e.motivo)).length;
        
        const errPercent = totalDocs > 0 ? Math.round((errorDocs / totalDocs) * 100) : 0;
        const status = errorDocs > 0 && errPercent > 5 ? (errPercent > 40 ? "error" : "warning") : "success";
        
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