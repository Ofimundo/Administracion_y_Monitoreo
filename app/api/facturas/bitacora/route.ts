// app/api/facturas/bitacora/route.ts
import { NextResponse } from "next/server";
import { isSimulationMode, executeQuery } from "@/lib/db-client";
import { getSimulatedDatabase } from "@/lib/db-simulation";

export async function GET(request: Request) {
  try {
    const isSimulated = isSimulationMode();
    const { searchParams } = new URL(request.url);
    
    const estado = searchParams.get("estado");
    const search = searchParams.get("search");
    const tipoDocumento = searchParams.get("tipoDocumento");
    const fechaDesde = searchParams.get("fechaDesde");
    const fechaHasta = searchParams.get("fechaHasta");

    console.log("📊 [API] Filtros recibidos:", { estado, search, tipoDocumento, fechaDesde, fechaHasta });
    console.log("📊 [API] Modo:", isSimulated ? "SIMULACIÓN" : "REAL SQL Server");

    if (isSimulated) {
      // MODO SIMULACIÓN
      const db = getSimulatedDatabase();
      let bitacora = [...db.bitacora];
      bitacora.sort((a, b) => new Date(b.fecha_proceso).getTime() - new Date(a.fecha_proceso).getTime());

      if (estado && estado !== "todos") {
        let estadoNormalizado = estado;
        if (estado === "aprobado") estadoNormalizado = "Aprobado";
        else if (estado === "rechazado") estadoNormalizado = "Rechazado";
        else if (estado === "pendiente") estadoNormalizado = "Pendiente";
        else if (estado === "pendiente espera") estadoNormalizado = "Pendiente Espera";
        else if (estado === "manual") estadoNormalizado = "Manual";
        bitacora = bitacora.filter(b => b.estado?.toLowerCase() === estadoNormalizado.toLowerCase());
      }

      if (tipoDocumento && tipoDocumento !== "todos") {
        bitacora = bitacora.filter(b => b.tipo_documento === parseInt(tipoDocumento));
      }

      if (fechaDesde) {
        bitacora = bitacora.filter(b => b.fecha_proceso.split('T')[0] >= fechaDesde);
      }
      if (fechaHasta) {
        bitacora = bitacora.filter(b => b.fecha_proceso.split('T')[0] <= fechaHasta);
      }
      if (search && search.trim() !== "") {
        const query = search.toLowerCase();
        bitacora = bitacora.filter(b =>
          b.folio_documento.toString().includes(query) ||
          b.rut_proveedor.toLowerCase().includes(query) ||
          b.razon_social.toLowerCase().includes(query)
        );
      }

      return NextResponse.json({ success: true, mode: "simulation", count: bitacora.length, data: bitacora });
    } else {
      // MODO REAL - SQL Server
      let conditions: string[] = [];

      // Filtro por estado
      if (estado && estado !== "todos") {
        let estadoValue = "";
        switch (estado) {
          case "aprobado": estadoValue = "Aprobado"; break;
          case "rechazado": estadoValue = "Rechazado"; break;
          case "pendiente": estadoValue = "Pendiente"; break;
          case "pendiente espera": estadoValue = "Pendiente Espera"; break;
          case "manual": estadoValue = "Manual"; break;
          default: estadoValue = estado;
        }
        conditions.push(`estado = '${estadoValue}'`);
      }

      // Filtro por tipo de documento
      if (tipoDocumento && tipoDocumento !== "todos") {
        conditions.push(`tipo_documento = ${parseInt(tipoDocumento)}`);
      }

      // Filtro por búsqueda
      if (search && search.trim() !== "") {
        const searchClean = search.replace(/'/g, "''");
        conditions.push(`(
          CAST(folio_documento AS NVARCHAR(50)) LIKE '%${searchClean}%' OR 
          rut_proveedor LIKE '%${searchClean}%' OR 
          razon_social LIKE '%${searchClean}%'
        )`);
      }

      // Filtro por fechas
      if (fechaDesde) {
        conditions.push(`CAST(fecha_proceso AS DATE) >= '${fechaDesde}'`);
      }
      if (fechaHasta) {
        conditions.push(`CAST(fecha_proceso AS DATE) <= '${fechaHasta}'`);
      }

      let sqlQuery = `
        SELECT 
          id_proceso,
          folio_documento,
          tipo_documento,
          orden_compra,
          razon_social,
          rut_proveedor,
          dias_por_vencer,
          estado,
          id_regla,
          motivo,
          horas_por_revisar,
          fecha_proceso,
          fecha_modificacion
        FROM [THE_COOLER_SGCX].[RPA].[aceptacion_rechazo_bitacora]
      `;
      
      if (conditions.length > 0) {
        sqlQuery += " WHERE " + conditions.join(" AND ");
      }
      sqlQuery += " ORDER BY fecha_proceso DESC";

      console.log("🔌 [SQL Query]:", sqlQuery);

      try {
        const result = await executeQuery(sqlQuery);
        const data = result?.recordset || [];
        
        console.log(`✅ [SQL Server] ${data.length} registros encontrados`);
        
        return NextResponse.json({
          success: true,
          mode: "real",
          count: data.length,
          data: data,
        });
      } catch (dbError: any) {
        console.error("❌ Error en consulta SQL:", dbError);
        return NextResponse.json({
          success: false,
          message: "Error al consultar la base de datos: " + dbError.message,
          mode: "real",
          data: [],
        }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error("❌ Error general en API:", error);
    return NextResponse.json({
      success: false,
      message: error.message || "Error al consultar la bitácora",
      data: [],
    }, { status: 500 });
  }
}