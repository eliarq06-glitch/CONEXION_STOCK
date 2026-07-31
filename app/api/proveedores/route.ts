import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const proveedores = await prisma.proveedor.findMany({
      orderBy: { nombre: "asc" }
    });
    return NextResponse.json(proveedores);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { nombre, defaultLeadTime } = await req.json();
    const proveedor = await prisma.proveedor.create({
      data: {
        nombre: nombre.toUpperCase(),
        defaultLeadTime: defaultLeadTime || 0
      }
    });
    return NextResponse.json(proveedor);
  } catch (error: any) {
    // Return existing if it already exists
    if (error.code === 'P2002') {
       const existing = await prisma.proveedor.findUnique({
          where: { nombre: (await req.json()).nombre.toUpperCase() }
       });
       return NextResponse.json(existing);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
