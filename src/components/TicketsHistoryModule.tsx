import React, { useState, useMemo, useRef } from 'react';
import {
  FileText,
  Search,
  Download,
  Printer,
  Send,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Filter,
  DollarSign,
  Clock,
  User,
  RotateCcw,
  Eye,
  Calendar,
  Plus,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Upload,
  Sparkles,
  Award,
  RefreshCw,
} from 'lucide-react';
import { AppSettings, ExpenseRecord, Product, SaleTicket } from '../types';
import {
  formatQuantity,
  formatUSD,
  formatVES,
  importTicketsBatch,
  generateTelegramThankYou,
  generateTelegramTicketsSummary,
} from '../services/storage';
import { syncAndSumTicketsToFidelis, loadFidelisProfiles, saveFidelisProfiles } from '../services/fidelis';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { ShortCashReportView } from './ShortCashReportView';
import { ExpensesView } from './ExpensesView';
import { NewExpenseModal } from './NewExpenseModal';
import { RestockRecord } from '../types';

interface TicketsHistoryModuleProps {
  tickets: SaleTicket[];
  expenses: ExpenseRecord[];
  restocks?: RestockRecord[];
  products: Product[];
  settings: AppSettings;
  onDeleteTicket: (ticketId: string, deletePermanently: boolean, reason: string) => void;
  onAddExpense: (expense: Omit<ExpenseRecord, 'id' | 'expenseNumber'>) => void;
  onDeleteExpense: (expenseId: string) => void;
  onAbonoToRestock?: (
    restockId: string,
    amountUSD: number,
    method: 'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia',
    reference?: string,
    notes?: string
  ) => void;
  onTicketsImported?: (updatedTickets: SaleTicket[], message: string) => void;
}

