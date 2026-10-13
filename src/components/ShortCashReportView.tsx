import React, { useState, useMemo } from 'react';
import {
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Wallet,
  Smartphone,
  CreditCard,
  Building2,
  Calendar,
  Share2,
  Copy,
  Printer,
  Check,
  AlertCircle,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { AppSettings, ExpenseRecord, SaleTicket } from '../types';
import { formatUSD, formatVES, generateTelegramShareUrl } from '../services/storage';

interface ShortCashReportViewProps {
  tickets: SaleTicket[];
  expenses: ExpenseRecord[];
  settings: AppSettings;
}

export const ShortCashReportView: React.FC<ShortCashReportViewProps> = ({
  tickets,
  expenses,
  settings,
}) => {
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('today');
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [copied, setCopied] = useState(false);

  // Calculate timestamps for filtering
  const { startMs, endMs, periodLabel } = useMemo(() => {
    const now = new Date();
    let start = 0;
    let end = 0;
    let label = 'Hoy';

    if (period === 'today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      start = startOfToday.getTime();
      end = endOfToday.getTime();
      label = `Hoy (${now.toLocaleDateString('es-VE')})`;
    } else if (period === 'yesterday') {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const startY = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      const endY = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      start = startY.getTime();
      end = endY.getTime();
      label = `Ayer (${y.toLocaleDateString('es-VE')})`;
    } else if (period === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start = sevenDaysAgo.getTime();
      end = now.getTime();
      label = 'Últimos 7 días';
    } else if (period === 'month') {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      start = startMonth.getTime();
      end = endMonth.getTime();
      label = `Este mes (${now.toLocaleString('es-VE', { month: 'long', year: 'numeric' })})`;
    } else if (period === 'custom') {
      start = new Date(`${customStart}T00:00:00`).getTime();
      end = new Date(`${customEnd}T23:59:59.999`).getTime();
      label = `${customStart} al ${customEnd}`;
    } else {
      start = 0;
      end = Number.MAX_SAFE_INTEGER;
      label = 'Histórico Completo';
    }

    return { startMs: start, endMs: end, periodLabel: label };
  }, [period, customStart, customEnd]);

  // Aggregate metrics
  const report = useMemo(() => {
    // 1. Filter Tickets in Period
    const periodTickets = tickets.filter((t) => {
      const ms = new Date(t.date).getTime();
      return ms >= startMs && ms <= endMs;
    });

    let totalTickets = periodTickets.length;
    let validTickets = 0;
    let voidedTickets = 0;
    let fiadoTickets = 0;

    // Incomes collected by channel
    let collectedCashUSD = 0;
    let collectedCashVES = 0;
    let collectedPagoMovilVES = 0;
    let collectedPuntoVES = 0;
    let collectedTransferenciaVES = 0;
    let pendingFiadoUSD = 0;
    let pendingFiadoVES = 0;

    for (const t of periodTickets) {
      if (t.isVoided) {
        voidedTickets++;
        continue;
      }

      validTickets++;

      if (t.paymentMethod === 'cash_usd') {
        collectedCashUSD += t.totalUSD;
      } else if (t.paymentMethod === 'cash_ves') {
        collectedCashVES += t.totalVES;
      } else if (t.paymentMethod === 'pago_movil') {
        collectedPagoMovilVES += t.totalVES;
      } else if (t.paymentMethod === 'punto') {
        collectedPuntoVES += t.totalVES;
      } else if (t.paymentMethod === 'fiado') {
        fiadoTickets++;
        pendingFiadoUSD += t.pendingUSD;
        pendingFiadoVES += t.pendingVES;
      } else if (t.paymentMethod === 'mixed' && t.paymentSplits) {
        for (const sp of t.paymentSplits) {
          if (sp.method === 'cash_usd') {
            collectedCashUSD += sp.amountUSD;
          } else if (sp.method === 'cash_ves') {
            collectedCashVES += sp.amountVES;
          } else if (sp.method === 'pago_movil') {
            collectedPagoMovilVES += sp.amountVES;
          } else if (sp.method === 'punto') {
            collectedPuntoVES += sp.amountVES;
          } else if (sp.method === 'fiado') {
            pendingFiadoUSD += sp.amountUSD;
            pendingFiadoVES += sp.amountVES;
          }
        }
      }
    }

    // Abonos collected during this period from any tickets
    for (const t of tickets) {
      if (t.abonos && t.abonos.length > 0) {
        for (const ab of t.abonos) {
          const abMs = new Date(ab.date).getTime();
          if (abMs >= startMs && abMs <= endMs) {
            if (ab.method === 'cash_usd') {
              collectedCashUSD += ab.amountUSD;
            } else if (ab.method === 'cash_ves') {
              collectedCashVES += ab.amountVES;
            } else if (ab.method === 'pago_movil') {
              collectedPagoMovilVES += ab.amountVES;
            } else if (ab.method === 'punto') {
              collectedPuntoVES += ab.amountVES;
            }
          }
        }
      }
    }

    // 2. Filter Expenses in Period
    const periodExpenses = expenses.filter((e) => {
      const ms = new Date(e.date).getTime();
      return ms >= startMs && ms <= endMs;
    });

    let spentCashUSD = 0;
    let spentCashVES = 0;
    let spentPagoMovilVES = 0;
    let spentPuntoVES = 0;
    let spentTransferenciaVES = 0;

    for (const e of periodExpenses) {
      if (e.paymentMethod === 'cash_usd') {
        spentCashUSD += e.amountUSD;
      } else if (e.paymentMethod === 'cash_ves') {
        spentCashVES += e.amountVES;
      } else if (e.paymentMethod === 'pago_movil') {
        spentPagoMovilVES += e.amountVES;
      } else if (e.paymentMethod === 'punto') {
        spentPuntoVES += e.amountVES;
      } else if (e.paymentMethod === 'transferencia') {
        spentTransferenciaVES += e.amountVES;
      }
    }

    // Totals in USD & VES
    const rate = settings.bcvRate || 1;

    // Total Recogido (Efectivamente cobrado)
    const totalCollectedVES =
      collectedCashUSD * rate +
      collectedCashVES +
      collectedPagoMovilVES +
      collectedPuntoVES +
      collectedTransferenciaVES;
    const totalCollectedUSD = totalCollectedVES / rate;

    // Total Sacado (Egresos pagados)
    const totalSpentVES =
      spentCashUSD * rate +
      spentCashVES +
      spentPagoMovilVES +
      spentPuntoVES +
      spentTransferenciaVES;
    const totalSpentUSD = totalSpentVES / rate;

    // Debes tener por método
    const balanceCashUSD = collectedCashUSD - spentCashUSD;
    const balanceCashVES = collectedCashVES - spentCashVES;
    const balancePagoMovilVES = collectedPagoMovilVES - spentPagoMovilVES;
    const balancePuntoVES = collectedPuntoVES - spentPuntoVES;
    const balanceTransferenciaVES = collectedTransferenciaVES - spentTransferenciaVES;

    // Total Neto Disponible
    const netAvailableUSD = totalCollectedUSD - totalSpentUSD;
    const netAvailableVES = totalCollectedVES - totalSpentVES;

    return {
      totalTickets,
      validTickets,
      voidedTickets,
      fiadoTickets,
      // Plata recogida
      totalCollectedUSD,
      totalCollectedVES,
      collectedCashUSD,
      collectedCashVES,
      collectedPagoMovilVES,
      collectedPuntoVES,
      collectedTransferenciaVES,
      pendingFiadoUSD,
      pendingFiadoVES,
      // Plata sacada
      expensesCount: periodExpenses.length,
      totalSpentUSD,
      totalSpentVES,
      spentCashUSD,
      spentCashVES,
      spentPagoMovilVES,
      spentPuntoVES,
      spentTransferenciaVES,
      // Debes de tener
      balanceCashUSD,
      balanceCashVES,
      balancePagoMovilVES,
      balancePuntoVES,
      balanceTransferenciaVES,
      netAvailableUSD,
      netAvailableVES,
      rate,
    };
  }, [tickets, expenses, startMs, endMs, settings.bcvRate]);

  // Generate ultra-concise text for WhatsApp and Clipboard
  const formattedText = useMemo(() => {
    return `🧀 *${settings.businessName.toUpperCase()}*
📋 *REPORTE Y CUADRE DE CAJA*
📅 *Período:* ${periodLabel}
💵 *Tasa BCV:* ${formatVES(report.rate)} / USD
━━━━━━━━━━━━━━━━━━━━
🧾 *FACTURAS:*
• Total emitidas: *${report.totalTickets} facturas* (${report.validTickets} válidas, ${report.voidedTickets} anuladas)

💰 *RECOGISTE (INGRESOS COBRADOS):*
• *${formatUSD(report.totalCollectedUSD)} USD* (~${formatVES(report.totalCollectedVES)})

💸 *SACASTE (EGRESOS / PAGOS):*
• *${formatUSD(report.totalSpentUSD)} USD* (~${formatVES(report.totalSpentVES)}) [${report.expensesCount} salidas]
━━━━━━━━━━━━━━━━━━━━
💵 *DEBES DE TENER EN CAJA:*
• *Divisa Efectivo ($):* ${formatUSD(report.balanceCashUSD)}
• *Bolívares Efectivo:* ${formatVES(report.balanceCashVES)}
• *Pago Móvil:* ${formatVES(report.balancePagoMovilVES)} (~${formatUSD(report.balancePagoMovilVES / report.rate)})
• *Punto de Venta:* ${formatVES(report.balancePuntoVES)} (~${formatUSD(report.balancePuntoVES / report.rate)})
${report.balanceTransferenciaVES !== 0 ? `• *Transferencia:* ${formatVES(report.balanceTransferenciaVES)}\n` : ''}━━━━━━━━━━━━━━━━━━━━
✨ *TOTAL NETO DISPONIBLE:*
👉 *${formatUSD(report.netAvailableUSD)} USD*
👉 *${formatVES(report.netAvailableVES)}*
${report.pendingFiadoUSD > 0 ? `\n⚠️ *Por Cobrar en Fiados:* ${formatUSD(report.pendingFiadoUSD)} (~${formatVES(report.pendingFiadoVES)})\n` : ''}`;
  }, [report, settings.businessName, periodLabel]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(formattedText)}`;
    window.open(url, '_blank');
  };

  const handleTelegram = () => {
    const url = generateTelegramShareUrl(formattedText);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="short-cash-report-container" className="space-y-4">
      {/* Period Selection & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base sm:text-lg text-white">
              Cuadre y Reporte Preciso de Caja
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Balance directo de facturación, dinero recogido, dinero sacado y arqueo exacto por moneda.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer shadow-sm active:scale-95"
            title="Copiar reporte al portapapeles"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
          </button>

          <button
            type="button"
            id="btn-telegram-short-cash"
            onClick={handleTelegram}
            className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-sky-950/50 cursor-pointer active:scale-95"
            title="Enviar reporte por Telegram"
          >
            <Send className="w-4 h-4" />
            <span>Telegram</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsApp}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-950/50 cursor-pointer active:scale-95"
            title="Enviar reporte por WhatsApp"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 cursor-pointer"
            title="Imprimir reporte"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Period Quick Pills */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'today', label: 'Hoy' },
            { id: 'yesterday', label: 'Ayer' },
            { id: 'week', label: 'Últimos 7 Días' },
            { id: 'month', label: 'Este Mes' },
            { id: 'all', label: 'Todo' },
            { id: 'custom', label: 'Personalizado' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                period === item.id
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-slate-200 focus:outline-rose-500"
            />
            <span className="text-slate-500">al</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-slate-200 focus:outline-rose-500"
            />
          </div>
        )}

        <div className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded-lg bg-slate-950/60 border border-slate-800">
          Tasa BCV: <span className="font-bold text-slate-200">{formatVES(report.rate)}</span>
        </div>
      </div>

      {/* CORE 4 QUESTIONS CARDS (Fueron tantas facturas, recogiste tanta plata, sacaste tanta plata, debes tener...) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Facturas Emitidas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Facturas Emitidas
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-100">
              {report.totalTickets}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-emerald-400 font-semibold">{report.validTickets} cobradas</span>
              {report.voidedTickets > 0 && (
                <span className="text-rose-400">• {report.voidedTickets} anuladas</span>
              )}
              {report.fiadoTickets > 0 && (
                <span className="text-amber-400">• {report.fiadoTickets} fiados</span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Recogiste Tanta Plata */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Recogiste (Ingresos)</span>
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400">
              {formatUSD(report.totalCollectedUSD)}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              ~{formatVES(report.totalCollectedVES)}
            </div>
          </div>
        </div>

        {/* 3. Sacaste Tanta Plata */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Sacaste (Egresos)</span>
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-400">
              {formatUSD(report.totalSpentUSD)}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center justify-between">
              <span>~{formatVES(report.totalSpentVES)}</span>
              <span className="text-[10px] text-slate-500">{report.expensesCount} pagos</span>
            </div>
          </div>
        </div>

        {/* 4. Total Neto Disponible */}
        <div className="bg-slate-900 border border-emerald-900/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between bg-gradient-to-br from-slate-900 to-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Neto en Caja y Bancos
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/30 text-emerald-300 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-2xl sm:text-3xl font-bold font-mono ${report.netAvailableUSD >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
              {formatUSD(report.netAvailableUSD)}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              ~{formatVES(report.netAvailableVES)}
            </div>
          </div>
        </div>
      </div>

      {/* DETALLE EXACTO: "DEBES DE TENER TANTA PLATA EN DIVISA, EN BOLÍVARES, ETC..." */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>Arqueo Exacto: ¿Cuánto dinero debes tener en cada canal?</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Fórmula directa: <span className="text-slate-300 font-mono">Dinero Recogido - Dinero Sacado = Dinero que debes tener</span>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* A. DIVISA / EFECTIVO $ USD */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                  $
                </span>
                <span>Divisas en Efectivo (Dólares Físicos en Caja)</span>
              </span>
              <span className={`font-mono font-bold text-sm sm:text-base ${report.balanceCashUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatUSD(report.balanceCashUSD)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800/80">
              <div className="text-slate-400">
                <span>Entraron: </span>
                <span className="text-emerald-400 font-bold">+{formatUSD(report.collectedCashUSD)}</span>
              </div>
              <div className="text-slate-400 text-right">
                <span>Salieron: </span>
                <span className="text-rose-400 font-bold">-{formatUSD(report.spentCashUSD)}</span>
              </div>
            </div>
          </div>

          {/* B. BOLÍVARES EN EFECTIVO */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-950 text-amber-400 flex items-center justify-center font-bold text-xs">
                  Bs
                </span>
                <span>Bolívares en Efectivo (Billetes Físicos en Caja)</span>
              </span>
              <span className={`font-mono font-bold text-sm sm:text-base ${report.balanceCashVES >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                {formatVES(report.balanceCashVES)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800/80">
              <div className="text-slate-400">
                <span>Entraron: </span>
                <span className="text-emerald-400 font-bold">+{formatVES(report.collectedCashVES)}</span>
              </div>
              <div className="text-slate-400 text-right">
                <span>Salieron: </span>
                <span className="text-rose-400 font-bold">-{formatVES(report.spentCashVES)}</span>
              </div>
            </div>
          </div>

          {/* C. PAGO MÓVIL */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center">
                  <Smartphone className="w-3.5 h-3.5" />
                </span>
                <span>Pago Móvil (En Cuenta Bancaria)</span>
              </span>
              <div className="text-right">
                <div className={`font-mono font-bold text-sm sm:text-base ${report.balancePagoMovilVES >= 0 ? 'text-indigo-300' : 'text-rose-400'}`}>
                  {formatVES(report.balancePagoMovilVES)}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  ~{formatUSD(report.balancePagoMovilVES / report.rate)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800/80">
              <div className="text-slate-400">
                <span>Entraron: </span>
                <span className="text-emerald-400 font-bold">+{formatVES(report.collectedPagoMovilVES)}</span>
              </div>
              <div className="text-slate-400 text-right">
                <span>Salieron: </span>
                <span className="text-rose-400 font-bold">-{formatVES(report.spentPagoMovilVES)}</span>
              </div>
            </div>
          </div>

          {/* D. PUNTO DE VENTA (TARJETA) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-950 text-sky-400 flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5" />
                </span>
                <span>Punto de Venta / Débito (En Cuenta Bancaria)</span>
              </span>
              <div className="text-right">
                <div className={`font-mono font-bold text-sm sm:text-base ${report.balancePuntoVES >= 0 ? 'text-sky-300' : 'text-rose-400'}`}>
                  {formatVES(report.balancePuntoVES)}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  ~{formatUSD(report.balancePuntoVES / report.rate)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800/80">
              <div className="text-slate-400">
                <span>Entraron: </span>
                <span className="text-emerald-400 font-bold">+{formatVES(report.collectedPuntoVES)}</span>
              </div>
              <div className="text-slate-400 text-right">
                <span>Salieron: </span>
                <span className="text-rose-400 font-bold">-{formatVES(report.spentPuntoVES)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Transferencia bancaria (si hubo movimiento) */}
        {(report.collectedTransferenciaVES > 0 || report.spentTransferenciaVES > 0) && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                <span>Transferencias Bancarias</span>
              </span>
              <div className="text-right">
                <div className="font-mono font-bold text-purple-300">
                  {formatVES(report.balanceTransferenciaVES)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-800/80">
              <div className="text-slate-400">
                Entraron: <span className="text-emerald-400 font-bold">+{formatVES(report.collectedTransferenciaVES)}</span>
              </div>
              <div className="text-slate-400 text-right">
                Salieron: <span className="text-rose-400 font-bold">-{formatVES(report.spentTransferenciaVES)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Cuentas Por Cobrar (Fiados generados en el período) */}
        {report.pendingFiadoUSD > 0 && (
          <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-300">Ventas a Crédito (Fiados) en el período:</span>
                <p className="text-[11px] text-amber-400/80">
                  Mercancía despachada pendiente por cobrar a clientes.
                </p>
              </div>
            </div>
            <div className="text-right font-mono font-bold text-amber-300 text-sm">
              <div>{formatUSD(report.pendingFiadoUSD)}</div>
              <div className="text-[10px] text-amber-400/80 font-normal">
                ~{formatVES(report.pendingFiadoVES)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QUICK SUMMARY PREVIEW (TEXTO COPIABLE DIRECTO) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <span>Formato Directo para Mensajería / Cuadre Rápido</span>
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
          >
            {copied ? '¡Copiado!' : 'Copiar Texto'}
          </button>
        </div>
        <pre className="bg-slate-950 rounded-xl p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap select-all overflow-x-auto border border-slate-800/60">
          {formattedText}
        </pre>
      </div>
    </div>
  );
};
