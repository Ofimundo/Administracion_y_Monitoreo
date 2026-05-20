// app/api/facturas/db-editor/route.ts
import { NextResponse } from "next/server";
import { getSimulatedDatabase, saveSimulatedDatabase, INITIAL_DATABASE } from "@/lib/db-simulation";

export async function GET() {
  try {
    const db = getSimulatedDatabase();
    return NextResponse.json({
      success: true,
      db,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Error al leer la base de datos de simulación: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, action, data } = body; // table: dte_doccab, oordencom, etc. action: update, insert, delete

    if (!table || !action || !data) {
      return NextResponse.json(
        { success: false, message: "Parámetros 'table', 'action' y 'data' son requeridos." },
        { status: 400 }
      );
    }

    const db = getSimulatedDatabase();
    const tableData = (db as any)[table];

    if (!tableData || !Array.isArray(tableData)) {
      return NextResponse.json(
        { success: false, message: `La tabla '${table}' no existe o no es un arreglo.` },
        { status: 400 }
      );
    }

    if (action === "update") {
      // Para dte_doccab, buscamos por Folio y TipoDTE
      if (table === "dte_doccab") {
        const idx = tableData.findIndex(
          (d: any) => d.Folio === data.Folio && d.TipoDTE === data.TipoDTE
        );
        if (idx >= 0) {
          tableData[idx] = { ...tableData[idx], ...data };
        } else {
          return NextResponse.json({ success: false, message: "Documento no encontrado." }, { status: 404 });
        }
      }
      // Para oordencom, buscamos por NroOrden
      else if (table === "owordencom") {
        const idx = tableData.findIndex((o: any) => o.NroOrden === data.NroOrden);
        if (idx >= 0) {
          tableData[idx] = { ...tableData[idx], ...data };
        } else {
          return NextResponse.json({ success: false, message: "Orden de Compra no encontrada." }, { status: 404 });
        }
      }
      // Para cwt_auxi_attr, buscamos por RutAux
      else if (table === "cwt_auxi_attr") {
        const idx = tableData.findIndex((a: any) => a.RutAux === data.RutAux);
        if (idx >= 0) {
          tableData[idx] = { ...tableData[idx], ...data };
        } else {
          // Si no existe, lo insertamos
          tableData.push(data);
        }
      }
      // Genérico por NroOrden u otro
      else {
        return NextResponse.json({ success: false, message: "Actualización no soportada para esta tabla." }, { status: 400 });
      }
    } else if (action === "insert") {
      tableData.push(data);
    } else if (action === "delete") {
      if (table === "dte_doccab") {
        (db as any)[table] = tableData.filter(
          (d: any) => !(d.Folio === data.Folio && d.TipoDTE === data.TipoDTE)
        );
      } else if (table === "owordencom") {
        (db as any)[table] = tableData.filter((o: any) => o.NroOrden !== data.NroOrden);
      } else {
        return NextResponse.json({ success: false, message: "Eliminación no soportada para esta tabla." }, { status: 400 });
      }
    }

    saveSimulatedDatabase(db);

    return NextResponse.json({
      success: true,
      message: `Tabla '${table}' actualizada exitosamente. Acción: ${action}.`,
      db,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Error al actualizar la base de datos de simulación: " + error.message },
      { status: 500 }
    );
  }
}

// DELETE para reiniciar a los valores de fábrica
export async function DELETE() {
  try {
    // Clonar INITIAL_DATABASE para asegurar que no mutemos la constante
    const newDb = JSON.parse(JSON.stringify(INITIAL_DATABASE));
    saveSimulatedDatabase(newDb);

    return NextResponse.json({
      success: true,
      message: "Base de datos de simulación reiniciada a los valores de fábrica exitosamente.",
      db: newDb,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Error al reiniciar la base de datos de simulación: " + error.message },
      { status: 500 }
    );
  }
}
