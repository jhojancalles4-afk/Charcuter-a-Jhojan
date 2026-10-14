import React from 'react';
import { Wifi, WifiOff, HardDrive } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  lastSync?: string;
  onManualSync?: () => void;
  isSyncing?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = () => {
  const isOnline = useOnlineStatus();

  return (
    <div id="connectivity-status-bar" className="flex items-center gap-2">
      {isOnline ? (
        <div
          id="online-badge"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[11px] font-medium text-emerald-400"
          title="Almacenamiento 100% Local en este dispositivo. No depende de servidores en la nube."
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <HardDrive className="w-3 h-3 text-emerald-400" />
          <span className="hidden sm:inline">Almacenamiento Local</span>
        </div>
      ) : (
        <div
          id="offline-badge"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/70 border border-amber-800/80 text-[11px] font-medium text-amber-300 shadow-md"
          title="Modo sin conexión. Todos los datos se guardan de forma privada y segura en el dispositivo."
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span>Modo Offline (100% Local)</span>
        </div>
      )}
    </div>
  );
};
