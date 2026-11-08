import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Zap,
  Mic,
  MicOff,
  Send,
  X,
  CheckCircle2,
  Check,
  RotateCcw,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Package,
  BookOpen,
  FileText,
  Volume2,
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
  AIChatMessage,
  AIActionProposal,
  processAIChatQuery,
} from '../services/aiAssistantEngine';
import { playSuccessChime, playBeepSound } from '../utils/audioFeedback';

interface GlobalAICopilotProps {
  products: Product[];
  tickets: SaleTicket[];
  debtors: DebtorCustomer[];
  restocks: RestockRecord[];
  expenses: ExpenseRecord[];
  mermas: MermaRecord[];
  settings: AppSettings;
  onExecuteAction: (proposal: AIActionProposal) => void;
  onNavigateToTab: (tab: string) => void;
  onShowToast: (msg: string) => void;
  onSaveSettings: (settings: AppSettings) => void;
}

export const GlobalAICopilot: React.FC<GlobalAICopilotProps> = ({
  products,
  tickets,
  debtors,
  restocks,
  expenses,
  mermas,
  settings,
  onExecuteAction,
  onNavigateToTab,
  onShowToast,
  onSaveSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'init-global-msg',
      sender: 'ai',
      timestamp: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      category: 'general',
      text: `⚡ **Centro de Control Total del Negocio:**\n\nPuedes darme órdenes por texto o voz sobre cualquier parte del sistema:\n• *"Pon la tasa BCV a 64"* • *"Sube el queso llanero a $5.80"*\n• *"Registra gasto de $15 de hielo y bolsas"* • *"Abona $10 a Carmen"*\n• *"Ajusta stock de jamón a 15kg"* • *"Cierre de caja Z"*\n\n${settings.aiAutonomousMode ? '⚡ **Modo Autónomo:** Las órdenes se ejecutan de inmediato.' : '🛡️ **Modo Asistido:** Te mostraré confirmación antes de aplicar.'}`,
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Handle Speech-to-Text via Web Speech API
  const handleToggleVoice = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
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
          setInputMessage(transcript);
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

  // Send message and process AI control command
  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsProcessing(true);

    setTimeout(() => {
      const aiResponse = processAIChatQuery(query, {
        products,
        tickets,
        debtors,
        restocks,
        expenses,
        mermas,
        settings,
      });

      // If autonomous mode is active and proposal is returned, auto-execute
      if (settings.aiAutonomousMode && aiResponse.actionProposal) {
        onExecuteAction(aiResponse.actionProposal);
        aiResponse.actionProposal = {
          ...aiResponse.actionProposal,
          status: 'executed',
        };
        aiResponse.text += `\n\n⚡ **Ejecutado automáticamente en Modo Autónomo.**`;
      }

      setMessages((prev) => [...prev, aiResponse]);
      setIsProcessing(false);
    }, 280);
  };

  // Toggle Autonomous mode
  const handleToggleAutonomous = () => {
    const updatedMode = !settings.aiAutonomousMode;
    onSaveSettings({
      ...settings,
      aiAutonomousMode: updatedMode,
    });
    playSuccessChime();
    onShowToast(
      updatedMode
        ? '⚡ Modo Autónomo ACTIVADO: Las órdenes se aplican al instante.'
        : '🛡️ Modo Asistido ACTIVADO: Se requerirá confirmación de 1 clic.'
    );
  };

  const quickControlChips = [
    '💵 Cambiar tasa BCV',
    '💸 Registrar gasto',
    '📦 Ajustar stock',
    '📋 Abonar a fiado',
    '🏷️ Sube precio del queso',
    '⚖️ Registrar merma',
    '📢 Crear combo arepero',
    '🧾 Cierre de caja Z',
  ];

  return (
    <>
      {/* Floating Trigger Button (Available anywhere in the app) */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl transition transform active:scale-95 cursor-pointer font-bold text-xs sm:text-sm border backdrop-blur-md ${
            isOpen
              ? 'bg-purple-600 text-white border-purple-400 shadow-purple-950/80 ring-2 ring-purple-400/50'
              : 'bg-slate-900/95 text-slate-100 hover:text-white border-purple-500/60 hover:border-purple-400 shadow-slate-950/90'
          }`}
          title="Copiloto de Control Total con IA"
        >
          <div className="relative">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            <span
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                settings.aiAutonomousMode ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
              }`}
            />
          </div>
          <span className="hidden sm:inline">Copiloto IA</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-purple-950 text-purple-300 border border-purple-800">
            {settings.aiAutonomousMode ? '⚡ AUTO' : '🛡️ ASIST'}
          </span>
        </button>
      </div>

      {/* Slide-over Control Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md sm:max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-1.5">
                    <span>Control Total con IA</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-normal bg-purple-950 text-purple-300 border border-purple-700">
                      Omni-Copiloto
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Comandos de voz y texto con acceso a toda la tienda
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Autonomous Mode Toggle */}
                <button
                  type="button"
                  onClick={handleToggleAutonomous}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    settings.aiAutonomousMode
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                  title="Alternar entre Ejecución Inmediata o Confirmación con 1 Clic"
                >
                  <Zap className={`w-3.5 h-3.5 ${settings.aiAutonomousMode ? 'text-amber-400' : ''}`} />
                  <span>{settings.aiAutonomousMode ? 'Auto: ON' : 'Auto: OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  title="Cerrar panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Action Chips */}
            <div className="p-3 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider shrink-0 mr-1">
                Órdenes:
              </span>
              {quickControlChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(chip)}
                  className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-purple-950 hover:text-purple-200 border border-slate-700/60 hover:border-purple-600/50 text-slate-300 text-[11px] whitespace-nowrap transition cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => {
                const isUser = m.sender === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        isUser
                          ? 'bg-purple-600 text-white rounded-br-none shadow-md shadow-purple-950/40'
                          : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75">
                        <span className="font-bold">{isUser ? 'Tú' : 'Copiloto IA'}</span>
                        <span className="font-mono">{m.timestamp}</span>
                      </div>

                      <div className="whitespace-pre-line space-y-1">{m.text}</div>

                      {/* Proposal Action Card (if action pending) */}
                      {m.actionProposal && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-purple-300 font-bold text-xs">
                            <Zap className="w-3.5 h-3.5" />
                            <span>{m.actionProposal.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            {m.actionProposal.description}
                          </p>

                          <div className="pt-1 flex items-center gap-2">
                            {m.actionProposal.status === 'pending' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onExecuteAction(m.actionProposal!);
                                  setMessages((prev) =>
                                    prev.map((msg) =>
                                      msg.id === m.id
                                        ? {
                                            ...msg,
                                            actionProposal: {
                                              ...msg.actionProposal!,
                                              status: 'executed',
                                            },
                                          }
                                        : msg
                                    )
                                  );
                                }}
                                className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Ejecutar Orden Ahora</span>
                              </button>
                            ) : m.actionProposal.status === 'executed' ? (
                              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Orden ejecutada en el sistema</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-purple-400 pl-9">
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                  <span>Procesando orden y actualizando base de datos...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Voice Listening Status Banner */}
            {isListening && (
              <div className="p-2.5 bg-rose-950/80 border-t border-rose-500/40 flex items-center justify-between text-xs text-rose-200 shrink-0 animate-pulse">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span>Escuchando orden por micrófono... Habla ahora.</span>
                </span>
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className="px-2 py-0.5 rounded bg-rose-800 text-[10px] font-bold text-white hover:bg-rose-700"
                >
                  Detener
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0 space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
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
                  placeholder="Escribe o dicta cualquier orden..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                />

                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isProcessing}
                  className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold transition cursor-pointer shrink-0"
                  title="Enviar orden"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {/* Bottom Quick Link to Full AI View */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                <span>Total de productos: {products.length}</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateToTab('ai');
                  }}
                  className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Abrir Centro Completo de IA</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
