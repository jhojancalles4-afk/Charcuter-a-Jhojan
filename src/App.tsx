import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppSettings, ExpenseRecord, FidelisCustomerProfile, Product, SaleTicket } from './types';
import {
  loadProducts,
  saveProducts,
  loadSettings,
  saveSettings,
  loadTickets,
  saveTickets,
  loadExpenses,
  saveExpenses,
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
import { InventoryModule } from './components/InventoryModule';
import { SettingsModule } from './components/SettingsModule';
import { FidelisDirectoryModal } from './components/FidelisDirectoryModal';
import { GoogleBackupModal } from './components/GoogleBackupModal';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { voidOrDeleteTicket } from './services/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<'pos' | 'tickets' | 'fiados' | 'inventory' | 'settings'>(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'pos' || tabParam === 'tickets' || tabParam === 'fiados' || tabParam === 'inventory' || tabParam === 'settings') {
        return tabParam;
      }
    }
    return 'pos';
  });
  const [products, setProducts] = useState<Product[]>(() => loadProducts());
  const [tickets, setTickets] = useState<SaleTicket[]>(() => loadTickets());
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => loadExpenses());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [fidelisProfiles, setFidelisProfiles] = useState<Record<string, FidelisCustomerProfile>>(() =>
    loadFidelisProfiles()
  );
  const [isGoogleBackupModalOpen, setIsGoogleBackupModalOpen] = useState(false);
  const [isGlobalFidelisOpen, setIsGlobalFidelisOpen] = useState(false);
  const [inventorySearchQuery, setInventorySearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync across tabs or storage events
  useEffect(() => {
    const handleStorageSync = (e: any) => {
      if (e.detail?.type === 'products') setProducts(loadProducts());
      if (e.detail?.type === 'tickets') setTickets(loadTickets());
      if (e.detail?.type === 'expenses') setExpenses(loadExpenses());
      if (e.detail?.type === 'settings') setSettings(loadSettings());
      if (e.detail?.type === 'fidelis') setFidelisProfiles(loadFidelisProfiles());
      if (e.detail?.type === 'all') {
        setProducts(loadProducts());
        setTickets(loadTickets());
        setExpenses(loadExpenses());
        setSettings(loadSettings());
        setFidelisProfiles(loadFidelisProfiles());
      }
    };

    window.addEventListener('jhojan_pos_sync', handleStorageSync);
    return () => window.removeEventListener('jhojan_pos_sync', handleStorageSync);
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

  // Calculate Debtors metrics for Header badge
  const debtorsSummary = useMemo(() => {
    return getDebtorsSummary(tickets, settings.bcvRate);
  }, [tickets, settings.bcvRate]);

  const totalDebtUSD = useMemo(() => {
    return debtorsSummary.reduce((sum, d) => sum + d.totalDebtUSD, 0);
  }, [debtorsSummary]);

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
        totalTicketsCount={tickets.length}
        totalDebtUSD={totalDebtUSD}
        fidelisRewardsReadyCount={fidelisRewardsReadyCount}
        onOpenFidelis={() => setIsGlobalFidelisOpen(true)}
        onOpenGoogleBackup={() => setIsGoogleBackupModalOpen(true)}
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
            products={products}
            settings={settings}
            onDeleteTicket={handleDeleteTicket}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onTicketsImported={handleTicketsImported}
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

        {activeTab === 'inventory' && (
          <InventoryModule
            products={products}
            settings={settings}
            onUpdateProducts={handleUpdateProducts}
            initialSearchQuery={inventorySearchQuery}
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

      {/* Google Daily Backup & Cloud Restoration Modal */}
      <GoogleBackupModal
        isOpen={isGoogleBackupModalOpen}
        onClose={() => setIsGoogleBackupModalOpen(false)}
        onDataRestored={() => showToast('¡Datos sincronizados y recuperados desde Google!')}
        tickets={tickets}
        products={products}
        settings={settings}
        expenses={expenses}
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

      {/* Footer info */}
      <footer className="py-3 border-t border-slate-900 text-center text-[11px] text-slate-600 font-mono">
        Charcutería Jhojan C.A. • Sistema POS & Libro de Fiados PWA • 100% Offline con Sincronización
      </footer>
    </div>
  );
}
