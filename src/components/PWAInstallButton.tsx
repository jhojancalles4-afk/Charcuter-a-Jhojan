import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed and running standalone, show subtle active badge
  if (isInstalled) {
    return (
      <div
        id="pwa-installed-badge"
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] font-medium text-emerald-400"
        title="Aplicación instalada y lista para uso offline"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>PWA Activa</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="btn-install-pwa"
        onClick={handleInstallClick}
        disabled={isInstalling}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-semibold shadow-md transition-all duration-150 animate-pulse hover:animate-none cursor-pointer"
        title="Instalar como App en este dispositivo"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="btn-install-ios-pwa"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
          title="Instrucciones para instalar en iPhone/iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-rose-400" />
          <span>Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-rose-400" />
                  <h3 className="font-semibold text-sm">Instalar en iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold shrink-0">1</span>
                  <p>Toca el botón <strong>Compartir</strong> <Share className="w-3.5 h-3.5 inline mx-0.5 text-rose-400" /> en la barra inferior de Safari.</p>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold shrink-0">2</span>
                  <p>Baja en el menú y selecciona <strong>«Agregar al inicio»</strong> (+).</p>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold shrink-0">3</span>
                  <p>Presiona <strong>«Agregar»</strong>. ¡Listo! Podrás abrir el POS sin conexión y a pantalla completa.</p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback if not yet triggered (still useful info button)
  return (
    <button
      id="btn-pwa-info"
      onClick={() => {
        alert('Para instalar este POS en tu dispositivo: abre el menú de tu navegador (los tres puntos o botón de compartir) y selecciona "Instalar aplicación" o "Agregar a la pantalla principal".');
      }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 text-xs font-medium transition cursor-pointer"
      title="Disponible para instalar como App"
    >
      <Download className="w-3.5 h-3.5 text-rose-400" />
      <span className="hidden sm:inline">PWA Offline</span>
    </button>
  );
};
