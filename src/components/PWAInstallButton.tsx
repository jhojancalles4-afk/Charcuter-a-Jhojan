import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share, PlusSquare, ArrowDownToLine } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isMobile, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Check if banner was dismissed in this session
  useEffect(() => {
    if (!isInstalled && isMobile) {
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    } else {
      setShowBanner(false);
    }
  }, [isInstalled, isMobile]);

  const handleDismissBanner = () => {
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
    setShowBanner(false);
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        const outcome = await install();
        if (outcome) {
          setShowBanner(false);
        }
      } finally {
        setIsInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      setShowAndroidGuide(true);
    }
  };

  return (
    <>
      {/* Header Button */}
      {isInstalled ? (
        <div
          id="pwa-installed-badge"
          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[11px] font-medium text-emerald-400"
          title="App instalada y funcionando 100% offline"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="hidden sm:inline">PWA Activa</span>
          <span className="sm:hidden font-mono text-[10px]">App</span>
        </div>
      ) : (
        <button
          id="btn-install-pwa"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-950/40 transition duration-150 cursor-pointer animate-pulse hover:animate-none"
          title="Instalar esta aplicación en tu teléfono o computadora"
        >
          {isIOS ? (
            <Smartphone className="w-3.5 h-3.5 text-rose-200 shrink-0" />
          ) : (
            <Download className="w-3.5 h-3.5 text-rose-200 shrink-0" />
          )}
          <span>Instalar</span>
        </button>
      )}

      {/* Floating Mobile Bottom Install Banner */}
      {showBanner && !isInstalled && (
        <aside
          role="region"
          aria-label="Aviso para instalar la aplicación en el teléfono"
          className="fixed bottom-3 inset-x-3 sm:hidden z-50 rounded-2xl bg-slate-900/98 border border-rose-500/50 p-3.5 shadow-2xl backdrop-blur-md text-slate-100 animate-in fade-in slide-in-from-bottom duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 text-white shadow-md shadow-rose-950/50 shrink-0">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100 leading-tight">
                  Instalar en el Teléfono
                </h4>
                <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                  Acceso directo, pantalla completa y 100% offline.
                </p>
              </div>
            </div>
            <button
              onClick={handleDismissBanner}
              className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold text-center shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar ahora</span>
            </button>
            <button
              onClick={handleDismissBanner}
              className="py-2 px-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer"
            >
              Más tarde
            </button>
          </div>
        </aside>
      )}

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
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
                <p>En Safari, toca el botón <strong>Compartir</strong> <Share className="w-3.5 h-3.5 inline mx-0.5 text-rose-400" /> (cuadrado con flecha hacia arriba) en la barra de navegación.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold shrink-0">2</span>
                <p>Desplaza hacia abajo y selecciona <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-rose-400" /> <strong>«Agregar al inicio»</strong>.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold shrink-0">3</span>
                <p>Presiona <strong>«Agregar»</strong> en la esquina superior derecha. ¡Listo! La app aparecerá en tu pantalla de inicio.</p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}

      {/* Android / Chrome Manual Guide Modal */}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-rose-400" />
                <h3 className="font-semibold text-sm">Instalar en Android / Móvil</h3>
              </div>
              <button
                onClick={() => setShowAndroidGuide(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold shrink-0">1</span>
                <p>Toca el menú de <strong>tres puntos ⋮</strong> en la esquina superior o inferior de tu navegador (Chrome, Samsung Internet, Edge o Firefox).</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold shrink-0">2</span>
                <p>Selecciona <ArrowDownToLine className="w-3.5 h-3.5 inline mx-0.5 text-rose-400" /> <strong>«Instalar aplicación»</strong> o <strong>«Agregar a la pantalla principal»</strong>.</p>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold shrink-0">3</span>
                <p>Confirma en <strong>«Instalar»</strong>. La aplicación se comportará como una app nativa en tu teléfono.</p>
              </div>
            </div>

            <button
              onClick={() => setShowAndroidGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
