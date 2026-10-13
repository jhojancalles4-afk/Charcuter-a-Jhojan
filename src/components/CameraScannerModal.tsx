import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  X,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Repeat,
  Keyboard,
  ArrowRight,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { playBeepSound, playErrorBeep, triggerHapticFeedback } from '../utils/audioFeedback';

export interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedCode: string) => boolean | void; // returns true if product was found/handled, false if not found
  title?: string;
  subtitle?: string;
  allowContinuous?: boolean;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Escanear Código con la Cámara',
  subtitle = 'Apunta la cámara del teléfono hacia el código de barras o QR del producto',
  allowContinuous = true,
}) => {
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ code: string; success: boolean; text?: string } | null>(null);
  
  // Options
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [continuousMode, setContinuousMode] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'camera-barcode-reader-container';
  const lastScanTimestampRef = useRef<number>(0);
  const lastScannedTextRef = useRef<string>('');

  // Handle scanned result
  const handleDecodedCode = useCallback((decodedText: string) => {
    const trimmed = decodedText.trim();
    if (!trimmed) return;

    const now = Date.now();
    // Debounce identical scans within 1.8 seconds in continuous mode
    if (trimmed === lastScannedTextRef.current && now - lastScanTimestampRef.current < 1800) {
      return;
    }

    lastScanTimestampRef.current = now;
    lastScannedTextRef.current = trimmed;
    setLastScannedCode(trimmed);

    // Audio & Haptic feedback
    if (soundEnabled) {
      playBeepSound(1900, 110);
    }
    triggerHapticFeedback();

    // Notify parent
    const result = onScan(trimmed);
    const wasSuccess = result !== false;

    setScanFeedback({
      code: trimmed,
      success: wasSuccess,
      text: wasSuccess ? '¡Código escaneado con éxito!' : 'Código no encontrado en catálogo',
    });

    if (!wasSuccess && soundEnabled) {
      setTimeout(() => playErrorBeep(), 150);
    }

    // Auto-clear feedback banner after 2.5s
    setTimeout(() => {
      setScanFeedback(null);
    }, 2500);

    // If not in continuous mode, close after a brief delay so user sees feedback
    if (!continuousMode) {
      setTimeout(() => {
        onClose();
      }, 450);
    }
  }, [continuousMode, onClose, onScan, soundEnabled]);

  // Start Scanner
  const startScanner = useCallback(async (cameraIdOrFacing: string | { facingMode: string }) => {
    try {
      setErrorMessage(null);

      // Stop existing instance if running
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(readerElementId);
      }

      const qrCodeScanner = html5QrCodeRef.current;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Optimized rectangular scanning window for 1D barcodes and QR codes
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const width = Math.floor(minEdge * 0.88);
          const height = Math.floor(minEdge * 0.55);
          return { width: Math.max(width, 240), height: Math.max(height, 160) };
        },
        aspectRatio: 1.333333,
      };

      await qrCodeScanner.start(
        cameraIdOrFacing,
        config,
        (decodedText) => {
          handleDecodedCode(decodedText);
        },
        () => {
          // Frame errors occur normally when no barcode is in view; safely ignore
        }
      );

      setIsScanning(true);

      // Detect torch capability on the active track
      try {
        const videoElement = document.querySelector(`#${readerElementId} video`) as HTMLVideoElement | null;
        if (videoElement && videoElement.srcObject) {
          const stream = videoElement.srcObject as MediaStream;
          const track = stream.getVideoTracks()[0];
          if (track) {
            const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
            if (capabilities && 'torch' in capabilities) {
              setHasTorchSupport(true);
            }
          }
        }
      } catch {
        // Torch capability check is optional
      }
    } catch (err: any) {
      console.error('Error starting camera scanner:', err);
      setIsScanning(false);
      let msg = 'No se pudo iniciar la cámara del teléfono.';
      if (err?.name === 'NotAllowedError' || err?.toString()?.includes('NotAllowedError')) {
        msg = 'Permiso denegado: Por favor habilita el acceso a la cámara en los permisos de tu navegador o celular.';
      } else if (err?.name === 'NotFoundError' || err?.toString()?.includes('NotFoundError')) {
        msg = 'No se detectó ninguna cámara disponible en este dispositivo.';
      } else if (err?.name === 'NotReadableError' || err?.toString()?.includes('NotReadableError')) {
        msg = 'La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo.';
      } else if (err?.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
    }
  }, [handleDecodedCode]);

  // Stop Scanner
  const stopScanner = useCallback(async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      }
      setIsScanning(false);
      setTorchEnabled(false);
    } catch (err) {
      console.warn('Error stopping scanner:', err);
    }
  }, []);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    try {
      const videoElement = document.querySelector(`#${readerElementId} video`) as HTMLVideoElement | null;
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          const nextTorchState = !torchEnabled;
          await track.applyConstraints({
            advanced: [{ torch: nextTorchState } as any],
          });
          setTorchEnabled(nextTorchState);
        }
      }
    } catch (err) {
      console.warn('Could not toggle torch:', err);
    }
  };

  // Switch camera (front/back or next device)
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) {
      // Toggle between facing modes
      await stopScanner();
      const nextFacing = selectedCameraId === 'user' ? 'environment' : 'user';
      setSelectedCameraId(nextFacing);
      startScanner({ facingMode: nextFacing });
      return;
    }

    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setSelectedCameraId(nextCamera.id);
    await stopScanner();
    startScanner(nextCamera.id);
  };

  // Initialize camera list and launch when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;

    const init = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (isMounted) {
          if (devices && devices.length > 0) {
            setCameras(devices);
            // Prefer back/rear/environment camera
            const backCam = devices.find((d) =>
              /back|rear|environment|trasera|posterior/i.test(d.label)
            );
            const targetCamId = backCam ? backCam.id : devices[0].id;
            setSelectedCameraId(targetCamId);
            startScanner(targetCamId);
          } else {
            // Fallback to facingMode constraint
            startScanner({ facingMode: 'environment' });
          }
        }
      } catch {
        if (isMounted) {
          // Camera listing might fail without permissions; try starting directly
          startScanner({ facingMode: 'environment' });
        }
      }
    };

    // Small delay to ensure modal DOM is mounted
    const timer = setTimeout(() => {
      init();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  // Submit manual code
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDecodedCode(manualCode.trim());
    setManualCode('');
    setShowManualInput(false);
  };

  if (!isOpen) return null;

  return (
    <div
      id="camera-scanner-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in"
    >
      <div
        id="camera-scanner-modal-content"
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>{title}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40">
                  En Vivo
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Cerrar escáner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Viewport Area */}
        <div className="relative bg-black flex-1 min-h-[300px] sm:min-h-[340px] flex items-center justify-center overflow-hidden">
          {/* html5-qrcode video container */}
          <div id={readerElementId} className="w-full h-full" />

          {/* Scanner Reticle Overlay */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="relative w-64 h-40 rounded-2xl border-2 border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.35)] overflow-hidden">
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-rose-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-rose-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-rose-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-rose-400 rounded-br-lg" />

              {/* Laser Scanning Animation Line */}
              {isScanning && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-rose-400 to-transparent shadow-[0_0_12px_#f43f5e] animate-pulse transition-all duration-700 top-1/2 -translate-y-1/2" />
              )}
            </div>
            <p className="mt-3 text-[11px] font-medium text-white/80 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs shadow-sm">
              Centra el código de barras o QR dentro del recuadro
            </p>
          </div>

          {/* Real-time Feedback Banner */}
          {scanFeedback && (
            <div
              className={`absolute top-4 inset-x-4 p-3 rounded-2xl border shadow-xl flex items-center gap-2.5 backdrop-blur-md transition-all animate-in slide-in-from-top-3 ${
                scanFeedback.success
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                  : 'bg-amber-950/90 border-amber-500 text-amber-200'
              }`}
            >
              {scanFeedback.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{scanFeedback.text}</div>
                <div className="text-[11px] font-mono opacity-80 truncate">
                  Código: {scanFeedback.code}
                </div>
              </div>
            </div>
          )}

          {/* Camera Permission or Error Screen */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-100 mb-1">Cámara no disponible</h4>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-4">
                {errorMessage}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => startScanner({ facingMode: 'environment' })}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Reintentar Cámara
                </button>
                <button
                  onClick={() => setShowManualInput(true)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Ingresar Manual
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls Toolbar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2.5">
          {/* Quick controls row: Flashlight, Switch Camera, Sound, Continuous mode */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              {/* Flashlight / Torch */}
              {hasTorchSupport && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    torchEnabled
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title={torchEnabled ? 'Apagar Linterna' : 'Encender Linterna'}
                >
                  {torchEnabled ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                  <span className="hidden xs:inline text-[11px]">{torchEnabled ? 'Luz ON' : 'Luz'}</span>
                </button>
              )}

              {/* Switch Camera */}
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Cambiar cámara (trasera / frontal)"
              >
                <SwitchCamera className="w-4 h-4" />
                <span className="hidden xs:inline text-[11px]">Cambiar</span>
              </button>

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  soundEnabled
                    ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400'
                    : 'bg-slate-800 text-slate-500'
                }`}
                title={soundEnabled ? 'Sonido de pitido activado' : 'Silenciado'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="hidden xs:inline text-[11px]">{soundEnabled ? 'Pitido' : 'Mudo'}</span>
              </button>
            </div>

            {/* Continuous Mode Toggle */}
            {allowContinuous && (
              <button
                type="button"
                onClick={() => setContinuousMode(!continuousMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                  continuousMode
                    ? 'bg-rose-950/80 border-rose-600 text-rose-300 shadow-xs'
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200'
                }`}
                title="Mantener escáner abierto para escanear múltiples productos seguidos"
              >
                <Repeat className={`w-3.5 h-3.5 ${continuousMode ? 'text-rose-400' : ''}`} />
                <span className="text-[11px]">
                  {continuousMode ? 'Modo Ráfaga ON' : 'Modo Ráfaga'}
                </span>
              </button>
            )}
          </div>

          {/* Manual input toggle & form */}
          {showManualInput ? (
            <form onSubmit={handleManualSubmit} className="flex items-center gap-2 pt-1 animate-in fade-in">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Escribe el código o EAN..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 font-mono focus:outline-rose-500"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-md"
              >
                <span>Buscar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowManualInput(false)}
                className="p-2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="flex items-center gap-1.5 text-slate-400 hover:text-rose-300 transition cursor-pointer"
              >
                <Keyboard className="w-3.5 h-3.5 text-slate-500" />
                <span>¿Código dañado? Escribir código manual</span>
              </button>

              {lastScannedCode && (
                <span className="font-mono text-[10px] text-slate-500">
                  Último: {lastScannedCode}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
