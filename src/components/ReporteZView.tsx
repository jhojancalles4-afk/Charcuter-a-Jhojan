import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  Send,
  Calendar,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Wallet,
  Building,
  CreditCard,
  ShoppingBag,
  Scale,
  Package,
  Plus,
  AlertTriangle,
  ChevronDown,
  Eye,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { AppSettings, ExpenseRecord, Product, SaleTicket, ZReportData } from '../types';
import {
  buildZReportData,
  formatQuantity,
  formatUSD,
  formatVES,
  generateWhatsAppZReport,
  ZReportPeriodFilter,
} from '../services/storage';
import {
  downloadZReportPNG,
  generateZReportCanvas,
  printZReportThermal,
} from '../services/receiptRenderer';

interface ReporteZViewProps {
  tickets: SaleTicket[];
  expenses: ExpenseRecord[];
  products: Product[];
  settings: AppSettings;
  onOpenNewExpenseModal: () => void;
}

export const ReporteZView: React.FC<ReporteZViewProps> = ({
  tickets,
  expenses,
  products,
  settings,
  onOpenNewExpenseModal,
}) => {
  const [period, setPeriod] = useState<ZReportPeriodFilter>('today');
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [showCanvasPreview, setShowCanvasPreview] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Compute Z-Report data in real time
  const reportData = useMemo(() => {
    return buildZReportData(tickets, expenses, settings, period, customStart, customEnd);
  }, [tickets, expenses, settings, period, customStart, customEnd]);

  // Update canvas preview if opened
  useEffect(() => {
    if (!showCanvasPreview || !canvasContainerRef.current) return;
    try {
      const canvas = generateZReportCanvas(reportData, settings);
      canvasContainerRef.current.innerHTML = '';
      canvas.style.width = '100%';
      canvas.style.maxWidth = '420px';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      canvas.style.boxShadow = '0 10px 30px -10px rgba(0,0,0,0.5)';
      canvasContainerRef.current.appendChild(canvas);
    } catch (e) {
      console.error('Error generating Z-Report preview canvas', e);
    }
  }, [showCanvasPreview, reportData, settings]);

  const handleDownloadPNG = () => {
    downloadZReportPNG(reportData, settings);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handlePrintThermal = () => {
    printZReportThermal(reportData, settings);
  };

  const handleSendWhatsApp = () => {
    const { url } = generateWhatsAppZReport(reportData, settings);
    window.open(url, '_blank');
  };

  return (
    <div id="reporte-z-view" className="space-y-4">
      {/* Header & Actions Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                Reporte Z: Cierre de Caja y Compras
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Balance de ventas, arqueo de efectivo en gaveta ($ y Bs.), salidas por egresos y reporte completo de mercancía vendida.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowCanvasPreview(!showCanvasPreview)}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              {showCanvasPreview ? 'Ocultar Ticket' : 'Ver Ticket Físico'}
            </button>

            <button
              onClick={handlePrintThermal}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              Imprimir Térmica
            </button>

            <button
              onClick={handleDownloadPNG}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-900/30 flex items-center gap-1.5 cursor-pointer"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  Descargado
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Descargar PNG
                </>
              )}
            </button>

            <button
              onClick={handleSendWhatsApp}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar WhatsApp
            </button>

            <button
              onClick={onOpenNewExpenseModal}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-amber-200 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/80 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Egreso
            </button>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: 'today', label: 'Hoy (Cierre Actual)' },
              { id: 'yesterday', label: 'Ayer' },
              { id: 'week', label: 'Últimos 7 Días' },
              { id: 'month', label: 'Este Mes' },
              { id: 'all', label: 'Todo el Historial' },
              { id: 'custom', label: 'Personalizado' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  period === p.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date range display */}
          <div className="text-xs text-slate-400 font-medium">
            Período: <span className="text-slate-200 font-bold">{reportData.dateRangeLabel}</span>
          </div>
        </div>

        {/* Custom date range picker if custom selected */}
        {period === 'custom' && (
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-semibold">Desde:</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-semibold">Hasta:</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Canvas Thermal Preview Accordion (Collapsible) */}
      {showCanvasPreview && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Vista Previa del Ticket Térmico Oficial (Reporte Z)
            </span>
            <span className="text-xs text-slate-400">80mm / 58mm Formato Monocromático</span>
          </div>
          <div
            ref={canvasContainerRef}
            className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 overflow-x-auto flex justify-center"
          />
        </div>
      )}

      {/* Top Financial Dashboard - Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Gross Sales */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Ventas Brutas Facturadas
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {formatUSD(reportData.grossSalesUSD)}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              {formatVES(reportData.grossSalesVES)}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>{reportData.validTicketsCount} facturas válidas</span>
            {reportData.voidedTicketsCount > 0 && (
              <span className="text-rose-400 font-semibold">
                {reportData.voidedTicketsCount} anuladas
              </span>
            )}
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Egresos y Gastos Operativos
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-mono text-rose-400">
              -{formatUSD(reportData.totalExpensesUSD)}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              -{formatVES(reportData.totalExpensesVES)}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>{reportData.expensesCount} egresos registrados</span>
            <button
              onClick={onOpenNewExpenseModal}
              className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
            >
              + Agregar gasto
            </button>
          </div>
        </div>

        {/* Net Flow */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Flujo Operativo Neto
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-mono text-indigo-400">
              {formatUSD(reportData.netOperatingFlowUSD)}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              {formatVES(reportData.netOperatingFlowVES)}
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            Ventas Netas menos Gastos del período
          </div>
        </div>
      </div>

      {/* Arqueo de Caja / Cuadratura de Fondos Físicos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">
              Arqueo de Caja: Fondos Esperados en Gaveta y Bancos
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Tasa BCV: {formatVES(reportData.currentBcvRate)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Cash USD */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>💵 Efectivo Divisas ($ USD)</span>
              <span className="text-slate-500">Gaveta $</span>
            </div>
            <div className="text-lg font-black font-mono text-emerald-400">
              {formatUSD(reportData.expectedCashDrawerUSD)}
            </div>
            <div className="text-[10px] text-slate-500">
              Ingresos ${formatUSD(reportData.incomeCashUSD)} - Egresos ${formatUSD(reportData.expensesCashUSD)}
            </div>
          </div>

          {/* Cash VES */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>🇻🇪 Efectivo Bolívares (Bs)</span>
              <span className="text-slate-500">Gaveta Bs</span>
            </div>
            <div className="text-lg font-black font-mono text-slate-200">
              {formatVES(reportData.expectedCashDrawerVES)}
            </div>
            <div className="text-[10px] text-slate-500">
              Ingresos {formatVES(reportData.incomeCashVES)} - Egresos {formatVES(reportData.expensesCashVES)}
            </div>
          </div>

          {/* Digital / Banks */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>💳 Bancos (Punto + Pago Móvil)</span>
              <span className="text-slate-500">Cuentas</span>
            </div>
            <div className="text-lg font-black font-mono text-cyan-400">
              {formatVES(reportData.expectedDigitalVES)}
            </div>
            <div className="text-[10px] text-slate-500">
              Punto {formatVES(reportData.incomePuntoVES)} + PM {formatVES(reportData.incomePagoMovilVES)} - Egresos {formatVES(reportData.expensesDigitalVES)}
            </div>
          </div>
        </div>
      </div>

      {/* Two columns: Income Channels Breakdown & Expenses by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income Channels Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Desglose de Ingresos por Medio de Pago
            </h4>
            <span className="text-xs font-mono text-slate-400">
              Total: {formatUSD(reportData.grossSalesUSD)}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="font-medium text-slate-300">💵 Efectivo Divisas ($ USD)</span>
              <div className="text-right">
                <span className="font-bold font-mono text-emerald-400">
                  {formatUSD(reportData.incomeCashUSD)}
                </span>
                <span className="text-[10px] text-slate-500 block font-mono">
                  {formatVES(reportData.incomeCashUSD_inVES)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="font-medium text-slate-300">🇻🇪 Efectivo Bolívares (Bs)</span>
              <span className="font-bold font-mono text-slate-200">
                {formatVES(reportData.incomeCashVES)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="font-medium text-slate-300">💳 Punto de Venta (Tarjetas Bs)</span>
              <span className="font-bold font-mono text-cyan-300">
                {formatVES(reportData.incomePuntoVES)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="font-medium text-slate-300">📲 Pago Móvil (Bs)</span>
              <span className="font-bold font-mono text-cyan-300">
                {formatVES(reportData.incomePagoMovilVES)}
              </span>
            </div>

            {reportData.incomeFiadoUSD > 0 && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/30 border border-amber-800/50">
                <span className="font-medium text-amber-300">⏳ Crédito Otorgado (Fiado)</span>
                <div className="text-right">
                  <span className="font-bold font-mono text-amber-300">
                    {formatUSD(reportData.incomeFiadoUSD)}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {formatVES(reportData.incomeFiadoVES)}
                  </span>
                </div>
              </div>
            )}

            {reportData.collectedAbonosUSD > 0 && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/30 border border-emerald-800/50">
                <span className="font-medium text-emerald-300">📥 Abonos de Fiados Cobrados</span>
                <div className="text-right">
                  <span className="font-bold font-mono text-emerald-300">
                    {formatUSD(reportData.collectedAbonosUSD)}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {formatVES(reportData.collectedAbonosVES)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Egresos Agrupados por Categoría
            </h4>
            <span className="text-xs font-mono text-rose-400">
              -{formatUSD(reportData.totalExpensesUSD)}
            </span>
          </div>

          {reportData.expensesByCategory.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              No hay egresos registrados en este período.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {reportData.expensesByCategory.map((cat) => {
                const percent =
                  reportData.totalExpensesUSD > 0
                    ? Math.round((cat.totalUSD / reportData.totalExpensesUSD) * 100)
                    : 0;

                return (
                  <div
                    key={cat.category}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">
                        {cat.category} ({cat.count})
                      </span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-rose-400">
                          -{formatUSD(cat.totalUSD)}
                        </span>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          -{formatVES(cat.totalVES)}
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* REPORTE COMPLETO DE COMPRAS / ARTÍCULOS DESPACHADOS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Reporte Completo de Compras y Artículos Despachados
              </h3>
              <p className="text-[11px] text-slate-400">
                Consolidado de kilogramos y unidades vendidas de cada producto en el período
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 text-xs font-mono font-semibold border border-slate-800">
              ⚖️ {reportData.totalKilosWeight.toFixed(3)} KG
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 text-xs font-mono font-semibold border border-slate-800">
              📦 {reportData.totalUnitsCount} UN
            </span>
          </div>
        </div>

        {reportData.productsSold.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No hay compras registradas en este período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Producto / Artículo</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-right">Volumen</th>
                  <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                  <th className="py-2.5 px-3 text-right">% Margen</th>
                  <th className="py-2.5 px-3 text-right">Venta Unit.</th>
                  <th className="py-2.5 px-3 text-right">Total Facturado</th>
                  <th className="py-2.5 px-3 text-right text-emerald-400">Utilidad Bruta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reportData.productsSold.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-850 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">
                      {item.productName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-950 text-slate-400 border border-slate-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-100">
                      {formatQuantity(item.quantitySold, item.unit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {formatUSD(item.unitCostUSD || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          (item.marginPercent || 0) >= 35
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                            : (item.marginPercent || 0) >= 20
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                        }`}
                      >
                        +{(item.marginPercent || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {formatUSD(item.unitPriceUSD || (item.totalUSD / (item.quantitySold || 1)))}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span className="font-bold text-slate-100 block">{formatUSD(item.totalUSD)}</span>
                      <span className="text-[10px] text-slate-400">{formatVES(item.totalVES)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      +{formatUSD(item.grossProfitUSD || (item.totalUSD - (item.totalCostUSD || 0)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Facturas Anuladas / Malas en el período */}
      {reportData.voidedTicketsList.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-900/50 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>Facturas Anuladas como Malas en este Período ({reportData.voidedTicketsCount})</span>
          </div>
          <div className="space-y-1.5 pt-1 text-xs">
            {reportData.voidedTicketsList.map((v) => (
              <div
                key={v.ticketNumber}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-rose-900/30"
              >
                <div>
                  <span className="font-mono font-bold text-rose-400">Ticket #{v.ticketNumber}</span>
                  <span className="text-slate-400 ml-2">({v.customerName})</span>
                  <span className="text-[11px] text-slate-500 block">Motivo: {v.reason}</span>
                </div>
                <div className="text-right font-mono font-bold text-rose-400">
                  {formatUSD(v.totalUSD)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
