import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  MessageCircle,
  DollarSign,
  Calendar,
  Phone,
  User,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Send,
  Copy,
  Receipt,
  Eye,
  PlusCircle,
  X,
  CreditCard,
  Building,
  Check,
  Trash2,
  Printer,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { AppSettings, DebtorCustomer, PaymentAbono, Product, SaleTicket } from '../types';
import {
  formatUSD,
  formatVES,
  formatQuantity,
  generateWhatsAppReminder,
  generateTelegramReminder,
  generateTelegramFiadosReport,
  generateTelegramShareUrl,
  amortizeCustomerPayment,
  sanitizePhoneForWhatsApp,
  deleteDebtorAccount,
  voidOrDeleteTicket,
} from '../services/storage';
import { ThermalReceiptModal } from './ThermalReceiptModal';

interface FiadosModuleProps {
  tickets: SaleTicket[];
  settings: AppSettings;
  products?: Product[];
  onUpdateTickets: (updatedTickets: SaleTicket[]) => void;
  onUpdateProducts?: (updatedProducts: Product[]) => void;
}

export const FiadosModule: React.FC<FiadosModuleProps> = ({
  tickets,
  settings,
  products = [],
  onUpdateTickets,
  onUpdateProducts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorCustomer | null>(null);

  // Reminder message preview modal
  const [reminderModalData, setReminderModalData] = useState<{
    debtor: DebtorCustomer;
    url: string;
    message: string;
  } | null>(null);
  const [copiedReminder, setCopiedReminder] = useState(false);

  // New Abono modal
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [abonoAmountUSD, setAbonoAmountUSD] = useState<string>('');
  const [abonoCurrency, setAbonoCurrency] = useState<'USD' | 'VES'>('USD');
  const [abonoMethod, setAbonoMethod] = useState<'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto'>('pago_movil');
  const [abonoReference, setAbonoReference] = useState('');
  const [abonoNotes, setAbonoNotes] = useState('');
  const [abonoSuccessMsg, setAbonoSuccessMsg] = useState<string | null>(null);
  const [abonoErrorMsg, setAbonoErrorMsg] = useState<string | null>(null);

  // Account deletion modal
  const [accountToDelete, setAccountToDelete] = useState<DebtorCustomer | null>(null);
  const [restoreStockOnAccountDelete, setRestoreStockOnAccountDelete] = useState(true);

  // Single ticket actions
  const [ticketToViewReceipt, setTicketToViewReceipt] = useState<SaleTicket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<SaleTicket | null>(null);
  const [deleteTicketReason, setDeleteTicketReason] = useState('Factura que salió mala (Error en peso/mercancía)');

  // Group debtors from tickets
  const debtorsList: DebtorCustomer[] = useMemo(() => {
    const map = new Map<string, DebtorCustomer>();

    for (const ticket of tickets) {
      const isFiadoOrPending =
        ticket.paymentMethod === 'fiado' ||
        ticket.status === 'pending' ||
        ticket.status === 'partially_paid';

      if (!isFiadoOrPending || ticket.pendingUSD <= 0.001) continue;

      const key = (ticket.customerPhone || ticket.customerCedula || ticket.customerName).trim().toLowerCase();
      if (!key) continue;

      const existing = map.get(key);
      if (existing) {
        existing.tickets.push(ticket);
        existing.totalDebtUSD += ticket.pendingUSD;
        existing.totalDebtVES += ticket.pendingUSD * settings.bcvRate;
        if (new Date(ticket.date) > new Date(existing.lastPurchaseDate)) {
          existing.lastPurchaseDate = ticket.date;
        }
      } else {
        map.set(key, {
          name: ticket.customerName || 'Cliente sin nombre',
          cedula: ticket.customerCedula || 'S/C',
          phone: ticket.customerPhone || '',
          totalDebtUSD: ticket.pendingUSD,
          totalDebtVES: ticket.pendingUSD * settings.bcvRate,
          tickets: [ticket],
          lastPurchaseDate: ticket.date,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalDebtUSD - a.totalDebtUSD);
  }, [tickets, settings.bcvRate]);

  // Financial summary metrics
  const { totalGlobalDebtUSD, totalGlobalDebtVES, totalPaidInAbonosUSD } = useMemo(() => {
    let debtUSD = 0;
    let abonosUSD = 0;

    for (const t of tickets) {
      if (t.paymentMethod === 'fiado' || t.status === 'pending' || t.status === 'partially_paid') {
        debtUSD += t.pendingUSD;
      }
      if (t.abonos && t.abonos.length > 0) {
        for (const ab of t.abonos) {
          abonosUSD += ab.amountUSD;
        }
      }
    }

    return {
      totalGlobalDebtUSD: debtUSD,
      totalGlobalDebtVES: debtUSD * settings.bcvRate,
      totalPaidInAbonosUSD: abonosUSD,
    };
  }, [tickets, settings.bcvRate]);

  // Filter debtors by search
  const filteredDebtors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return debtorsList;
    return debtorsList.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q) ||
        d.cedula.toLowerCase().includes(q)
    );
  }, [debtorsList, searchQuery]);

  // 1-Tap WhatsApp Reminder Handler
  const handleOpenReminder = (debtor: DebtorCustomer) => {
    const data = generateWhatsAppReminder(debtor, settings);
    setReminderModalData({ debtor, ...data });
    setCopiedReminder(false);
  };

  const handleCopyReminder = () => {
    if (!reminderModalData) return;
    navigator.clipboard.writeText(reminderModalData.message);
    setCopiedReminder(true);
    setTimeout(() => setCopiedReminder(false), 3000);
  };

  // Open Abono Modal for a Debtor
  const handleOpenAbonoModal = (debtor: DebtorCustomer) => {
    setSelectedDebtor(debtor);
    setAbonoAmountUSD(debtor.totalDebtUSD.toFixed(2)); // default full amount
    setAbonoCurrency('USD');
    setAbonoReference('');
    setAbonoNotes('');
    setAbonoSuccessMsg(null);
    setAbonoErrorMsg(null);
    setIsAbonoModalOpen(true);
  };

  // Submit Abono with automatic chronological amortization
  const handleSubmitAbono = (e: React.FormEvent) => {
    e.preventDefault();
    setAbonoErrorMsg(null);
    if (!selectedDebtor) return;

    let parsedVal = parseFloat(abonoAmountUSD.replace(',', '.'));
    if (isNaN(parsedVal) || parsedVal <= 0) {
      setAbonoErrorMsg('Por favor introduce un monto válido mayor a cero para el abono.');
      return;
    }

    // If entered in VES, convert to USD
    let effectiveUSD = parsedVal;
    if (abonoCurrency === 'VES') {
      effectiveUSD = parsedVal / settings.bcvRate;
    }

    const { updatedTickets, appliedTotalUSD } = amortizeCustomerPayment(
      tickets,
      selectedDebtor.phone || selectedDebtor.cedula || selectedDebtor.name,
      effectiveUSD,
      abonoMethod,
      abonoReference,
      abonoNotes,
      settings.bcvRate
    );

    onUpdateTickets(updatedTickets);

    setAbonoSuccessMsg(
      `¡Abono de ${formatUSD(appliedTotalUSD)} (~${formatVES(appliedTotalUSD * settings.bcvRate)}) amortizado con éxito en las facturas más antiguas!`
    );

    // Refresh selectedDebtor details
    setTimeout(() => {
      setIsAbonoModalOpen(false);
      setAbonoSuccessMsg(null);
      // Close debtor view if fully settled
      if (selectedDebtor.totalDebtUSD - appliedTotalUSD <= 0.01) {
        setSelectedDebtor(null);
      }
    }, 1400);
  };

  const handleConfirmDeleteAccount = () => {
    if (!accountToDelete) return;
    const debtorKey = (accountToDelete.phone || accountToDelete.cedula || accountToDelete.name).trim().toLowerCase();
    const result = deleteDebtorAccount(debtorKey, restoreStockOnAccountDelete, tickets, products);
    onUpdateTickets(result.updatedTickets);
    if (onUpdateProducts && result.updatedProducts) {
      onUpdateProducts(result.updatedProducts);
    }
    const deletedName = accountToDelete.name;
    setAccountToDelete(null);
    if (selectedDebtor && (selectedDebtor.phone === accountToDelete.phone || selectedDebtor.name === accountToDelete.name)) {
      setSelectedDebtor(null);
    }
  };

  const handleConfirmDeleteTicket = () => {
    if (!ticketToDelete) return;
    const result = voidOrDeleteTicket(ticketToDelete.id, false, deleteTicketReason, tickets, products);
    onUpdateTickets(result.updatedTickets);
    if (onUpdateProducts && result.updatedProducts) {
      onUpdateProducts(result.updatedProducts);
    }
    const deletedTicketId = ticketToDelete.id;
    setTicketToDelete(null);
    if (selectedDebtor) {
      const remaining = selectedDebtor.tickets.filter((t) => t.id !== deletedTicketId);
      if (remaining.length === 0) {
        setSelectedDebtor(null);
      } else {
        const newTotalUSD = remaining.reduce((sum, t) => sum + t.pendingUSD, 0);
        setSelectedDebtor({
          ...selectedDebtor,
          tickets: remaining,
          totalDebtUSD: newTotalUSD,
          totalDebtVES: newTotalUSD * settings.bcvRate,
        });
      }
    }
  };

  return (
    <div id="fiados-module-container" className="space-y-4">
      {/* 1. TOP FINANCIAL SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total por cobrar en USD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">
              Total Global por Cobrar ($)
            </span>
            <span id="fiados-total-usd" className="text-2xl sm:text-3xl font-black font-mono text-rose-400">
              {formatUSD(totalGlobalDebtUSD)}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              En cartera de crédito fiado
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-950/80 text-rose-400 flex items-center justify-center border border-rose-800/40">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total por cobrar en Bolívares */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">
              Total por Cobrar en Bs. (BCV)
            </span>
            <span id="fiados-total-ves" className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {formatVES(totalGlobalDebtVES)}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-mono">
              Tasa: {formatVES(settings.bcvRate)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-950/80 text-emerald-400 flex items-center justify-center border border-emerald-800/40">
            <Building className="w-6 h-6" />
          </div>
        </div>

        {/* Clientes deudores */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">
              Clientes con Saldo Pendiente
            </span>
            <span id="fiados-debtors-count" className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
              {debtorsList.length}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              {totalPaidInAbonosUSD > 0
                ? `${formatUSD(totalPaidInAbonosUSD)} recaudados en abonos`
                : 'Sin abonos hoy'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-950/80 text-amber-400 flex items-center justify-center border border-amber-800/40">
            <User className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT: Debtors List & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-rose-400" />
              <span>Libro de Cuentas por Cobrar (Fiados)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Gestión de saldos, amortización automática y cobranza automatizada vía WhatsApp.
            </p>
          </div>

          {/* Actions & Search */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              id="btn-telegram-fiados-report"
              onClick={() => {
                const { url } = generateTelegramFiadosReport(debtorsList, settings);
                window.open(url, '_blank');
              }}
              className="px-3 py-2 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 border border-sky-800/60 text-sky-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer whitespace-nowrap active:scale-95"
              title="Enviar respaldo completo del libro de fiados por Telegram"
            >
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span>Respaldo Telegram</span>
            </button>

            {/* Search bar */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="fiados-search-input"
                type="text"
                placeholder="Buscar cliente, cédula o teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-rose-500 focus:border-rose-500"
              />
            </div>
          </div>
        </div>

        {/* Debtors Cards / Table */}
        <div className="space-y-2.5">
          {filteredDebtors.map((debtor) => {
            const lastDateFormatted = new Date(debtor.lastPurchaseDate).toLocaleDateString('es-VE');

            return (
              <div
                key={debtor.phone || debtor.cedula || debtor.name}
                id={`debtor-row-${debtor.phone || debtor.cedula}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition gap-3"
              >
                {/* Debtor info */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-rose-400 font-bold flex items-center justify-center shrink-0 border border-slate-700">
                    {debtor.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-slate-100">{debtor.name}</h4>
                      <span className="text-[11px] font-mono text-slate-400 px-1.5 py-0.2 rounded bg-slate-800/80">
                        {debtor.cedula}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap font-mono">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Phone className="w-3 h-3" />
                        {debtor.phone || 'Sin número'}
                      </span>
                      <span>•</span>
                      <span>{debtor.tickets.length} compras pendientes</span>
                      <span>•</span>
                      <span>Última: {lastDateFormatted}</span>
                    </div>
                  </div>
                </div>

                {/* Balance & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-800">
                  {/* Accumulated Debt */}
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] text-slate-400 block">Saldo Acumulado:</span>
                    <div className="text-base sm:text-lg font-black font-mono text-rose-400">
                      {formatUSD(debtor.totalDebtUSD)}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      ~{formatVES(debtor.totalDebtVES)}
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* WhatsApp 1-Touch Reminder Button */}
                    <button
                      type="button"
                      id={`btn-wa-reminder-${debtor.phone}`}
                      onClick={() => handleOpenReminder(debtor)}
                      disabled={!debtor.phone}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                        debtor.phone
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                      title={
                        debtor.phone
                          ? 'Abrir recordatorio de cobro por WhatsApp con datos de Pago Móvil'
                          : 'Cliente sin número telefónico registrado'
                      }
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>

                    {/* Telegram Reminder Button */}
                    <button
                      type="button"
                      id={`btn-tg-reminder-${debtor.phone || debtor.name}`}
                      onClick={() => {
                        const { url } = generateTelegramReminder(debtor, settings);
                        window.open(url, '_blank');
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-xs shadow-sky-950/40 cursor-pointer"
                      title="Enviar recordatorio de cobro por Telegram"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Telegram</span>
                    </button>

                    {/* Abono button */}
                    <button
                      type="button"
                      onClick={() => handleOpenAbonoModal(debtor)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs shadow-rose-950/40 cursor-pointer"
                      title="Registrar abono a esta cuenta"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Abonar</span>
                    </button>

                    {/* View Dossier / Detail */}
                    <button
                      type="button"
                      onClick={() => setSelectedDebtor(debtor)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Ver expediente de compras y abonos"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Delete Account button */}
                    <button
                      type="button"
                      onClick={() => setAccountToDelete(debtor)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-800/50 transition cursor-pointer"
                      title="Eliminar cuenta de este deudor o anular facturas malas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredDebtors.length === 0 && (
            <div className="py-12 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-300">¡Al día! No hay cuentas pendientes por cobrar.</p>
              <p className="text-xs text-slate-500 mt-1">
                Todas las ventas registradas están saldadas o no coinciden con la búsqueda.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Expediente del Deudor (Purchases & Invoices History) */}
      {selectedDebtor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-950 text-rose-300 font-bold flex items-center justify-center border border-rose-800/40">
                  {selectedDebtor.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-base">{selectedDebtor.name}</h3>
                  <p className="text-xs font-mono text-slate-400">
                    Cédula: {selectedDebtor.cedula} • Tel: {selectedDebtor.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDebtor(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Debtor Balance Header Card */}
            <div className="my-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Deuda Total Pendiente:</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-rose-400">
                  {formatUSD(selectedDebtor.totalDebtUSD)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-2">
                  (~{formatVES(selectedDebtor.totalDebtVES)})
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAbonoModal(selectedDebtor)}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Registrar Abono</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenReminder(selectedDebtor)}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Tickets History List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Compras Pendientes por Saldar:
              </h4>

              {selectedDebtor.tickets.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-rose-400">
                        Ticket #{t.ticketNumber}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(t.date).toLocaleString('es-VE')}
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-xs text-slate-400">Pendiente: </span>
                      <span className="font-bold text-rose-400">{formatUSD(t.pendingUSD)}</span>
                      <span className="text-[11px] text-slate-500 ml-1">
                        / Total {formatUSD(t.totalUSD)}
                      </span>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="bg-slate-900/60 p-2.5 rounded-lg text-xs space-y-1 font-mono">
                    {t.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-slate-300">
                        <span>
                          {it.product.name} ({formatQuantity(it.quantity, it.product.unit)})
                        </span>
                        <span className="text-slate-400">{formatUSD(it.totalUSD)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Prior Abonos if any */}
                  {t.abonos && t.abonos.length > 0 && (
                    <div className="pt-1 text-[11px] font-mono text-emerald-400 space-y-0.5">
                      <span className="font-bold">Abonos aplicados a este ticket:</span>
                      {t.abonos.map((ab) => (
                        <div key={ab.id} className="text-slate-400 pl-2">
                          • {new Date(ab.date).toLocaleDateString('es-VE')}: +{formatUSD(ab.amountUSD)} ({ab.method}) {ab.reference ? `Ref: ${ab.reference}` : ''}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions for this single ticket: Print/View Invoice PNG & Void bad invoice */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setTicketToViewReceipt(t)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      title="Generar e imprimir factura o descargar imagen PNG"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-400" />
                      <span>Factura PNG / Imprimir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTicketToDelete(t)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 hover:text-rose-300 text-xs font-semibold transition flex items-center gap-1.5 border border-transparent hover:border-rose-800/50 cursor-pointer"
                      title="Anular esta factura si salió mala y retornar el stock"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Anular Factura Mala</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDebtor(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cerrar Expediente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: WhatsApp Reminder 1-Tap Preview & Send */}
      {reminderModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Recordatorio de Pago WhatsApp</h3>
              </div>
              <button
                onClick={() => setReminderModalData(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Mensaje preformateado con detalle exacto de compras, total bimonetario ($/Bs.) y datos bancarios para Pago Móvil:
            </p>

            {/* Message Preview Box */}
            <div className="my-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex-1 overflow-y-auto max-h-[350px]">
              <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                {reminderModalData.message}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleCopyReminder}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedReminder ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-confirm-send-tg"
                onClick={() => {
                  const url = generateTelegramShareUrl(reminderModalData.message);
                  window.open(url, '_blank');
                  setReminderModalData(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-sky-950/50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Enviar por Telegram</span>
              </button>

              <a
                id="btn-confirm-send-wa"
                href={reminderModalData.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setReminderModalData(null)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Abrir WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Registrar Abono (Amortización Automática) */}
      {isAbonoModalOpen && selectedDebtor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-base">Registrar Abono</h3>
              </div>
              <button
                onClick={() => setIsAbonoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {abonoSuccessMsg ? (
              <div className="my-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-emerald-400">{abonoSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitAbono} className="mt-4 space-y-3">
                {abonoErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold">
                    {abonoErrorMsg}
                  </div>
                )}
                {/* Debtor info */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-400 block">Cliente:</span>
                    <strong className="text-slate-100 text-sm">{selectedDebtor.name}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block">Deuda Actual:</span>
                    <strong className="text-rose-400 font-mono text-sm">
                      {formatUSD(selectedDebtor.totalDebtUSD)}
                    </strong>
                  </div>
                </div>

                {/* Amount input & currency toggle */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <label className="text-slate-300 font-semibold">Monto del Abono:</label>
                    <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setAbonoCurrency('USD')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          abonoCurrency === 'USD' ? 'bg-rose-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        $ USD
                      </button>
                      <button
                        type="button"
                        onClick={() => setAbonoCurrency('VES')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          abonoCurrency === 'VES' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        Bs. (BCV)
                      </button>
                    </div>
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    autoFocus
                    value={abonoAmountUSD}
                    onChange={(e) => setAbonoAmountUSD(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-lg font-bold font-mono text-white focus:outline-rose-500"
                    placeholder="0.00"
                    required
                  />
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    {abonoCurrency === 'USD' ? (
                      <span>
                        Equivalente: ~
                        {formatVES((parseFloat(abonoAmountUSD) || 0) * settings.bcvRate)}
                      </span>
                    ) : (
                      <span>
                        Equivalente: ~
                        {formatUSD((parseFloat(abonoAmountUSD) || 0) / settings.bcvRate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Método de Pago del Abono:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { id: 'pago_movil', label: 'Pago Móvil', icon: '📱' },
                      { id: 'cash_usd', label: 'Efectivo $ USD', icon: '💵' },
                      { id: 'cash_ves', label: 'Efectivo Bs.', icon: '🇻🇪' },
                      { id: 'punto', label: 'Punto de Venta', icon: '💳' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAbonoMethod(m.id as any)}
                        className={`p-2 rounded-xl text-left border transition cursor-pointer flex items-center gap-2 ${
                          abonoMethod === m.id
                            ? 'bg-rose-950/80 border-rose-500 text-white'
                            : 'bg-slate-800/80 border-slate-700/80 text-slate-300'
                        }`}
                      >
                        <span>{m.icon}</span>
                        <span className="font-semibold text-xs">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reference / Comprobante */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Número de Referencia o Comprobante:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. PM-948201 / Banesco"
                    value={abonoReference}
                    onChange={(e) => setAbonoReference(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                {/* Amortization notice */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
                  ℹ️ <strong>Amortización Automática:</strong> El sistema descontará este abono en orden cronológico, liquidando primero las compras fiadas más antiguas de este cliente.
                </div>

                {/* Actions */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAbonoModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    id="btn-submit-abono"
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-950/40 cursor-pointer"
                  >
                    Guardar Abono
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: Confirm Delete Entire Account */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-rose-700/60 rounded-2xl p-5 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="p-2.5 rounded-xl bg-rose-950/80 text-rose-400 border border-rose-800/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Eliminar Cuenta de Deudor</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {accountToDelete.name} ({accountToDelete.cedula})
                </p>
              </div>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                ¿Estás seguro de que deseas eliminar la cuenta de{' '}
                <strong className="text-white">{accountToDelete.name}</strong>?
              </p>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Deuda Acumulada:</span>
                  <span className="font-bold text-rose-400">{formatUSD(accountToDelete.totalDebtUSD)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Equivalente en Bs:</span>
                  <span className="font-bold text-slate-200">{formatVES(accountToDelete.totalDebtVES)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Facturas vinculadas:</span>
                  <span className="font-bold text-slate-300">{accountToDelete.tickets.length}</span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restoreStockOnAccountDelete}
                  onChange={(e) => setRestoreStockOnAccountDelete(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-[11px] text-slate-300 leading-normal">
                  <strong>Devolver mercancía al inventario:</strong> Restaura automáticamente las existencias en KG/unidades de todas las facturas malas o anuladas de este cliente.
                </span>
              </label>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-950/50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Eliminación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Confirm Delete Single Ticket */}
      {ticketToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-rose-700/60 rounded-2xl p-5 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="p-2.5 rounded-xl bg-rose-950/80 text-rose-400 border border-rose-800/60">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Anular Factura Mala</h3>
                <p className="text-xs text-rose-400 font-mono">
                  Ticket #{ticketToDelete.ticketNumber} • {formatUSD(ticketToDelete.totalUSD)}
                </p>
              </div>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Esta factura se marcará como anulada y se reintegrarán las cantidades al inventario.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Motivo de anulación:
                </label>
                <input
                  type="text"
                  value={deleteTicketReason}
                  onChange={(e) => setDeleteTicketReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  placeholder="Ej. Error en pesaje o productos que salieron malos"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTicketToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTicket}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-950/50 cursor-pointer"
              >
                Anular Factura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Thermal Receipt / PNG / Bluetooth Print Modal */}
      {ticketToViewReceipt && (
        <ThermalReceiptModal
          ticket={ticketToViewReceipt}
          settings={settings}
          onClose={() => setTicketToViewReceipt(null)}
        />
      )}
    </div>
  );
};
