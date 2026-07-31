"use client";

import { HelpCircle, Trash2 } from "lucide-react";

export interface Provider {
  id: string;
  nombre: string;
  defaultLeadTime: number;
}

export interface GridRow {
  id: string;
  codigo: string;
  descripcion: string;
  ventas3M: number;
  ventas6M: number;
  ventas9M: number;
  ventas12M: number;
  validSales: any[];
  
  proveedorNombre: string;
  leadTime: number;
  costoUnitario: number;
  precioVenta: number;
  descuento: number;
  margenUtilidad: number;
  tipoDemanda: string;
  observaciones: string;
  
  cantidadSugerida: number;
  semaforo: string;
  cpd?: number;
  ventasPeriodo?: number;
}

interface DataGridProps {
  data: GridRow[];
  providers: Provider[];
  updateRow: (id: string, field: keyof GridRow, value: any) => void;
  onAddProvider: (name: string) => void;
  deleteRow: (id: string) => void;
}

export function DataGrid({ data, providers, updateRow, onAddProvider, deleteRow }: DataGridProps) {
  
  const handleInputChange = (id: string, field: keyof GridRow, value: string | number) => {
    updateRow(id, field, value);
  };

  const handleProviderChange = (id: string, value: string) => {
    if (value.startsWith("NEW:")) {
      const newName = value.split("NEW:")[1].toUpperCase();
      onAddProvider(newName);
      updateRow(id, "proveedorNombre", newName);
    } else {
      updateRow(id, "proveedorNombre", value);
      const prov = providers.find(p => p.nombre === value);
      if (prov) {
        updateRow(id, "leadTime", prov.defaultLeadTime);
      }
    }
  };

  return (
    <div className="data-grid-container rounded-lg border border-white/10">
      <table className="data-grid">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th>Ventas 3M</th>
            <th>Ventas 6M</th>
            <th>Ventas 9M</th>
            <th>Ventas 12M</th>
            <th>Proveedor</th>
            <th>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Lead Time
                <span title="Días estimados que demora el proveedor en entregar el pedido."><HelpCircle size={14} style={{ color: 'var(--text-muted)', cursor: 'help' }} /></span>
              </div>
            </th>
            <th>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                C.P.D.
                <span title="Consumo Promedio Diario = Ventas Reales / Días del periodo seleccionado."><HelpCircle size={14} style={{ color: 'var(--text-muted)', cursor: 'help' }} /></span>
              </div>
            </th>
            <th>Costo Unit. ($)</th>
            <th>Precio Venta ($)</th>
            <th>Descuento (%)</th>
            <th>Margen (%)</th>
            <th>Tipo Demanda</th>
            <th>Cant. Sugerida</th>
            <th>Semáforo</th>
            <th>Observaciones</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              <td className="editable-cell w-24">
                <input 
                  type="text" 
                  value={row.codigo}
                  onChange={(e) => handleInputChange(row.id, "codigo", e.target.value.toUpperCase())}
                  className="uppercase"
                />
              </td>
              <td className="editable-cell min-w-[400px]">
                <input 
                  type="text" 
                  value={row.descripcion}
                  onChange={(e) => handleInputChange(row.id, "descripcion", e.target.value.toUpperCase())}
                  className="uppercase w-full"
                />
              </td>
              <td className="text-right">{row.ventas3M}</td>
              <td className="text-right">{row.ventas6M}</td>
              <td className="text-right">{row.ventas9M}</td>
              <td className="text-right">{row.ventas12M}</td>
              
              <td className="editable-cell min-w-[150px]">
                <input 
                  type="text" 
                  list="providers"
                  value={row.proveedorNombre}
                  onChange={(e) => handleInputChange(row.id, "proveedorNombre", e.target.value.toUpperCase())}
                  onBlur={(e) => {
                    if (e.target.value && !providers.find(p => p.nombre === e.target.value)) {
                      onAddProvider(e.target.value);
                    }
                  }}
                  className="w-full uppercase"
                  placeholder="Escribir o elegir..."
                />
              </td>
              
              <td className="editable-cell w-24">
                <input 
                  type="number" 
                  min="0"
                  value={row.leadTime}
                  onChange={(e) => handleInputChange(row.id, "leadTime", parseInt(e.target.value) || 0)}
                  className="text-right"
                />
              </td>

              <td className="text-right font-mono pr-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                {(row.cpd || 0).toFixed(2)}
              </td>

              <td className="editable-cell w-28">
                <input 
                  type="number" 
                  min="0" step="0.01"
                  value={row.costoUnitario}
                  onChange={(e) => handleInputChange(row.id, "costoUnitario", parseFloat(e.target.value) || 0)}
                  className="text-right"
                />
              </td>

              <td className="editable-cell w-28">
                <input 
                  type="number" 
                  min="0" step="0.01"
                  value={row.precioVenta}
                  onChange={(e) => handleInputChange(row.id, "precioVenta", parseFloat(e.target.value) || 0)}
                  className="text-right"
                />
              </td>

              <td className="editable-cell w-24">
                <input 
                  type="number" 
                  min="0" max="100" step="0.01"
                  value={row.descuento}
                  onChange={(e) => handleInputChange(row.id, "descuento", parseFloat(e.target.value) || 0)}
                  className="text-right"
                />
              </td>

              <td className="font-mono text-right pr-4">
                <span className={row.margenUtilidad < 0 ? "text-danger" : "text-success"}>
                  {row.margenUtilidad.toFixed(2)}%
                </span>
              </td>

              <td className="editable-cell min-w-[140px]">
                <select 
                  value={row.tipoDemanda}
                  onChange={(e) => handleInputChange(row.id, "tipoDemanda", e.target.value)}
                >
                  <option value="ANALISIS_PENDIENTE">PENDIENTE</option>
                  <option value="RECURRENTE">RECURRENTE</option>
                  <option value="PROYECTO">PROYECTO</option>
                  <option value="BAJO PEDIDO">BAJO PEDIDO</option>
                </select>
              </td>

              <td className="text-right font-bold pr-4">
                {row.cantidadSugerida.toFixed(0)}
              </td>

              <td>
                <span className={`tag ${
                  row.semaforo === "COMPRAR" ? "tag-success" : 
                  row.semaforo === "NO COMPRAR" ? "tag-danger" : "tag-warning"
                }`}>
                  {row.semaforo === "COMPRAR" ? "🟢" : row.semaforo === "NO COMPRAR" ? "🔴" : "⚪"} {row.semaforo}
                </span>
              </td>

              <td className="editable-cell min-w-[200px]">
                <input 
                  type="text" 
                  value={row.observaciones}
                  onChange={(e) => handleInputChange(row.id, "observaciones", e.target.value.toUpperCase())}
                  className="uppercase"
                />
              </td>
              
              <td className="text-center">
                <button 
                  onClick={() => deleteRow(row.id)}
                  style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                  title="Eliminar fila"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <datalist id="providers">
        {providers.map(p => (
          <option key={p.id} value={p.nombre} />
        ))}
      </datalist>
    </div>
  );
}
