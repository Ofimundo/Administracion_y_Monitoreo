import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const acceptHeader = request.headers.get("accept") || "";
  const formatParam = request.nextUrl.searchParams.get("format");

  // Si se consulta como API JSON
  if (acceptHeader.includes("application/json") || formatParam === "json") {
    return NextResponse.json({
      success: true,
      url: "http://54.20.80.88:3000/",
      credentials: {
        usuario: "admin",
        contrasena: "ofilab2026"
      }
    });
  }

  // Redirección directa a la URL exacta solicitada por el usuario
  return NextResponse.redirect("http://54.20.80.88:3000/", 307);
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    url: "http://54.20.80.88:3000/",
    credentials: {
      usuario: "admin",
      contrasena: "ofilab2026"
    }
  });
}
