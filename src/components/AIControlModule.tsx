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
} from 'lucide-react';
import {
  AppSettings,
  DebtorCustomer,
  ExpenseRecord,
  MermaRecord,
  Product,
  RestockRecord,
  SaleTicket,
} from '../types';
import {
  formatUSD,
  formatVES,
  formatQuantity,
} from '../services/storage';
import {
  AIChatMessage,
  AIExecutiveReport,
  generateFinancialPLReport,
  generateDemandReport,
  generateDebtorsAuditReport,
  processAIChatQuery,
  AIActionProposal,
} from '../services/aiAssistantEngine';
import { calculateAIRestockPredictions, generateAIPatternsReport } from '../services/restockAI';

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
  onShowToast,
  onNavigateToTab,
}) => {
  // Navigation inside AI Module
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'reports' | 'demand' | 'control'>('chat');

  // Chat State
  const [messages, setMessages] = useState<AIChatMessage[]>(() => [
    {
      id: 'welcome-msg',
      sender: 'ai',
      timestamp: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      category: 'general',
      text: `👋 ¡Hola! Soy tu **Copiloto de Inteligencia Artificial** con control y monitoreo total de **${settings.businessName}**.\n\nTengo acceso a todos los datos en tiempo real de la tienda (inventario, ventas, libro de fiados, compras, egresos y tasas de cambio).\n\n¿En qué deseas que trabajemos hoy? Puedes preguntarme sobre la **demanda**, pedirme **reportes financieros**, consultar **deudores**, o pedirme que **ajuste parámetros** como la tasa BCV.`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Reports State
  const [selectedReportType, setSelectedReportType] = useState<'financial' | 'demand' | 'debtors'>('financial');
  const [reportWindowDays, setReportWindowDays] = useState<number>(30);
  const [copiedReport, setCopiedReport] = useState(false);

  // Quick prompt chips
  const quickChips = [
    '¿Qué productos tienen mayor demanda y se van a agotar primero?',
    'Generar reporte financiero de ganancias y utilidades',
    '¿Quiénes nos deben en el libro de fiados?',
    '¿Cuáles son los días pico de venta y qué productos comprar?',
    'Ajustar la tasa oficial BCV',
  ];

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setMessages((prev) => [...prev, response]);
      setIsProcessing(false);
    }, 300);
  };

  // Execute Action Proposed by AI
  const handleExecuteAction = (proposal: AIActionProposal) => {
    try {
      if (proposal.type === 'set_bcv_rate') {
        onUpdateBcvRate(proposal.payload.newRate);
        onShowToast(`✅ Tasa BCV actualizada a ${formatVES(proposal.payload.newRate)} Bs.`);
      } else if (proposal.type === 'set_pref_rate' && onUpdatePreferentialRate) {
        onUpdatePreferentialRate(proposal.payload.newRate);
        onShowToast(`✅ Tasa Preferencial de Divisas actualizada a ${formatVES(proposal.payload.newRate)} Bs.`);
      } else if (proposal.type === 'open_reminder') {
        if (proposal.payload.url) {
          window.open(proposal.payload.url, '_blank');
          onShowToast(`📲 Abriendo WhatsApp para ${proposal.payload.debtorName || 'el cliente'}...`);
        }
      } else if (proposal.type === 'navigate_tab' && onNavigateToTab) {
        onNavigateToTab(proposal.payload.tab);
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
          {/* Quick Prompts Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 border-b border-slate-800 no-scrollbar shrink-0">
            <span className="text-[11px] font-semibold text-purple-400 shrink-0 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>Preguntas rápidas:</span>
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

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="pt-3 border-t border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              placeholder="Pregúntale a la IA sobre demanda, ganancias, deudas o pide un cambio (ej: '¿Qué queso se agota primero?', 'Cambia la tasa BCV a 82')..."
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
                <button
                  type="button"
                  onClick={() => {
                    const val = prompt('Ingresa la nueva Tasa Oficial BCV (ej: 82.50):', settings.bcvRate.toString());
                    if (val) {
                      const parsed = parseFloat(val.replace(',', '.'));
                      if (!isNaN(parsed) && parsed > 0) {
                        onUpdateBcvRate(parsed);
                        onShowToast(`✅ Tasa BCV actualizada a ${formatVES(parsed)} Bs.`);
                      }
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer"
                >
                  Cambiar Tasa BCV
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block font-semibold">Tasa Preferencial Divisa</span>
                  <span className="text-base font-mono font-bold text-amber-400">
                    {formatVES(settings.preferentialRate || settings.bcvRate)} Bs.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdatePreferentialRate) {
                      const val = prompt('Ingresa la Tasa Preferencial de Efectivo Divisa (ej: 85.00):', (settings.preferentialRate || settings.bcvRate).toString());
                      if (val) {
                        const parsed = parseFloat(val.replace(',', '.'));
                        if (!isNaN(parsed) && parsed > 0) {
                          onUpdatePreferentialRate(parsed);
                          onShowToast(`✅ Tasa Preferencial actualizada a ${formatVES(parsed)} Bs.`);
                        }
                      }
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer"
                >
                  Cambiar Tasa Divisa
                </button>
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
