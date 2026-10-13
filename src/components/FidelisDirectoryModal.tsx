import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Award,
  Crown,
  Gift,
  Users,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Edit,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { FidelisCustomerProfile, SaleTicket } from '../types';
import {
  FIDELIS_STAMPS_GOAL,
  FIDELIS_HIGH_VALUE_GOAL,
  updateFidelisCustomerProfile,
  deleteFidelisCustomerProfile,
  syncAndSumTicketsToFidelis,
} from '../services/fidelis';
import { formatUSD, loadTickets } from '../services/storage';
import { FidelisCustomerEditModal } from './FidelisCustomerEditModal';

interface FidelisDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Record<string, FidelisCustomerProfile>;
  onClaimReward: (customerId: string, rewardType: 'stamps' | 'highValue') => void;
  onSelectCustomer?: (customer: { name: string; cedula: string; phone: string }) => void;
  onSaveCustomer?: (updatedProfile: Partial<FidelisCustomerProfile> & { customerName: string; customerCedula: string; customerPhone: string }, originalId: string) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onSyncComplete?: (message: string) => void;
}

export const FidelisDirectoryModal: React.FC<FidelisDirectoryModalProps> = ({
  isOpen,
  onClose,
  profiles,
  onClaimReward,
  onSelectCustomer,
  onSaveCustomer,
  onDeleteCustomer,
  onSyncComplete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'ready'>('all');

  // Customer editing modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<FidelisCustomerProfile | null>(null);

  // Sync notification toast
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const profileList = useMemo(() => {
    return (Object.values(profiles) as FidelisCustomerProfile[]).sort((a, b) => {
      // Prioritize customers with pending rewards
      const aReady = a.stampsCount >= FIDELIS_STAMPS_GOAL || a.highValueCount >= FIDELIS_HIGH_VALUE_GOAL;
      const bReady = b.stampsCount >= FIDELIS_STAMPS_GOAL || b.highValueCount >= FIDELIS_HIGH_VALUE_GOAL;
      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;
      return b.totalTransactions - a.totalTransactions;
    });
  }, [profiles]);

  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return profileList.filter((p) => {
      const matchesSearch =
        !q ||
        p.customerName.toLowerCase().includes(q) ||
        p.customerCedula.toLowerCase().includes(q) ||
        p.customerPhone.includes(q);

      const hasRewardReady =
        p.stampsCount >= FIDELIS_STAMPS_GOAL || p.highValueCount >= FIDELIS_HIGH_VALUE_GOAL;

      const matchesFilter = filterMode === 'all' || (filterMode === 'ready' && hasRewardReady);

      return matchesSearch && matchesFilter;
    });
  }, [profileList, searchTerm, filterMode]);

  // General summary counters
  const totalCustomers = profileList.length;
  const rewardsReadyCount = profileList.filter(
    (p) => p.stampsCount >= FIDELIS_STAMPS_GOAL || p.highValueCount >= FIDELIS_HIGH_VALUE_GOAL
  ).length;

  const handleOpenEdit = (cust: FidelisCustomerProfile) => {
    setCustomerToEdit(cust);
    setIsEditModalOpen(true);
  };

  const handleOpenCreate = () => {
    setCustomerToEdit(null);
    setIsEditModalOpen(true);
  };

  const handleSaveCustomer = (
    updatedData: Partial<FidelisCustomerProfile> & {
      customerName: string;
      customerCedula: string;
      customerPhone: string;
    },
    originalId: string
  ) => {
    if (onSaveCustomer) {
      onSaveCustomer(updatedData, originalId);
    } else {
      updateFidelisCustomerProfile(originalId, updatedData, profiles);
    }
    setIsEditModalOpen(false);
    setSyncToast(
      originalId
        ? `Cliente "${updatedData.customerName}" actualizado correctamente.`
        : `Nuevo cliente "${updatedData.customerName}" agregado a Fidelis.`
    );
    setTimeout(() => setSyncToast(null), 3500);
  };

  const handleDeleteCustomer = (customerId: string) => {
    if (onDeleteCustomer) {
      onDeleteCustomer(customerId);
    } else {
      deleteFidelisCustomerProfile(customerId, profiles);
    }
    setIsEditModalOpen(false);
    setSyncToast('Cliente eliminado del directorio de fidelización.');
    setTimeout(() => setSyncToast(null), 3500);
  };

  // Synchronize all tickets with customer stamps
  const handleSyncWithTickets = () => {
    const allTickets = loadTickets();
    const result = syncAndSumTicketsToFidelis(allTickets, profiles, { resetBeforeSync: false });
    const msg = `Sincronización completada: se procesaron ${result.processedTicketsCount} facturas, sumando ${result.totalStampsAdded} sellos en ${result.matchedCustomersCount} clientes.`;
    setSyncToast(msg);
    if (onSyncComplete) {
      onSyncComplete(msg);
    }
    setTimeout(() => setSyncToast(null), 4500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col text-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-950/40 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Directorio de Fidelización Fidelis
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/40 font-mono font-bold">
                  {totalCustomers} Clientes
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sistema de Métricas Duales: Recurrencia (X/10) y Facturas de Alto Valor (Y/4)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleSyncWithTickets}
              title="Buscar en las facturas históricas y sumar los sellos a cada cliente"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Sumar Sellos de Facturas</span>
              <span className="sm:hidden">Sincronizar</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Nuevo</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sync Toast Notification */}
        {syncToast && (
          <div className="bg-amber-950/90 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200 flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1 font-medium">{syncToast}</span>
            <button
              type="button"
              onClick={() => setSyncToast(null)}
              className="text-amber-400 hover:text-amber-200 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter Controls & Search */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, cédula o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-amber-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({totalCustomers})
            </button>
            <button
              onClick={() => setFilterMode('ready')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'ready'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/40'
                  : 'bg-amber-950/40 text-amber-300 border border-amber-800/40 hover:bg-amber-950/70'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Premios Listos ({rewardsReadyCount})</span>
            </button>
          </div>
        </div>

        {/* Customer Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredList.map((p) => {
            const hasStampsReward = p.stampsCount >= FIDELIS_STAMPS_GOAL;
            const hasHighValueReward = p.highValueCount >= FIDELIS_HIGH_VALUE_GOAL;
            const stampsPercent = Math.min(100, Math.round((p.stampsCount / FIDELIS_STAMPS_GOAL) * 100));
            const highValuePercent = Math.min(
              100,
              Math.round((p.highValueCount / FIDELIS_HIGH_VALUE_GOAL) * 100)
            );

            return (
              <div
                key={p.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  hasStampsReward || hasHighValueReward
                    ? 'bg-slate-950/90 border-amber-500/80 shadow-md shadow-amber-950/20'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/70">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-100">{p.customerName}</h4>
                      {(hasStampsReward || hasHighValueReward) && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black">
                          <Gift className="w-3 h-3" />
                          <span>¡RECOMPENSA DISPONIBLE!</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                      {p.customerCedula && <span>CI: {p.customerCedula}</span>}
                      {p.customerPhone && <span>Tlf: {p.customerPhone}</span>}
                      <span>{p.totalTransactions} transacciones</span>
                      <span className="text-emerald-400 font-semibold">{formatUSD(p.totalSpentUSD)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {/* Edit Customer Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
                      title="Editar datos, sellos y métricas del cliente"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {onSelectCustomer && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCustomer({
                            name: p.customerName,
                            cedula: p.customerCedula,
                            phone: p.customerPhone,
                          });
                          onClose();
                        }}
                        className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                      >
                        <span>Cargar en Venta</span>
                        <ArrowRight className="w-3 h-3 text-rose-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Dual Metric Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 text-xs">
                  {/* Metric 1: Stamps */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sellos Base</span>
                      </span>
                      <span className="font-mono font-bold text-amber-400">
                        {p.stampsCount}/{FIDELIS_STAMPS_GOAL}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all duration-500"
                        style={{ width: `${stampsPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>Ciclos: {p.stampsCycles} | Canjes: {p.stampsClaimed}</span>
                      {hasStampsReward && (
                        <button
                          type="button"
                          onClick={() => onClaimReward(p.id, 'stamps')}
                          className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer"
                        >
                          Entregar Premio
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metric 2: High Value */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5 text-yellow-400" />
                        <span>Compras ≥$18 USD</span>
                      </span>
                      <span className="font-mono font-bold text-yellow-300">
                        {p.highValueCount}/{FIDELIS_HIGH_VALUE_GOAL}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-yellow-300 transition-all duration-500"
                        style={{ width: `${highValuePercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>Ciclos VIP: {p.highValueCycles} | Canjes: {p.highValueClaimed}</span>
                      {hasHighValueReward && (
                        <button
                          type="button"
                          onClick={() => onClaimReward(p.id, 'highValue')}
                          className="px-2 py-0.5 rounded bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold transition cursor-pointer"
                        >
                          Entregar Premio VIP
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredList.length === 0 && (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">No se encontraron clientes</p>
              <p className="text-xs text-slate-500 mt-1">
                Puedes registrar clientes manualmente con el botón "+ Nuevo" o se registrarán automáticamente con cada venta.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Customer Edit & Creation Modal */}
      <FidelisCustomerEditModal
        isOpen={isEditModalOpen}
        customer={customerToEdit}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveCustomer}
        onDelete={handleDeleteCustomer}
      />
    </div>
  );
};

