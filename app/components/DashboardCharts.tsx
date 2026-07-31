"use client";

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export default function DashboardCharts({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  // 1. Process data for Pie Chart (Demand Type)
  const demandCounts = {
    RECURRENTE: 0,
    PROYECTO: 0,
    "BAJO PEDIDO": 0,
    "ANÁLISIS PENDIENTE": 0,
  };
  data.forEach(d => {
    if (demandCounts[d.tipoDemanda as keyof typeof demandCounts] !== undefined) {
      demandCounts[d.tipoDemanda as keyof typeof demandCounts]++;
    }
  });

  const pieData = Object.entries(demandCounts)
    .filter(([_, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  const COLORS = ['#1b1f3a', '#242a4f', '#ffd400', '#ffea66']; // Navy & Yellow Exactos
  
  // 2. Process data for Bar Chart (Top items to buy by Quantity)
  const buyItems = data.filter(d => d.semaforo === "COMPRAR" && d.cantidadSugerida > 0);
  const sortedByQty = [...buyItems].sort((a, b) => b.cantidadSugerida - a.cantidadSugerida).slice(0, 5);
  
  const barData = sortedByQty.map(d => ({
    name: d.descripcion.substring(0, 25) + (d.descripcion.length > 25 ? '...' : ''),
    Cantidad: d.cantidadSugerida,
  }));

  // KPIs
  const totalToBuy = buyItems.reduce((acc, curr) => acc + (curr.cantidadSugerida * curr.costoUnitario), 0);
  const missingCostCount = buyItems.filter(i => i.costoUnitario === 0).length;

  return (
    <div className="analytics-section">
      <div className="bento-grid">
        <div className="card">
          <div className="card-title">Inversión Total Sugerida</div>
          <div className="card-value">${totalToBuy.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          {missingCostCount > 0 && (
            <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '8px' }}>
              ⚠️ {missingCostCount} ítems sugeridos no tienen costo asignado.
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Ítems a Comprar</div>
          <div className="card-value">{buyItems.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Total en Análisis</div>
          <div className="card-value">{data.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Pie Chart */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '16px' }}>Distribución de Demanda</div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '16px' }}>Top 5 Ítems (Cantidades Sugeridas)</div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 9 }} 
                  angle={-45} 
                  textAnchor="end" 
                  interval={0} 
                />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Bar dataKey="Cantidad" fill="#FFC107" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
