import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { parse, differenceInDays } from "date-fns";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
    
    if (!workbook.SheetNames.length) {
      return NextResponse.json({ error: "Empty workbook" }, { status: 400 });
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Cast rows to raw object
    const rawData = xlsx.utils.sheet_to_json<any>(worksheet);

    const movementsByCode = new Map<string, {
      codigo: string;
      descripcion: string;
      movimientos: any[];
    }>();

    for (const row of rawData) {
      const cod = row["CODIGO"]?.toString().trim();
      if (!cod) continue;
      
      if (!movementsByCode.has(cod)) {
        let rawDesc = row["DESCRIPCION"]?.toString() || "";
        // Limpiar caracteres especiales de codificación y basura del ERP
        let cleanDesc = rawDesc.replace(/[^a-zA-Z0-9\s.,-]/g, '').trim();

        movementsByCode.set(cod, {
          codigo: cod,
          descripcion: cleanDesc,
          movimientos: []
        });
      }
      
      movementsByCode.get(cod)!.movimientos.push(row);
    }
    
    const today = new Date();
    const processedItems = Array.from(movementsByCode.values()).map(item => {
      let v3 = 0, v6 = 0, v9 = 0, v12 = 0;
      
      const validSales = item.movimientos.filter(m => {
        const ref = m["REFERENCIA"]?.toString() || "";
        return ref.startsWith("001-") || ref.startsWith("002-") || ref.startsWith("004-");
      });

      for (const sale of validSales) {
        let saleDate = sale["FECHA"];
        if (!(saleDate instanceof Date)) {
          saleDate = new Date(saleDate);
        }
        
        if (isNaN(saleDate.getTime())) continue;
        
        const daysAgo = differenceInDays(today, saleDate);
        const qty = Math.abs(Number(sale["CANTIDAD"]) || 0);

        if (daysAgo <= 90) v3 += qty;
        if (daysAgo <= 180) v6 += qty;
        if (daysAgo <= 270) v9 += qty;
        if (daysAgo <= 360) v12 += qty;
      }
      
      // Auto-classify demand type algorithm
      let autoTipoDemanda = "ANALISIS_PENDIENTE";
      
      const prev3M = v6 - v3; // Ventas entre 3M y 6M atrás
      const prev6M = v9 - v6; // Ventas entre 6M y 9M atrás
      
      // Strict RECURRENTE: Consistent recent sales + some past sales
      if (v3 > 0 && (prev3M > 0 || prev6M > 0)) {
        autoTipoDemanda = "RECURRENTE";
      } 
      // PROYECTO: Zero recent sales, but huge spikes in the past
      else if (v3 === 0 && (v6 > 0 || v9 > 0 || v12 > 0)) {
        autoTipoDemanda = "PROYECTO";
      }
      // BAJO PEDIDO: Sporadic/very low volume or only just started selling recently
      else {
        autoTipoDemanda = "BAJO PEDIDO";
      }

      return {
        id: crypto.randomUUID(),
        codigo: item.codigo,
        descripcion: item.descripcion,
        ventas3M: v3,
        ventas6M: v6,
        ventas9M: v9,
        ventas12M: v12,
        validSales,
        
        proveedorId: "",
        proveedorNombre: "",
        leadTime: 0,
        costoUnitario: 0,
        precioVenta: 0,
        descuento: 0,
        margenUtilidad: 0,
        tipoDemanda: autoTipoDemanda,
        observaciones: "",
        
        cantidadSugerida: 0,
        semaforo: "ANÁLISIS PENDIENTE"
      };
    });

    return NextResponse.json({ data: processedItems });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
