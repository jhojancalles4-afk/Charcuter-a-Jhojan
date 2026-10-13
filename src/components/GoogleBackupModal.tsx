import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  ShieldCheck,
  RefreshCw,
  Download,
  Upload,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  HardDrive,
  Clock,
  Sparkles,
  ArrowRight,
  Database,
  ExternalLink,
  Send,
  Copy,
} from 'lucide-react';
import { AppSettings, ExpenseRecord, GoogleAccountInfo, GoogleDailyBackup, Product, SaleTicket } from '../types';
import {
  getLinkedGoogleAccount,
  saveLinkedGoogleAccount,
  getGoogleDailyBackups,
  createDailyGoogleBackup,
  restoreFromGoogleDailyBackup,
  restoreFromGoogleEmail,
  exportDatabaseBackup,
  generateTelegramFullMasterBackup,
  loadTickets,
  loadProducts,
  loadSettings,
  loadExpenses,
  getDebtorsSummary,
} from '../services/storage';

interface GoogleBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
  tickets?: SaleTicket[];
  products?: Product[];
  settings?: AppSettings;
  expenses?: ExpenseRecord[];
}

export const GoogleBackupModal: React.FC<GoogleBackupModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
  tickets,
  products,
  settings,
  expenses,
}) => {
  const [account, setAccount] = useState<GoogleAccountInfo>(() => getLinkedGoogleAccount());
  const [backups, setBackups] = useState<GoogleDailyBackup[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Restore by email state (e.g. when opening on another phone)
  const [restoreEmail, setRestoreEmail] = useState('');
  const [isRestoringByEmail, setIsRestoringByEmail] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const acc = getLinkedGoogleAccount();
      setAccount(acc);
      setEmailInput(acc.email || 'jhojancalles4@gmail.com');
      setRestoreEmail(acc.email || 'jhojancalles4@gmail.com');
      loadBackupsList(acc.email);
      setStatusMessage(null);
    }
  }, [isOpen]);

  const loadBackupsList = (email?: string) => {
    const list = getGoogleDailyBackups(email);
    setBackups(list);
  };

  if (!isOpen) return null;

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = emailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Por favor ingresa un correo electrónico válido.' });
      return;
    }

    const updated: GoogleAccountInfo = {
      ...account,
      email: clean,
      isLinked: true,
      displayName: clean.split('@')[0],
      linkedAt: account.linkedAt || new Date().toISOString(),
    };
    saveLinkedGoogleAccount(updated);
    setAccount(updated);
    setIsEditingEmail(false);
    loadBackupsList(clean);
    setStatusMessage({
      type: 'success',
      text: `Cuenta vinculada exitosamente con ${clean}. Las copias diarias se guardarán en este correo.`,
    });
  };

  const handleManualBackupNow = () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const res = createDailyGoogleBackup(account.email);
      if (res.success) {
        setAccount(getLinkedGoogleAccount());
        loadBackupsList(account.email);
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: 'Error al generar la copia de seguridad.' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Error inesperado al generar la copia.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreBackup = (backupId: string) => {
    if (!window.confirm('¿Deseas restaurar esta copia de seguridad? Se actualizarán los datos de tu teléfono con esta versión.')) {
      return;
    }

    const res = restoreFromGoogleDailyBackup(backupId);
    if (res.success) {
      setStatusMessage({ type: 'success', text: '¡Copia restaurada exitosamente! Todos los datos están al día.' });
      if (onDataRestored) onDataRestored();
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } else {
      setStatusMessage({ type: 'error', text: res.message });
    }
  };

  const handleRestoreByEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = restoreEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Ingresa el correo con el que hiciste la copia original.' });
      return;
    }

    setIsRestoringByEmail(true);
    setStatusMessage(null);

    setTimeout(() => {
      const res = restoreFromGoogleEmail(clean);
      setIsRestoringByEmail(false);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
        setAccount(getLinkedGoogleAccount());
        loadBackupsList(clean);
        if (onDataRestored) onDataRestored();
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    }, 400);
  };

  const [copiedMaster, setCopiedMaster] = useState(false);

  const getMasterBackupPackage = () => {
    const t = tickets && tickets.length > 0 ? tickets : loadTickets();
    const p = products && products.length > 0 ? products : loadProducts();
    const s = settings ? settings : loadSettings();
    const e = expenses && expenses.length > 0 ? expenses : loadExpenses();
    const d = getDebtorsSummary(t, s.bcvRate);
    return generateTelegramFullMasterBackup({
      tickets: t,
      debtors: d,
      products: p,
      expenses: e,
      settings: s,
    });
  };

  const handleSendTelegramMasterBackup = () => {
    const { url } = getMasterBackupPackage();
    window.open(url, '_blank');
  };

  const handleCopyMasterBackupText = () => {
    const { message } = getMasterBackupPackage();
    navigator.clipboard.writeText(message);
    setCopiedMaster(true);
    setTimeout(() => setCopiedMaster(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 animate-in fade-in duration-150 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 my-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-blue-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-blue-950/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <span>Copias de Seguridad con Google</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Copia Diaria Activa
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Vincula tu correo Google para respaldos diarios automáticos y recuperación instantánea en otro teléfono.
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
                : 'bg-rose-950/80 border border-rose-800 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        {/* 1. Linked Google Account Section */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-200">
                <Mail className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Correo de Google Vinculado:</span>
                <span className="text-sm font-bold text-slate-100 font-mono">
                  {account.email || 'jhojancalles4@gmail.com'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingEmail(!isEditingEmail)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              >
                {isEditingEmail ? 'Cancelar' : 'Cambiar Correo'}
              </button>
            </div>
          </div>

          {isEditingEmail && (
            <form onSubmit={handleSaveEmail} className="pt-2 border-t border-slate-800 flex items-center gap-2">
              <input
                type="email"
                required
                placeholder="ejemplo@gmail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-rose-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer"
              >
                Guardar
              </button>
            </form>
          )}

          {/* Quick Info Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px] font-mono">
            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Frecuencia:</span>
                <span className="text-slate-200 font-bold">1 Copia Diaria</span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Última Copia:</span>
                <span className="text-emerald-300 font-bold">
                  {account.lastBackupDate
                    ? new Date(account.lastBackupDate).toLocaleTimeString('es-VE', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: 'short',
                      })
                    : 'Hoy activa'}
                </span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Respaldos Guardados:</span>
                <span className="text-amber-300 font-bold">{backups.length} días protegidos</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Main Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Action A: Trigger Daily Backup Now */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Copia Diaria en Google Ahora</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Guarda una instantánea completa de inventario, facturas, clientes, fiados y tasas bajo tu cuenta de correo.
              </p>
            </div>

            <button
              type="button"
              onClick={handleManualBackupNow}
              disabled={isSyncing}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Guardando Copia...' : 'Hacer Copia Diaria Ahora'}</span>
            </button>
          </div>

          {/* Action B: Download for Google Drive */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-1">
                <Download className="w-4 h-4" />
                <span>Descargar para Google Drive</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Descarga un archivo .JSON con el respaldo oficial para subirlo directamente a tu Google Drive personal.
              </p>
            </div>

            <button
              type="button"
              onClick={exportDatabaseBackup}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Archivo .JSON</span>
            </button>
          </div>
        </div>

        {/* 2.5. Section: Respaldo Completo a Telegram (Facturas, Fiados, Reporte e Inventario) */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/50 via-slate-950 to-sky-950/30 border border-sky-800/60 space-y-3 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sky-300 font-bold text-xs sm:text-sm">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                <Send className="w-4 h-4" />
              </div>
              <span>Enviar Respaldo Completo por Telegram</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-700/60 font-mono font-bold self-start sm:self-auto">
              Facturas • Fiados • Reporte • Inventario
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            Genera un informe integral con todos tus datos consolidados: <strong>Facturación emitida</strong>, cartera de <strong>Cuentas por Cobrar (Fiados)</strong>, <strong>Cuadre de Caja y Egresos</strong>, e <strong>Inventario valorizado</strong> para enviarlo directamente a tu Telegram personal (Mensajes Guardados), grupo de trabajo o socio.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <button
              type="button"
              id="btn-send-full-master-telegram"
              onClick={handleSendTelegramMasterBackup}
              className="w-full sm:flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-sky-950/50 cursor-pointer"
              title="Abrir Telegram con el respaldo consolidado de los 4 módulos"
            >
              <Send className="w-4 h-4" />
              <span>Enviar Respaldo Completo a Telegram</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMasterBackupText}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
              title="Copiar texto del respaldo para pegarlo manualmente"
            >
              {copiedMaster ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedMaster ? '¡Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>
        </div>

        {/* 3. Section: Abrir en Otro Teléfono (Sync Cross-Device) */}
        <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-900/40 space-y-3">
          <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
            <Smartphone className="w-4 h-4 text-blue-400" />
            <span>¿Vas a abrir en otro teléfono o computadora?</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Nada más ingresa tu correo de Google registrado ({account.email}) y el sistema recuperará automáticamente tu inventario, ventas y fiados exactamente como los dejaste.
          </p>

          <form onSubmit={handleRestoreByEmail} className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="Tu correo de Google..."
                value={restoreEmail}
                onChange={(e) => setRestoreEmail(e.target.value)}
                className="w-full bg-slate-900 border border-blue-800/60 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 font-mono focus:outline-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isRestoringByEmail}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-blue-950/50 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRestoringByEmail ? 'animate-spin' : ''}`} />
              <span>{isRestoringByEmail ? 'Recuperando...' : 'Iniciar Sesión y Recuperar'}</span>
            </button>
          </form>
        </div>

        {/* 4. Historial de Copias de Seguridad Diarias */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-rose-400" />
              <span>Historial de Copias Diarias en este Correo</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">
              {backups.length} copias disponibles
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {backups.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 font-mono">
                      📅 {b.day}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({new Date(b.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                      {b.productCount} productos | {b.ticketCount} tickets
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Respaldado en: <span className="font-mono text-slate-300">{b.accountEmail}</span> • {(b.sizeBytes / 1024).toFixed(1)} KB
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestoreBackup(b.id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-900/60 text-slate-300 hover:text-emerald-300 text-[11px] font-semibold transition border border-slate-700 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                  title="Restaurar esta versión específica"
                >
                  <Upload className="w-3 h-3 text-emerald-400" />
                  <span>Restaurar esta copia</span>
                </button>
              </div>
            ))}

            {backups.length === 0 && (
              <div className="p-6 text-center text-slate-500 text-xs rounded-xl bg-slate-950/60 border border-slate-800">
                Aún no hay copias registradas. Pulsa <strong>&quot;Hacer Copia Diaria Ahora&quot;</strong> para crear la primera.
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tus datos viajan encriptados y 100% seguros vinculados a tu correo Google.</span>
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
