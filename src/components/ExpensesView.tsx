import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Search,
  Plus,
  Trash2,
  Tag,
  Calendar,
  User,
  Hash,
  AlertTriangle,
  TrendingDown,
  Wallet,
  Building,
  Truck,
  Clock,
  CheckCircle2,
  CalendarClock,
  Send,
  ArrowRight,
} from 'lucide-react';
import { AppSettings, ExpenseCategory, ExpenseRecord, RestockRecord } from '../types';
import { formatUSD, formatVES, formatQuantity } from '../services/storage';

interface ExpensesViewProps {
  expenses: ExpenseRecord[];
  settings: AppSettings;
  restocks?: RestockRecord[];
  onOpenNewExpenseModal: () => void;
  onDeleteExpense: (expenseId: string) => void;
  onAbonoToRestock?: (
    restockId: string,
    amountUSD: number,
    method: 'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia',
    reference?: string,
    notes?: string
  ) => void;
  onNavigateToRestocks?: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  settings,
  restocks = [],
  onOpenNewExpenseModal,
  onDeleteExpense,
  onAbonoToRestock,
  onNavigateToRestocks,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRecord | null>(null);

  // Abono modal state inside Egresos
  const [activeRestockForAbono, setActiveRestockForAbono] = useState<RestockRecord | null>(null);
  const [abonoAmountInput, setAbonoAmountInput] = useState<string>('');
  const [abonoPaymentMethod, setAbonoPaymentMethod] = useState<
    'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia'
  >('cash_usd');
  const [abonoRefInput, setAbonoRefInput] = useState<string>('');
  const [abonoNotesInput, setAbonoNotesInput] = useState<string>('');
  const [abonoError, setAbonoError] = useState<string | null>(null);

  // Credit Restocks Reminders
  const creditRestocks = useMemo(() => {
    return restocks.filter((r) => r.paymentCondition === 'credito');
  }, [restocks]);

  const pendingCreditRestocks = useMemo(() => {
    return creditRestocks.filter((r) => !r.isPaid && r.pendingUSD > 0);
  }, [creditRestocks]);

