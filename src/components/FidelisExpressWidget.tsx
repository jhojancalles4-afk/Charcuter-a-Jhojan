import React, { useState } from 'react';
import {
  Award,
  Crown,
  Sparkles,
  Gift,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Users,
} from 'lucide-react';
import { FidelisCustomerProfile } from '../types';
import {
  findFidelisProfile,
  FIDELIS_STAMPS_GOAL,
  FIDELIS_HIGH_VALUE_THRESHOLD,
  FIDELIS_HIGH_VALUE_GOAL,
} from '../services/fidelis';
import { formatUSD } from '../services/storage';

interface FidelisExpressWidgetProps {
  customerCedula: string;
  customerPhone: string;
  customerName: string;
  currentCartTotalUSD: number;
  profiles: Record<string, FidelisCustomerProfile>;
  onClaimReward: (customerId: string, rewardType: 'stamps' | 'highValue') => void;
  onOpenDirectory?: () => void;
}

export const FidelisExpressWidget: React.FC<FidelisExpressWidgetProps> = ({
  customerCedula,
  customerPhone,
  customerName,
  currentCartTotalUSD,
  profiles,
  onClaimReward,
  onOpenDirectory,
}) => {
  const [claimConfirmType, setClaimConfirmType] = useState<'stamps' | 'highValue' | null>(null);

  // Locate active customer profile in real time
  const activeProfile = findFidelisProfile(
    { cedula: customerCedula, phone: customerPhone, name: customerName },
    profiles
  );

  const hasCustomerIdentity =
    (customerCedula.trim().length > 3 && customerCedula.trim().toUpperCase() !== 'V-00000000') ||
    customerPhone.trim().length >= 7 ||
    (customerName.trim().length > 2 && customerName.trim().toLowerCase() !== 'consumidor final');

  // Metrics values (existing profile or virtual new client)
  const stamps = activeProfile ? activeProfile.stampsCount : 0;
  const stampsGoal = FIDELIS_STAMPS_GOAL;
  const highValue = activeProfile ? activeProfile.highValueCount : 0;
  const highValueGoal = FIDELIS_HIGH_VALUE_GOAL;

  // Evaluator for active cart in real time
  const isCartActive = currentCartTotalUSD > 0;
  const qualifiesForHighValue = currentCartTotalUSD >= FIDELIS_HIGH_VALUE_THRESHOLD;
  const missingForHighValue = Math.max(0, FIDELIS_HIGH_VALUE_THRESHOLD - currentCartTotalUSD);

  // Projected metrics after sale
  const projectedStamps = hasCustomerIdentity && isCartActive ? Math.min(stampsGoal, stamps + 1) : stamps;
  const projectedHighValue =
    hasCustomerIdentity && isCartActive && qualifiesForHighValue
      ? Math.min(highValueGoal, highValue + 1)
      : highValue;

  // Reward ready states
  const isStampsRewardReady = stamps >= stampsGoal;
  const isHighValueRewardReady = highValue >= highValueGoal;

  // Percentage calculations for dynamic progress bars
  const stampsPercent = Math.min(100, Math.round((stamps / stampsGoal) * 100));
  const highValuePercent = Math.min(100, Math.round((highValue / highValueGoal) * 100));

  const handleConfirmClaim = (type: 'stamps' | 'highValue') => {
    if (!activeProfile) return;
    onClaimReward(activeProfile.id, type);
    setClaimConfirmType(null);
  };

  return (
    <div
      id="fidelis-express-widget"
      className="rounded-2xl border border-amber-900/60 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-3.5 shadow-lg relative overflow-hidden space-y-3"
    >
      {/* Background ambient glow in amber */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Widget Express Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-500 text-slate-950 font-black shadow-xs shadow-amber-950/50">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-wide text-amber-300 uppercase">
                Fidelis Express
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/50 font-medium">
                Métricas Duales
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {hasCustomerIdentity
                ? activeProfile
                  ? `Cliente: ${activeProfile.customerName}`
                  : `Nuevo cliente: ${customerName || 'Por registrar'}`
                : 'Identifica al cliente para consultar o acumular'}
            </p>
          </div>
        </div>

        {onOpenDirectory && (
          <button
            type="button"
            onClick={onOpenDirectory}
            className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-950/70 border border-amber-800/40 px-2 py-1 rounded-lg transition cursor-pointer"
            title="Ver catálogo completo de clientes fidelizados"
          >
            <Users className="w-3 h-3" />
            <span className="hidden sm:inline">Directorio</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* If no customer identity typed yet */}
      {!hasCustomerIdentity ? (
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-900 text-amber-400 shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-slate-300 font-medium">
              Lectura rápida en tiempo real
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">
              Escribe el nombre, cédula o teléfono arriba para activar la tarjeta Fidelis del cliente.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 relative z-10">
          {/* Dual Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. Sistema Base de Sellos (Recurrencia: X/10) */}
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                isStampsRewardReady
                  ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/40'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Base de Sellos</span>
                </span>
                <span className="font-mono font-black text-xs text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                  {stamps}/{stampsGoal}
                </span>
              </div>

              {/* Dynamic Progress Bar with Amber & Yellow Gradient */}
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800 mb-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all duration-500"
                  style={{ width: `${stampsPercent}%` }}
                />
              </div>

              {/* Stamp Bubbles (10 units) */}
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: stampsGoal }).map((_, i) => {
                  const isEarned = i < stamps;
                  const isNextInCart = !isEarned && i < projectedStamps;
                  return (
                    <div
                      key={i}
                      className={`h-5 rounded-md flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
                        isEarned
                          ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-xs'
                          : isNextInCart
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse'
                          : 'bg-slate-900 text-slate-600 border border-slate-800/80'
                      }`}
                      title={isEarned ? `Sello #${i + 1} alcanzado` : `Sello #${i + 1}`}
                    >
                      {isEarned ? '✓' : i + 1}
                    </div>
                  );
                })}
              </div>

              {/* Reward Ready Badge or Action */}
              {isStampsRewardReady ? (
                <div className="mt-2 pt-2 border-t border-amber-800/40 flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                    <Gift className="w-3 h-3 text-yellow-400 animate-bounce" />
                    <span>¡Recompensa Lista!</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setClaimConfirmType('stamps')}
                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-xs"
                  >
                    Canjear
                  </button>
                </div>
              ) : (
                <p className="mt-1.5 text-[10px] text-slate-400 text-right">
                  {stampsGoal - stamps === 1
                    ? '¡A solo 1 compra de la meta!'
                    : `Faltan ${stampsGoal - stamps} compras`}
                </p>
              )}
            </div>

            {/* 2. Seguimiento de Alto Valor (≥ $18 USD: Y/4) */}
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                isHighValueRewardReady
                  ? 'bg-amber-950/40 border-yellow-500 shadow-md shadow-amber-950/40'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                  <Crown className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Compras ≥$18</span>
                </span>
                <span className="font-mono font-black text-xs text-yellow-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                  {highValue}/{highValueGoal}
                </span>
              </div>

              {/* Dynamic Progress Bar with Amber & Yellow Gradient */}
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800 mb-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all duration-500"
                  style={{ width: `${highValuePercent}%` }}
                />
              </div>

              {/* VIP Gems Bubbles (4 units) */}
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: highValueGoal }).map((_, i) => {
                  const isEarned = i < highValue;
                  const isNextInCart = !isEarned && i < projectedHighValue;
                  return (
                    <div
                      key={i}
                      className={`h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                        isEarned
                          ? 'bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 shadow-xs'
                          : isNextInCart
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/60 animate-pulse'
                          : 'bg-slate-900 text-slate-600 border border-slate-800/80'
                      }`}
                      title={
                        isEarned
                          ? `Compra VIP #${i + 1} alcanzada`
                          : `Compra VIP #${i + 1} (≥ $18)`
                      }
                    >
                      {isEarned ? '👑' : `#${i + 1}`}
                    </div>
                  );
                })}
              </div>

              {/* High Value Ready Badge or Action */}
              {isHighValueRewardReady ? (
                <div className="mt-2 pt-2 border-t border-amber-800/40 flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-yellow-300 flex items-center gap-1">
                    <Crown className="w-3 h-3 text-yellow-400 animate-bounce" />
                    <span>¡Premio VIP Listo!</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setClaimConfirmType('highValue')}
                    className="px-2 py-0.5 text-[10px] font-bold rounded bg-yellow-400 hover:bg-yellow-300 text-slate-950 transition cursor-pointer shadow-xs"
                  >
                    Canjear
                  </button>
                </div>
              ) : (
                <p className="mt-1.5 text-[10px] text-slate-400 text-right">
                  {highValueGoal - highValue === 1
                    ? '¡A solo 1 compra VIP!'
                    : `Faltan ${highValueGoal - highValue} compras ≥ $18`}
                </p>
              )}
            </div>
          </div>

          {/* Real-time Evaluator Banner for Current Cart */}
          {isCartActive && (
            <div
              className={`p-2 rounded-xl text-[11px] flex items-center justify-between gap-2 border transition-all ${
                qualifiesForHighValue
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                  : 'bg-slate-950/90 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <TrendingUp
                  className={`w-3.5 h-3.5 shrink-0 ${
                    qualifiesForHighValue ? 'text-yellow-400' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">
                  {qualifiesForHighValue ? (
                    <span>
                      Venta actual de <strong>{formatUSD(currentCartTotalUSD)}</strong>: Sumará{' '}
                      <strong className="text-yellow-300">+1 Sello</strong> y{' '}
                      <strong className="text-yellow-300">+1 Compra VIP</strong>
                    </span>
                  ) : (
                    <span>
                      Venta actual: Sumará <strong className="text-amber-300">+1 Sello</strong>.
                      Faltan <strong className="text-amber-400">{formatUSD(missingForHighValue)}</strong> para
                      alcanzar $18 VIP
                    </span>
                  )}
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 font-bold ${
                  qualifiesForHighValue
                    ? 'bg-yellow-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {qualifiesForHighValue ? 'CALIFICA VIP' : 'BASE'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Claiming Rewards */}
      {claimConfirmType && activeProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-amber-500/60 p-5 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500 text-slate-950">
                {claimConfirmType === 'stamps' ? (
                  <Gift className="w-6 h-6" />
                ) : (
                  <Crown className="w-6 h-6" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  {claimConfirmType === 'stamps'
                    ? 'Canjear Recompensa por Recurrencia'
                    : 'Canjear Recompensa VIP Fidelis Oro'}
                </h4>
                <p className="text-xs text-amber-300 font-mono">
                  Cliente: {activeProfile.customerName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {claimConfirmType === 'stamps'
                ? `El cliente ha completado 10/10 transacciones. Al canjear, se reiniciará el ciclo de sellos y se registrará la recompensa entregada.`
                : `El cliente ha completado 4/4 compras mayores o iguales a $18 USD. Al canjear, se reiniciará el contador VIP y se registrará la recompensa entregada.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setClaimConfirmType(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClaim(claimConfirmType)}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-bold hover:brightness-110 shadow-md shadow-amber-950/50 cursor-pointer"
              >
                Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
