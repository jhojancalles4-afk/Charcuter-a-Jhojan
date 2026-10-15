import React, { useState } from 'react';
import {
  Store,
  ShoppingCart,
  BookOpen,
  Package,
  Settings,
  DollarSign,
  TrendingUp,
  Edit2,
  Check,
  X,
  RefreshCw,
  Receipt,
  Sparkles,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { AppSettings } from '../types';
import { formatVES, formatUSD } from '../services/storage';
import { OfflineIndicator } from './OfflineIndicator';

interface HeaderProps {
  activeTab: 'pos' | 'tickets' | 'fiados' | 'inventory' | 'settings';
  setActiveTab: (tab: 'pos' | 'tickets' | 'fiados' | 'inventory' | 'settings') => void;
  settings: AppSettings;
  onUpdateBcvRate: (newRate: number) => void;
  onUpdatePreferentialRate?: (newRate: number) => void;
  debtorsCount: number;
  totalTicketsCount?: number;
  totalDebtUSD: number;
  onSync?: () => void;
  isSyncing?: boolean;
  fidelisRewardsReadyCount?: number;
  onOpenFidelis?: () => void;
  onOpenGoogleBackup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onUpdateBcvRate,
  onUpdatePreferentialRate,
  debtorsCount,
  totalTicketsCount = 0,
  totalDebtUSD,
  fidelisRewardsReadyCount = 0,
  onOpenFidelis,
  onOpenGoogleBackup,
}) => {
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(settings.bcvRate.toString());

  const [isEditingPrefRate, setIsEditingPrefRate] = useState(false);
  const [tempPrefRate, setTempPrefRate] = useState(
    (settings.preferentialRate || settings.bcvRate).toString()
  );

  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(tempRate.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      onUpdateBcvRate(parsed);
      setIsEditingRate(false);
    }
  };

  const handleSavePrefRate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(tempPrefRate.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0 && onUpdatePreferentialRate) {
      onUpdatePreferentialRate(parsed);
      setIsEditingPrefRate(false);
    }
  };

  const effectivePrefRate = settings.preferentialRate || settings.bcvRate;

  return (
    <header id="app-main-header" className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5">
        {/* Top row: Brand + Rates + Connectivity + PWA */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-800/60">
          {/* Logo & Store Name */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 text-white shadow-md shadow-rose-950/40">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight leading-tight">
                  {settings.businessName}
                </h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 font-mono font-medium border border-rose-800/40">
                  POS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                RIF: {settings.rif}
              </p>
            </div>
          </div>

          {/* Right Controls: BCV Rate + Tasa Preferencial Efectivo, Offline, PWA Button */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Live BCV Tasa widget with 1-click editor */}
            <div id="bcv-rate-badge" className="relative">
              {isEditingRate ? (
                <form
                  onSubmit={handleSaveRate}
                  className="flex items-center gap-1 bg-slate-800 border border-rose-500/80 rounded-lg p-1 shadow-lg"
                >
                  <span className="text-[11px] font-mono text-slate-300 pl-1.5">BCV:</span>
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={tempRate}
                    onChange={(e) => setTempRate(e.target.value)}
                    className="w-18 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-white text-right focus:outline-rose-500"
                    placeholder="78.50"
                  />
                  <button
                    type="submit"
                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs cursor-pointer"
                    title="Guardar Tasa BCV"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempRate(settings.bcvRate.toString());
                      setIsEditingRate(false);
                    }}
                    className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs cursor-pointer"
                    title="Cancelar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTempRate(settings.bcvRate.toString());
                    setIsEditingRate(true);
                  }}
                  className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 transition shadow-xs cursor-pointer"
                  title="Haz clic para editar la Tasa Oficial BCV"
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                    <TrendingUp className="w-3 h-3" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Tasa BCV</span>
                      <Edit2 className="w-2.5 h-2.5 text-slate-500 group-hover:text-emerald-400 transition" />
                    </div>
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      {formatVES(settings.bcvRate)}
                    </span>
                  </div>
                </button>
              )}
            </div>

            {/* Renglón Tasa Preferencial Efectivo widget */}
            <div id="pref-rate-badge" className="relative">
              {isEditingPrefRate ? (
                <form
                  onSubmit={handleSavePrefRate}
                  className="flex flex-col gap-1 bg-slate-800 border border-amber-500/80 rounded-lg p-1.5 shadow-lg"
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-mono text-amber-300 pl-1">💵 Divisa:</span>
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={tempPrefRate}
                      onChange={(e) => setTempPrefRate(e.target.value)}
                      className="w-18 bg-slate-900 border border-amber-700 rounded px-1.5 py-0.5 text-xs font-mono text-amber-300 text-right focus:outline-amber-500"
                      placeholder="82.00"
                    />
                    <button
                      type="submit"
                      className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs cursor-pointer"
                      title="Guardar Tasa Preferencial"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempPrefRate(effectivePrefRate.toString());
                        setIsEditingPrefRate(false);
                      }}
                      className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] font-mono text-amber-300 px-1 bg-amber-950/60 rounded py-0.5 border border-amber-800/40 text-center">
                    Sugerencia: $10.00 base → ${(parseFloat(tempPrefRate) > 0 ? (10 * settings.bcvRate) / parseFloat(tempPrefRate) : 10).toFixed(2)} USD
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTempPrefRate(effectivePrefRate.toString());
                    setIsEditingPrefRate(true);
                  }}
                  className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-amber-800/60 hover:border-amber-500/60 transition shadow-xs cursor-pointer"
                  title="Renglón de Tasa Preferencial para cobros en divisas efectivo"
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/40">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">💵 Tasa Divisa</span>
                      <Edit2 className="w-2.5 h-2.5 text-amber-500 group-hover:text-amber-300 transition" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold font-mono text-amber-300">
                        {formatVES(effectivePrefRate)}
                      </span>
                      <span className="hidden sm:inline text-[10px] font-mono text-amber-400/90">
                        ($10 → ${((10 * settings.bcvRate) / effectivePrefRate).toFixed(2)} USD)
                      </span>
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Unified Backup Hub Button (Google Drive & Telegram) */}
            {onOpenGoogleBackup && (
              <button
                type="button"
                onClick={onOpenGoogleBackup}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-sky-800/60 hover:border-sky-500/60 transition shadow-xs cursor-pointer text-slate-200"
                title="Centro de Respaldos: Google Drive y Telegram"
              >
                <div className="flex items-center justify-center w-5 h-5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/40">
                  <ShieldCheck className="w-3 h-3" />
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-[9px] font-medium text-sky-400 uppercase tracking-wider block leading-tight">
                    Respaldos
                  </span>
                  <span className="text-[10px] font-mono text-slate-300 font-semibold leading-tight block">
                    Drive & Telegram
                  </span>
                </div>
                <span className="sm:hidden text-[10px] font-semibold text-sky-300">
                  Respaldos
                </span>
              </button>
            )}

            {/* Local Storage & Connectivity Status */}
            <OfflineIndicator />
          </div>
        </div>

        {/* Bottom row: Primary Navigation Tabs */}
        <nav id="app-primary-nav" className="flex items-center gap-1.5 pt-2 overflow-x-auto no-scrollbar">
          <button
            id="nav-tab-pos"
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'pos'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Punto de Venta</span>
          </button>

          <button
            id="nav-tab-tickets"
            onClick={() => setActiveTab('tickets')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'tickets'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Facturas</span>
            {totalTicketsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                {totalTicketsCount}
              </span>
            )}
          </button>

          <button
            id="nav-tab-fiados"
            onClick={() => setActiveTab('fiados')}
            className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'fiados'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Libro de Fiados</span>
            {debtorsCount > 0 && (
              <span
                id="badge-debtors-count"
                className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950 shadow-xs"
              >
                {debtorsCount}
              </span>
            )}
          </button>

          {onOpenFidelis && (
            <button
              id="nav-btn-fidelis"
              type="button"
              onClick={onOpenFidelis}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer text-amber-300 hover:text-amber-100 hover:bg-amber-950/60 border border-amber-500/30 bg-amber-500/10 shadow-xs"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Fidelis Club</span>
              {fidelisRewardsReadyCount > 0 && (
                <span
                  id="badge-fidelis-rewards-count"
                  className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-amber-400 text-slate-950 shadow-xs animate-pulse"
                  title="Clientes con premios listos para canjear"
                >
                  {fidelisRewardsReadyCount}
                </span>
              )}
            </button>
          )}

          <button
            id="nav-tab-inventory"
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Inventario</span>
          </button>

          <button
            id="nav-tab-settings"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Ajustes & Pago Móvil</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
