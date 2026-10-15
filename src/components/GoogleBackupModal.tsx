import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  HardDrive,
  Send,
  Download,
  Upload,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  FileCode,
  Share2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ClipboardPaste,
  FileSpreadsheet,
  Calendar,
  Table,
  Check,
  Scissors,
  Package,
} from 'lucide-react';
import { AppSettings, ExpenseRecord, MermaRecord, Product, SaleTicket } from '../types';
import {
  exportGoogleDriveBackupFile,
  importDatabaseBackup,
  generateUnifiedTelegramBackup,
  restoreFromTelegramBackup,
  loadTickets,
  loadProducts,
  loadSettings,
  loadExpenses,
  loadMermas,
  getDebtorsSummary,
  exportDatabaseBackupString,
  sendTelegramBackupFile,
  exportMonthlySales,
  exportDebtors,
  exportMermas,
  exportInventoryToCSV,
  getAvailableTicketMonths,
} from '../services/storage';

interface GoogleBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
  tickets?: SaleTicket[];
  products?: Product[];
  settings?: AppSettings;
  expenses?: ExpenseRecord[];
  mermas?: MermaRecord[];
}

export const GoogleBackupModal: React.FC<GoogleBackupModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
  tickets,
  products,
  settings,
  expenses,
  mermas,
}) => {
  const [activeTab, setActiveTab] = useState<'drive' | 'telegram' | 'excel'>('drive');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Drive restore input ref
  const driveFileInputRef = useRef<HTMLInputElement>(null);
  // Telegram file input ref
  const telegramFileInputRef = useRef<HTMLInputElement>(null);

  // Telegram paste text
  const [telegramInputText, setTelegramInputText] = useState('');
  const [isProcessingTelegram, setIsProcessingTelegram] = useState(false);
  const [copiedTelegramPackage, setCopiedTelegramPackage] = useState(false);
  const [telegramPhone, setTelegramPhone] = useState(
    settings?.telegramPhone || settings?.phone || '0414-7281945'
  );
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  if (!isOpen) return null;

  const currentTickets = tickets && tickets.length > 0 ? tickets : loadTickets();
  const currentProducts = products && products.length > 0 ? products : loadProducts();
  const currentSettings = settings ? settings : loadSettings();
  const currentExpenses = expenses && expenses.length > 0 ? expenses : loadExpenses();
  const currentMermas = mermas && mermas.length > 0 ? mermas : loadMermas();
  const currentDebtors = getDebtorsSummary(currentTickets, currentSettings.bcvRate);
  const availableMonths = useMemo(() => getAvailableTicketMonths(currentTickets), [currentTickets]);

  const telegramPackage = generateUnifiedTelegramBackup({
    tickets: currentTickets,
    debtors: currentDebtors,
    products: currentProducts,
    expenses: currentExpenses,
    settings: currentSettings,
  });

  // Handler for uploading JSON from Drive or device
  const handleDriveFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = event.target?.result as string;
        const res = importDatabaseBackup(rawJson);
        if (res.success) {
          setStatusMessage({
            type: 'success',
            text: `¡Restauración exitosa desde Google Drive! ${res.message}`,
          });
          if (onDataRestored) onDataRestored();
          setTimeout(() => window.location.reload(), 1400);
        } else {
          setStatusMessage({ type: 'error', text: res.message });
        }
      } catch (err) {
        setStatusMessage({
          type: 'error',
          text: 'Error al procesar el archivo de Google Drive. Asegúrate de seleccionar el archivo .json correcto.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handler for uploading JSON file from Telegram
  const handleTelegramFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = event.target?.result as string;
        const res = restoreFromTelegramBackup(rawJson);
        if (res.success) {
          setStatusMessage({
            type: 'success',
            text: `¡Restauración exitosa desde el archivo de Telegram! ${res.message}`,
          });
          if (onDataRestored) onDataRestored();
          setTimeout(() => window.location.reload(), 1400);
        } else {
          setStatusMessage({ type: 'error', text: res.message });
        }
      } catch (err) {
        setStatusMessage({
          type: 'error',
          text: 'Error al leer el archivo descargado de Telegram.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Send pure .json backup file to Telegram app / number
  const handleSendTelegramFile = async () => {
    setIsSendingTelegram(true);
    setStatusMessage(null);
    try {
      const res = await sendTelegramBackupFile(telegramPhone);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `¡Listo! ${res.message}`,
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: res.message,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error al enviar archivo a Telegram: ' + (err?.message || 'Verifica la aplicación'),
      });
    } finally {
      setIsSendingTelegram(false);
    }
  };

  // Handler to restore by pasting text/code received from Telegram
  const handleRestoreFromTelegramPaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramInputText.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Por favor pega en el recuadro el mensaje o código que recibiste en Telegram.',
      });
      return;
    }

    setIsProcessingTelegram(true);
    setStatusMessage(null);

    setTimeout(() => {
      const res = restoreFromTelegramBackup(telegramInputText);
      setIsProcessingTelegram(false);

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `¡Restauración desde Telegram completada! ${res.message}`,
        });
        setTelegramInputText('');
        if (onDataRestored) onDataRestored();
        setTimeout(() => window.location.reload(), 1400);
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message,
        });
      }
    }, 400);
  };

  // Paste from clipboard helper
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTelegramInputText(text);
      }
    } catch (err) {
      // Browser permissions denied
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 animate-in fade-in duration-150 overflow-y-auto">
      {/* Hidden File Input for Google Drive Restoration */}
      <input
        type="file"
        ref={driveFileInputRef}
        onChange={handleDriveFileSelected}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Hidden File Input for Telegram File Restoration */}
      <input
        type="file"
        ref={telegramFileInputRef}
        onChange={handleTelegramFileSelected}
        accept=".json,application/json"
        className="hidden"
      />

      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 my-auto space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-blue-950/40">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <span>Centro de Respaldos y Restauración</span>
              </h3>
              <p className="text-xs text-slate-400">
                Respaldo y recuperación 100% oficial mediante <strong>Google Drive</strong> y <strong>Telegram</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                : statusMessage.type === 'info'
                ? 'bg-sky-950/80 border border-sky-800 text-sky-300'
                : 'bg-rose-950/80 border border-rose-800 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : statusMessage.type === 'info' ? (
              <Sparkles className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        {/* Navigation Tabs: Google Drive vs Telegram */}
        <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('drive')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'drive'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Google Drive (Respaldo & Restaurar)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('telegram')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'telegram'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Telegram (Respaldo)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'excel'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel / CSV Contable</span>
          </button>
        </div>

        {/* TAB 1: GOOGLE DRIVE */}
        {activeTab === 'drive' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Drive Overview */}
            <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-900/40 text-xs text-slate-300 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-slate-100 block">Respaldo Oficial con Google Drive</span>
                <p className="leading-relaxed">
                  Descarga el archivo <code>.json</code> oficial con el 100% de tus datos (inventario, tickets, cartera de fiados, egresos, reposiciones y fidelización) para guardarlo en tu Google Drive. En cualquier otro teléfono o computadora, súbelo aquí para restaurar todo al instante.
                </p>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Download file for Google Drive */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-1">
                    <Download className="w-4 h-4" />
                    <span>1. Respaldar en Google Drive</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Descarga el archivo con tu base de datos completa para subirlo y protegerlo en tu nube de Google Drive.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={exportGoogleDriveBackupFile}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-blue-950/50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Archivo para Drive</span>
                  </button>

                  <a
                    href="https://drive.google.com/drive/my-drive"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition border border-slate-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir mi Google Drive</span>
                  </a>
                </div>
              </div>

              {/* Option 2: Restore from Google Drive */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                    <Upload className="w-4 h-4" />
                    <span>2. Restaurar desde Google Drive</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Selecciona el archivo <code>.json</code> guardado en Google Drive o en tu dispositivo para recuperar todos tus datos.
                  </p>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => driveFileInputRef.current?.click()}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950/50 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Seleccionar Archivo de Drive</span>
                  </button>
                  <span className="block text-center text-[10px] text-slate-500 mt-2">
                    Acepta formato <code>.json</code> oficial
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TELEGRAM UNIFIED BACKUP & RESTORE */}
        {activeTab === 'telegram' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Telegram Overview */}
            <div className="p-3.5 rounded-2xl bg-sky-950/20 border border-sky-900/40 text-xs text-slate-300 flex items-start gap-2.5">
              <Send className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-slate-100 block">Envío Directo de Archivo de Respaldo a Telegram</span>
                <p className="leading-relaxed text-slate-300">
                  Envía exclusivamente el <strong>archivo de respaldo (.json)</strong> directamente a tu cuenta o número en la <strong>aplicación de Telegram</strong>, sin textos largos ni redirecciones a páginas web.
                </p>
              </div>
            </div>

            {/* Part A: Send Backup File to Telegram */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                  <Send className="w-4 h-4" />
                  <span>1. Enviar Archivo a tu Número de Telegram</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-semibold">
                  Solo Archivo .JSON
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Tu Número de Teléfono de Telegram:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={telegramPhone}
                    onChange={(e) => setTelegramPhone(e.target.value)}
                    placeholder="Ej. 0414-7281945 o +584147281945"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-rose-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Se abrirá la aplicación de Telegram en tu teléfono para entregar el archivo directamente sin pasar por páginas web.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendTelegramFile}
                  disabled={isSendingTelegram}
                  className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-sky-950/50 cursor-pointer disabled:opacity-50"
                  title="Enviar archivo de respaldo directamente a la aplicación de Telegram"
                >
                  <Send className={`w-3.5 h-3.5 ${isSendingTelegram ? 'animate-spin' : ''}`} />
                  <span>{isSendingTelegram ? 'Preparando...' : 'Enviar Archivo a Telegram'}</span>
                </button>

                <button
                  type="button"
                  onClick={exportGoogleDriveBackupFile}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
                  title="Descargar archivo .json en este dispositivo"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Descargar Archivo .JSON</span>
                </button>
              </div>
            </div>

            {/* Part B: Restore from Telegram Text / Code or File */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <ClipboardPaste className="w-4 h-4" />
                  <span>2. Restaurar a través de Telegram</span>
                </div>
                <button
                  type="button"
                  onClick={() => telegramFileInputRef.current?.click()}
                  className="text-[10px] text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>¿Tienes archivo .json de Telegram? Cárgalo aquí</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Copia el mensaje completo o el bloque de código que tienes en Telegram y pégalo a continuación:
              </p>

              <form onSubmit={handleRestoreFromTelegramPaste} className="space-y-2">
                <div className="relative">
                  <textarea
                    rows={3}
                    value={telegramInputText}
                    onChange={(e) => setTelegramInputText(e.target.value)}
                    placeholder="Pega aquí el mensaje o código recibido de Telegram..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-hidden resize-none no-scrollbar"
                  />
                  {!telegramInputText && (
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="absolute right-2.5 bottom-2.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer border border-slate-700/60"
                    >
                      <ClipboardPaste className="w-3 h-3 text-sky-400" />
                      <span>Pegar</span>
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isProcessingTelegram || !telegramInputText.trim()}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessingTelegram ? 'animate-spin' : ''}`} />
                  <span>{isProcessingTelegram ? 'Procesando...' : 'Procesar y Restaurar desde Telegram'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: EXCEL / CSV CONTABLE */}
        {activeTab === 'excel' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Overview */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 text-xs text-slate-300 flex items-start gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-slate-100 block">Exportación para Contabilidad Externa y Administración</span>
                <p className="leading-relaxed">
                  Descarga tus reportes en formatos <strong>.xls (Excel)</strong> o <strong>.csv (con UTF-8 BOM)</strong>. Abren inmediatamente con doble clic en <strong>Microsoft Excel</strong>, Google Sheets o LibreOffice con acentos, tildes y formato bimonetario (USD / Bs. BCV).
                </p>
              </div>
            </div>

            {/* Grid of 4 Export Modules */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[58vh] overflow-y-auto pr-1">
              {/* 1. Ventas del Mes */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>1. Ventas del Mes</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {currentTickets.length} ventas
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    Facturas, método de pago, desglose por gramaje/kilos, tasa BCV y montos cobrados vs crédito.
                  </p>

                  {/* Month Selector */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                      Período a exportar:
                    </label>
                    <select
                      value={selectedMonthKey}
                      onChange={(e) => setSelectedMonthKey(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Todas las ventas históricas ({currentTickets.length})</option>
                      {availableMonths.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label} ({m.count} venta{m.count > 1 ? 's' : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      exportMonthlySales(currentTickets, currentSettings, selectedMonthKey, 'excel');
                      setStatusMessage({
                        type: 'success',
                        text: '¡Archivo Excel (.xls) de ventas generado y descargado exitosamente!',
                      });
                    }}
                    className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel (.xls)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      exportMonthlySales(currentTickets, currentSettings, selectedMonthKey, 'csv');
                      setStatusMessage({
                        type: 'success',
                        text: '¡Archivo CSV de ventas generado y descargado exitosamente!',
                      });
                    }}
                    className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* 2. Cartera de Deudores / Fiados */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Table className="w-4 h-4 text-rose-400" />
                      <span>2. Cartera de Deudores (Fiados)</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {currentDebtors.length} deudores
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    Lista completa de clientes con saldo pendiente, teléfonos, cédulas, antigüedad de deuda y tickets vinculados.
                  </p>

                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-400">Total por cobrar:</span>
                    <span className="text-rose-400 font-bold">
                      ${currentDebtors.reduce((sum, d) => sum + d.totalDebtUSD, 0).toFixed(2)} USD
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      exportDebtors(currentDebtors, currentSettings, 'excel');
                      setStatusMessage({
                        type: 'success',
                        text: '¡Cartera de deudores exportada a Excel (.xls) con éxito!',
                      });
                    }}
                    className="py-2 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel (.xls)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      exportDebtors(currentDebtors, currentSettings, 'csv');
                      setStatusMessage({
                        type: 'success',
                        text: '¡Cartera de deudores exportada a CSV con éxito!',
                      });
                    }}
                    className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* 3. Mermas Físicas & Multi-Almacén */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Scissors className="w-4 h-4 text-amber-400" />
                      <span>3. Mermas por Manipulación</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {currentMermas.length} registros
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    Pérdidas de humedad (secado en mostrador), recortes no vendibles, daño o ajuste físico desglosado por almacén.
                  </p>

                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-400">Pérdida en costo P&L:</span>
                    <span className="text-amber-400 font-bold">
                      -${currentMermas.reduce((sum, m) => sum + m.totalCostUSD, 0).toFixed(2)} USD
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      exportMermas(currentMermas, currentSettings, 'excel');
                      setStatusMessage({
                        type: 'success',
                        text: '¡Reporte de mermas exportado a Excel (.xls) con éxito!',
                      });
                    }}
                    className="py-2 px-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel (.xls)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      exportMermas(currentMermas, currentSettings, 'csv');
                      setStatusMessage({
                        type: 'success',
                        text: '¡Reporte de mermas exportado a CSV con éxito!',
                      });
                    }}
                    className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* 4. Inventario, Costos & Márgenes */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-sky-400" />
                      <span>4. Catálogo e Inventario</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {currentProducts.length} productos
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    Existencias en KG y UN, costos unitarios, precios de venta en USD/Bs, márgenes de ganancia y valor de stock.
                  </p>

                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-400">Inversión en costo:</span>
                    <span className="text-emerald-400 font-bold">
                      ${currentProducts.reduce((sum, p) => sum + p.stock * (p.costUSD || p.priceUSD * 0.72), 0).toFixed(2)} USD
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      exportInventoryToCSV(currentProducts, currentSettings);
                      setStatusMessage({
                        type: 'success',
                        text: '¡Catálogo de inventario exportado en formato Excel / CSV con éxito!',
                      });
                    }}
                    className="col-span-2 py-2 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Catálogo (Excel / CSV)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tus datos son 100% privados y exportables en cualquier momento.</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
