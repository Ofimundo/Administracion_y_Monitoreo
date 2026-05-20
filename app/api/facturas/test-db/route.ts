// app/api/test-db/route.ts
import { NextResponse } from "next/server";
import { executeQuery, isSimulationMode } from "@/lib/db-client";

export async function GET() {
  try {
    const isSimulated = isSimulationMode();
    
    if (isSimulated) {
      return NextResponse.json({ 
        success: true, 
        mode: 'simulation',
        message: '⚠️ Estás en MODO SIMULACIÓN. Cambia NEXT_PUBLIC_DB_MODE=real en .env.local para usar SQL Server'
      });
    }
    
    // Probar conexión con una consulta simple
    const result = await executeQuery("SELECT GETDATE() as server_time, DB_NAME() as database_name, @@SERVERNAME as server_name");
    
    return NextResponse.json({ 
      success: true, 
      mode: 'real',
      server_time: result?.recordset?.[0]?.server_time,
      database_name: result?.recordset?.[0]?.database_name,
      server_name: result?.recordset?.[0]?.server_name,
      message: '✅ Conexión a SQL Server exitosa'
    });
  } catch (error: any) {
    console.error("❌ Error en test-db:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      message: '❌ Error de conexión a SQL Server. Verifica tus credenciales en .env.local'
    }, { status: 500 });
  }
}