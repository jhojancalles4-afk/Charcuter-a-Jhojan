import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  TrendingUp,
  AlertTriangle,
  Clock,
  DollarSign,
  Package,
  BookOpen,
  CheckCircle2,
  Copy,
  Printer,
  ChevronRight,
  RefreshCw,
  Sliders,
  Check,
  X,
  FileText,
  Boxes,
  HelpCircle,
  MessageCircle,
  Zap,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  Megaphone,
  Share2,
  Flame,
  BadgePercent,
  Trash2,
  Plus,
  Mic,
  MicOff,
} from 'lucide-react';
import {
  AppSettings,
  DebtorCustomer,
  ExpenseRecord,
  MarketingPromotion,
  MermaRecord,
  Product,
  RestockRecord,
  SaleTicket,
} from '../types';
import {
  formatUSD,
  formatVES,
  formatQuantity,
  THANK_YOU_TONE_PRESETS,
  REMINDER_TONE_PRESETS,
  DEFAULT_THANK_YOU_TEMPLATE,
  DEFAULT_REMINDER_TEMPLATE,
} from '../services/storage';
import {
  AIChatMessage,
  AIExecutiveReport,
  generateFinancialPLReport,
  generateDemandReport,
  generateDebtorsAuditReport,
  processAIChatQuery,
  generateAICopyPromotion,
  AIActionProposal,
} from '../services/aiAssistantEngine';
import { calculateAIRestockPredictions, generateAIPatternsReport } from '../services/restockAI';
import { playSuccessChime, playBeepSound } from '../utils/audioFeedback';

