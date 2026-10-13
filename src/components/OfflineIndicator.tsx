import React from 'react';
import { Wifi, WifiOff, Cloud, Check } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  lastSync?: string;
  onManualSync?: () => void;
  isSyncing?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  lastSync,
  onManualSync,
  isSyncing = false,
}) => {
  const isOnline = useOnlineStatus();

  return (
    <div id="connectivity-status-bar" className="flex items-center gap-2">
      {isOnline ? (
        <div
          id="online-badge"
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[11px] font-medium text-emerald-400"
          title="Conectado a Internet - Listo para sincronizar"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span className="hidden md:inline">En Línea</span>
        </div>
      ) : (
        <div
          id="offline-badge"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/70 border border-amber-800/80 text-[11px] font-medium text-amber-300 shadow-md animate-pulse"
          title="Modo sin conexión activo. Todos los datos se guardan en el dispositivo y se sincronizarán al recuperar la señal."
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span>Modo Offline (100% Guardado Local)</span>
        </div>
      )}

      {onManualSync && (
        <button
          id="btn-cloud-sync"
          onClick={onManualSync}
          disabled={isSyncing}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/60 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
          title="Sincronizar datos locales con la nube / respaldo"
        >
          <Cloud className={`w-3 h-3 ${isSyncing ? 'animate-spin text-rose-400' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
        </button>
      )}
    </div>
  );
};