  const totalPendingSupplierDebtUSD = useMemo(() => {
    return pendingCreditRestocks.reduce((sum, r) => sum + r.pendingUSD, 0);
  }, [pendingCreditRestocks]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchDesc = exp.description.toLowerCase().includes(q);
      const matchRecipient = exp.recipient?.toLowerCase().includes(q);
      const matchRef = exp.reference?.toLowerCase().includes(q);
      const matchCategory = exp.category.toLowerCase().includes(q);
      return matchDesc || matchRecipient || matchRef || matchCategory;
    });
  }, [expenses, categoryFilter, searchQuery]);

  // Aggregate Metrics
  const summary = useMemo(() => {
    let totalUSD = 0;
    let totalVES = 0;
    let cashUSD = 0;
    let cashVES = 0;
    let digitalVES = 0;

    for (const exp of expenses) {
      totalUSD += exp.amountUSD;
      totalVES += exp.amountVES;
      if (exp.paymentMethod === 'cash_usd') {
        cashUSD += exp.amountUSD;
      } else if (exp.paymentMethod === 'cash_ves') {
        cashVES += exp.amountVES;
      } else {
        digitalVES += exp.amountVES;
      }
    }

    return { totalUSD, totalVES, cashUSD, cashVES, digitalVES };
  }, [expenses]);

  const handleConfirmDelete = () => {
    if (!expenseToDelete) return;
    onDeleteExpense(expenseToDelete.id);
    setExpenseToDelete(null);
  };

  const getCategoryBadgeColor = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'Mercancía/Proveedores':
        return 'bg-blue-950 text-blue-300 border-blue-800';
      case 'Bolsas y Empaques':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'Mantenimiento':
        return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'Personal/Nómina':
        return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'Servicios':
        return 'bg-yellow-950 text-yellow-300 border-yellow-800';
      case 'Alquiler/Local':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const formatMethodLabel = (m: string) => {
    switch (m) {
      case 'cash_usd':
        return '💵 Efectivo $';
      case 'cash_ves':
        return '🇻🇪 Efectivo Bs';
      case 'pago_movil':
        return '📲 Pago Móvil';
      case 'punto':
        return '💳 Punto / Débito';
      case 'transferencia':
        return '🏦 Transferencia';
      default:
        return m;
    }
  };

  return (
    <div id="expenses-view" className="space-y-4">
      {/* Top Banner & Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <TrendingDown className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                Registro y Control de Egresos
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Controla las salidas de dinero por mercancía, bolsas, servicios, hielo y nómina para cuadrar la caja en el Reporte Z.
            </p>
          </div>

          <button
            onClick={onOpenNewExpenseModal}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            Registrar Egreso
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Total Egresos
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-rose-400 block mt-0.5">
              -{formatUSD(summary.totalUSD)}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              -{formatVES(summary.totalVES)}
            </span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Salida Efectivo $
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-amber-300 block mt-0.5">
              -{formatUSD(summary.cashUSD)}
            </span>
            <span className="text-[10px] text-slate-500">Gaveta Divisas</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Salida Efectivo Bs
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-slate-200 block mt-0.5">
              -{formatVES(summary.cashVES)}
            </span>
            <span className="text-[10px] text-slate-500">Gaveta Bolívares</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Salida Bancos
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-cyan-300 block mt-0.5">
              -{formatVES(summary.digitalVES)}
            </span>
            <span className="text-[10px] text-slate-500">Pago Móvil / Punto</span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por concepto, proveedor o referencia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-amber-500 focus:border-amber-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-amber-500"
          >
            <option value="all">Todas las categorías</option>
            <option value="Mercancía/Proveedores">Mercancía/Proveedores</option>
            <option value="Bolsas y Empaques">Bolsas y Empaques</option>
            <option value="Mantenimiento">Mantenimiento</option>
            <option value="Personal/Nómina">Personal/Nómina</option>
            <option value="Servicios">Servicios</option>
            <option value="Alquiler/Local">Alquiler/Local</option>
            <option value="Otros Gastos">Otros Gastos</option>
          </select>
        </div>
      </div>

      {/* RECORDATORIOS DE PAGO DE MERCANCÍA A CRÉDITO */}
      {creditRestocks.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <CalendarClock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Recordatorios de Pago a Proveedores (Mercancía a Crédito)</span>
                  {pendingCreditRestocks.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {pendingCreditRestocks.length} pendiente{pendingCreditRestocks.length > 1 ? 's' : ''}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Control de compras a crédito, fechas límite de pago y registro de abonos antes del vencimiento.
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Deuda Total a Proveedores:</span>
              <span className="text-base font-bold font-mono text-amber-400">
                {formatUSD(totalPendingSupplierDebtUSD)}
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {creditRestocks.map((r) => {
              const isOverdue =
                !r.isPaid && r.dueDate && new Date(r.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

              return (
                <div
                  key={r.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                    r.isPaid
                      ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                      : isOverdue
                      ? 'bg-rose-950/20 border-rose-600/40 text-slate-200'
                      : 'bg-amber-950/20 border-amber-500/30 text-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{r.productName}</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 font-mono text-[10px] text-slate-300">
                        +{formatQuantity(r.quantityAdded, r.unit)}
                      </span>
                      <span className="text-slate-400 text-[11px]">🏢 {r.supplierName}</span>
                      {r.supplierInvoiceNumber && (
                        <span className="text-slate-500 text-[10px]">Fac: {r.supplierInvoiceNumber}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 flex-wrap">
                      <span>Costo: <strong className="text-slate-200">{formatUSD(r.totalCostUSD)}</strong></span>
                      <span>
                        Abonado a la fecha:{' '}
                        <strong className="text-emerald-400">
                          {formatUSD(r.paidUSD)} {r.abonos && r.abonos.length > 0 ? `(${r.abonos.length} abonos)` : ''}
                        </strong>
                      </span>
                      <span>
                        Saldo restante:{' '}
                        <strong className={r.pendingUSD > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                          {formatUSD(r.pendingUSD)}
                        </strong>
                      </span>
                    </div>

                    {/* Due Date & Status */}
                    <div className="flex items-center gap-2 text-[11px]">
                      {r.dueDate && (
                        <span
                          className={`font-semibold flex items-center gap-1 ${
                            isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>Límite de Pago: {r.dueDate}</span>
                          {isOverdue && <span className="text-rose-400">⚠️ Vencido</span>}
                        </span>
                      )}
                      {r.isPaid && (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Liquidado / Pagado</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {!r.isPaid && r.pendingUSD > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRestockForAbono(r);
                          setAbonoAmountInput(r.pendingUSD.toFixed(2));
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Abonar a Proveedor</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="space-y-2.5">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-400">
            <DollarSign className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No hay egresos registrados</p>
            <p className="text-xs text-slate-500 mt-1">
              Usa el botón "Registrar Egreso" para añadir compras de mercancía, insumos o pagos operativos.
            </p>
          </div>
        ) : (
          filteredExpenses.map((exp) => (
            <div
              key={exp.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
            >
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 border border-slate-800">
                    EXP #{exp.expenseNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadgeColor(
                      exp.category
                    )}`}
                  >
                    {exp.category}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {formatMethodLabel(exp.paymentMethod)}
                  </span>
                </div>

                <div className="text-sm font-bold text-slate-100">{exp.description}</div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {new Date(exp.date).toLocaleString('es-VE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {exp.recipient && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      {exp.recipient}
                    </span>
                  )}
                  {exp.reference && (
                    <span className="flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-slate-500" />
                      {exp.reference}
                    </span>
                  )}
                </div>

                {exp.notes && (
                  <p className="text-[11px] text-slate-400 italic pt-0.5">"{exp.notes}"</p>
                )}
              </div>

              {/* Amount & Actions */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/80 gap-2">
                <div className="text-left sm:text-right">
                  <div className="text-base font-bold font-mono text-rose-400">
                    -{formatUSD(exp.amountUSD)}
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    -{formatVES(exp.amountVES)}
                  </div>
                </div>

                <button
                  onClick={() => setExpenseToDelete(exp)}
                  title="Eliminar Egreso"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Registrar Abono a Proveedor desde Egresos */}
      {activeRestockForAbono && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="text-sm font-bold">Abonar a Cuenta por Pagar</h4>
                  <p className="text-xs text-slate-400">{activeRestockForAbono.supplierName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRestockForAbono(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Producto Repuesto:</span>
                <span className="font-bold text-white">{activeRestockForAbono.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Costo Total Lote:</span>
                <span className="font-mono text-white">{formatUSD(activeRestockForAbono.totalCostUSD)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Abonado Previo:</span>
                <span className="font-mono text-emerald-400">{formatUSD(activeRestockForAbono.paidUSD)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-amber-400 font-bold">Saldo Deuda Pendiente:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {formatUSD(activeRestockForAbono.pendingUSD)}
                </span>
              </div>
              {activeRestockForAbono.dueDate && (
                <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>Fecha Límite Acordada:</span>
                  <span>{activeRestockForAbono.dueDate}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Monto a Abonar ($ USD):</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={activeRestockForAbono.pendingUSD}
                    value={abonoAmountInput}
                    onChange={(e) => setAbonoAmountInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-amber-500"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Método de Pago:</label>
                <select
                  value={abonoPaymentMethod}
                  onChange={(e: any) => setAbonoPaymentMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="cash_usd">💵 Efectivo Divisas ($ USD)</option>
                  <option value="cash_ves">🇻🇪 Efectivo Bolívares (Bs.)</option>
                  <option value="pago_movil">📱 Pago Móvil</option>
                  <option value="punto">💳 Punto de Venta</option>
                  <option value="transferencia">🏦 Transferencia Bancaria</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Referencia o Comprobante:</label>
                <input
                  type="text"
                  placeholder="Ej: PM-19283 / Comprobante"
                  value={abonoRefInput}
                  onChange={(e) => setAbonoRefInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Observaciones:</label>
                <input
                  type="text"
                  placeholder="Abono a cuenta antes del vencimiento..."
                  value={abonoNotesInput}
                  onChange={(e) => setAbonoNotesInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            {abonoError && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold">
                {abonoError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveRestockForAbono(null);
                  setAbonoError(null);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAbonoError(null);
                  const amt = parseFloat(abonoAmountInput.replace(',', '.'));
                  if (!amt || amt <= 0) {
                    setAbonoError('Por favor ingresa un monto válido mayor a cero.');
                    return;
                  }
                  if (amt > activeRestockForAbono.pendingUSD) {
                    setAbonoError(`El abono supera el saldo pendiente ($${activeRestockForAbono.pendingUSD.toFixed(2)}).`);
                    return;
                  }
                  if (onAbonoToRestock) {
                    onAbonoToRestock(
                      activeRestockForAbono.id,
                      amt,
                      abonoPaymentMethod,
                      abonoRefInput,
                      abonoNotesInput
                    );
                  }
                  setActiveRestockForAbono(null);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition shadow-lg shadow-amber-900/40 cursor-pointer"
              >
                Registrar Abono
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Expense Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-slate-100">¿Eliminar este Egreso?</h4>
              <p className="text-xs text-slate-400">
                Se eliminará el registro "{expenseToDelete.description}" por {formatUSD(expenseToDelete.amountUSD)}.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition shadow-lg shadow-rose-900/40"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
