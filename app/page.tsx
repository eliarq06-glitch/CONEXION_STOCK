"use client";

import { useState, useMemo, useEffect } from "react";
import { DataGrid, GridRow } from "./components/DataGrid";
import DashboardCharts from "./components/DashboardCharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LayoutDashboard, Database, FileText, Upload, Plus, Save, Download } from "lucide-react";

export default function Home() {
  const [data, setData] = useState<any[]>([]);
  
  const [filterMode, setFilterMode] = useState<"preset" | "custom">("preset");
  const [filterPeriod, setFilterPeriod] = useState<number>(90);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  
  const [marginPercent, setMarginPercent] = useState<number>(20);
  const [activeTab, setActiveTab] = useState<"dashboard" | "data" | "drafts">("data");
  const [drafts, setDrafts] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signName, setSignName] = useState("");
  const [signRole, setSignRole] = useState("COORDINADORA DE COMPRAS");

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailText, setEmailText] = useState("");

  useEffect(() => {
    fetchDrafts();
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/proveedores");
      if (res.ok) {
        const json = await res.json();
        setProviders(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addProvider = async (name: string) => {
    try {
      const res = await fetch("/api/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: name, defaultLeadTime: 0 })
      });
      if (res.ok) {
        fetchProviders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDrafts = async () => {
    try {
      const res = await fetch("/api/drafts");
      if (res.ok) {
        const json = await res.json();
        setDrafts(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await res.json();
    if (json.data) {
      setData(json.data);
      setActiveTab("dashboard");
    }
  };

  const addManualRow = () => {
    const newRow: GridRow = {
      id: crypto.randomUUID(),
      codigo: "NUEVO-000",
      descripcion: "NUEVO PRODUCTO MANUAL",
      ventas3M: 0, ventas6M: 0, ventas9M: 0, ventas12M: 0,
      validSales: [],
      proveedorNombre: "",
      leadTime: 0, costoUnitario: 0, precioVenta: 0, descuento: 0,
      margenUtilidad: 0, tipoDemanda: "BAJO PEDIDO", observaciones: "",
      cantidadSugerida: 0, semaforo: "ANÁLISIS PENDIENTE"
    };
    setData([newRow, ...data]);
  };

  const saveDraft = async () => {
    const name = prompt("Nombre para este borrador:", `Borrador ${new Date().toLocaleDateString()}`);
    if (!name) return;

    await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data })
    });
    alert("Borrador guardado con éxito.");
    fetchDrafts();
  };

  const loadDraft = (draftData: any) => {
    const parsed = typeof draftData === 'string' ? JSON.parse(draftData) : draftData;
    setData(parsed);
    setActiveTab("data");
  };

  const deleteRow = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este ítem?")) {
      setData(data.filter(r => r.id !== id));
    }
  };

  // Extraer meses disponibles
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    data.forEach(item => {
      if (item.validSales) {
        item.validSales.forEach((sale: any) => {
          let d = sale["FECHA"];
          if (!(d instanceof Date)) d = new Date(d);
          if (!isNaN(d.getTime())) {
            months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          }
        });
      }
    });
    return Array.from(months).sort().reverse();
  }, [data]);

  const computedData = useMemo(() => {
    return data.map(item => {
      const updated = { ...item };
      let ventasPeriodo = 0;
      let diasEvaluados = 90;

      if (filterMode === "preset") {
        diasEvaluados = filterPeriod;
        if (filterPeriod === 90) ventasPeriodo = updated.ventas3M;
        else if (filterPeriod === 180) ventasPeriodo = updated.ventas6M;
        else if (filterPeriod === 270) ventasPeriodo = updated.ventas9M;
        else if (filterPeriod === 360) ventasPeriodo = updated.ventas12M;
      } else {
        diasEvaluados = selectedMonths.length * 30 || 30; // 30 días aprox por mes seleccionado
        if (updated.validSales) {
          updated.validSales.forEach((sale: any) => {
            let d = sale["FECHA"];
            if (!(d instanceof Date)) d = new Date(d);
            if (!isNaN(d.getTime())) {
              const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              if (selectedMonths.includes(m)) {
                ventasPeriodo += Math.abs(Number(sale["CANTIDAD"]) || 0);
              }
            }
          });
        }
      }

      if (updated.costoUnitario > 0 && updated.precioVenta > 0) {
        const precioConDescuento = updated.precioVenta * (1 - (updated.descuento || 0) / 100);
        updated.margenUtilidad = ((precioConDescuento - updated.costoUnitario) / updated.costoUnitario) * 100;
      } else {
        updated.margenUtilidad = 0;
      }

      // Fórmulas matemáticas estrictas:
      const cpd = ventasPeriodo / diasEvaluados;
      const transito = cpd * updated.leadTime;
      const stockSeguridad = transito * (marginPercent / 100); // Margen dinámico
      
      const ceilTransito = Math.ceil(transito);
      const ceilSeguridad = Math.ceil(stockSeguridad);

      updated.cpd = cpd;
      updated.ventasPeriodo = ventasPeriodo;

      // Validación Matemática Estricta (Krajewski + Regla de Negocio)
      // Si vende menos de 1 unidad al mes (aprox CPD < 0.033), es imposible que sea RECURRENTE.
      if (cpd < 0.033) {
        updated.tipoDemanda = "BAJO PEDIDO";
        updated.semaforo = "NO COMPRAR";
        updated.cantidadSugerida = 0;
        updated.ceilTransito = 0;
        updated.ceilSeguridad = 0;
      } else {
        // Si superó el filtro y ya era recurrente, se calcula normal. Si ya era BAJO PEDIDO por falta de historial, se mantiene en 0.
        if (updated.tipoDemanda === "RECURRENTE") {
          updated.cantidadSugerida = ceilTransito + ceilSeguridad;
          updated.ceilTransito = ceilTransito;
          updated.ceilSeguridad = ceilSeguridad;
        } else {
          updated.cantidadSugerida = 0;
          updated.ceilTransito = 0;
          updated.ceilSeguridad = 0;
        }
      }

      // Reglas de semáforo
      if (updated.tipoDemanda === "PROYECTO") {
        updated.semaforo = "NO COMPRAR";
      } else if (updated.tipoDemanda === "RECURRENTE" && updated.cantidadSugerida > 0) {
        updated.semaforo = "COMPRAR";
      } else {
        updated.semaforo = "ANÁLISIS PENDIENTE";
      }

      return updated;
    });
  }, [data, filterPeriod, filterMode, selectedMonths, marginPercent]);

  const ceoAnalysis = useMemo(() => {
    if (computedData.length === 0) return null;
    
    const buyList = computedData.filter(r => r.semaforo === "COMPRAR");
    const noBuyList = computedData.filter(r => r.semaforo === "NO COMPRAR" || r.semaforo === "ANÁLISIS PENDIENTE");
    
    const totalInversion = buyList.reduce((sum, item) => sum + (item.cantidadSugerida * item.costoUnitario), 0);
    
    let recReason = "Se sugiere evaluar un bloque de 6 meses (180 días) para mitigar picos atípicos de ventas y mantener un flujo de caja conservador.";
    if (filterMode === "custom") {
      recReason = `Se está utilizando una selección de meses específicos (${selectedMonths.length} meses). Esta vista focalizada permite excluir temporalidades atípicas y analizar el C.P.D. con precisión quirúrgica.`;
    } else if (filterPeriod === 90) {
      recReason = "El filtro actual de 3 meses (90 días) es útil para capturar tendencias de consumo acelerado a corto plazo, asumiendo mayor riesgo de inventario.";
    } else if (filterPeriod === 360) {
      recReason = "El filtro de 12 meses garantiza máxima seguridad estadística, ideal para productos con fuerte estacionalidad anual.";
    }

    const insightText = `Tras auditar el flujo de inventario, mi diagnóstico ejecutivo es el siguiente: Existen ${buyList.length} SKU(s) que requieren reposición inmediata por un total de $${totalInversion.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD, para blindar la operación logística contra quiebres de stock considerando un margen de seguridad del ${marginPercent}%.\n\nPor otro lado, he bloqueado la compra de ${noBuyList.length} ítem(s) debido a su demanda esporádica (C.P.D. bajo) o falta de rentabilidad; adquirir estos últimos inmovilizaría capital de trabajo innecesariamente.\n\nEstrategia Temporal: ${recReason}`;

    return { insightText, buyCount: buyList.length, noBuyCount: noBuyList.length, totalInversion };
  }, [computedData, filterMode, filterPeriod, selectedMonths, marginPercent]);

  // Variables globales para la UI
  const itemsToBuy = computedData.filter(r => r.semaforo === "COMPRAR");
  const itemsWithMissingCost = itemsToBuy.filter(r => r.costoUnitario === 0 || !r.costoUnitario);
  const isPdfDisabled = itemsWithMissingCost.length > 0;

  const generateCEOReport = () => {
    if (isPdfDisabled) {
      alert("No se puede exportar: Hay ítems a comprar sin costo unitario asignado.");
      return;
    }
    
    if (itemsToBuy.length === 0) {
      alert("No hay ítems marcados para comprar.");
      return;
    }

    // Abrir modal de firma en lugar de exportar directamente
    setShowSignatureModal(true);
  };

  const openEmailModal = () => {
    let text = "Estimados,\n\nAdjunto el PDF de análisis de reposición. A continuación, el sustento técnico de los ítems con mayor urgencia (🚨):\n\n";
    const urgentItems = itemsToBuy.filter(r => r.cpd >= 0.15);
    
    if (urgentItems.length === 0) {
      text += "(No hay ítems marcados como urgencia máxima en este reporte)\n\n";
    } else {
      urgentItems.forEach(r => {
        text += `🚨 ${r.descripcion}:\nDebido a su velocidad de venta (Consumo Promedio Diario de ${r.cpd} unidades), necesitamos cubrir un tiempo de entrega de ${r.leadTime} días (Lead Time). Sugiero la compra de ${r.cantidadSugerida} unidades exactas, contemplando un ${marginPercent}% de stock de seguridad para evitar quiebres de inventario.\n\n`;
      });
    }

    const normalItems = itemsToBuy.filter(r => r.cpd < 0.15);
    if (normalItems.length > 0) {
      text += "Además, se sugiere la reposición normal (🟢) de los siguientes ítems:\n\n";
      normalItems.forEach(r => {
        text += `🟢 ${r.descripcion}: CPD de ${r.cpd}, Cantidad sugerida: ${r.cantidadSugerida} unidades.\n`;
      });
    }
    
    setEmailText(text);
    setShowEmailModal(true);
  };

  const confirmAndExportPDF = async () => {
    // Ordenamiento Lógico: Primero los que se COMPRAN, luego el resto, y dentro de eso alfabético.
    const sortedItems = [...computedData].sort((a, b) => {
      if (a.semaforo === "COMPRAR" && b.semaforo !== "COMPRAR") return -1;
      if (b.semaforo === "COMPRAR" && a.semaforo !== "COMPRAR") return 1;
      return a.descripcion.localeCompare(b.descripcion);
    });

    const doc = new jsPDF("landscape");
    const totalInversion = ceoAnalysis ? ceoAnalysis.totalInversion : 0;

    // CEO Header Design
    doc.setFillColor(27, 31, 58); // Exact Navy Blue (#1b1f3a)
    doc.rect(0, 0, doc.internal.pageSize.width, 40, "F");

    try {
      const img = new window.Image();
      img.src = '/LOGO_CONEXION.jpg';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      // Inyectar Logo corporativo a la derecha
      doc.addImage(img, 'JPEG', 238, 5, 45, 15);
    } catch (e) {
      console.warn("Logo LOGO_CONEXION.jpg no encontrado o no se pudo cargar.");
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("AUDITORÍA FINANCIERA: REPOSICIÓN DE INVENTARIO", 14, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 210);
    const txtPeriodo = filterMode === "preset" ? `${filterPeriod} días` : `${selectedMonths.length} mes(es) específicos`;
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}   |   Periodo Analizado: ${txtPeriodo}`, 14, 25);

    // Executive Summary
    doc.setTextColor(27, 31, 58);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("1. RESUMEN EJECUTIVO (DIAGNÓSTICO)", 14, 52);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const executiveText = ceoAnalysis?.insightText || "";
    const splitExecText = doc.splitTextToSize(executiveText, 270);
    doc.text(splitExecText, 14, 58);
    
    const tableTitleY = 58 + (splitExecText.length * 5) + 10;
    
    // Table
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("2. DETALLE TÉCNICO DE REPOSICIÓN", 14, tableTitleY);

    const tableStartY = tableTitleY + 5;

    // Preparar columnas
    const columns = [
      { header: 'Código', dataKey: 'codigo' },
      { header: 'Descripción (Producto)', dataKey: 'descripcion' },
      { header: 'Costo Unit.', dataKey: 'costoUnitario' },
      { header: `Vtas.(${filterMode === 'preset' ? filterPeriod + 'd' : 'Pers.'})`, dataKey: 'ventasPeriodo' },
      { header: 'Lead Time\n(Días)', dataKey: 'leadTime' },
      { header: 'C.P.D.', dataKey: 'cpd' },
      { header: 'Cant.\nSugerida', dataKey: 'cantidadSugerida' },
      { header: 'Veredicto del Analista', dataKey: 'veredicto' }
    ];

    const bodyData = sortedItems.map(item => {
      const leadT = item.leadTime || 0;
      const cpd = item.cpd || 0;
      const valTransito = item.ceilTransito || 0;
      const valSeguridad = item.ceilSeguridad || 0;
      
      const lblTransito = valTransito === 1 ? "unidad" : "unidades";
      const lblSeguridad = valSeguridad === 1 ? "unidad" : "unidades";
      
      let vText = "";
      if (item.semaforo === "NO COMPRAR" || cpd < 0.033) {
        vText = "Demanda esporádica (C.P.D. muy bajo). Compra sugerida únicamente bajo requerimiento de proyecto/cliente.";
      } else {
        const urgencia = cpd >= 0.15 ? "Urgente." : "Reposición Normal.";
        vText = `${urgencia} Para cubrir el Lead Time de ${leadT} días se requiere ${valTransito} ${lblTransito}, más ${valSeguridad} ${lblSeguridad} como margen operativo del ${marginPercent}%. Total a pedir: ${item.cantidadSugerida}.`;
      }
      
      const isDanger = item.margenUtilidad < 15;
      const descFormatted = item.descripcion;

      return {
        ...item,
        descripcion: descFormatted,
        costoUnitario: `$${item.costoUnitario.toFixed(2)}`,
        cpd: item.cpd!.toFixed(2),
        veredicto: vText,
        _isDanger: isDanger,
        _isUrgent: cpd >= 0.15 && item.semaforo === "COMPRAR"
      };
    });

    autoTable(doc, {
      startY: tableStartY,
      headStyles: { fillColor: [27, 31, 58], textColor: 255, fontStyle: 'bold' }, 
      styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: { 
        codigo: { cellWidth: 19, fontStyle: 'bold' },
        descripcion: { cellWidth: 50 },
        costoUnitario: { cellWidth: 18, halign: 'right' },
        ventasPeriodo: { cellWidth: 22, halign: 'center' },
        leadTime: { cellWidth: 18, halign: 'center' },
        cpd: { cellWidth: 15, halign: 'right' },
        cantidadSugerida: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
        veredicto: { cellWidth: 109, halign: 'justify' }
      },
      columns: columns,
      body: bodyData,
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.raw._isUrgent) {
          data.cell.styles.fillColor = [255, 248, 220]; // Resaltado amarillo para URGENTES
        }
      }
    });

    // Añadir firma al final
    let finalY = (doc as any).lastAutoTable.finalY + 30;
    if (finalY > 180) {
      doc.addPage();
      finalY = 40;
    }
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(27, 31, 58);
    doc.line(14, finalY, 80, finalY); 
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(signName.toUpperCase(), 14, finalY + 6);
    doc.setFont("helvetica", "normal");
    doc.text(signRole.toUpperCase(), 14, finalY + 12);

    doc.save(`Reporte_Auditoria_Compras_${new Date().getTime()}.pdf`);
    setShowSignatureModal(false);
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <img src="/LOGO_CONEXION.jpg" alt="Logo Conexion" style={{ width: '180px', objectFit: 'contain' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>

        <div 
          className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <LayoutDashboard size={20} /> Dashboard & Analytics
        </div>
        <div 
          className={`nav-item ${activeTab === "data" ? "active" : ""}`}
          onClick={() => setActiveTab("data")}
        >
          <Database size={20} /> Data Grid (Inventario)
        </div>
        <div 
          className={`nav-item ${activeTab === "drafts" ? "active" : ""}`}
          onClick={() => setActiveTab("drafts")}
        >
          <FileText size={20} /> Borradores Guardados
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        
        {/* Header Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
              {activeTab === "dashboard" ? "Dashboard Financiero" : activeTab === "data" ? "Gestión de Inventario" : "Borradores del Sistema"}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>Procesa y analiza el reporte consolidado para reposición.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Upload Button */}
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={18} /> Subir Excel
              <input type="file" accept=".xlsx,.xls" hidden onChange={handleFileUpload} />
            </label>

            {data.length > 0 && activeTab === "data" && (
              <>
                <button className="btn btn-secondary" onClick={saveDraft}>
                  <Save size={18} /> Guardar Borrador
                </button>
                <button className="btn btn-primary" onClick={openEmailModal} style={{ backgroundColor: '#FFC107', color: '#0A192F', border: 'none' }}>
                  ✉️ Generar Correo
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={generateCEOReport}
                    disabled={isPdfDisabled}
                    style={isPdfDisabled ? { opacity: 0.5, cursor: 'not-allowed', background: 'var(--text-muted)' } : {}}
                  >
                    <Download size={18} /> Generar Reporte CEO
                  </button>
                  {isPdfDisabled && (
                    <span style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 600 }}>
                      ⚠️ Bloqueado: Faltan {itemsWithMissingCost.length} costos unitarios.
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "dashboard" && (
          <>
            {ceoAnalysis && (
              <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--warning)', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '20px' }}>💡</span>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>Diagnóstico Ejecutivo del Sistema</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                  {ceoAnalysis.insightText}
                </p>
              </div>
            )}
            <DashboardCharts data={computedData} />
          </>
        )}

        {activeTab === "drafts" && (
          <div className="bento-grid">
            {drafts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No hay borradores guardados actualmente.</p>
            ) : (
              drafts.map((draft, idx) => (
                <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{draft.name || `Borrador ${idx + 1}`}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Fecha: {new Date(draft.createdAt).toLocaleString()}
                  </p>
                  <button className="btn btn-secondary" style={{ marginTop: 'auto' }} onClick={() => loadDraft(draft.data)}>
                    Cargar Datos
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "data" && (
          <>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Tipo de Filtro:</span>
                <select 
                  className="editable-cell" 
                  style={{ background: 'var(--bg-body)', width: '150px', padding: '10px', border: '1px solid var(--border)' }}
                  value={filterMode} 
                  onChange={(e) => setFilterMode(e.target.value as any)}
                >
                  <option value="preset">Rangos Fijos</option>
                  <option value="custom">Meses Específicos</option>
                </select>

                {filterMode === "preset" ? (
                  <select 
                    className="editable-cell" 
                    style={{ background: 'var(--bg-body)', width: '200px', padding: '10px', border: '1px solid var(--border)' }}
                    value={filterPeriod} 
                    onChange={(e) => setFilterPeriod(Number(e.target.value))}
                  >
                    <option value={90}>Últimos 3 Meses</option>
                    <option value={180}>Últimos 6 Meses</option>
                    <option value={270}>Últimos 9 Meses</option>
                    <option value={360}>Últimos 12 Meses</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '500px' }}>
                    {availableMonths.map(m => (
                      <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-body)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '13px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedMonths.includes(m)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMonths([...selectedMonths, m]);
                            else setSelectedMonths(selectedMonths.filter(x => x !== m));
                          }}
                        />
                        {m}
                      </label>
                    ))}
                    {availableMonths.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Cargue un archivo para ver meses</span>}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                  <span style={{ fontWeight: 600 }}>Margen Seg. (%):</span>
                  <input 
                    type="number" 
                    value={marginPercent} 
                    onChange={e => setMarginPercent(Number(e.target.value))}
                    className="editable-cell"
                    style={{ width: '60px', padding: '10px', background: 'var(--bg-body)', border: '1px solid var(--border)' }}
                  />
                </div>

                <button className="btn btn-secondary" onClick={addManualRow}>
                  <Plus size={18} /> Agregar Ítem Manual
                </button>
              </div>
            </div>

            {/* Tabla Dark UI */}
            <div className="dark-panel">
              <div className="panel-header">
                <h3>Data Grid Activo ({data.length} registros)</h3>
              </div>
              {data.length > 0 ? (
                <DataGrid 
                  data={computedData} 
                  providers={providers}
                  updateRow={(id, field, value) => {
                    setData(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
                  }} 
                  onAddProvider={addProvider}
                  deleteRow={deleteRow}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
                  Sube un archivo Excel, carga un borrador, o agrega un ítem manual para comenzar.
                </div>
              )}
            </div>
          </>
        )}

      </div>
      {/* Ventana Modal de Firma */}
      {showSignatureModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', marginBottom: '20px' }}>Firma del Reporte</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Responsable / Analista:</label>
              <input 
                type="text" 
                value={signName}
                onChange={e => setSignName(e.target.value)}
                placeholder="Ej. Aime"
                className="editable-cell"
                style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-muted)' }}>Cargo / Rol:</label>
              <input 
                type="text" 
                value={signRole}
                onChange={e => setSignRole(e.target.value)}
                className="editable-cell"
                style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowSignatureModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={confirmAndExportPDF}
                disabled={!signName.trim()}
                style={!signName.trim() ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                Confirmar y Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ventana Modal de Correo Electrónico */}
      {showEmailModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', width: '600px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--text-main)', marginBottom: '20px' }}>Borrador de Correo de Reposición</h3>
            
            <textarea 
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
              style={{ width: '100%', height: '300px', padding: '15px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.5', resize: 'none' }}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowEmailModal(false)}
              >
                Cerrar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  navigator.clipboard.writeText(emailText);
                  alert("¡Texto copiado al portapapeles!");
                }}
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                Copiar Texto
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
