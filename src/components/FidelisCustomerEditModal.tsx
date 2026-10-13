import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  CreditCard,
  Award,
  Crown,
  Gift,
  Trash2,
  Check,
  Sparkles,
  Plus,
  Minus,
  DollarSign,
  ShoppingBag,
} from 'lucide-react';
import { FidelisCustomerProfile } from '../types';
import {
  FIDELIS_STAMPS_GOAL,
  FIDELIS_HIGH_VALUE_GOAL,
  FIDELIS_HIGH_VALUE_THRESHOLD,
} from '../services/fidelis';
import { formatUSD } from '../services/storage';

interface FidelisCustomerEditModalProps {
  isOpen: boolean;
  customer: FidelisCustomerProfile | null;
  onClose: () => void;
  onSave: (
    updatedProfile: Partial<FidelisCustomerProfile> & {
      customerName: string;
      customerCedula: string;
      customerPhone: string;
    },
    originalId: string
  ) => void;
  onDelete?: (customerId: string) => void;
}

export const FidelisCustomerEditModal: React.FC<FidelisCustomerEditModalProps> = ({
  isOpen,
  customer,
  onClose,
  onSave,
  onDelete,
}) => {
  const isNew = !customer;

  const [customerName, setCustomerName] = useState('');
  const [customerCedula, setCustomerCedula] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [stampsCount, setStampsCount] = useState<number>(0);
  const [stampsCycles, setStampsCycles] = useState<number>(0);
  const [stampsClaimed, setStampsClaimed] = useState<number>(0);
  const [highValueCount, setHighValueCount] = useState<number>(0);
  const [highValueCycles, setHighValueCycles] = useState<number>(0);
  const [highValueClaimed, setHighValueClaimed] = useState<number>(0);
  const [totalSpentUSD, setTotalSpentUSD] = useState<string>('0.00');
  const [totalTransactions, setTotalTransactions] = useState<number>(0);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setCustomerName(customer.customerName || '');
      setCustomerCedula(customer.customerCedula || '');
      setCustomerPhone(customer.customerPhone || '');
      setStampsCount(customer.stampsCount || 0);
      setStampsCycles(customer.stampsCycles || 0);
      setStampsClaimed(customer.stampsClaimed || 0);
      setHighValueCount(customer.highValueCount || 0);
      setHighValueCycles(customer.highValueCycles || 0);
      setHighValueClaimed(customer.highValueClaimed || 0);
      setTotalSpentUSD(Number(customer.totalSpentUSD || 0).toFixed(2));
      setTotalTransactions(customer.totalTransactions || 0);
    } else {
      setCustomerName('');
      setCustomerCedula('');
      setCustomerPhone('');
      setStampsCount(0);
      setStampsCycles(0);
      setStampsClaimed(0);
      setHighValueCount(0);
      setHighValueCycles(0);
      setHighValueClaimed(0);
      setTotalSpentUSD('0.00');
      setTotalTransactions(0);
    }
    setConfirmDelete(false);
    setErrorMsg(null);
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = customerName.trim();
    if (!cleanName) {
      setErrorMsg('Por favor ingresa el nombre del cliente.');
      return;
    }

    const spent = Math.max(0, parseFloat(totalSpentUSD.replace(',', '.')) || 0);

    onSave(
      {
        customerName: cleanName,
        customerCedula: customerCedula.trim().toUpperCase(),
        customerPhone: customerPhone.trim(),
        stampsCount: Math.max(0, Math.min(stampsCount, 10)),
        stampsCycles: Math.max(0, stampsCycles),
        stampsClaimed: Math.max(0, stampsClaimed),
        highValueCount: Math.max(0, Math.min(highValueCount, 4)),
        highValueCycles: Math.max(0, highValueCycles),
        highValueClaimed: Math.max(0, highValueClaimed),
        totalSpentUSD: Math.round(spent * 100) / 100,
        totalTransactions: Math.max(0, totalTransactions),
      },
      customer?.id || ''
    );

    onClose();
  };

  const stampsPercent = Math.min(100, Math.round((stampsCount / FIDELIS_STAMPS_GOAL) * 100));
  const highValuePercent = Math.min(100, Math.round((highValueCount / FIDELIS_HIGH_VALUE_GOAL) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-950/40">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                {isNew ? 'Registrar Nuevo Cliente Fidelis' : 'Editar Cliente del Sistema Fidelis'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Ajusta datos personales, sellos de recurrencia y compras de alto valor.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Identification Section */}
          <div className="space-y-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Datos de Identificación</span>
            </h4>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Nombre Completo (*)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. María Pérez"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-slate-400" />
                    <span>Cédula / RIF</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. V-18456789"
                    value={customerCedula}
                    onChange={(e) => setCustomerCedula(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-amber-500 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Teléfono (WhatsApp)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="Ej. 04141234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Metric 1: Stamps Base (0-10) */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Sistema Base de Sellos (Recurrencia)</span>
              </h4>
              <span className="text-xs font-mono font-bold text-amber-400">
                {stampsCount}/{FIDELIS_STAMPS_GOAL}
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all duration-300"
                style={{ width: `${stampsPercent}%` }}
              />
            </div>

            {/* Quick adjust buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-slate-400">Sellos Acumulados Activos:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStampsCount((prev) => Math.max(0, prev - 1))}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm cursor-pointer border border-slate-700 transition"
                  title="Restar 1 sello"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <input
                  type="number"
                  min="0"
                  max="10"
                  value={stampsCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setStampsCount(isNaN(v) ? 0 : Math.max(0, Math.min(v, 10)));
                  }}
                  className="w-14 bg-slate-900 border border-slate-700 rounded-lg py-1 text-center font-mono font-bold text-amber-300 text-sm focus:outline-amber-500"
                />

                <button
                  type="button"
                  onClick={() => setStampsCount((prev) => Math.min(10, prev + 1))}
                  className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-sm cursor-pointer shadow-sm transition"
                  title="Sumar 1 sello"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Secondary Cycles & Claims */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Ciclos Completados (x10)</label>
                <input
                  type="number"
                  min="0"
                  value={stampsCycles}
                  onChange={(e) => setStampsCycles(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Premios Entregados</label>
                <input
                  type="number"
                  min="0"
                  value={stampsClaimed}
                  onChange={(e) => setStampsClaimed(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Metric 2: High Value (≥$18 USD, 0-4) */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-yellow-400" />
                <span>Compras de Alto Valor (≥$18 USD)</span>
              </h4>
              <span className="text-xs font-mono font-bold text-yellow-300">
                {highValueCount}/{FIDELIS_HIGH_VALUE_GOAL}
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-yellow-300 transition-all duration-300"
                style={{ width: `${highValuePercent}%` }}
              />
            </div>

            {/* Quick adjust buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-slate-400">Compras VIP Activas:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHighValueCount((prev) => Math.max(0, prev - 1))}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm cursor-pointer border border-slate-700 transition"
                  title="Restar 1 compra VIP"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <input
                  type="number"
                  min="0"
                  max="4"
                  value={highValueCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setHighValueCount(isNaN(v) ? 0 : Math.max(0, Math.min(v, 4)));
                  }}
                  className="w-14 bg-slate-900 border border-slate-700 rounded-lg py-1 text-center font-mono font-bold text-yellow-300 text-sm focus:outline-amber-500"
                />

                <button
                  type="button"
                  onClick={() => setHighValueCount((prev) => Math.min(4, prev + 1))}
                  className="w-7 h-7 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-slate-950 flex items-center justify-center font-bold text-sm cursor-pointer shadow-sm transition"
                  title="Sumar 1 compra VIP"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Secondary Cycles & Claims */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Ciclos VIP Completados (x4)</label>
                <input
                  type="number"
                  min="0"
                  value={highValueCycles}
                  onChange={(e) => setHighValueCycles(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Premios VIP Entregados</label>
                <input
                  type="number"
                  min="0"
                  value={highValueClaimed}
                  onChange={(e) => setHighValueClaimed(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Historical Totals */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Totales Acumulados</span>
            </h4>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Total Gastado ($ USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalSpentUSD}
                    onChange={(e) => setTotalSpentUSD(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-emerald-400 font-mono font-bold focus:outline-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Total Transacciones</label>
                <input
                  type="number"
                  min="0"
                  value={totalTransactions}
                  onChange={(e) => setTotalTransactions(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 font-mono font-bold focus:outline-amber-500"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div>
            {!isNew && onDelete && (
              <div>
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-rose-400 font-bold">¿Seguro de eliminar?</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (customer?.id) {
                          onDelete(customer.id);
                          onClose();
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition"
                    >
                      Sí, Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs cursor-pointer hover:bg-slate-700"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 p-1.5 rounded-lg hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Cliente</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs font-bold shadow-md shadow-amber-950/40 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isNew ? 'Registrar Cliente' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