interface AIControlModuleProps {
  products: Product[];
  tickets: SaleTicket[];
  debtors: DebtorCustomer[];
  restocks: RestockRecord[];
  expenses: ExpenseRecord[];
  mermas: MermaRecord[];
  settings: AppSettings;
  onUpdateBcvRate: (newRate: number) => void;
  onUpdatePreferentialRate?: (newRate: number) => void;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateTickets?: (tickets: SaleTicket[]) => void;
  onAddExpense?: (expense: Omit<ExpenseRecord, 'id' | 'expenseNumber'>) => void;
  onDeleteExpense?: (id: string) => void;
  onUpdateExpenses?: (expenses: ExpenseRecord[]) => void;
  onUpdateMermas?: (mermas: MermaRecord[]) => void;
  onUpdateRestocks?: (restocks: RestockRecord[]) => void;
  onOpenBackupModal?: () => void;
  onOpenMermaModal?: (product?: Product) => void;
  onClaimFidelisReward?: (customerId: string, rewardType: 'stamps' | 'highValue') => void;
  onSaveSettings?: (newSettings: AppSettings) => void;
  onShowToast: (msg: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const AIControlModule: React.FC<AIControlModuleProps> = ({
  products,
  tickets,
  debtors,
  restocks,
  expenses,
  mermas,
  settings,
  onUpdateBcvRate,
  onUpdatePreferentialRate,
  onUpdateProducts,
  onUpdateTickets,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpenses,
  onUpdateMermas,
  onUpdateRestocks,
  onOpenBackupModal,
  onOpenMermaModal,
  onClaimFidelisReward,
  onSaveSettings,
  onShowToast,
  onNavigateToTab,
}) => {
  // Navigation inside AI Module
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'copy' | 'reports' | 'demand' | 'control'>('chat');

  // Chat State
  const [messages, setMessages] = useState<AIChatMessage[]>(() => [
    {
      id: 'welcome-msg',
      sender: 'ai',
      timestamp: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      category: 'general',
      text: `👋 ¡Hola! Soy tu **Copiloto de Inteligencia Artificial & Manager Copy Experta** de **${settings.businessName}**.\n\nAdemás de auditorías de inventario, finanzas y libro de fiados, soy tu **redactora publicitaria en charcutería y alimentos**: puedo crear combos irresistibles para WhatsApp, diseñar ofertas relámpago, y redactar o modificar tus mensajes de agradecimiento y cobranza.\n\n¿Qué deseas impulsar hoy?`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Reports State
  const [selectedReportType, setSelectedReportType] = useState<'financial' | 'demand' | 'debtors'>('financial');
  const [reportWindowDays, setReportWindowDays] = useState<number>(30);
  const [copiedReport, setCopiedReport] = useState(false);

  // Manager Copy State
  const [copyTemplateType, setCopyTemplateType] = useState<'thank_you' | 'reminder'>('thank_you');
  const [thankYouText, setThankYouText] = useState<string>(
    settings.customThankYouTemplate || DEFAULT_THANK_YOU_TEMPLATE
  );
  const [reminderText, setReminderText] = useState<string>(
    settings.customReminderTemplate || DEFAULT_REMINDER_TEMPLATE
  );
  const [selectedCampaignCategory, setSelectedCampaignCategory] = useState<
    'combo' | 'descuento' | 'oferta_relampago' | 'fin_de_semana' | 'tasa_especial'
  >('combo');
  const [selectedCampaignProductId, setSelectedCampaignProductId] = useState<string>(
    products[0]?.id || ''
  );
  const [selectedCampaignTone, setSelectedCampaignTone] = useState<
    'persuasivo' | 'familiar' | 'gourmet' | 'relampago'
  >('persuasivo');
  const [activePromoDraft, setActivePromoDraft] = useState<MarketingPromotion | null>(() => {
    return (settings.promotions && settings.promotions[0]) || null;
  });
  const [copiedPromo, setCopiedPromo] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [isPrefRateEditing, setIsPrefRateEditing] = useState(false);
  const [tempPrefInput, setTempPrefInput] = useState((settings.preferentialRate || settings.bcvRate).toString());
  const [isBcvEditing, setIsBcvEditing] = useState(false);
  const [tempBcvInput, setTempBcvInput] = useState(settings.bcvRate.toString());

  // Quick prompt chips
  const quickChips = [
    '🔥 Crear combo arepero para WhatsApp',
    '⚡ Redactar oferta relámpago de queso llanero',
    '💬 Modificar mensaje de agradecimiento',
    '📋 Mejorar recordatorio de cobranza',
    '¿Qué productos tienen mayor demanda?',
    'Generar reporte financiero P&L',
    '¿Quiénes nos deben en el libro de fiados?',
  ];

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sync templates if settings change externally
  useEffect(() => {
    if (settings.customThankYouTemplate) {
      setThankYouText(settings.customThankYouTemplate);
    }
    if (settings.customReminderTemplate) {
      setReminderText(settings.customReminderTemplate);
    }
  }, [settings.customThankYouTemplate, settings.customReminderTemplate]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Voice command handler
  const handleToggleVoice = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onShowToast('⚠️ Tu navegador no soporta reconocimiento de voz nativo.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-VE';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        setIsListening(true);
        playBeepSound(1200, 80);
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setChatInput(transcript);
          handleSendMessage(transcript);
        }
      };
      recognition.onerror = () => {
        setIsListening(false);
        onShowToast('No se capturó la voz. Intenta de nuevo.');
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      onShowToast('Error al iniciar el micrófono.');
    }
  };

  // Handle User Message Submission
  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || chatInput).trim();
    if (!query) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput('');
    setIsProcessing(true);

    setTimeout(() => {
      const response = processAIChatQuery(query, {
        products,
        tickets,
        debtors,
        restocks,
        expenses,
        mermas,
        settings,
      });

      // If autonomous mode is active and proposal is present, execute immediately
      if (settings.aiAutonomousMode && response.actionProposal) {
        handleExecuteAction(response.actionProposal);
        response.actionProposal = {
          ...response.actionProposal,
          status: 'executed',
        };
        response.text += `\n\n⚡ **Ejecutado automáticamente en Modo Autónomo.**`;
      }

      setMessages((prev) => [...prev, response]);
      setIsProcessing(false);
    }, 300);
  };

  // Execute Action Proposed by AI (Total Application Control)
  const handleExecuteAction = (proposal: AIActionProposal) => {
    try {
      if (proposal.type === 'set_bcv_rate') {
        onUpdateBcvRate(proposal.payload.newRate);
        playSuccessChime();
        onShowToast(`✅ Tasa BCV actualizada a ${formatVES(proposal.payload.newRate)} Bs.`);
      } else if (proposal.type === 'set_pref_rate' && onUpdatePreferentialRate) {
        onUpdatePreferentialRate(proposal.payload.newRate);
        playSuccessChime();
        onShowToast(`✅ Tasa Preferencial de Divisas actualizada a ${formatVES(proposal.payload.newRate)} Bs.`);
      } else if (proposal.type === 'toggle_autonomous_mode' && onSaveSettings) {
        const enabled = proposal.payload.enabled;
        onSaveSettings({ ...settings, aiAutonomousMode: enabled });
        playSuccessChime();
        onShowToast(enabled ? '⚡ Modo Autónomo ACTIVADO: Ejecución directa' : '🛡️ Modo Asistido ACTIVADO');
      } else if (proposal.type === 'create_product') {
        const rawUnit = proposal.payload.unit;
        const validUnit = (rawUnit === 'UN' || rawUnit === 'unid') ? 'UN' : 'KG';
        const validCategory = ['Quesos', 'Embutidos', 'Lácteos', 'Varios'].includes(proposal.payload.category)
          ? proposal.payload.category
          : 'Embutidos';

        const newProduct: Product = {
          id: `prod-${Date.now()}`,
          name: proposal.payload.name,
          priceUSD: proposal.payload.priceUSD,
          costUSD: proposal.payload.costUSD || Math.round(proposal.payload.priceUSD * 0.72 * 100) / 100,
          stock: proposal.payload.stock || 0,
          unit: validUnit,
          category: validCategory,
          emoji: validCategory === 'Quesos' ? '🧀' : validCategory === 'Lácteos' ? '🥛' : '🥓',
          minStockAlert: 2,
        };
        onUpdateProducts([newProduct, ...products]);
        playSuccessChime();
        onShowToast(`✅ Producto "${newProduct.name}" creado con ${formatQuantity(newProduct.stock, newProduct.unit)}.`);
      } else if (proposal.type === 'update_product_price') {
        const nextProducts = products.map((p) =>
          p.id === proposal.payload.productId ? { ...p, priceUSD: proposal.payload.newPriceUSD } : p
        );
        onUpdateProducts(nextProducts);
        playSuccessChime();
        onShowToast(`✅ Precio de "${proposal.payload.productName}" actualizado a ${formatUSD(proposal.payload.newPriceUSD)}.`);
      } else if (proposal.type === 'update_product_stock') {
        const nextProducts = products.map((p) =>
          p.id === proposal.payload.productId ? { ...p, stock: proposal.payload.newStock } : p
        );
        onUpdateProducts(nextProducts);
        playSuccessChime();
        onShowToast(`✅ Stock de "${proposal.payload.productName}" fijado en ${proposal.payload.newStock}.`);
      } else if (proposal.type === 'add_expense' && onAddExpense) {
        onAddExpense(proposal.payload);
        playSuccessChime();
        onShowToast(`✅ Gasto de ${formatUSD(proposal.payload.amountUSD)} registrado en ${proposal.payload.category}.`);
      } else if (proposal.type === 'register_abono_fiado' && onUpdateTickets) {
        let remainingAbono = proposal.payload.amountUSD;
        const nextTickets = tickets.map((t) => {
          if (remainingAbono <= 0) return t;
          const isTarget =
            t.customerName?.toLowerCase().includes(proposal.payload.debtorName.toLowerCase()) ||
            t.customerCedula === proposal.payload.debtorCedula;
          if (isTarget && t.status === 'fiado' && (t.pendingUSD || 0) > 0) {
            const currentPending = t.pendingUSD || t.totalUSD;
            const abonoThis = Math.min(currentPending, remainingAbono);
            remainingAbono -= abonoThis;
            const newPending = currentPending - abonoThis;
            return {
              ...t,
              pendingUSD: newPending,
              status: newPending <= 0.001 ? ('paid' as const) : ('fiado' as const),
            };
          }
          return t;
        });
        onUpdateTickets(nextTickets);
        playSuccessChime();
        onShowToast(`✅ Abono de ${formatUSD(proposal.payload.amountUSD)} registrado para ${proposal.payload.debtorName}.`);
      } else if (proposal.type === 'register_merma') {
        const targetProd = products.find((p) => p.id === proposal.payload.productId);
        if (targetProd) {
          const nextProducts = products.map((p) =>
            p.id === targetProd.id ? { ...p, stock: Math.max(0, p.stock - proposal.payload.quantity) } : p
          );
          onUpdateProducts(nextProducts);
          if (onUpdateMermas) {
            const newMerma: MermaRecord = {
              id: `MERMA-${Date.now()}`,
              productId: targetProd.id,
              productName: targetProd.name,
              category: targetProd.category,
              unit: targetProd.unit,
              quantity: proposal.payload.quantity,
              unitCostUSD: targetProd.costUSD || targetProd.priceUSD * 0.72,
              totalCostUSD: proposal.payload.lossUSD,
              totalCostVES: proposal.payload.lossUSD * (settings.bcvRate || 1),
              bcvRate: settings.bcvRate || 1,
              reason: 'Daño / Vencimiento',
              location: 'Mostrador / Exhibidor',
              notes: proposal.payload.reason || 'Merma asentada por IA',
              date: new Date().toISOString(),
              performedBy: 'Copiloto IA (Control Total)',
            };
            onUpdateMermas([newMerma, ...mermas]);
          }
          playSuccessChime();
          onShowToast(`✅ Merma de ${formatQuantity(proposal.payload.quantity, targetProd.unit)} asentada.`);
        }
      } else if (proposal.type === 'execute_cierre_z' && onNavigateToTab) {
        onNavigateToTab('tickets');
        playSuccessChime();
        onShowToast(`🧾 Navegando al módulo de Cierre de Caja y Reportes Z.`);
      } else if (proposal.type === 'open_backup' && onOpenBackupModal) {
        onOpenBackupModal();
        playSuccessChime();
        onShowToast(`💾 Abriendo Centro de Respaldo y Copia de Seguridad.`);
      } else if (proposal.type === 'update_reminder_template' && onSaveSettings) {
        const updated: AppSettings = {
          ...settings,
          customReminderTemplate: proposal.payload.newTemplate,
          reminderTone: proposal.payload.tone || settings.reminderTone,
        };
        onSaveSettings(updated);
        setReminderText(proposal.payload.newTemplate);
        playSuccessChime();
        onShowToast(`✅ Plantilla de recordatorio de cobranza actualizada con éxito.`);
      } else if (proposal.type === 'update_thank_you_template' && onSaveSettings) {
        const updated: AppSettings = {
          ...settings,
          customThankYouTemplate: proposal.payload.newTemplate,
          thankYouTone: proposal.payload.tone || settings.thankYouTone,
        };
        onSaveSettings(updated);
        setThankYouText(proposal.payload.newTemplate);
        playSuccessChime();
        onShowToast(`✅ Plantilla de agradecimiento y factura actualizada con éxito.`);
      } else if (proposal.type === 'save_promotion' && onSaveSettings) {
        const promo: MarketingPromotion = proposal.payload.promotion;
        const currentPromos = settings.promotions || [];
        const existsIndex = currentPromos.findIndex((p) => p.id === promo.id || p.title === promo.title);
        let updatedPromos: MarketingPromotion[];
        if (existsIndex >= 0) {
          updatedPromos = currentPromos.map((p, idx) => (idx === existsIndex ? promo : p));
        } else {
          updatedPromos = [promo, ...currentPromos];
        }
        const updated: AppSettings = {
          ...settings,
          promotions: updatedPromos,
        };
        onSaveSettings(updated);
        setActivePromoDraft(promo);
        playSuccessChime();
        onShowToast(`📢 Promoción "${promo.title}" guardada en Campañas Activas.`);
      } else if (proposal.type === 'share_promotion') {
        const textToShare = proposal.payload.bodyWhatsApp;
        navigator.clipboard?.writeText(textToShare);
        const link = document.createElement('a');
        link.href = `https://wa.me/?text=${encodeURIComponent(textToShare)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
        playSuccessChime();
        onShowToast(`📲 Promoción copiada y transmitiendo por WhatsApp...`);
      } else if (proposal.type === 'open_reminder') {
        if (proposal.payload.url) {
          const link = document.createElement('a');
          link.href = proposal.payload.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.click();
          playSuccessChime();
          onShowToast(`📲 Abriendo WhatsApp para ${proposal.payload.debtorName || 'el cliente'}...`);
        }
      } else if (proposal.type === 'navigate_tab' && onNavigateToTab) {
        onNavigateToTab(proposal.payload.tab);
        playSuccessChime();
      }

      // Update proposal status in messages
      setMessages((prev) =>
        prev.map((m) => {
          if (m.actionProposal && m.actionProposal.id === proposal.id) {
            return {
              ...m,
              actionProposal: { ...m.actionProposal, status: 'executed' },
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      onShowToast(`❌ Error al ejecutar acción: ${err.message || 'Error'}`);
    }
  };

  // Cancel Action
  const handleCancelAction = (proposalId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.actionProposal && m.actionProposal.id === proposalId) {
          return {
            ...m,
            actionProposal: { ...m.actionProposal, status: 'cancelled' },
          };
        }
        return m;
      })
    );
  };

  // Active Report Generated
  const activeReport: AIExecutiveReport = useMemo(() => {
    if (selectedReportType === 'financial') {
      return generateFinancialPLReport(tickets, expenses, products, settings, reportWindowDays);
    } else if (selectedReportType === 'demand') {
      return generateDemandReport(products, tickets, restocks, settings, reportWindowDays);
    } else {
      return generateDebtorsAuditReport(debtors, settings);
    }
  }, [selectedReportType, reportWindowDays, tickets, expenses, products, restocks, debtors, settings]);

  // Copy Report for WhatsApp
  const handleCopyReport = () => {
    navigator.clipboard.writeText(activeReport.plainTextWhatsApp);
    setCopiedReport(true);
    onShowToast('📋 Reporte copiado con formato para WhatsApp.');
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // AI Demand Predictions for Demand Tab
  const predictions = useMemo(() => {
    return calculateAIRestockPredictions(products, tickets, restocks, 30);
  }, [products, tickets, restocks]);

  const patterns = useMemo(() => {
    return generateAIPatternsReport(products, tickets, restocks, 30);
  }, [products, tickets, restocks]);

  // Summary Metrics
  const criticalCount = predictions.filter((p) => p.urgencyLevel === 'critical').length;
  const warningCount = predictions.filter((p) => p.urgencyLevel === 'warning').length;
  let totalDebtAllUSD = 0;
  debtors.forEach((d) => (totalDebtAllUSD += d.totalDebtUSD));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner: Central AI Command Header */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/30 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2.5 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-inner">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Copiloto & Centro de Control IA
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800/60 font-mono">
                    Control Total 100%
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
                  Inteligencia centralizada de {settings.businessName}: responde sobre demanda y rotación, genera reportes de ganancias y orquesta acciones en toda la aplicación.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-950/70 border border-purple-900/40 rounded-2xl p-2.5">
              <span className="text-[10px] font-semibold text-slate-400 block">Tasa BCV Oficial</span>
              <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                {formatVES(settings.bcvRate)}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-rose-900/40 rounded-2xl p-2.5">
              <span className="text-[10px] font-semibold text-rose-400 block">Stock Crítico</span>
              <span className="text-sm sm:text-base font-mono font-bold text-rose-300">
                {criticalCount} en riesgo
              </span>
            </div>

            <div className="bg-slate-950/70 border border-amber-900/40 rounded-2xl p-2.5">
              <span className="text-[10px] font-semibold text-amber-400 block">Por Cobrar (Fiados)</span>
              <span className="text-sm sm:text-base font-mono font-bold text-amber-300">
                {formatUSD(totalDebtAllUSD)}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-2.5">
              <span className="text-[10px] font-semibold text-slate-400 block">Presupuesto Sugerido</span>
              <span className="text-sm sm:text-base font-mono font-bold text-white">
                {formatUSD(patterns.totalRecommendedPurchaseUSD)}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex items-center gap-1.5 pt-4 mt-4 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveSubTab('chat')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'chat'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Asistente & Chat IA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('copy')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'copy'
                ? 'bg-gradient-to-r from-rose-600 to-purple-600 text-white shadow-md shadow-rose-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Megaphone className="w-4 h-4 text-rose-300" />
            <span>Manager Copy & Promos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/80 text-white">
              IA
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('reports')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'reports'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Reportes Ejecutivos P&L</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('demand')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'demand'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Demanda & Reabastecimiento</span>
            {criticalCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white">
                {criticalCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('control')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'control'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Acciones Rápidas & Control</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: CHAT ASISTENTE & CONSOLA EN LENGUAJE NATURAL */}
      {activeSubTab === 'chat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col h-[650px]">
          {/* Autonomous Mode Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border ${settings.aiAutonomousMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                <Zap className={`w-4 h-4 ${settings.aiAutonomousMode ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <span className="text-xs font-bold text-white block flex items-center gap-2">
                  <span>{settings.aiAutonomousMode ? '⚡ Control Autónomo de la Aplicación: ACTIVADO' : '🛡️ Modo Asistido (Confirmación 1 Clic)'}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${settings.aiAutonomousMode ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-slate-400'}`}>
                    {settings.aiAutonomousMode ? 'EJECUCIÓN DIRECTA' : 'ASISTIDO'}
                  </span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {settings.aiAutonomousMode
                    ? 'Cualquier orden que le des a la IA se aplica directamente a la base de datos sin esperas.'
                    : 'La IA te muestra un resumen de la orden con botón para ejecutar.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const nextMode = !settings.aiAutonomousMode;
                if (onSaveSettings) {
                  onSaveSettings({ ...settings, aiAutonomousMode: nextMode });
                }
                playSuccessChime();
                onShowToast(nextMode ? '⚡ Modo Autónomo ACTIVADO: Ejecución directa' : '🛡️ Modo Asistido ACTIVADO');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border self-start sm:self-auto ${
                settings.aiAutonomousMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-950/40'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{settings.aiAutonomousMode ? '⚡ MODO AUTÓNOMO' : '🛡️ MODO ASISTIDO'}</span>
            </button>
          </div>

          {/* Quick Prompts Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 border-b border-slate-800 no-scrollbar shrink-0">
            <span className="text-[11px] font-semibold text-purple-400 shrink-0 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>Órdenes:</span>
            </span>
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip)}
                className="px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-purple-950 hover:text-purple-200 border border-slate-700/80 hover:border-purple-600/50 text-slate-300 text-[11px] whitespace-nowrap transition cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-purple-600 text-white rounded-br-none shadow-md shadow-purple-950/40'
                        : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75">
                      <span className="font-bold">{isUser ? 'Tú (Administrador)' : 'Copiloto IA'}</span>
                      <span className="font-mono">{m.timestamp}</span>
                    </div>

                    <div className="whitespace-pre-line space-y-1">
                      {m.text}
                    </div>

                    {/* Action Proposal Widget (If AI identified a command) */}
                    {m.actionProposal && (
                      <div className="mt-3 p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2">
                        <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                          <Zap className="w-4 h-4" />
                          <span>{m.actionProposal.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {m.actionProposal.description}
                        </p>

                        <div className="flex items-center gap-2 pt-1">
                          {m.actionProposal.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleExecuteAction(m.actionProposal!)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Confirmar y Aplicar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelAction(m.actionProposal!.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : m.actionProposal.status === 'executed' ? (
                            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Acción ejecutada correctamente</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Acción cancelada
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isProcessing && (
              <div className="flex items-center gap-2 text-xs text-purple-400 pl-11">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analizando datos del negocio y generando respuesta...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Voice Listening Status Banner */}
          {isListening && (
            <div className="p-2.5 mb-2 rounded-xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-between text-xs text-rose-200 shrink-0 animate-pulse">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span>🎤 Escuchando orden por micrófono... Di tu orden ahora.</span>
              </span>
              <button
                type="button"
                onClick={handleToggleVoice}
                className="px-2 py-0.5 rounded bg-rose-800 text-[10px] font-bold text-white hover:bg-rose-700 cursor-pointer"
              >
                Detener
              </button>
            </div>
          )}

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="pt-3 border-t border-slate-800 flex items-center gap-2 shrink-0"
          >
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-3 rounded-xl border transition cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-rose-600 text-white border-rose-400 animate-bounce'
                  : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
              }`}
              title={isListening ? 'Detener micrófono' : 'Comando por voz'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              placeholder="Ordena cualquier cambio (ej: 'Pon la tasa BCV a 64', 'Abona $10 a Pedro', 'Sube el queso a $5.80')..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition"
            />

            <button
              type="submit"
              disabled={!chatInput.trim() || isProcessing}
              className="px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shadow-md shadow-purple-950/40"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>
      )}

      {/* SUB-TAB: MANAGER COPY & PROMOCIONES */}
      {activeSubTab === 'copy' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-rose-950/80 via-purple-950/80 to-slate-900 border border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-500 to-purple-600 text-white shadow-lg shadow-rose-950/50">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <span>Manager Copy & Publicidad para Charcutería</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                      Experta en Ventas
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-0.5">
                    Redacta copys persuasivos de alta conversión para WhatsApp y redes, y personaliza los mensajes de agradecimiento y cobranza del negocio.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const promo = generateAICopyPromotion('combo arepero de fin de semana', products, settings);
                    setActivePromoDraft(promo);
                    onShowToast('✨ Nuevo combo arepero redactado con IA.');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sugerir Combo Arepero</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const promo = generateAICopyPromotion('oferta relampago de queso llanero', products, settings);
                    setActivePromoDraft(promo);
                    onShowToast('⚡ Oferta relámpago redactada con IA.');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span>Oferta Relámpago</span>
                </button>
              </div>
            </div>
          </div>

          {/* TWO COLUMNS: GENERADOR DE PROMOCIONES & PERSONALIZACIÓN DE MENSAJES */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* COLUMN 1: GENERADOR DE PROMOCIONES (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-rose-400" />
                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-white">
                        Generador de Promociones & Combos
                      </h4>
                      <p className="text-xs text-slate-400">
                        Crea mensajes listos para enviar por WhatsApp o publicar en estados
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category Preset Buttons */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
                    Tipo de Campaña:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'combo', label: '🥪 Combo Desayuno', desc: 'Queso + Jamón + Harina' },
                      { id: 'oferta_relampago', label: '⚡ Oferta Relámpago', desc: 'Rebaja por 48h' },
                      { id: 'fin_de_semana', label: '🥓 Picada & Parrilla', desc: 'Finde con amigos' },
                      { id: 'tasa_especial', label: '💵 Divisa Efectivo', desc: 'Incentivo de pago $' },
                      { id: 'descuento', label: '🏷️ Descuento Especial', desc: 'Precio de oportunidad' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCampaignCategory(cat.id as any);
                          const generated = generateAICopyPromotion(cat.id, products, settings, {
                            customType: cat.id as any,
                            targetProductId: selectedCampaignProductId,
                            tone: selectedCampaignTone,
                          });
                          setActivePromoDraft(generated);
                        }}
                        className={`p-2.5 rounded-2xl text-left border transition cursor-pointer ${
                          selectedCampaignCategory === cat.id
                            ? 'bg-rose-950/60 border-rose-500 text-white shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold text-xs block">{cat.label}</span>
                        <span className="text-[10px] text-slate-400">{cat.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone & Product Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Producto Protagónico:
                    </label>
                    <select
                      value={selectedCampaignProductId}
                      onChange={(e) => {
                        setSelectedCampaignProductId(e.target.value);
                        const generated = generateAICopyPromotion(selectedCampaignCategory, products, settings, {
                          customType: selectedCampaignCategory,
                          targetProductId: e.target.value,
                          tone: selectedCampaignTone,
                        });
                        setActivePromoDraft(generated);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.emoji} {p.name} (${p.priceUSD.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Tono del Copywriter:
                    </label>
                    <select
                      value={selectedCampaignTone}
                      onChange={(e) => {
                        const tone = e.target.value as any;
                        setSelectedCampaignTone(tone);
                        const generated = generateAICopyPromotion(selectedCampaignCategory, products, settings, {
                          customType: selectedCampaignCategory,
                          targetProductId: selectedCampaignProductId,
                          tone,
                        });
                        setActivePromoDraft(generated);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="persuasivo">🔥 Persuasivo & Urgente</option>
                      <option value="familiar">🧀 Sabor & Tradición Familiar</option>
                      <option value="gourmet">💎 Gourmet & Calidad Suprema</option>
                      <option value="relampago">⚡ Liquidación Rápida</option>
                    </select>
                  </div>
                </div>

                {/* Generated Copy Preview Card */}
                {activePromoDraft && (
                  <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-400">
                          Copy Listo para Difusión por WhatsApp
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {activePromoDraft.discountOrPrice || formatUSD(activePromoDraft.estimatedPriceUSD || 0)}
                      </span>
                    </div>

                    {/* WhatsApp Bubble Style Preview */}
                    <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-4 text-xs font-sans text-slate-100 whitespace-pre-line leading-relaxed selection:bg-emerald-600">
                      {activePromoDraft.bodyWhatsApp}
                    </div>

                    {/* Short social copy */}
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                      <span className="font-bold text-purple-300 block mb-0.5">
                        📱 Copy Corto (Estados de WhatsApp / Instagram):
                      </span>
                      {activePromoDraft.shortSocialCopy}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activePromoDraft.bodyWhatsApp);
                          setCopiedPromo(true);
                          setTimeout(() => setCopiedPromo(false), 2500);
                          onShowToast('📋 Copy publicitario copiado al portapapeles.');
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {copiedPromo ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPromo ? '¡Copiado!' : 'Copiar Texto'}</span>
                      </button>

                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(activePromoDraft.bodyWhatsApp)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/40"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Transmitir en WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          if (onSaveSettings) {
                            const currentPromos = settings.promotions || [];
                            const exists = currentPromos.some((p) => p.id === activePromoDraft.id || p.title === activePromoDraft.title);
                            const updatedPromos = exists
                              ? currentPromos.map((p) => (p.id === activePromoDraft.id ? activePromoDraft : p))
                              : [activePromoDraft, ...currentPromos];
                            onSaveSettings({ ...settings, promotions: updatedPromos });
                            onShowToast(`💾 Promoción "${activePromoDraft.title}" guardada.`);
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Guardar en Mis Campañas</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: PERSONALIZADOR DE MENSAJES DEL SISTEMA (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-purple-400" />
                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-white">
                        Mensajes Automáticos del Sistema
                      </h4>
                      <p className="text-xs text-slate-400">
                        Edita las plantillas para facturas y cobranza
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-Switch: Agradecimiento vs Recordatorio */}
                <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCopyTemplateType('thank_you')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      copyTemplateType === 'thank_you'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🧾 Agradecimiento Factura
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyTemplateType('reminder')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      copyTemplateType === 'reminder'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📋 Recordatorio de Fiados
                  </button>
                </div>

                {/* Tone Preset Selectors */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    Presets de Tono Estratégico:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {copyTemplateType === 'thank_you' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setThankYouText(THANK_YOU_TONE_PRESETS.calido);
                            onShowToast('Tono Cálido & Familiar seleccionado.');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950 border border-slate-800 text-slate-300 text-[11px] font-semibold text-left transition"
                        >
                          🥰 Cálido & Familiar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setThankYouText(THANK_YOU_TONE_PRESETS.dinamico);
                            onShowToast('Tono Ejecutivo & Rápido seleccionado.');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950 border border-slate-800 text-slate-300 text-[11px] font-semibold text-left transition"
                        >
                          ⚡ Ejecutivo Corto
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setThankYouText(THANK_YOU_TONE_PRESETS.fidelis);
                            onShowToast('Tono Fidelis VIP seleccionado.');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950 border border-slate-800 text-slate-300 text-[11px] font-semibold text-left transition"
                        >
                          ⭐ Fidelis VIP
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setThankYouText(THANK_YOU_TONE_PRESETS.gourmet);
                            onShowToast('Tono Charcutero Gourmet seleccionado.');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950 border border-slate-800 text-slate-300 text-[11px] font-semibold text-left transition"
                        >
                          🍷 Selección Gourmet
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setReminderText(REMINDER_TONE_PRESETS.cordial);
                            onShowToast('Tono Cordial & Amigable seleccionado.');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950 border border-slate-800 text-slate-300 text-[11px] font-semibold text-left transition"
                        >
                          🤝 Cordial & Suave
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReminderText(REMINDER_TONE_PRESETS.asertivo);
                            onShowToast('Tono Comercial Asertivo seleccionado.');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950 border border-slate-800 text-slate-300 text-[11px] font-semibold text-left transition"
                        >
                          💼 Comercial Asertivo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReminderText(REMINDER_TONE_PRESETS.urgente);
                            onShowToast('Tono Prioritario Urgente seleccionado.');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950 border border-slate-800 text-slate-300 text-[11px] font-semibold text-left transition"
                        >
                          ⏰ Prioritario Urgente
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReminderText(REMINDER_TONE_PRESETS.efectivo);
                            onShowToast('Tono Incentivo Efectivo seleccionado.');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950 border border-slate-800 text-slate-300 text-[11px] font-semibold text-left transition"
                        >
                          💵 Incentivo en Dólar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Variable Pills */}
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">
                    Variables disponibles (haz clic para insertar):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(copyTemplateType === 'thank_you'
                      ? ['{cliente}', '{negocio}', '{factura}', '{fecha}', '{totalUSD}', '{totalVES}', '{metodoPago}', '{fidelis}']
                      : ['{cliente}', '{negocio}', '{totalUSD}', '{totalVES}', '{comprasPendientes}', '{pagoMovil}']
                    ).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (copyTemplateType === 'thank_you') {
                            setThankYouText((prev) => `${prev} ${tag}`);
                          } else {
                            setReminderText((prev) => `${prev} ${tag}`);
                          }
                        }}
                        className="px-2 py-0.5 rounded-md bg-purple-950/80 hover:bg-purple-900 border border-purple-800/60 text-purple-300 text-[10px] font-mono transition cursor-pointer"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <textarea
                    rows={8}
                    value={copyTemplateType === 'thank_you' ? thankYouText : reminderText}
                    onChange={(e) => {
                      if (copyTemplateType === 'thank_you') {
                        setThankYouText(e.target.value);
                      } else {
                        setReminderText(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500 leading-relaxed"
                  />
                </div>

                {/* Save & Reset Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (copyTemplateType === 'thank_you') {
                        setThankYouText(DEFAULT_THANK_YOU_TEMPLATE);
                        if (onSaveSettings) {
                          onSaveSettings({ ...settings, customThankYouTemplate: undefined });
                        }
                        onShowToast('Mensaje de agradecimiento restablecido al valor inicial.');
                      } else {
                        setReminderText(DEFAULT_REMINDER_TEMPLATE);
                        if (onSaveSettings) {
                          onSaveSettings({ ...settings, customReminderTemplate: undefined });
                        }
                        onShowToast('Mensaje de recordatorio restablecido al valor inicial.');
                      }
                    }}
                    className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Restaurar Predeterminado
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onSaveSettings) {
                        if (copyTemplateType === 'thank_you') {
                          onSaveSettings({ ...settings, customThankYouTemplate: thankYouText });
                          onShowToast('✅ Plantilla de Agradecimiento guardada como activa.');
                        } else {
                          onSaveSettings({ ...settings, customReminderTemplate: reminderText });
                          onShowToast('✅ Plantilla de Recordatorio guardada como activa.');
                        }
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/40"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar Plantilla Activa</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE PROMOTIONS DIRECTORY */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BadgePercent className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-white">
                    Campañas & Promociones Guardadas ({settings.promotions?.length || 0})
                  </h4>
                  <p className="text-xs text-slate-400">
                    Biblioteca de copys publicitarios listos para difundir por WhatsApp
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(settings.promotions || []).map((promo) => (
                <div
                  key={promo.id}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800/60">
                        {promo.category.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {promo.discountOrPrice || formatUSD(promo.estimatedPriceUSD || 0)}
                      </span>
                    </div>
                    <h5 className="font-bold text-sm text-white">{promo.title}</h5>
                    <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-line">
                      {promo.bodyWhatsApp}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(promo.bodyWhatsApp);
                        onShowToast(`📋 Copiado copy de "${promo.title}".`);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(promo.bodyWhatsApp)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          if (onSaveSettings) {
                            const filtered = (settings.promotions || []).filter((p) => p.id !== promo.id);
                            onSaveSettings({ ...settings, promotions: filtered });
                            onShowToast(`Eliminada promoción "${promo.title}".`);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                        title="Eliminar campaña"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: REPORTES EJECUTIVOS P&L & AUDITORÍA */}
      {activeSubTab === 'reports' && (
        <div className="space-y-6">
          {/* Controls Bar: Type + Window Days + Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400">Tipo de Reporte:</span>
              <button
                type="button"
                onClick={() => setSelectedReportType('financial')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedReportType === 'financial'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Financiero (P&L)
              </button>

              <button
                type="button"
                onClick={() => setSelectedReportType('demand')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedReportType === 'demand'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Demanda y Rotación
              </button>

              <button
                type="button"
                onClick={() => setSelectedReportType('debtors')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedReportType === 'debtors'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Libro de Fiados
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
              {selectedReportType !== 'debtors' && (
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                  <span className="text-slate-400 pl-2">Período:</span>
                  {[
                    { days: 1, label: 'Hoy' },
                    { days: 7, label: '7D' },
                    { days: 30, label: '30D' },
                    { days: 90, label: '90D' },
                  ].map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setReportWindowDays(p.days)}
                      className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                        reportWindowDays === p.days
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleCopyReport}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                {copiedReport ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReport ? '¡Copiado!' : 'Copiar para WhatsApp'}</span>
              </button>
            </div>
          </div>

          {/* Report Sheet Presentation */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono text-purple-400 block uppercase tracking-wider">
                  Reporte Generado por Inteligencia Artificial
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white">{activeReport.title}</h3>
                <span className="text-xs text-slate-400">
                  {settings.businessName} • Fecha de emisión: {activeReport.generatedAt}
                </span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {activeReport.metrics.map((m, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1"
                >
                  <span className="text-[11px] text-slate-400 font-semibold block">{m.label}</span>
                  <div className="text-base sm:text-xl font-mono font-black text-white">
                    {m.valueUSD}
                  </div>
                  {m.valueVES && (
                    <div className="text-[11px] font-mono text-slate-400">
                      ≈ {m.valueVES}
                    </div>
                  )}
                  {m.changeText && (
                    <div className="text-[10px] text-purple-300 font-medium">
                      {m.changeText}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sections Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeReport.sections.map((sec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800/60 space-y-2 text-xs"
                >
                  <h4 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-1.5">
                    {sec.title}
                  </h4>
                  <ul className="space-y-1.5 text-slate-300">
                    {sec.content.map((c, cIdx) => (
                      <li key={cIdx} className="leading-relaxed">
                        • {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Recommendations Box */}
            <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-2 text-xs">
              <span className="font-bold text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Recomendaciones Ejecutivas de la IA:</span>
              </span>
              <ul className="space-y-1 text-slate-200">
                {activeReport.recommendations.map((rec, rIdx) => (
                  <li key={rIdx}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ANÁLISIS DE DEMANDA & REABASTECIMIENTO */}
      {activeSubTab === 'demand' && (
        <div className="space-y-6">
          {/* Executive Demand Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-rose-900/40 rounded-2xl p-4">
              <span className="text-xs text-rose-400 font-semibold block">Crítico (&lt;3 días)</span>
              <span className="text-xl font-mono font-black text-rose-300 mt-1 block">
                {criticalCount} productos
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Riesgo inminente de quiebre</span>
            </div>

            <div className="bg-slate-900 border border-amber-900/40 rounded-2xl p-4">
              <span className="text-xs text-amber-400 font-semibold block">Próximos (3 a 7 días)</span>
              <span className="text-xl font-mono font-black text-amber-300 mt-1 block">
                {warningCount} productos
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Momento ideal de reorden</span>
            </div>

            <div className="bg-slate-900 border border-purple-900/40 rounded-2xl p-4">
              <span className="text-xs text-purple-300 font-semibold block">Presupuesto Sugerido</span>
              <span className="text-xl font-mono font-black text-white mt-1 block">
                {formatUSD(patterns.totalRecommendedPurchaseUSD)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Para 10 días de cobertura</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-xs text-slate-400 font-semibold block">Día Pico de la Semana</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {patterns.peakDaysOfWeek[0]?.dayName || 'Sábado'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Mayor afluencia de clientes
              </span>
            </div>
          </div>

          {/* Predictions Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">
                  Matriz Predictiva de Agotamiento de Inventario
                </h3>
                <p className="text-xs text-slate-400">
                  Calculado con modelo de tasa de consumo ponderada de los últimos 30 días.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
              {predictions.map((p) => {
                const isCrit = p.urgencyLevel === 'critical';
                const isWarn = p.urgencyLevel === 'warning';
                return (
                  <div
                    key={p.productId}
                    className={`p-3.5 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      isCrit
                        ? 'bg-rose-950/20 border-rose-600/40'
                        : isWarn
                        ? 'bg-amber-950/20 border-amber-500/30'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl shrink-0">
                        {p.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-white truncate">{p.productName}</h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isCrit
                                ? 'bg-rose-900/60 text-rose-300'
                                : isWarn
                                ? 'bg-amber-900/60 text-amber-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {p.currentStock <= 0 ? 'Agotado' : `${p.daysOfStockLeft} días de stock`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{p.reasoning}</p>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-1">
                          <span>Stock: <strong className="text-white">{formatQuantity(p.currentStock, p.unit)}</strong></span>
                          <span>Salida: <strong className="text-purple-300">{p.dailySalesRate} {p.unit}/día</strong></span>
                          {p.suggestedSupplier && (
                            <span>Prov: <strong className="text-slate-300">{p.suggestedSupplier.name}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 block">Compra Recomendada:</span>
                      <span className="font-mono font-bold text-sm text-emerald-400">
                        +{formatQuantity(p.suggestedRestockQty, p.unit)}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        ≈ {formatUSD(p.suggestedRestockCostUSD)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ACCIONES RÁPIDAS & CONTROL */}
      {activeSubTab === 'control' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Control de Tasas de Cambio */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">Parámetros de Cambio (Divisas)</h3>
                <p className="text-xs text-slate-400">Control global de conversión monetaria</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block font-semibold">Tasa Oficial BCV</span>
                  <span className="text-base font-mono font-bold text-emerald-400">
                    {formatVES(settings.bcvRate)} Bs.
                  </span>
                </div>
                {isBcvEditing ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={tempBcvInput}
                      onChange={(e) => setTempBcvInput(e.target.value)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white text-right focus:outline-rose-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseFloat(tempBcvInput.replace(',', '.'));
                        if (!isNaN(parsed) && parsed > 0) {
                          onUpdateBcvRate(parsed);
                          setIsBcvEditing(false);
                          onShowToast(`✅ Tasa BCV actualizada a ${formatVES(parsed)} Bs.`);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs cursor-pointer"
                      title="Guardar"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempBcvInput(settings.bcvRate.toString());
                        setIsBcvEditing(false);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTempBcvInput(settings.bcvRate.toString());
                      setIsBcvEditing(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer"
                  >
                    Cambiar Tasa BCV
                  </button>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block font-semibold">Tasa Preferencial Divisa</span>
                  <span className="text-base font-mono font-bold text-amber-400">
                    {formatVES(settings.preferentialRate || settings.bcvRate)} Bs.
                  </span>
                </div>
                {isPrefRateEditing ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={tempPrefInput}
                      onChange={(e) => setTempPrefInput(e.target.value)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white text-right focus:outline-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (onUpdatePreferentialRate) {
                          const parsed = parseFloat(tempPrefInput.replace(',', '.'));
                          if (!isNaN(parsed) && parsed > 0) {
                            onUpdatePreferentialRate(parsed);
                            setIsPrefRateEditing(false);
                            onShowToast(`✅ Tasa Preferencial actualizada a ${formatVES(parsed)} Bs.`);
                          }
                        }
                      }}
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs cursor-pointer"
                      title="Guardar"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempPrefInput((settings.preferentialRate || settings.bcvRate).toString());
                        setIsPrefRateEditing(false);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTempPrefInput((settings.preferentialRate || settings.bcvRate).toString());
                      setIsPrefRateEditing(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer"
                  >
                    Cambiar Tasa Divisa
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Auditoría Rápida de Fiados */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">Auditoría Rápida de Fiados</h3>
                <p className="text-xs text-slate-400">Cuentas por cobrar en divisa estadounidense</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Deuda Total Activa:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">{formatUSD(totalDebtAllUSD)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Clientes Deudores:</span>
                <span className="font-bold text-white">{debtors.length}</span>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReportType('debtors');
                    setActiveSubTab('reports');
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-amber-500/30"
                >
                  <FileText className="w-4 h-4" />
                  <span>Ver Auditoría Completa de Fiados</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