export const TicketsHistoryModule: React.FC<TicketsHistoryModuleProps> = ({
  tickets,
  expenses,
  restocks = [],
  products,
  settings,
  onDeleteTicket,
  onAddExpense,
  onDeleteExpense,
  onAbonoToRestock,
  onTicketsImported,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'tickets' | 'expenses' | 'report'>('tickets');
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'paid' | 'pending' | 'mixed' | 'voided'>('all');
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<SaleTicket | null>(null);

  // File import ref and feedback state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFeedback, setImportFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Deletion modal state
  const [ticketToDelete, setTicketToDelete] = useState<SaleTicket | null>(null);
  const [deleteReason, setDeleteReason] = useState('Error en pesaje o productos (Factura que salió mala)');
  const [deletePermanently, setDeletePermanently] = useState(false);

  // Handle Invoices File Import ("Carga de facturas: busca a quién le corresponde y suma los sellos")
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = importTicketsBatch(content, tickets);
        setImportFeedback({
          success: result.success,
          message: result.message,
        });

        if (result.success && onTicketsImported) {
          onTicketsImported(result.updatedTickets, result.message);
        }
      }
    };
    reader.readAsText(file);
    // reset input so the same file can be selected again if needed
    e.target.value = '';
  };

  // Synchronize all tickets with customer stamps
  const handleSyncFidelis = () => {
    const currentFidelis = loadFidelisProfiles();
    const result = syncAndSumTicketsToFidelis(tickets, currentFidelis, { resetBeforeSync: false });
    const msg = `Sincronización Fidelis: se procesaron ${result.processedTicketsCount} facturas, sumando ${result.totalStampsAdded} sellos en ${result.matchedCustomersCount} clientes.`;
    setImportFeedback({
      success: true,
      message: msg,
    });
    if (onTicketsImported) {
      onTicketsImported(tickets, msg);
    }
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Type filter
      if (filterType === 'paid' && (t.status !== 'paid' || t.isVoided)) return false;
      if (filterType === 'pending' && (t.status !== 'pending' && t.status !== 'partially_paid' || t.isVoided)) return false;
      if (filterType === 'mixed' && (t.paymentMethod !== 'mixed' || t.isVoided)) return false;
      if (filterType === 'voided' && !t.isVoided && t.status !== 'voided') return false;

      // Query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchNum = t.ticketNumber.toString().includes(q);
      const matchName = t.customerName.toLowerCase().includes(q);
      const matchCedula = t.customerCedula.toLowerCase().includes(q);
      const matchPhone = t.customerPhone.includes(q);
      const matchItem = t.items.some((it) => it.product.name.toLowerCase().includes(q));

      return matchNum || matchName || matchCedula || matchPhone || matchItem;
    });
  }, [tickets, filterType, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    let totalSalesUSD = 0;
    let totalSalesVES = 0;
    let voidedCount = 0;

    for (const t of tickets) {
      if (t.isVoided) {
        voidedCount++;
      } else {
        totalSalesUSD += t.totalUSD;
        totalSalesVES += t.totalVES;
      }
    }

    return {
      count: tickets.length,
      totalSalesUSD,
      totalSalesVES,
      voidedCount,
    };
  }, [tickets]);

  const handleConfirmDelete = () => {
    if (!ticketToDelete) return;
    onDeleteTicket(ticketToDelete.id, deletePermanently, deleteReason);
    setTicketToDelete(null);
    setDeleteReason('Error en pesaje o productos (Factura que salió mala)');
  };

  return (
    <div id="tickets-history-module" className="space-y-4">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2 rounded-2xl shadow-lg">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('tickets')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'tickets'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Facturas y Ventas</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-950/60 border border-white/10">
              {tickets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('expenses')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'expenses'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <TrendingDown className="w-4 h-4 text-amber-400" />
            <span>Registro de Egresos</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-950/60 border border-white/10">
              {expenses.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('report')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'report'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Cuadre y Reporte Preciso</span>
          </button>
        </div>

        {/* Quick action button */}
        <div className="flex items-center gap-2">
          {activeSubTab !== 'report' && (
            <button
              onClick={() => setActiveSubTab('report')}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/60 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Ver Cuadre</span>
            </button>
          )}

          <button
            onClick={() => setIsNewExpenseModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition shadow-md shadow-amber-950/50 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Registrar Egreso</span>
          </button>
        </div>
      </div>

      {/* Render Sub-Views */}
      {activeSubTab === 'report' && (
        <ShortCashReportView
          tickets={tickets}
          expenses={expenses}
          settings={settings}
        />
      )}

      {activeSubTab === 'expenses' && (
        <ExpensesView
          expenses={expenses}
          settings={settings}
          restocks={restocks}
          onOpenNewExpenseModal={() => setIsNewExpenseModalOpen(true)}
          onDeleteExpense={onDeleteExpense}
          onAbonoToRestock={onAbonoToRestock}
        />
      )}

      {activeSubTab === 'tickets' && (
        <div className="space-y-4">
          {/* Header & Stats Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                Historial de Facturas y Ventas
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Consulta, descarga facturas en PNG, imprime en Bluetooth o elimina facturas que salieron con error (devolviendo el inventario).
            </p>
          </div>

          {/* Quick Metrics and Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                className="hidden"
                onChange={handleFileImport}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer shadow-sm active:scale-95"
                title="Cargar facturas desde archivo JSON: buscará al cliente y sumará los sellos Fidelis correspondientes"
              >
                <Upload className="w-3.5 h-3.5 text-rose-400" />
                <span>Cargar Facturas</span>
              </button>

              <button
                type="button"
                onClick={handleSyncFidelis}
                className="px-3 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition border border-amber-800/60 cursor-pointer shadow-sm active:scale-95"
                title="Procesa todas las facturas del sistema y suma los sellos a sus clientes correspondientes"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Sumar Sellos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('report')}
                className="px-3 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95"
                title="Abrir el cuadre de caja preciso con desglose por divisa y bolívares"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Cuadre de Caja</span>
              </button>

              <button
                type="button"
                id="btn-telegram-tickets-summary"
                onClick={() => {
                  const { url } = generateTelegramTicketsSummary(tickets, settings);
                  window.open(url, '_blank');
                }}
                className="px-3 py-2 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 border border-sky-800/60 text-sky-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95"
                title="Enviar respaldo de facturas por Telegram"
              >
                <Send className="w-3.5 h-3.5 text-sky-400" />
                <span>Respaldo Telegram</span>
              </button>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Total Facturado
              </span>
              <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
                {formatUSD(stats.totalSalesUSD)}
              </span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Tickets Emitidos
              </span>
              <span className="text-sm sm:text-base font-bold font-mono text-slate-200">
                {stats.count}
              </span>
            </div>
          </div>
        </div>

        {/* Import / Sync Feedback Notice */}
        {importFeedback && (
          <div
            className={`mt-3 p-3 rounded-xl border flex items-start justify-between gap-2 text-xs ${
              importFeedback.success
                ? 'bg-emerald-950/40 border-emerald-800/70 text-emerald-200'
                : 'bg-rose-950/40 border-rose-800/70 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {importFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{importFeedback.message}</span>
            </div>
            <button
              onClick={() => setImportFeedback(null)}
              className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por N° ticket, cliente, cédula o producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-rose-500 focus:border-rose-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: 'all', label: `Todos (${tickets.length})` },
              { id: 'paid', label: 'Pagadas' },
              { id: 'mixed', label: 'Pago Mixto' },
              { id: 'pending', label: 'Fiadas' },
              { id: 'voided', label: `Malas / Anuladas (${stats.voidedCount})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  filterType === f.id
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No se encontraron facturas</p>
            <p className="text-xs text-slate-500 mt-1">Prueba cambiando los filtros o el término de búsqueda.</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const isVoid = ticket.isVoided;
            const isFiado = ticket.paymentMethod === 'fiado' || ticket.status === 'pending';
            const isMixed = ticket.paymentMethod === 'mixed';

            return (
              <div
                key={ticket.id}
                className={`bg-slate-900 border rounded-2xl p-4 transition shadow-md hover:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  isVoid
                    ? 'border-rose-900/60 opacity-75 bg-rose-950/20'
                    : 'border-slate-800 hover:bg-slate-850'
                }`}
              >
                {/* Left Info */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-slate-950 text-rose-300 border border-slate-800">
                      #{ticket.ticketNumber}
                    </span>

                    {/* Method badge */}
                    {isVoid ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                        ANULADA / MALA
                      </span>
                    ) : isMixed ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                        PAGO MIXTO
                      </span>
                    ) : isFiado ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                        FIADO (CRÉDITO)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {ticket.paymentMethod.toUpperCase()}
                      </span>
                    )}

                    <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(ticket.date).toLocaleString('es-VE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="font-semibold text-slate-100 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {ticket.customerName}
                    </span>
                    {ticket.customerPhone && (
                      <span className="text-slate-400 font-mono">
                        Tel: {ticket.customerPhone}
                      </span>
                    )}
                    <span className="text-slate-500">
                      {ticket.items.length} producto{ticket.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Items brief preview */}
                  <div className="text-[11px] text-slate-400 line-clamp-1 italic">
                    {ticket.items.map((it) => `${it.product.name} (${formatQuantity(it.quantity, it.product.unit)})`).join(', ')}
                  </div>

                  {/* Void reason if exists */}
                  {isVoid && ticket.voidReason && (
                    <div className="text-[11px] text-rose-300 font-mono">
                      Motivo: {ticket.voidReason}
                    </div>
                  )}
                </div>

                {/* Center / Right: Amounts & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80 shrink-0">
                  {/* Totals */}
                  <div className="text-left md:text-right">
                    <div className="text-sm sm:text-base font-black font-mono text-emerald-400">
                      {formatUSD(ticket.totalUSD)}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      {formatVES(ticket.totalVES)}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1.5">
                    {/* View / Download PNG / Print Thermal */}
                    <button
                      onClick={() => setSelectedTicketForModal(ticket)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
                      title="Ver Factura Térmica & Descargar PNG"
                    >
                      <Eye className="w-3.5 h-3.5 text-rose-400" />
                      <span className="hidden sm:inline">Factura</span>
                    </button>

                    {/* Quick Telegram share */}
                    <button
                      type="button"
                      onClick={() => {
                        const { url } = generateTelegramThankYou(ticket, settings);
                        window.open(url, '_blank');
                      }}
                      className="p-1.5 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 text-sky-400 hover:text-white transition flex items-center justify-center cursor-pointer border border-sky-800/60"
                      title="Enviar comprobante de esta factura por Telegram"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete / Void Bad Ticket button */}
                    {!isVoid ? (
                      <button
                        onClick={() => setTicketToDelete(ticket)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 transition cursor-pointer border border-slate-700/60 hover:border-rose-800"
                        title="Eliminar factura que salió mala o errónea (Devuelve stock)"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setTicketToDelete(ticket);
                          setDeletePermanently(true);
                        }}
                        className="p-1.5 rounded-xl bg-rose-950/40 text-rose-400 hover:bg-rose-900 transition cursor-pointer border border-rose-900"
                        title="Borrar definitivamente del historial"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Thermal Receipt Viewer & Download */}
      {selectedTicketForModal && (
        <ThermalReceiptModal
          ticket={selectedTicketForModal}
          settings={settings}
          onClose={() => setSelectedTicketForModal(null)}
        />
      )}

      {/* MODAL: Delete / Void Bad Ticket Confirmation */}
      {ticketToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-slate-100">
            {/* Header */}
            <div className="flex items-start gap-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">
                  {deletePermanently ? 'Eliminar Factura Definitivamente' : 'Eliminar Factura Mala / Defectuosa'}
                </h3>
                <p className="text-xs text-slate-400">
                  Ticket #{ticketToDelete.ticketNumber} • {ticketToDelete.customerName}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Monto total:</span>
                  <span className="font-bold font-mono text-emerald-400">{formatUSD(ticketToDelete.totalUSD)} (~{formatVES(ticketToDelete.totalVES)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Modalidad:</span>
                  <span className="font-semibold text-slate-200 uppercase">{ticketToDelete.paymentMethod}</span>
                </div>
              </div>

              {/* Automatic Stock Restoration Notice */}
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Devolución Automática al Inventario:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Las cantidades pesadas y unidades de esta factura serán reincorporadas de inmediato al stock disponible en el inventario.
                </p>
                <div className="pt-1 text-[11px] font-mono text-emerald-300 max-h-24 overflow-y-auto space-y-0.5">
                  {ticketToDelete.items.map((it, idx) => (
                    <div key={idx}>
                      • {it.product.name}: +{formatQuantity(it.quantity, it.product.unit)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Automatic Loyalty Reversal Notice ("Al eliminar la factura se elimina el sello") */}
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <Award className="w-3.5 h-3.5" />
                  <span>Deducción en Fidelización Fidelis:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Al eliminar o anular esta factura, se descontará automáticamente{' '}
                  <strong className="text-amber-300">1 sello Fidelis</strong> del cliente{' '}
                  <strong className="text-slate-100">{ticketToDelete.customerName || 'Cliente'}</strong>.
                  {ticketToDelete.totalUSD >= 18 && (
                    <span className="block text-yellow-400 mt-1 font-semibold">
                      👑 Se descontará también 1 compra de alto valor (≥$18 USD).
                    </span>
                  )}
                </p>
              </div>

              {/* Reason input */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Motivo de anulación o eliminación:
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  placeholder="Ej. Error en peso, cliente cambió de producto, prueba"
                />
              </div>

              {/* Permanent option */}
              <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-300">
                <input
                  type="checkbox"
                  checked={deletePermanently}
                  onChange={(e) => setDeletePermanently(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 bg-slate-950 border-slate-700"
                />
                <span className="text-[11px]">
                  Eliminar registro completamente (no dejar constancia de factura anulada)
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setTicketToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmar y Devolver Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* New Expense Modal */}
      <NewExpenseModal
        settings={settings}
        isOpen={isNewExpenseModalOpen}
        onClose={() => setIsNewExpenseModalOpen(false)}
        onAddExpense={onAddExpense}
      />
    </div>
  );
};
