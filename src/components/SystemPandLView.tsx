import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Send,
  Printer,
  ShoppingBag,
  Boxes,
  PieChart,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Download,
  Filter,
  ShieldCheck,
  CreditCard,
  Wallet,
  Building,
} from 'lucide-react';
import {
  AppSettings,
  ExpenseRecord,
  Product,
  RestockRecord,
  SaleTicket,
  SystemPandLData,
} from '../types';
import {
  formatUSD,
  formatVES,
  formatQuantity,
  buildSystemPandLReport,
  generateWhatsAppPandLReport,
  ZReportPeriodFilter,
} from '../services/storage';

interface SystemPandLViewProps {
  tickets: SaleTicket[];
  expenses: ExpenseRecord[];
  restocks: RestockRecord[];
  products: Product[];
  settings: AppSettings;
}

export const SystemPandLView: React.FC<SystemPandLViewProps> = ({
  tickets,
  expenses,
  restocks,
  products,
  settings,
}) => {
  const [period, setPeriod] = useState<ZReportPeriodFilter>('month');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Compute the comprehensive P&L data
  const report: SystemPandLData = useMemo(() => {
    return buildSystemPandLReport(
      tickets,
      expenses,
      restocks,
      products,
      settings,
      period,
      customStart,
      customEnd
    );
  }, [tickets, expenses, restocks, products, settings, period, customStart, customEnd]);

  // WhatsApp Share URL
  const { url: whatsAppUrl, message: whatsAppMessage } = useMemo(() => {
    return generateWhatsAppPandLReport(report, settings);
  }, [report, settings]);

  const handleCopyReport = () => {
    navigator.clipboard.writeText(whatsAppMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Controls: Period Selection & Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Estado de Pérdidas y Ganancias del Sistema (P&L)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Auditoría financiera integral: Ingresos de ventas, costo de mercancía (COGS), gastos operativos y resultado neto real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleCopyReport}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              {copiedMessage ? '✓ Copiado' : 'Copiar Texto'}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-800">
          <span className="text-xs text-slate-400 font-semibold mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Período:</span>
          </span>

          {[
            { id: 'today', label: 'Hoy' },
            { id: 'yesterday', label: 'Ayer' },
            { id: 'week', label: 'Últimos 7 Días' },
            { id: 'month', label: 'Mes Actual' },
            { id: 'all', label: 'Todo el Histórico' },
            { id: 'custom', label: 'Rango Personalizado' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriod(tab.id as ZReportPeriodFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                period === tab.id
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-2 mt-2 sm:mt-0">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
              />
              <span className="text-slate-500 text-xs">hasta</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* CORE FINANCIAL RESULT: HERO CARD (NET PROFIT / LOSS) */}
      <div
        className={`p-6 sm:p-7 rounded-3xl border shadow-2xl relative overflow-hidden transition-all ${
          report.isProfit
            ? 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/40'
            : 'bg-gradient-to-br from-rose-950/80 via-slate-900 to-slate-950 border-rose-500/40'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                  report.isProfit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {report.isProfit ? '🟢 RESULTADO POSITIVO: GANANCIA NETA' : '🔴 RESULTADO NEGATIVO: PÉRDIDA NETA'}
              </span>
              <span className="text-xs text-slate-400 font-mono">({report.periodLabel})</span>
            </div>

            <div className="flex items-baseline gap-3">
              <span
                className={`text-3xl sm:text-5xl font-black font-mono tracking-tight ${
                  report.isProfit ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {report.netProfitUSD >= 0 ? '+' : ''}
                {formatUSD(report.netProfitUSD)}
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-300">
                (~{formatVES(report.netProfitVES)})
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-xl">
              Margen Neto Real del <strong>{report.netMarginPercent}%</strong> sobre ventas totales después de
              descontar el costo directo de la mercancía ({formatUSD(report.costOfGoodsSoldUSD)}) y gastos operativos (
              {formatUSD(report.operatingExpensesUSD)}).
            </p>
          </div>

          {/* Quick Sub-Metrics Bento */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Utilidad Bruta (Margen)</span>
              <span className="text-base sm:text-lg font-mono font-bold text-white block">
                {formatUSD(report.grossProfitUSD)}
              </span>
              <span className="text-xs font-bold text-emerald-400">{report.grossMarginPercent}% margen</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Flujo Operativo Neto</span>
              <span className="text-base sm:text-lg font-mono font-bold text-white block">
                {formatUSD(report.collectedSalesUSD - report.totalExpensesUSD)}
              </span>
              <span className="text-xs text-slate-400 font-mono">Caja & Cobros</span>
            </div>
          </div>
        </div>
      </div>

      {/* THE FINANCIAL BRIDGE (WATERFALL CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Ventas Netas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-bold text-emerald-400 uppercase tracking-wide">1. Ventas Netas</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">
            {formatUSD(report.totalSalesUSD)}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">
            {formatVES(report.totalSalesVES)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            {report.validTicketsCount} facturas válidas ({report.totalWeightSoldKG.toFixed(2)} KG y {report.totalUnitsSoldUN} UN)
          </div>
        </div>

        {/* 2. Costo de Mercancía (COGS) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-bold text-rose-400 uppercase tracking-wide">2. Costo Mercancía (COGS)</span>
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-400">
            -{formatUSD(report.costOfGoodsSoldUSD)}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">
            -{formatVES(report.costOfGoodsSoldVES)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            Costo de lo que salió del inventario
          </div>
        </div>

        {/* 3. Utilidad Bruta */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-bold text-blue-400 uppercase tracking-wide">3. Utilidad Bruta</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-blue-400">
            {formatUSD(report.grossProfitUSD)}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">
            {formatVES(report.grossProfitVES)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            Margen bruto: <strong>{report.grossMarginPercent}%</strong>
          </div>
        </div>

        {/* 4. Gastos Operativos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-bold text-amber-400 uppercase tracking-wide">4. Gastos Operativos</span>
            <ArrowDownRight className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
            -{formatUSD(report.operatingExpensesUSD)}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">
            -{formatVES(report.operatingExpensesVES)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            {expenses.length} egresos (nómina, bolsas, servicios)
          </div>
        </div>
      </div>

      {/* SECTION: ARQUEO DE CAJA Y CUENTAS CORRIENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Arqueo de Caja / Dinero Esperado */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Arqueo de Caja y Dinero en Custodia</span>
          </h3>

          <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Efectivo $ Gaveta:</span>
              <span className="text-base font-bold text-emerald-400">
                {formatUSD(report.cashInDrawerUSD)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Efectivo Bs Gaveta:</span>
              <span className="text-sm font-bold text-slate-200">
                {formatVES(report.cashInDrawerVES)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[10px] block">En Bancos (Punto/PM):</span>
              <span className="text-sm font-bold text-blue-400">
                {formatVES(report.digitalInBankVES)}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Ventas Cobradas de Contado:</span>
              <span className="font-mono text-white">{formatUSD(report.collectedSalesUSD)}</span>
            </div>
            {report.creditSalesUSD > 0 && (
              <div className="flex justify-between">
                <span>Fiados Otorgados en el período:</span>
                <span className="font-mono text-amber-400">{formatUSD(report.creditSalesUSD)}</span>
              </div>
            )}
            {report.collectedFiadosAbonosUSD > 0 && (
              <div className="flex justify-between">
                <span>Abonos de Fiados Cobrados en el período:</span>
                <span className="font-mono text-emerald-400">+{formatUSD(report.collectedFiadosAbonosUSD)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cuentas Corrientes del Sistema */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-400" />
            <span>Cuentas Corrientes Globales del Negocio</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30">
              <span className="text-[11px] font-bold text-amber-300 block mb-1">
                📥 Cuentas por Cobrar (Fiados en la calle)
              </span>
              <span className="text-xl font-black font-mono text-amber-400 block">
                {formatUSD(report.currentAccountsReceivableUSD)}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                (~{formatVES(report.currentAccountsReceivableUSD * settings.bcvRate)})
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/30">
              <span className="text-[11px] font-bold text-rose-300 block mb-1">
                📤 Cuentas por Pagar (Proveedores a crédito)
              </span>
              <span className="text-xl font-black font-mono text-rose-400 block">
                {formatUSD(report.currentAccountsPayableUSD)}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                (~{formatVES(report.currentAccountsPayableUSD * settings.bcvRate)})
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
            <span className="text-slate-400">Posición Neta de Deudas (Cobrar - Pagar):</span>
            <span
              className={`font-mono font-bold text-sm ${
                report.currentAccountsReceivableUSD >= report.currentAccountsPayableUSD
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {formatUSD(report.currentAccountsReceivableUSD - report.currentAccountsPayableUSD)}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION: TOP PRODUCTOS MÁS RENTABLES */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-400" />
              <span>Desglose de Rentabilidad por Producto ({report.topProducts.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Ingresos generados, costo estimado y ganancia neta aportada por cada producto vendido en el período.
            </p>
          </div>
        </div>

        {report.topProducts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No hay ventas registradas en el período seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Producto</th>
                  <th className="py-2.5 px-3 text-right">Cantidad Despachada</th>
                  <th className="py-2.5 px-3 text-right">Venta Total ($)</th>
                  <th className="py-2.5 px-3 text-right">Costo Total ($)</th>
                  <th className="py-2.5 px-3 text-right text-emerald-400">Ganancia Neta ($)</th>
                  <th className="py-2.5 px-3 text-right">% Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {report.topProducts.map((p) => (
                  <tr key={p.productId} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-sans font-semibold text-white">
                      {p.productName}
                      <span className="text-[10px] text-slate-500 font-mono block">{p.category}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {formatQuantity(p.quantitySold, p.unit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      {formatUSD(p.revenueUSD)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-400">
                      -{formatUSD(p.costUSD)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                      +{formatUSD(p.profitUSD)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.marginPercent >= 35
                            ? 'bg-emerald-950 text-emerald-300'
                            : p.marginPercent >= 20
                            ? 'bg-blue-950 text-blue-300'
                            : 'bg-amber-950 text-amber-300'
                        }`}
                      >
                        {p.marginPercent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION: GASTOS OPERATIVOS POR CATEGORÍA */}
      {report.expensesByCategory.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
          <h3 className="font-bold text-sm sm:text-base text-white">
            Desglose de Gastos Operativos por Categoría
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {report.expensesByCategory.map((c) => (
              <div
                key={c.category}
                className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-200 block">{c.category}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {c.count} gasto{c.count > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-sm font-bold text-rose-400 block">-{formatUSD(c.totalUSD)}</span>
                  <span className="text-[10px] text-slate-400">-{formatVES(c.totalVES)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
