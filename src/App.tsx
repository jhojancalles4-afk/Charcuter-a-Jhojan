import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppSettings, ExpenseRecord, FidelisCustomerProfile, MermaRecord, Product, RestockRecord, SaleTicket } from './types';
import {
  loadProducts,
  saveProducts,
  loadSettings,
  saveSettings,
  loadTickets,
  saveTickets,
  loadExpenses,
  saveExpenses,
  loadRestocks,
  saveRestocks,
  loadMermas,
  saveMermas,
  addAbonoToRestock,
  getDebtorsSummary,
} from './services/storage';
import {
  loadFidelisProfiles,
  recordFidelisSale,
  claimFidelisReward,
  revertFidelisSale,
  updateFidelisCustomerProfile,
  deleteFidelisCustomerProfile,
} from './services/fidelis';
import { INITIAL_EXPENSES, INITIAL_PRODUCTS, INITIAL_SETTINGS, INITIAL_TICKETS } from './data/initialData';
import { Header } from './components/Header';
import { POSModule } from './components/POSModule';
import { TicketsHistoryModule } from './components/TicketsHistoryModule';
import { FiadosModule } from './components/FiadosModule';
import { RestockModule } from './components/RestockModule';
import { InventoryModule } from './components/InventoryModule';
import { SettingsModule } from './components/SettingsModule';
import { AIControlModule } from './components/AIControlModule';
import { GlobalAICopilot } from './components/GlobalAICopilot';
import { FidelisDirectoryModal } from './components/FidelisDirectoryModal';
import { GoogleBackupModal } from './components/GoogleBackupModal';
import { MermaAdjustmentModal } from './components/MermaAdjustmentModal';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { voidOrDeleteTicket } from './services/storage';
import { AIActionProposal } from './services/aiAssistantEngine';
import { playSuccessChime } from './utils/audioFeedback';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'pos' | 'tickets' | 'fiados' | 'restocks' | 'inventory' | 'settings' | 'ai'
  >(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      if (
        tabParam === 'pos' ||
        tabParam === 'tickets' ||
        tabParam === 'fiados' ||
        tabParam === 'restocks' ||
        tabParam === 'inventory' ||
        tabParam === 'settings' ||
        tabParam === 'ai'
      ) {
        return tabParam;
      }
    }
    return 'pos';
  });
  const [products, setProducts] = useState<Product[]>(() => loadProducts());
  const [tickets, setTickets] = useState<SaleTicket[]>(() => loadTickets());
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => loadExpenses());
  const [restocks, setRestocks] = useState<RestockRecord[]>(() => loadRestocks());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [mermas, setMermas] = useState<MermaRecord[]>(() => loadMermas());
  const [fidelisProfiles, setFidelisProfiles] = useState<Record<string, FidelisCustomerProfile>>(() =>
    loadFidelisProfiles()
  );
  const [isGoogleBackupModalOpen, setIsGoogleBackupModalOpen] = useState(false);
  const [isGlobalFidelisOpen, setIsGlobalFidelisOpen] = useState(false);
  const [isMermaModalOpen, setIsMermaModalOpen] = useState(false);
  const [mermaPreselectedProduct, setMermaPreselectedProduct] = useState<Product | null>(null);
  const [inventorySearchQuery, setInventorySearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync across tabs or storage events
  useEffect(() => {
    const handleStorageSync = (e: any) => {
      if (e.detail?.type === 'products') setProducts(loadProducts());
      if (e.detail?.type === 'tickets') setTickets(loadTickets());
      if (e.detail?.type === 'expenses') setExpenses(loadExpenses());
      if (e.detail?.type === 'restocks') setRestocks(loadRestocks());
      if (e.detail?.type === 'settings') setSettings(loadSettings());
      if (e.detail?.type === 'mermas') setMermas(loadMermas());
      if (e.detail?.type === 'fidelis') setFidelisProfiles(loadFidelisProfiles());
      if (e.detail?.type === 'all') {
        setProducts(loadProducts());
        setTickets(loadTickets());
        setExpenses(loadExpenses());
        setRestocks(loadRestocks());
        setSettings(loadSettings());
        setMermas(loadMermas());
        setFidelisProfiles(loadFidelisProfiles());
      }
    };

    const handleNativeStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('jhojan_pos_')) {
        setProducts(loadProducts());
        setTickets(loadTickets());
        setExpenses(loadExpenses());
        setRestocks(loadRestocks());
        setSettings(loadSettings());
        setMermas(loadMermas());
        setFidelisProfiles(loadFidelisProfiles());
      }
    };

    window.addEventListener('jhojan_pos_sync', handleStorageSync);
    window.addEventListener('storage', handleNativeStorage);
    return () => {
      window.removeEventListener('jhojan_pos_sync', handleStorageSync);
      window.removeEventListener('storage', handleNativeStorage);
    };
  }, []);

  // Save changes to localStorage whenever state changes
  const handleUpdateProducts = useCallback((newProducts: Product[]) => {
    setProducts(newProducts);
    saveProducts(newProducts);
  }, []);

  const handleUpdateTickets = useCallback((newTickets: SaleTicket[]) => {
    setTickets(newTickets);
    saveTickets(newTickets);
  }, []);

  const handleSaveSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  // Update BCV rate directly
  const handleUpdateBcvRate = useCallback((newRate: number) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        bcvRate: newRate,
        bcvLastUpdated: new Date().toISOString(),
      };
      saveSettings(updated);
      return updated;
    });
    showToast(`Tasa BCV actualizada a Bs. ${newRate.toFixed(2)} / USD`);
  }, []);

  // Update Preferential Rate for cash USD
  const handleUpdatePreferentialRate = useCallback((newRate: number) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        preferentialRate: newRate,
      };
      saveSettings(updated);
      return updated;
    });
    showToast(`Renglón Tasa Preferencial Efectivo actualizada a Bs. ${newRate.toFixed(2)} / USD`);
  }, []);

  // Handle Voiding or Deleting Bad Invoices ("Al eliminar la factura se elimina el sello")
  const handleDeleteTicket = useCallback(
    (ticketId: string, deletePermanently: boolean, reason: string) => {
      const targetTicket = tickets.find((t) => t.id === ticketId);
      const wasAlreadyVoided = targetTicket?.isVoided;

      const result = voidOrDeleteTicket(ticketId, deletePermanently, reason, tickets, products);
      setTickets(result.updatedTickets);
      saveTickets(result.updatedTickets);
      if (result.updatedProducts) {
        setProducts(result.updatedProducts);
        saveProducts(result.updatedProducts);
      }

      // Revertir el sello Fidelis al eliminar o anular la factura
      let fidelisNotice = '';
      if (targetTicket && !wasAlreadyVoided) {
        const revertResult = revertFidelisSale(targetTicket, fidelisProfiles);
        setFidelisProfiles(revertResult.updatedProfiles);
        if (revertResult.removedStamp && revertResult.updatedProfile) {
          fidelisNotice = ` Se eliminó 1 sello Fidelis de ${revertResult.updatedProfile.customerName}.`;
        }
      }

      if (deletePermanently) {
        showToast(`Ticket eliminado permanentemente y stock reintegrado.${fidelisNotice}`);
      } else {
        showToast(`Ticket anulado como factura mala y stock reintegrado.${fidelisNotice}`);
      }
    },
    [tickets, products, fidelisProfiles]
  );

  // Handle batch invoices loaded / imported with stamps credited
  const handleTicketsImported = useCallback((updatedTickets: SaleTicket[], message: string) => {
    setTickets(updatedTickets);
    setFidelisProfiles(loadFidelisProfiles());
    showToast(message);
  }, []);

  // Add a new expense
  const handleAddExpense = useCallback((newExpenseData: Omit<ExpenseRecord, 'id' | 'expenseNumber'>) => {
    setExpenses((prev) => {
      const nextNum = (prev[0]?.expenseNumber || 100) + 1;
      const expense: ExpenseRecord = {
        ...newExpenseData,
        id: `EXP-${Date.now()}`,
        expenseNumber: nextNum,
      };
      const updated = [expense, ...prev];
      saveExpenses(updated);
      return updated;
    });
    showToast('Egreso registrado exitosamente.');
  }, []);

  // Delete an expense
  const handleDeleteExpense = useCallback((expenseId: string) => {
    setExpenses((prev) => {
      const updated = prev.filter((e) => e.id !== expenseId);
      saveExpenses(updated);
      return updated;
    });
    showToast('Egreso eliminado.');
  }, []);

  // Update restocks
  const handleUpdateRestocks = useCallback((newRestocks: RestockRecord[]) => {
    setRestocks(newRestocks);
    saveRestocks(newRestocks);
  }, []);

  // Update mermas
  const handleUpdateMermas = useCallback((newMermas: MermaRecord[]) => {
    setMermas(newMermas);
    saveMermas(newMermas);
  }, []);

  // Open Merma Adjustment Modal (with optional preselected product)
  const handleOpenMermaModal = useCallback((product?: Product) => {
    setMermaPreselectedProduct(product || null);
    setIsMermaModalOpen(true);
  }, []);

  // Make an abono to a supplier restock account
  const handleAbonoToRestock = useCallback(
    (
      restockId: string,
      amountUSD: number,
      method: 'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia',
      reference?: string,
      notes?: string
    ) => {
      try {
        const result = addAbonoToRestock(
          restockId,
          amountUSD,
          method,
          reference || '',
          notes || '',
          restocks,
          expenses,
          settings
        );
        setRestocks(result.updatedRestocks);
        setExpenses(result.updatedExpenses);
        showToast(`Abono a proveedor registrado con éxito ($${amountUSD.toFixed(2)} USD).`);
      } catch (err: any) {
        showToast(`Error: ${err?.message || 'No se pudo registrar el abono'}`);
      }
    },
    [restocks, expenses, settings]
  );

  // Calculate Debtors metrics for Header badge
  const debtorsSummary = useMemo(() => {
    return getDebtorsSummary(tickets, settings.bcvRate);
  }, [tickets, settings.bcvRate]);

  const totalDebtUSD = useMemo(() => {
    return debtorsSummary.reduce((sum, d) => sum + d.totalDebtUSD, 0);
  }, [debtorsSummary]);

  // Calculate pending supplier debt count
  const pendingSuppliersCount = useMemo(() => {
    return restocks.filter((r) => r.paymentCondition === 'credito' && !r.isPaid && r.pendingUSD > 0.001).length;
  }, [restocks]);

  // Unique customer directory for POS auto-complete
  const existingCustomers = useMemo(() => {
    const map = new Map<string, { name: string; cedula: string; phone: string }>();
    for (const t of tickets) {
      if (t.customerName && t.customerName !== 'Consumidor Final') {
        const key = (t.customerPhone || t.customerCedula || t.customerName).trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: t.customerName,
            cedula: t.customerCedula,
            phone: t.customerPhone,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [tickets]);

  // Handle Fidelis Reward Claiming
  const handleClaimFidelisReward = useCallback(
    (customerId: string, rewardType: 'stamps' | 'highValue') => {
      const result = claimFidelisReward(customerId, rewardType, fidelisProfiles);
      if (result.success && result.claimedProfile) {
        setFidelisProfiles(result.updatedProfiles);
        showToast(
          rewardType === 'stamps'
            ? `🎁 ¡Recompensa de 10 Sellos canjeada para ${result.claimedProfile.customerName}!`
            : `👑 ¡Recompensa VIP Fidelis Oro canjeada para ${result.claimedProfile.customerName}!`
        );
      }
    },
    [fidelisProfiles]
  );

  // Count how many customers have unlocked rewards ready to claim
  const fidelisRewardsReadyCount = useMemo(() => {
    return (Object.values(fidelisProfiles) as FidelisCustomerProfile[]).filter(
      (p) => p.stampsCount >= 10 || p.highValueCount >= 4
    ).length;
  }, [fidelisProfiles]);

  // Handle POS Sale completion
  const handleCompleteSale = useCallback(
    (newTicket: SaleTicket, updatedProducts: Product[]) => {
      // 1. Update tickets
      const nextTickets = [newTicket, ...tickets];
      setTickets(nextTickets);
      saveTickets(nextTickets);

      // 2. Update product stock
      setProducts(updatedProducts);
      saveProducts(updatedProducts);

      // 3. Increment ticket counter in settings
      setSettings((prev) => {
        const nextSettings = {
          ...prev,
          ticketCounter: prev.ticketCounter + 1,
        };
        saveSettings(nextSettings);
        return nextSettings;
      });

      // 4. Update Fidelis loyalty profile & stamps
      const fidelisResult = recordFidelisSale(newTicket, fidelisProfiles);
      if (fidelisResult.updatedProfile) {
        setFidelisProfiles(fidelisResult.updatedProfiles);
        if (fidelisResult.unlockedStampsReward) {
          showToast(
            `🎁 ¡${fidelisResult.updatedProfile.customerName} completó la meta de 10 sellos Fidelis! Premio desbloqueado.`
          );
        } else if (fidelisResult.unlockedHighValueReward) {
          showToast(
            `👑 ¡${fidelisResult.updatedProfile.customerName} completó 4 compras VIP (≥$18 USD) Fidelis! Premio desbloqueado.`
          );
        }
      }

      if (newTicket.paymentMethod === 'fiado') {
        showToast(
          `Venta Fiada registrada para ${newTicket.customerName} (Ticket #${newTicket.ticketNumber})`
        );
      } else {
        showToast(`Ticket #${newTicket.ticketNumber} completado exitosamente`);
      }
    },
    [tickets, fidelisProfiles]
  );

  // Navigate directly to Inventory (e.g. when product is out of stock in POS)
  const handleNavigateToInventory = (product?: Product) => {
    if (product) {
      setInventorySearchQuery(product.name);
    }
    setActiveTab('inventory');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Central Dispatcher for Total AI Control Actions
  const handleExecuteAIAction = useCallback(
    (proposal: AIActionProposal) => {
      try {
        if (proposal.type === 'set_bcv_rate') {
          handleUpdateBcvRate(proposal.payload.newRate);
        } else if (proposal.type === 'set_pref_rate') {
          handleUpdatePreferentialRate(proposal.payload.newRate);
        } else if (proposal.type === 'toggle_autonomous_mode') {
          handleSaveSettings({ ...settings, aiAutonomousMode: proposal.payload.enabled });
          playSuccessChime();
          showToast(proposal.payload.enabled ? '⚡ Modo Autónomo ACTIVADO: Ejecución directa' : '🛡️ Modo Asistido ACTIVADO');
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
          handleUpdateProducts([newProduct, ...products]);
          playSuccessChime();
          showToast(`✅ Producto "${newProduct.name}" creado con ${newProduct.stock} ${newProduct.unit}.`);
        } else if (proposal.type === 'update_product_price') {
          const nextProducts = products.map((p) =>
            p.id === proposal.payload.productId ? { ...p, priceUSD: proposal.payload.newPriceUSD } : p
          );
          handleUpdateProducts(nextProducts);
          playSuccessChime();
          showToast(`✅ Precio de "${proposal.payload.productName}" actualizado a $${proposal.payload.newPriceUSD.toFixed(2)}.`);
        } else if (proposal.type === 'update_product_stock') {
          const nextProducts = products.map((p) =>
            p.id === proposal.payload.productId ? { ...p, stock: proposal.payload.newStock } : p
          );
          handleUpdateProducts(nextProducts);
          playSuccessChime();
          showToast(`✅ Stock de "${proposal.payload.productName}" fijado en ${proposal.payload.newStock}.`);
        } else if (proposal.type === 'add_expense') {
          handleAddExpense(proposal.payload);
          playSuccessChime();
        } else if (proposal.type === 'register_abono_fiado') {
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
          handleUpdateTickets(nextTickets);
          playSuccessChime();
          showToast(`✅ Abono de $${proposal.payload.amountUSD.toFixed(2)} registrado para ${proposal.payload.debtorName}.`);
        } else if (proposal.type === 'register_merma') {
          const targetProd = products.find((p) => p.id === proposal.payload.productId);
          if (targetProd) {
            const nextProducts = products.map((p) =>
              p.id === targetProd.id ? { ...p, stock: Math.max(0, p.stock - proposal.payload.quantity) } : p
            );
            handleUpdateProducts(nextProducts);
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
            handleUpdateMermas([newMerma, ...mermas]);
            playSuccessChime();
            showToast(`✅ Merma de ${proposal.payload.quantity} ${targetProd.unit} registrada.`);
          }
        } else if (proposal.type === 'execute_cierre_z') {
          setActiveTab('tickets');
          playSuccessChime();
          showToast(`🧾 Navegando a Cierre de Caja y Reportes Z.`);
        } else if (proposal.type === 'open_backup') {
          setIsGoogleBackupModalOpen(true);
          playSuccessChime();
        } else if (proposal.type === 'update_reminder_template') {
          handleSaveSettings({
            ...settings,
            customReminderTemplate: proposal.payload.newTemplate,
            reminderTone: proposal.payload.tone || settings.reminderTone,
          });
          playSuccessChime();
          showToast(`✅ Plantilla de recordatorio de cobranza actualizada.`);
        } else if (proposal.type === 'update_thank_you_template') {
          handleSaveSettings({
            ...settings,
            customThankYouTemplate: proposal.payload.newTemplate,
            thankYouTone: proposal.payload.tone || settings.thankYouTone,
          });
          playSuccessChime();
          showToast(`✅ Plantilla de agradecimiento actualizada.`);
        } else if (proposal.type === 'save_promotion') {
          const promo = proposal.payload.promotion;
          const currentPromos = settings.promotions || [];
          const existsIndex = currentPromos.findIndex((p) => p.id === promo.id || p.title === promo.title);
          const updatedPromos = existsIndex >= 0
            ? currentPromos.map((p, idx) => (idx === existsIndex ? promo : p))
            : [promo, ...currentPromos];
          handleSaveSettings({ ...settings, promotions: updatedPromos });
          playSuccessChime();
          showToast(`📢 Promoción "${promo.title}" guardada.`);
        } else if (proposal.type === 'share_promotion') {
          const textToShare = proposal.payload.bodyWhatsApp;
          navigator.clipboard?.writeText(textToShare);
          const link = document.createElement('a');
          link.href = `https://wa.me/?text=${encodeURIComponent(textToShare)}`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.click();
          playSuccessChime();
          showToast(`📲 Transmitiendo promoción por WhatsApp...`);
        } else if (proposal.type === 'open_reminder') {
          if (proposal.payload.url) {
            const link = document.createElement('a');
            link.href = proposal.payload.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.click();
            playSuccessChime();
            showToast(`📲 Abriendo WhatsApp para ${proposal.payload.debtorName || 'el cliente'}...`);
          }
        } else if (proposal.type === 'navigate_tab') {
          setActiveTab(proposal.payload.tab);
          playSuccessChime();
        }
      } catch (err: any) {
        showToast(`❌ Error: ${err.message || 'Error al ejecutar acción'}`);
      }
    },
    [
      products,
      tickets,
      mermas,
      settings,
      handleUpdateBcvRate,
      handleUpdatePreferentialRate,
      handleSaveSettings,
      handleUpdateProducts,
      handleAddExpense,
      handleUpdateTickets,
      handleUpdateMermas,
    ]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-rose-500/60 text-xs font-semibold text-white shadow-2xl animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main App Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        onUpdateBcvRate={handleUpdateBcvRate}
        onUpdatePreferentialRate={handleUpdatePreferentialRate}
        debtorsCount={debtorsSummary.length}
        pendingSuppliersCount={pendingSuppliersCount}
        totalTicketsCount={tickets.length}
        totalDebtUSD={totalDebtUSD}
        fidelisRewardsReadyCount={fidelisRewardsReadyCount}
        onOpenFidelis={() => setIsGlobalFidelisOpen(true)}
      />

      {/* Main Tab Views */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        {activeTab === 'pos' && (
          <POSModule
            products={products}
            settings={settings}
            onCompleteSale={handleCompleteSale}
            existingCustomers={existingCustomers}
            fidelisProfiles={fidelisProfiles}
            onClaimFidelisReward={handleClaimFidelisReward}
            onNavigateToInventory={handleNavigateToInventory}
          />
        )}

        {activeTab === 'tickets' && (
          <TicketsHistoryModule
            tickets={tickets}
            expenses={expenses}
            restocks={restocks}
            products={products}
            settings={settings}
            mermas={mermas}
            onDeleteTicket={handleDeleteTicket}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onAbonoToRestock={handleAbonoToRestock}
            onTicketsImported={handleTicketsImported}
            onNavigateToRestocks={() => setActiveTab('restocks')}
            onOpenMermaModal={handleOpenMermaModal}
          />
        )}

        {activeTab === 'fiados' && (
          <FiadosModule
            tickets={tickets}
            products={products}
            settings={settings}
            onUpdateTickets={handleUpdateTickets}
            onUpdateProducts={handleUpdateProducts}
          />
        )}

        {activeTab === 'restocks' && (
          <RestockModule
            products={products}
            restocks={restocks}
            expenses={expenses}
            tickets={tickets}
            settings={settings}
            onUpdateProducts={handleUpdateProducts}
            onUpdateRestocks={handleUpdateRestocks}
            onUpdateExpenses={(newExpenses) => {
              setExpenses(newExpenses);
              saveExpenses(newExpenses);
            }}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryModule
            products={products}
            settings={settings}
            mermas={mermas}
            onUpdateProducts={handleUpdateProducts}
            onOpenMermaModal={handleOpenMermaModal}
            initialSearchQuery={inventorySearchQuery}
          />
        )}

        {activeTab === 'ai' && (
          <AIControlModule
            products={products}
            tickets={tickets}
            debtors={debtorsSummary}
            restocks={restocks}
            expenses={expenses}
            mermas={mermas}
            settings={settings}
            onUpdateBcvRate={handleUpdateBcvRate}
            onUpdatePreferentialRate={handleUpdatePreferentialRate}
            onUpdateProducts={handleUpdateProducts}
            onUpdateTickets={handleUpdateTickets}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onUpdateExpenses={(newExpenses) => {
              setExpenses(newExpenses);
              saveExpenses(newExpenses);
            }}
            onUpdateMermas={handleUpdateMermas}
            onUpdateRestocks={handleUpdateRestocks}
            onOpenBackupModal={() => setIsGoogleBackupModalOpen(true)}
            onOpenMermaModal={handleOpenMermaModal}
            onClaimFidelisReward={handleClaimFidelisReward}
            onSaveSettings={handleSaveSettings}
            onShowToast={showToast}
            onNavigateToTab={(tab) => {
              if (['pos', 'tickets', 'fiados', 'restocks', 'inventory', 'settings', 'ai'].includes(tab)) {
                setActiveTab(tab as any);
              }
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsModule
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onOpenGoogleBackup={() => setIsGoogleBackupModalOpen(true)}
          />
        )}
      </main>

      {/* Google Daily Backup, Cloud Restoration & Excel/CSV Modal */}
      <GoogleBackupModal
        isOpen={isGoogleBackupModalOpen}
        onClose={() => setIsGoogleBackupModalOpen(false)}
        onDataRestored={() => showToast('¡Datos sincronizados y recuperados!')}
        tickets={tickets}
        products={products}
        settings={settings}
        expenses={expenses}
        mermas={mermas}
      />

      {/* Merma Adjustment Modal (Multi-Almacén & Manipulación) */}
      <MermaAdjustmentModal
        isOpen={isMermaModalOpen}
        onClose={() => {
          setIsMermaModalOpen(false);
          setMermaPreselectedProduct(null);
        }}
        products={products}
        mermas={mermas}
        settings={settings}
        preselectedProduct={mermaPreselectedProduct}
        onUpdateProducts={handleUpdateProducts}
        onUpdateMermas={handleUpdateMermas}
        onSuccessToast={showToast}
      />

      {/* Global Fidelis Customer Directory Modal */}
      <FidelisDirectoryModal
        isOpen={isGlobalFidelisOpen}
        onClose={() => setIsGlobalFidelisOpen(false)}
        profiles={fidelisProfiles}
        onClaimReward={handleClaimFidelisReward}
        onSaveCustomer={(updatedData, originalId) => {
          const res = updateFidelisCustomerProfile(originalId, updatedData, fidelisProfiles);
          setFidelisProfiles(res.updatedProfiles);
          showToast(`Cliente "${res.updatedProfile.customerName}" guardado en Fidelis.`);
        }}
        onDeleteCustomer={(customerId) => {
          const res = deleteFidelisCustomerProfile(customerId, fidelisProfiles);
          setFidelisProfiles(res);
          showToast('Cliente eliminado del sistema de fidelización.');
        }}
        onSyncComplete={(msg) => {
          setFidelisProfiles(loadFidelisProfiles());
          showToast(msg);
        }}
      />

      {/* Omnipresent Floating Global AI Copilot (Total Control from ANY screen) */}
      <GlobalAICopilot
        products={products}
        tickets={tickets}
        debtors={debtorsSummary}
        restocks={restocks}
        expenses={expenses}
        mermas={mermas}
        settings={settings}
        onExecuteAction={handleExecuteAIAction}
        onNavigateToTab={(tab) => {
          if (['pos', 'tickets', 'fiados', 'restocks', 'inventory', 'settings', 'ai'].includes(tab)) {
            setActiveTab(tab as any);
          }
        }}
        onShowToast={showToast}
        onSaveSettings={handleSaveSettings}
      />

      {/* Footer info */}
      <footer className="py-3 border-t border-slate-900 text-center text-[11px] text-slate-600 font-mono">
        Charcutería Jhojan C.A. • Sistema POS & Libro de Fiados PWA • 100% Offline con Sincronización
      </footer>
    </div>
  );
}
