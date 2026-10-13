import React, { useState } from 'react';
import { X, DollarSign, Tag, User, Hash, FileText, CheckCircle2 } from 'lucide-react';
import { AppSettings, ExpenseCategory, ExpenseRecord } from '../types';
import { formatUSD, formatVES } from '../services/storage';

interface NewExpenseModalProps {
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (expense: Omit<ExpenseRecord, 'id' | 'expenseNumber'>) => void;
}

const CATEGORIES: { id: ExpenseCategory; label: string; icon: string }[] = [
  { id: 'Mercancía/Proveedores', label: 'Mercancía y Proveedores', icon: '🧀' },
  { id: 'Bolsas y Empaques', label: 'Bolsas y Empaques', icon: '🛍️' },
  { id: 'Mantenimiento', label: 'Mantenimiento y Reparación', icon: '🔧' },
  { id: 'Personal/Nómina', label: 'Personal y Nómina', icon: '👥' },
  { id: 'Servicios', label: 'Servicios (Luz, Agua, Net)', icon: '💡' },
  { id: 'Alquiler/Local', label: 'Alquiler y Local', icon: '🏪' },
  { id: 'Otros Gastos', label: 'Otros Gastos Operativos', icon: '📦' },
];

export const NewExpenseModal: React.FC<NewExpenseModalProps> = ({
  settings,
  isOpen,
  onClose,
  onAddExpense,
}) => {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Mercancía/Proveedores');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [amountInput, setAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia'
  >('cash_usd');
  const [recipient, setRecipient] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const bcvRate = settings.bcvRate > 0 ? settings.bcvRate : 78.50;
  const numAmount = parseFloat(amountInput) || 0;

  // Compute opposite currency amount
  const amountUSD = currency === 'USD' ? numAmount : numAmount / bcvRate;
  const amountVES = currency === 'VES' ? numAmount : numAmount * bcvRate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Por favor indica una descripción o concepto del egreso.');
      return;
    }
    if (numAmount <= 0) {
      setError('El monto del egreso debe ser mayor a 0.');
      return;
    }

    onAddExpense({
      date: new Date().toISOString(),
      description: description.trim(),
      category,
      amountUSD: Number(amountUSD.toFixed(2)),
      amountVES: Number(amountVES.toFixed(2)),
      currency,
      appliedRate: bcvRate,
      paymentMethod,
      recipient: recipient.trim() || undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div
      id="new-expense-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Registrar Nuevo Egreso / Gasto</h3>
              <p className="text-xs text-slate-400">Salida de dinero de caja o bancos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-xs text-rose-300 font-medium">
              {error}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Concepto / Descripción del Egreso *
            </label>
            <input
              type="text"
              placeholder="Ej. Compra de 500 bolsas plásticas, Pago de hielo, Proveedor Quesos..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError(null);
              }}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-rose-500 focus:border-rose-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Categoría del Gasto *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-2 rounded-xl text-xs font-medium text-left flex items-center gap-2 transition border cursor-pointer ${
                    category === cat.id
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-xs'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount & Currency Switcher */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Monto del Egreso *
              </label>
              {/* Currency pills */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setCurrency('USD');
                    if (paymentMethod === 'cash_ves') setPaymentMethod('cash_usd');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    currency === 'USD'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Dólares ($ USD)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrency('VES');
                    if (paymentMethod === 'cash_usd') setPaymentMethod('cash_ves');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    currency === 'VES'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Bolívares (Bs. VES)
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 font-mono">
                {currency === 'USD' ? '$' : 'Bs.'}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setError(null);
                }}
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-base font-bold font-mono text-slate-100 placeholder:text-slate-600 focus:outline-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Equivalent live preview */}
            {numAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1 border-t border-slate-900">
                <span>Equivalente a Tasa BCV ({formatVES(bcvRate)}):</span>
                <span className="font-mono font-bold text-slate-200">
                  {currency === 'USD' ? formatVES(amountVES) : formatUSD(amountUSD)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Method / Origin of funds */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Origen de los Fondos (¿Cómo se pagó?) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'cash_usd', label: 'Efectivo $ (Gaveta)', desc: 'Resta del efectivo $' },
                { id: 'cash_ves', label: 'Efectivo Bs (Gaveta)', desc: 'Resta del efectivo Bs' },
                { id: 'pago_movil', label: 'Pago Móvil', desc: 'Resta de Bancos' },
                { id: 'punto', label: 'Punto / Débito', desc: 'Resta de Bancos' },
                { id: 'transferencia', label: 'Transferencia', desc: 'Resta de Bancos' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                    paymentMethod === m.id
                      ? 'bg-rose-500/20 border-rose-500/60 text-white shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">{m.label}</div>
                  <div className="text-[10px] text-slate-500">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Beneficiary / Recipient & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Proveedor / Beneficiario
              </label>
              <input
                type="text"
                placeholder="Ej. Distribuidora Polar, Juan Pérez..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-rose-500 focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                N° Factura / Referencia
              </label>
              <input
                type="text"
                placeholder="Ej. FAC-1204 o Ref: 8941"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-rose-500 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Notas adicionales (Opcional)
            </label>
            <input
              type="text"
              placeholder="Detalle extra del gasto..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-rose-500 focus:border-rose-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition shadow-lg shadow-amber-900/40 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Guardar Egreso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
