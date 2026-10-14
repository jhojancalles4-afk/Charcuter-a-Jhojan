import React, { useState } from 'react';
import {
  Settings,
  Building,
  Phone,
  DollarSign,
  Smartphone,
  Save,
  Download,
  Upload,
  Cloud,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Camera,
  Barcode,
  Sparkles,
  Check,
  ShieldCheck,
  Mail,
  Send,
  HardDrive,
} from 'lucide-react';
import { AppSettings } from '../types';
import { VENEZUELAN_BANKS } from '../data/initialData';
import {
  exportDatabaseBackup,
  importDatabaseBackup,
  formatVES,
  generateTelegramFullMasterBackup,
  loadTickets,
  loadProducts,
  loadExpenses,
  getDebtorsSummary,
} from '../services/storage';
import { CameraScannerModal } from './CameraScannerModal';

interface SettingsModuleProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onOpenGoogleBackup?: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  settings,
  onSaveSettings,
  onOpenGoogleBackup,
}) => {
  // Local form state
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [rif, setRif] = useState(settings.rif);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [bcvRate, setBcvRate] = useState(settings.bcvRate.toString());
  const [preferentialRate, setPreferentialRate] = useState(
    (settings.preferentialRate || settings.bcvRate).toString()
  );
  const [sampleBaseUSD, setSampleBaseUSD] = useState('10.00');

  // Pago Móvil fields
  const [bankCode, setBankCode] = useState(settings.pagoMovil.bankCode);
  const [pagoMovilPhone, setPagoMovilPhone] = useState(settings.pagoMovil.phone);
  const [pagoMovilCedula, setPagoMovilCedula] = useState(settings.pagoMovil.cedula);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Camera test modal state
  const [isTestScannerOpen, setIsTestScannerOpen] = useState(false);
  const [testScannedResult, setTestScannedResult] = useState<string | null>(null);

  // When bank code changes, set appropriate bank name
  const handleBankChange = (code: string) => {
    setBankCode(code);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsedBcv = parseFloat(bcvRate.replace(',', '.'));
    if (isNaN(parsedBcv) || parsedBcv <= 0) {
      setFormError('Por favor introduce una tasa BCV válida mayor a cero.');
      return;
    }

    const parsedPref = parseFloat(preferentialRate.replace(',', '.'));
    const validPrefRate = isNaN(parsedPref) || parsedPref <= 0 ? parsedBcv : parsedPref;

    const selectedBank = VENEZUELAN_BANKS.find((b) => b.code === bankCode);
    const bankName = selectedBank ? selectedBank.name : 'Banesco Banco Universal';

    const updated: AppSettings = {
      ...settings,
      businessName: businessName.trim(),
      rif: rif.trim(),
      phone: phone.trim(),
      address: address.trim(),
      bcvRate: parsedBcv,
      preferentialRate: validPrefRate,
      bcvLastUpdated: new Date().toISOString(),
      pagoMovil: {
        bankCode,
        bankName,
        phone: pagoMovilPhone.trim(),
        cedula: pagoMovilCedula.trim(),
      },
    };

    onSaveSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importDatabaseBackup(content);
        setImportMessage(res.message);
        if (res.success) {
          setTimeout(() => window.location.reload(), 1500);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSendTelegramBackup = () => {
    const t = loadTickets();
    const p = loadProducts();
    const e = loadExpenses();
    const d = getDebtorsSummary(t, settings.bcvRate);
    const { url } = generateTelegramFullMasterBackup({
      tickets: t,
      debtors: d,
      products: p,
      expenses: e,
      settings,
    });
    window.open(url, '_blank');
  };

  return (
    <div id="settings-module-container" className="space-y-4 max-w-4xl mx-auto">
      {/* Form Card */}
      <form onSubmit={handleFormSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-rose-400" />
              <span>Configuración del Comercio y Pago Móvil</span>
            </h3>
            <p className="text-xs text-slate-400">
              Datos que alimentan automáticamente el encabezado, facturas y mensajes de WhatsApp.
            </p>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>¡Guardado con éxito!</span>
            </div>
          )}

          {formError && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-400 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4" />
              <span>{formError}</span>
            </div>
          )}
        </div>

        {/* 1. Basic Store Details */}
        <div>
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-rose-400" />
            <span>Identificación del Comercio</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Nombre Comercial (*)</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-semibold focus:outline-rose-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">RIF del Negocio (*)</label>
              <input
                type="text"
                required
                value={rif}
                onChange={(e) => setRif(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-rose-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Teléfono Principal del Local</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-rose-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Dirección / Ubicación</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-rose-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Renglón de Tasas de Cambio Bimonetarias */}
        <div className="pt-3 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Renglones de Tasas de Cambio (Bimonetario USD / VES)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Tasa 1: Oficial BCV */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-semibold block">
                  Tasa Oficial BCV (Tarjeta / Pago Móvil)
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                  Base General
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
                  Bs.
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={bcvRate}
                  onChange={(e) => setBcvRate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-slate-100 font-mono font-bold text-base focus:outline-rose-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Aplica por defecto a Punto de Venta, Pago Móvil, Efectivo Bs. y cálculo de deudas en el Libro de Fiados.
              </p>
            </div>

            {/* Tasa 2: Preferencial Divisa Efectivo */}
            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-amber-300 font-semibold block">
                  Renglón Tasa Preferencial (Divisa Efectivo)
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono font-bold">
                  💵 Billete Verde
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-mono">
                  Bs.
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={preferentialRate}
                  onChange={(e) => setPreferentialRate(e.target.value)}
                  className="w-full bg-slate-900 border border-amber-700/60 rounded-xl pl-10 pr-3 py-2 text-amber-300 font-mono font-bold text-base focus:outline-amber-500"
                />
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Utilizada automáticamente para evaluar el cobro en dólares billete en mano. Si no se define, se toma la tasa oficial BCV.
              </p>

              {/* Sugerencia de Precio de Venta en USD (Nada de Bolívares) */}
              {(() => {
                const currentBcv = parseFloat(bcvRate.replace(',', '.')) || 1;
                const currentPref = parseFloat(preferentialRate.replace(',', '.')) || currentBcv;
                const currentSample = parseFloat(sampleBaseUSD.replace(',', '.')) || 0;
                const calculatedSuggestedUSD = currentPref > 0 ? (currentSample * currentBcv) / currentPref : currentSample;
                const savingUSD = Math.max(0, currentSample - calculatedSuggestedUSD);
                const savingPercent = currentSample > 0 ? (savingUSD / currentSample) * 100 : 0;

                return (
                  <div className="mt-2 p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Sugerencia de Precio de Venta en USD (Efectivo)</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
                        100% en Dólares USD
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Calcula el precio de venta en divisas para clientes que paguen con billetes en mano. <em>(Sin bolívares: la relación se expresa puramente en USD)</em>.
                    </p>

                    {/* Interactive Simulator Input */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] text-slate-400 font-medium">
                          Introduce un Precio Base ($ USD):
                        </label>
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={sampleBaseUSD}
                            onChange={(e) => setSampleBaseUSD(e.target.value)}
                            className="w-full bg-slate-900 border border-amber-700/60 rounded-lg pl-5 pr-2 py-1 text-xs font-mono font-bold text-white text-right focus:outline-amber-500"
                            placeholder="10.00"
                          />
                        </div>
                      </div>

                      {/* Quick Select Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500">Montos rápidos:</span>
                        {['1.00', '5.00', '10.00', '20.00', '50.00'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setSampleBaseUSD(val)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition ${
                              sampleBaseUSD === val
                                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            ${val}
                          </button>
                        ))}
                      </div>

                      {/* Highlight Result Card */}
                      <div className="p-3 rounded-lg bg-gradient-to-br from-amber-950/60 to-slate-900 border border-amber-500/40 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono text-amber-400/90 uppercase tracking-wider block">
                            Precio de Venta Sugerido en USD
                          </span>
                          <span className="text-xl font-black font-mono text-amber-300">
                            ${calculatedSuggestedUSD.toFixed(2)} USD
                          </span>
                        </div>

                        <div className="text-right text-[11px] font-mono">
                          <span className="text-slate-400 block">Ajuste en USD:</span>
                          <span className="font-bold text-emerald-400">
                            -${savingUSD.toFixed(2)} USD ({savingPercent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Table of Quick Reference */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-center font-mono text-[11px]">
                      {[
                        { base: 5 },
                        { base: 10 },
                        { base: 20 },
                        { base: 50 },
                      ].map(({ base }) => {
                        const sug = currentPref > 0 ? (base * currentBcv) / currentPref : base;
                        return (
                          <div key={base} className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                            <span className="text-[10px] text-slate-400 block">Base: ${base.toFixed(2)}</span>
                            <span className="font-bold text-amber-300">${sug.toFixed(2)} USD</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Privacy & Receipt Assurance */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        <strong>Facturación:</strong> La tasa preferencial es para cálculo interno y <u>NO aparece</u> en la factura ni en el ticket térmico del cliente.
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* 3. Configuración de Pago Móvil */}
        <div className="pt-3 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-rose-400" />
            <span>Datos Bancarios para Pago Móvil (Cobranzas)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Banco Receptor */}
            <div>
              <label className="text-slate-400 block mb-1">Banco Receptor (*)</label>
              <select
                value={bankCode}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-rose-500 font-medium"
              >
                {VENEZUELAN_BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} - {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Teléfono Pago Móvil */}
            <div>
              <label className="text-slate-400 block mb-1">Teléfono Afiliado (*)</label>
              <input
                type="text"
                required
                placeholder="04141234567"
                value={pagoMovilPhone}
                onChange={(e) => setPagoMovilPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-rose-500"
              />
            </div>

            {/* Cédula o RIF */}
            <div>
              <label className="text-slate-400 block mb-1">Cédula / RIF del Titular (*)</label>
              <input
                type="text"
                required
                placeholder="V-12345678"
                value={pagoMovilCedula}
                onChange={(e) => setPagoMovilCedula(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-rose-500"
              />
            </div>
          </div>

          {/* WhatsApp Preview Card */}
          <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
            <span className="text-slate-400 text-[11px] block mb-1">
              Vista previa de datos en la plantilla de WhatsApp:
            </span>
            <div className="font-mono text-slate-300 text-[11px] bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              🏦 *DATOS BANCARIOS PARA PAGO MÓVIL:*<br />
              • Banco: {VENEZUELAN_BANKS.find((b) => b.code === bankCode)?.name || 'Banco'} ({bankCode})<br />
              • Teléfono: {pagoMovilPhone}<br />
              • Cédula / RIF: {pagoMovilCedula}<br />
              • Monto exacto: Bs. [Calculado según tasa BCV]
            </div>
          </div>
        </div>

        {/* Submit button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            id="btn-save-settings"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs transition shadow-lg shadow-rose-950/40 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Ajustes</span>
          </button>
        </div>
      </form>

      {/* 4. Local Storage & Backups Hub */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span>Almacenamiento Local y Centro de Respaldos</span>
          </h3>
          <p className="text-xs text-slate-400">
            Toda la información se almacena 100% de forma local y privada en este dispositivo (sin servidores externos ni intermediarios). Realiza copias de seguridad descargables con Google Drive y Telegram para proteger tus datos.
          </p>
        </div>

        {importMessage && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200">
            {importMessage}
          </div>
        )}

        {/* Google Daily Backup Hub */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-blue-950/40 to-slate-950 border border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 flex items-center justify-center text-emerald-400 border border-emerald-800 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">
                  Centro de Respaldos: Google Drive y Telegram
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-mono font-bold">
                  Oficial
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Respalda y restaura de forma segura tus facturas, fiados, reposiciones e inventario mediante Google Drive (archivos .json) y Telegram (mensajes y códigos directos).
              </p>
            </div>
          </div>

          {onOpenGoogleBackup && (
            <button
              type="button"
              onClick={onOpenGoogleBackup}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-sky-950/40 cursor-pointer shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Abrir Centro de Respaldos</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Telegram Master Backup */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-900/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Send className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-xs text-slate-100">Respaldo Telegram</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Envía facturas, fiados, reporte e inventario consolidado a Telegram.
              </p>
            </div>
            <button
              type="button"
              id="btn-settings-telegram-backup"
              onClick={handleSendTelegramBackup}
              className="mt-3 w-full py-2 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar a Telegram</span>
            </button>
          </div>

          {/* Local Storage Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-slate-100">Almacenamiento Local</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tus datos se guardan de forma privada en la memoria de este dispositivo (100% Offline).
              </p>
            </div>
            <div className="mt-3 w-full py-2 px-3 rounded-xl bg-slate-900 border border-emerald-800/40 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Guardado en Equipo</span>
            </div>
          </div>

          {/* Export Database Backup */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-xs text-slate-100">Exportar Respaldo</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Descarga un archivo .JSON con todos los productos, clientes, deudas y tickets.
              </p>
            </div>
            <button
              type="button"
              onClick={exportDatabaseBackup}
              className="mt-3 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar .JSON</span>
            </button>
          </div>

          {/* Import Database Backup */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs text-slate-100">Restaurar Respaldo</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Carga un archivo de respaldo previo en este equipo para actualizar todos los datos.
              </p>
            </div>
            <label className="mt-3 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar .JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* 5. Escáner con Cámara del Teléfono */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <Camera className="w-4 h-4 text-rose-400" />
              <span>Escáner de Códigos con Cámara de Teléfono</span>
            </h3>
            <p className="text-xs text-slate-400">
              Convierte la cámara de tu celular o tableta en un lector de códigos de barras (EAN-13, QR, Code-128).
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsTestScannerOpen(true)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 transition shadow-md shadow-rose-950/40 cursor-pointer self-start sm:self-auto"
          >
            <Camera className="w-4 h-4" />
            <span>Probar Escáner Ahora</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Barcode className="w-4 h-4 text-emerald-400" />
              <span>Formatos Compatibles</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Detecta códigos EAN-13, EAN-8, UPC, Code 128, Code 39 y códigos QR en paquetes, quesos y embutidos.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Smartphone className="w-4 h-4 text-rose-400" />
              <span>Uso en Caja (POS)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              En la pantalla de cobro dispones del botón de cámara para escanear y agregar artículos directamente al carrito.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Feedback Inmediato</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Pitido sonoro configurable tipo caja registradora, vibración háptica y soporte de linterna para poca luz.
            </p>
          </div>
        </div>

        {testScannedResult && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-xs flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Último código detectado en prueba: <strong className="font-mono text-emerald-200">{testScannedResult}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setTestScannedResult(null)}
              className="text-emerald-400 hover:text-emerald-200 text-[11px] underline cursor-pointer"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>

      {/* Test Scanner Modal */}
      <CameraScannerModal
        isOpen={isTestScannerOpen}
        onClose={() => setIsTestScannerOpen(false)}
        title="Prueba de Escáner de Cámara"
        subtitle="Verifica que la cámara enfoque correctamente códigos de barras o QR"
        allowContinuous={true}
        onScan={(code) => {
          setTestScannedResult(code);
          return true;
        }}
      />
    </div>
  );
};
