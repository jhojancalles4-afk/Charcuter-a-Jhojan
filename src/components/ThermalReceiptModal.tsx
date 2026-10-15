import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Printer,
  Send,
  X,
  CheckCircle2,
  Bluetooth,
  FileImage,
  Sparkles,
  Share2,
} from 'lucide-react';
import { AppSettings, SaleTicket } from '../types';
import {
  downloadReceiptPNG,
  generateReceiptCanvas,
  printReceiptBluetoothDirect,
  printReceiptThermal,
} from '../services/receiptRenderer';
import { generateWhatsAppThankYou, generateTelegramThankYou } from '../services/storage';

interface ThermalReceiptModalProps {
  ticket: SaleTicket | null;
  settings: AppSettings;
  onClose: () => void;
  title?: string;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  ticket,
  settings,
  onClose,
  title = 'Factura Digital & Impresión Térmica',
}) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (!ticket) return;

    // Render canvas and generate image preview
    try {
      const canvas = generateReceiptCanvas(ticket, settings);
      const url = canvas.toDataURL('image/png');
      setDataUrl(url);

      if (canvasContainerRef.current) {
        canvasContainerRef.current.innerHTML = '';
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        canvas.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.4)';
        canvasContainerRef.current.appendChild(canvas);
      }
    } catch (e) {
      console.error('Error rendering receipt canvas:', e);
    }
  }, [ticket, settings]);

  if (!ticket) return null;

  const { url: whatsAppUrl } = generateWhatsAppThankYou(ticket, settings);
  const { url: telegramUrl } = generateTelegramThankYou(ticket, settings);

  const handleDownloadPNG = () => {
    downloadReceiptPNG(ticket, settings);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handlePrintThermal = () => {
    setIsPrinting(true);
    printReceiptThermal(ticket, settings);
    setTimeout(() => setIsPrinting(false), 1200);
  };

  const [isSharingImage, setIsSharingImage] = useState(false);
  const handleShareImageNative = async () => {
    if (!dataUrl) return;
    setIsSharingImage(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `factura-${ticket.ticketNumber}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Factura #${ticket.ticketNumber} - ${settings.businessName}`,
          });
          return;
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.warn('Error compartiendo imagen:', e);
      }
    } finally {
      setIsSharingImage(false);
    }
    downloadReceiptPNG(ticket, settings);
  };

  return (
    <div
      id="thermal-receipt-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <FileImage className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                <span>{title}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-rose-300 font-mono border border-slate-700">
                  Ticket #{ticket.ticketNumber}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Formato para rollos térmicos de 58mm / 80mm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status notification */}
        {bluetoothStatus && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <Bluetooth className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{bluetoothStatus}</span>
          </div>
        )}

        {/* Content Body: Thermal Receipt graphic on paper */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Paper container */}
          <div className="bg-slate-950/80 p-3 sm:p-4 rounded-2xl border border-slate-800/80 flex flex-col items-center">
            {/* Visual ticket label */}
            <div className="w-full flex items-center justify-between mb-2 text-xs text-slate-400 px-1">
              <span className="font-mono">📄 Vista previa de la factura:</span>
              <span className="text-emerald-400 font-medium">100% Alta Resolución PNG</span>
            </div>

            {/* Jagged thermal paper top styling */}
            <div className="w-full max-w-[380px] bg-white rounded-t-sm shadow-xl overflow-hidden border-b border-dashed border-slate-300">
              <div ref={canvasContainerRef} className="w-full" />
            </div>

            {/* Paper bottom perforated notch aesthetic */}
            <div className="w-full max-w-[380px] h-3 bg-white flex items-center justify-center overflow-hidden">
              <div className="w-full h-full border-b-2 border-dotted border-slate-400" />
            </div>
          </div>

          {/* Quick instructions */}
          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/70 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Instrucciones de entrega al cliente:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              1. <strong>Descarga la Factura PNG</strong> en tu teléfono o PC con 1 clic.<br />
              2. <strong>Envía el mensaje de agradecimiento</strong> por WhatsApp. El texto ya incluye un mensaje agradable anunciando que adjuntas la factura.<br />
              3. O <strong>imprime el ticket</strong> directamente en tu impresora térmica portátil Bluetooth.
            </p>
          </div>
        </div>

        {/* Footer Actions: Download PNG, Bluetooth Thermal Print, WhatsApp Share */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-col gap-2 shrink-0">
          {/* Primary Row: PNG & Print */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Download PNG */}
            <button
              id="btn-download-receipt-png"
              onClick={handleDownloadPNG}
              className={`py-3 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                downloadSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
              }`}
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>¡Factura Descargada! (.png)</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar Factura en PNG</span>
                </>
              )}
            </button>

            {/* Thermal Print via Bluetooth / Standard */}
            <div className="flex gap-1.5">
              <button
                id="btn-print-receipt-bluetooth"
                onClick={handleBluetoothPrint}
                disabled={isPrinting}
                className="flex-1 py-3 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-950/40"
                title="Conectar e imprimir en impresora térmica Bluetooth"
              >
                <Bluetooth className="w-4 h-4" />
                <span>Imprimir Térmica BT</span>
              </button>

              <button
                id="btn-print-receipt-dialog"
                onClick={handlePrintThermal}
                disabled={isPrinting}
                className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition flex items-center justify-center cursor-pointer border border-slate-700"
                title="Abrir diálogo de impresión (Rollos 58mm/80mm)"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Share Actions: Telegram & WhatsApp */}
          <div className="flex flex-col gap-2">
            <a
              id="btn-share-receipt-telegram"
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-sky-950/50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Enviar Factura por Telegram</span>
            </a>

            {whatsAppUrl ? (
              <a
                id="btn-share-receipt-whatsapp"
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-emerald-950/50 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Enviar por WhatsApp ({ticket.customerPhone || 'Cliente'})</span>
              </a>
            ) : (
              <div className="text-center text-[10px] text-slate-500 py-0.5">
                (Cliente sin número WhatsApp para envío directo por wa.me)
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
