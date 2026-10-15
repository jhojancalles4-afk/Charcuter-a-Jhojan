import {
  AppSettings,
  DebtorCustomer,
  ExpenseRecord,
  InventoryReportSummary,
  MermaRecord,
  MermaReason,
  PaymentAbono,
  Product,
  RestockAbono,
  RestockRecord,
  SaleTicket,
  SystemPandLData,
  ZReportData,
  ZReportProductSummary,
  GoogleDailyBackup,
  GoogleAccountInfo,
} from '../types';
import {
  INITIAL_EXPENSES,
  INITIAL_MERMAS,
  INITIAL_PRODUCTS,
  INITIAL_RESTOCKS,
  INITIAL_SETTINGS,
  INITIAL_TICKETS,
} from '../data/initialData';
import {
  findFidelisProfile,
  loadFidelisProfiles,
  saveFidelisProfiles,
  revertFidelisSale,
  syncAndSumTicketsToFidelis,
} from './fidelis';

const STORAGE_KEYS = {
  SETTINGS: 'jhojan_pos_settings_v1',
  PRODUCTS: 'jhojan_pos_products_v1',
  TICKETS: 'jhojan_pos_tickets_v1',
  EXPENSES: 'jhojan_pos_expenses_v1',
  RESTOCKS: 'jhojan_pos_restocks_v1',
  MERMAS: 'jhojan_pos_mermas_v1',
  SYNC_QUEUE: 'jhojan_pos_sync_queue_v1',
  GOOGLE_ACCOUNT: 'jhojan_pos_google_account_v1',
  GOOGLE_DAILY_BACKUPS: 'jhojan_pos_google_daily_backups_v1',
  CLOUD_LEDGER_PREFIX: 'jhojan_pos_cloud_ledger_',
};

// --- Storage I/O ---
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return INITIAL_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...INITIAL_SETTINGS,
      ...parsed,
      preferentialRate: parsed.preferentialRate || INITIAL_SETTINGS.preferentialRate || 82.00,
    };
  } catch (e) {
    console.error('Error loading settings from localStorage', e);
    return INITIAL_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    notifyStorageChange('settings');
  } catch (e) {
    console.error('Error saving settings to localStorage', e);
  }
}

export function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!raw) return INITIAL_PRODUCTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p: Product) => {
        const matchInitial = INITIAL_PRODUCTS.find((initP) => initP.id === p.id);
        const costUSD = typeof p.costUSD === 'number' && p.costUSD > 0
          ? p.costUSD
          : (matchInitial?.costUSD ?? Math.round(p.priceUSD * 0.72 * 100) / 100);
        const marginPercent = typeof p.marginPercent === 'number' && p.marginPercent > 0
          ? p.marginPercent
          : (matchInitial?.marginPercent ?? (costUSD > 0 ? Math.round(((p.priceUSD - costUSD) / costUSD) * 1000) / 10 : 35.0));

        return {
          ...p,
          barcode: p.barcode || matchInitial?.barcode,
          costUSD,
          marginPercent,
        };
      });
    }
    return INITIAL_PRODUCTS;
  } catch (e) {
    console.error('Error loading products from localStorage', e);
    return INITIAL_PRODUCTS;
  }
}

export function saveProducts(products: Product[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    notifyStorageChange('products');
  } catch (e) {
    console.error('Error saving products to localStorage', e);
  }
}

export function loadTickets(): SaleTicket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (!raw) return INITIAL_TICKETS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_TICKETS;
  } catch (e) {
    console.error('Error loading tickets from localStorage', e);
    return INITIAL_TICKETS;
  }
}

export function saveTickets(tickets: SaleTicket[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
    notifyStorageChange('tickets');
  } catch (e) {
    console.error('Error saving tickets to localStorage', e);
  }
}

export function loadExpenses(): ExpenseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!raw) return INITIAL_EXPENSES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_EXPENSES;
  } catch (e) {
    console.error('Error loading expenses from localStorage', e);
    return INITIAL_EXPENSES;
  }
}

export function saveExpenses(expenses: ExpenseRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    notifyStorageChange('expenses');
  } catch (e) {
    console.error('Error saving expenses to localStorage', e);
  }
}

export function loadRestocks(): RestockRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RESTOCKS);
    if (!raw) return INITIAL_RESTOCKS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_RESTOCKS;
  } catch (e) {
    console.error('Error loading restocks from localStorage', e);
    return INITIAL_RESTOCKS;
  }
}

export function saveRestocks(restocks: RestockRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RESTOCKS, JSON.stringify(restocks));
    notifyStorageChange('restocks');
  } catch (e) {
    console.error('Error saving restocks to localStorage', e);
  }
}

// --- Mermas Físicas & Desperdicios por Manipulación ---
export function loadMermas(): MermaRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MERMAS);
    if (!raw) return INITIAL_MERMAS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_MERMAS;
  } catch (e) {
    console.error('Error loading mermas from localStorage', e);
    return INITIAL_MERMAS;
  }
}

export function saveMermas(mermas: MermaRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MERMAS, JSON.stringify(mermas));
    notifyStorageChange('mermas');
  } catch (e) {
    console.error('Error saving mermas to localStorage', e);
  }
}

export interface ProcessMermaInput {
  productId: string;
  quantity: number;
  reason: MermaReason;
  notes?: string;
  performedBy?: string;
}

export function processNewMerma(
  input: ProcessMermaInput,
  products: Product[],
  mermas: MermaRecord[],
  settings: AppSettings
): {
  updatedProducts: Product[];
  updatedMermas: MermaRecord[];
  newMerma: MermaRecord;
} {
  const targetProduct = products.find((p) => p.id === input.productId);
  if (!targetProduct) {
    throw new Error('Producto no encontrado para registrar la merma');
  }

  const cleanQty = Math.max(0.001, Math.round(input.quantity * 1000) / 1000);
  const unitCostUSD = targetProduct.costUSD && targetProduct.costUSD > 0
    ? targetProduct.costUSD
    : Math.round(targetProduct.priceUSD * 0.65 * 100) / 100;

  const totalCostUSD = Math.round(cleanQty * unitCostUSD * 100) / 100;
  const totalCostVES = Math.round(totalCostUSD * settings.bcvRate * 100) / 100;

  // Deduct from product stock
  const newStock = Math.max(0, Math.round((targetProduct.stock - cleanQty) * 1000) / 1000);
  const updatedProducts = products.map((p) =>
    p.id === input.productId ? { ...p, stock: newStock } : p
  );

  const newMerma: MermaRecord = {
    id: `MERMA-${Date.now()}`,
    date: new Date().toISOString(),
    productId: targetProduct.id,
    productName: targetProduct.name,
    category: targetProduct.category,
    unit: targetProduct.unit,
    quantity: cleanQty,
    unitCostUSD,
    totalCostUSD,
    totalCostVES,
    bcvRate: settings.bcvRate,
    reason: input.reason,
    notes: input.notes?.trim() || undefined,
    performedBy: input.performedBy?.trim() || 'Encargado de Charcutería',
  };

  const updatedMermas = [newMerma, ...mermas];

  saveProducts(updatedProducts);
  saveMermas(updatedMermas);

  return {
    updatedProducts,
    updatedMermas,
    newMerma,
  };
}

export function deleteMermaRecord(
  mermaId: string,
  restoreStock: boolean,
  products: Product[],
  mermas: MermaRecord[]
): { updatedProducts: Product[]; updatedMermas: MermaRecord[] } {
  const target = mermas.find((m) => m.id === mermaId);
  let updatedProducts = [...products];

  if (target && restoreStock) {
    updatedProducts = updatedProducts.map((p) => {
      if (p.id === target.productId) {
        return {
          ...p,
          stock: Math.round((p.stock + target.quantity) * 1000) / 1000,
        };
      }
      return p;
    });
    saveProducts(updatedProducts);
  }

  const updatedMermas = mermas.filter((m) => m.id !== mermaId);
  saveMermas(updatedMermas);

  return { updatedProducts, updatedMermas };
}

export interface ProcessRestockInput {
  productId: string;
  quantityAdded: number;
  unitCostUSD: number;
  supplierName: string;
  supplierPhone?: string;
  supplierInvoiceNumber?: string;
  paymentCondition: 'contado' | 'credito';
  dueDate?: string;
  // If paid de contado
  contadoPaymentMethod?: 'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia';
  // If credito, upfront payment if any
  hasInitialAbono?: boolean;
  initialAbonoUSD?: number;
  initialAbonoMethod?: 'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia';
  initialAbonoRef?: string;
  notes?: string;
}

export function processNewRestock(
  input: ProcessRestockInput,
  products: Product[],
  restocks: RestockRecord[],
  expenses: ExpenseRecord[],
  settings: AppSettings
): {
  updatedProducts: Product[];
  updatedRestocks: RestockRecord[];
  updatedExpenses: ExpenseRecord[];
  newRestock: RestockRecord;
} {
  const targetProduct = products.find((p) => p.id === input.productId);
  if (!targetProduct) {
    throw new Error('Producto no encontrado para reposición');
  }

  const previousStock = targetProduct.stock;
  const newStock = Math.round((previousStock + input.quantityAdded) * 1000) / 1000;
  const totalCostUSD = Math.round(input.quantityAdded * input.unitCostUSD * 100) / 100;
  const totalCostVES = Math.round(totalCostUSD * settings.bcvRate * 100) / 100;

  // Next restock number
  const maxRestockNum = restocks.reduce((max, r) => Math.max(max, r.restockNumber || 0), 500);
  const restockNumber = maxRestockNum + 1;
  const restockId = `RESTOCK-${restockNumber}`;

  let paidUSD = 0;
  let pendingUSD = totalCostUSD;
  const abonos: RestockAbono[] = [];
  const createdExpenseIds: string[] = [];
  let updatedExpenses = [...expenses];

  const nowIso = new Date().toISOString();

  // If paid de contado, create complete payment abono and expense record
  if (input.paymentCondition === 'contado') {
    paidUSD = totalCostUSD;
    pendingUSD = 0;
    const method = input.contadoPaymentMethod || 'cash_usd';

    const abonoItem: RestockAbono = {
      id: `ABONO-${restockNumber}-0`,
      date: nowIso,
      amountUSD: totalCostUSD,
      amountVES: totalCostVES,
      bcvRate: settings.bcvRate,
      paymentMethod: method,
      reference: input.supplierInvoiceNumber || 'PAGO-CONTADO',
      notes: `Pago de contado reposición de ${targetProduct.name}`,
    };
    abonos.push(abonoItem);

    // Create Expense in Egresos
    const maxExpNum = updatedExpenses.reduce((max, exp) => Math.max(max, exp.expenseNumber || 0), 100);
    const newExpense: ExpenseRecord = {
      id: `EXP-${maxExpNum + 1}`,
      expenseNumber: maxExpNum + 1,
      date: nowIso,
      description: `Reposición de mercancía: ${targetProduct.name} (+${input.quantityAdded} ${targetProduct.unit}) - Prov: ${input.supplierName}`,
      category: 'Mercancía/Proveedores',
      amountUSD: totalCostUSD,
      amountVES: totalCostVES,
      currency: method === 'cash_usd' ? 'USD' : 'VES',
      appliedRate: settings.bcvRate,
      paymentMethod: method,
      recipient: input.supplierName,
      reference: input.supplierInvoiceNumber,
      notes: input.notes || `Recepción y pago de contado de mercancía`,
    };
    createdExpenseIds.push(newExpense.id);
    updatedExpenses = [newExpense, ...updatedExpenses];
  } else {
    // Crédito
    if (input.hasInitialAbono && (input.initialAbonoUSD || 0) > 0) {
      const initAmount = Math.min(totalCostUSD, Math.round((input.initialAbonoUSD || 0) * 100) / 100);
      const initAmountVES = Math.round(initAmount * settings.bcvRate * 100) / 100;
      paidUSD = initAmount;
      pendingUSD = Math.round((totalCostUSD - initAmount) * 100) / 100;
      const method = input.initialAbonoMethod || 'cash_usd';

      const abonoItem: RestockAbono = {
        id: `ABONO-${restockNumber}-1`,
        date: nowIso,
        amountUSD: initAmount,
        amountVES: initAmountVES,
        bcvRate: settings.bcvRate,
        paymentMethod: method,
        reference: input.initialAbonoRef || 'ABONO-INICIAL',
        notes: `Abono inicial al proveedor antes de fecha de pago`,
      };
      abonos.push(abonoItem);

      // Create Expense record for this abono in Egresos
      const maxExpNum = updatedExpenses.reduce((max, exp) => Math.max(max, exp.expenseNumber || 0), 100);
      const newExpense: ExpenseRecord = {
        id: `EXP-${maxExpNum + 1}`,
        expenseNumber: maxExpNum + 1,
        date: nowIso,
        description: `Abono a proveedor mercancía: ${targetProduct.name} - Prov: ${input.supplierName}`,
        category: 'Mercancía/Proveedores',
        amountUSD: initAmount,
        amountVES: initAmountVES,
        currency: method === 'cash_usd' ? 'USD' : 'VES',
        appliedRate: settings.bcvRate,
        paymentMethod: method,
        recipient: input.supplierName,
        reference: input.initialAbonoRef || input.supplierInvoiceNumber,
        notes: `Abono parcial previo a fecha límite (${input.dueDate || 'Sin fecha'})`,
      };
      createdExpenseIds.push(newExpense.id);
      updatedExpenses = [newExpense, ...updatedExpenses];
    }
  }

  const isPaid = pendingUSD <= 0.001;

  const newRestock: RestockRecord = {
    id: restockId,
    restockNumber,
    date: nowIso,
    productId: targetProduct.id,
    productName: targetProduct.name,
    unit: targetProduct.unit,
    category: targetProduct.category,
    quantityAdded: input.quantityAdded,
    previousStock,
    newStock,
    unitCostUSD: input.unitCostUSD,
    totalCostUSD,
    totalCostVES,
    bcvRate: settings.bcvRate,
    supplierName: input.supplierName.trim() || 'Proveedor General',
    supplierPhone: input.supplierPhone?.trim(),
    supplierInvoiceNumber: input.supplierInvoiceNumber?.trim(),
    paymentCondition: input.paymentCondition,
    isPaid,
    dueDate: input.dueDate,
    abonos,
    paidUSD,
    pendingUSD,
    pendingVES: Math.round(pendingUSD * settings.bcvRate * 100) / 100,
    expenseIds: createdExpenseIds,
    notes: input.notes?.trim(),
    createdAt: nowIso,
  };

  // 1. Update product with new stock and new unit cost
  const updatedProducts = products.map((p) => {
    if (p.id === targetProduct.id) {
      return {
        ...p,
        stock: newStock,
        costUSD: input.unitCostUSD > 0 ? input.unitCostUSD : p.costUSD,
      };
    }
    return p;
  });

  const updatedRestocks = [newRestock, ...restocks];

  saveProducts(updatedProducts);
  saveRestocks(updatedRestocks);
  saveExpenses(updatedExpenses);

  return {
    updatedProducts,
    updatedRestocks,
    updatedExpenses,
    newRestock,
  };
}

export function addAbonoToRestock(
  restockId: string,
  amountUSD: number,
  paymentMethod: 'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia',
  reference: string,
  notes: string,
  restocks: RestockRecord[],
  expenses: ExpenseRecord[],
  settings: AppSettings
): {
  updatedRestocks: RestockRecord[];
  updatedExpenses: ExpenseRecord[];
  updatedRestock: RestockRecord;
} {
  const target = restocks.find((r) => r.id === restockId);
  if (!target) {
    throw new Error('Registro de reposición no encontrado');
  }

  const cleanAmountUSD = Math.min(target.pendingUSD, Math.round(amountUSD * 100) / 100);
  if (cleanAmountUSD <= 0) {
    throw new Error('El monto de abono debe ser mayor a cero');
  }

  const nowIso = new Date().toISOString();
  const amountVES = Math.round(cleanAmountUSD * settings.bcvRate * 100) / 100;

  const abonoId = `ABONO-${target.restockNumber}-${target.abonos.length + 1}`;
  const newAbono: RestockAbono = {
    id: abonoId,
    date: nowIso,
    amountUSD: cleanAmountUSD,
    amountVES,
    bcvRate: settings.bcvRate,
    paymentMethod,
    reference: reference.trim(),
    notes: notes.trim(),
  };

  const newPaidUSD = Math.round((target.paidUSD + cleanAmountUSD) * 100) / 100;
  const newPendingUSD = Math.max(0, Math.round((target.pendingUSD - cleanAmountUSD) * 100) / 100);
  const newPendingVES = Math.round(newPendingUSD * settings.bcvRate * 100) / 100;
  const isPaid = newPendingUSD <= 0.001;

  // Create corresponding expense record in Egresos
  const maxExpNum = expenses.reduce((max, exp) => Math.max(max, exp.expenseNumber || 0), 100);
  const newExpense: ExpenseRecord = {
    id: `EXP-${maxExpNum + 1}`,
    expenseNumber: maxExpNum + 1,
    date: nowIso,
    description: `Abono a proveedor: ${target.supplierName} (Mercancía: ${target.productName})`,
    category: 'Mercancía/Proveedores',
    amountUSD: cleanAmountUSD,
    amountVES,
    currency: paymentMethod === 'cash_usd' ? 'USD' : 'VES',
    appliedRate: settings.bcvRate,
    paymentMethod,
    recipient: target.supplierName,
    reference: reference || target.supplierInvoiceNumber,
    notes: notes || `Abono a cuenta por pagar. Saldo restante: $${newPendingUSD.toFixed(2)}`,
  };

  const updatedRestock: RestockRecord = {
    ...target,
    paidUSD: newPaidUSD,
    pendingUSD: newPendingUSD,
    pendingVES: newPendingVES,
    isPaid,
    abonos: [...target.abonos, newAbono],
    expenseIds: [...(target.expenseIds || []), newExpense.id],
  };

  const updatedRestocks = restocks.map((r) => (r.id === restockId ? updatedRestock : r));
  const updatedExpenses = [newExpense, ...expenses];

  saveRestocks(updatedRestocks);
  saveExpenses(updatedExpenses);

  return {
    updatedRestocks,
    updatedExpenses,
    updatedRestock,
  };
}

// Custom event for cross-tab or component sync
function notifyStorageChange(type: string) {
  window.dispatchEvent(new CustomEvent('jhojan_pos_sync', { detail: { type } }));
}

// --- Currency & Number Formatting ---
export function formatUSD(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) amount = 0;
  return `$ ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatVES(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) amount = 0;
  // Venezuelan standard: 1.250,50 Bs.
  return `Bs. ${amount.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatWeight(kg: number): string {
  if (isNaN(kg) || kg === null || kg === undefined) kg = 0;
  return `${kg.toLocaleString('es-VE', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kg`;
}

export function formatQuantity(qty: number, unit: 'KG' | 'UN'): string {
  if (unit === 'KG') {
    return formatWeight(qty);
  }
  return `${Math.round(qty)} UN`;
}

// Clean phone number for WhatsApp wa.me link (standard Venezuelan format)
export function sanitizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // If starts with 0 (e.g. 0414..., 0424...), replace with 58
  if (digits.startsWith('0')) {
    return `58${digits.substring(1)}`;
  }
  // If doesn't start with 58 and is 10 digits
  if (!digits.startsWith('58') && digits.length === 10) {
    return `58${digits}`;
  }
  return digits;
}

// --- Debtor Analysis & Grouping ---
export function getDebtorsSummary(tickets: SaleTicket[], bcvRate: number): DebtorCustomer[] {
  const map = new Map<string, DebtorCustomer>();

  // Filter only tickets that have pending balance or fiado status and are not voided
  for (const ticket of tickets) {
    if (ticket.isVoided) continue;

    const isFiadoOrPending =
      ticket.paymentMethod === 'fiado' ||
      ticket.status === 'pending' ||
      ticket.status === 'partially_paid';

    if (!isFiadoOrPending || ticket.pendingUSD <= 0.001) continue;

    // Use normalized phone or valid cédula as key, otherwise fallback to customer name
    const isPlaceholderCedula =
      !ticket.customerCedula ||
      ticket.customerCedula.trim().toUpperCase() === 'V-00000000' ||
      ticket.customerCedula.trim() === '0';
    const key = (
      ticket.customerPhone?.trim() ||
      (!isPlaceholderCedula ? ticket.customerCedula.trim() : '') ||
      ticket.customerName.trim()
    ).toLowerCase();
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      existing.tickets.push(ticket);
      existing.totalDebtUSD += ticket.pendingUSD;
      existing.totalDebtVES += ticket.pendingUSD * bcvRate;
      if (new Date(ticket.date) > new Date(existing.lastPurchaseDate)) {
        existing.lastPurchaseDate = ticket.date;
      }
    } else {
      map.set(key, {
        name: ticket.customerName || 'Cliente sin nombre',
        cedula: ticket.customerCedula || 'S/C',
        phone: ticket.customerPhone || '',
        totalDebtUSD: ticket.pendingUSD,
        totalDebtVES: ticket.pendingUSD * bcvRate,
        tickets: [ticket],
        lastPurchaseDate: ticket.date,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalDebtUSD - a.totalDebtUSD);
}

// --- WhatsApp Customer Purchase Thank-You Generator with Attached Invoice Notice ---
export function generateWhatsAppThankYou(
  ticket: SaleTicket,
  settings: AppSettings
): { url: string; message: string } {
  const cleanPhone = sanitizePhoneForWhatsApp(ticket.customerPhone);
  const firstName = ticket.customerName && ticket.customerName !== 'Consumidor Final'
    ? ticket.customerName.trim()
    : 'estimado(a) cliente';

  const dateStr = new Date(ticket.date).toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Describe payment method warmly
  let paymentText = '';
  if (ticket.paymentMethod === 'mixed' && ticket.paymentSplits && ticket.paymentSplits.length > 0) {
    const splitsStr = ticket.paymentSplits
      .map((s) => {
        const name = s.method === 'cash_usd' ? 'Efectivo $' : s.method === 'pago_movil' ? 'Pago Móvil' : s.method === 'punto' ? 'Punto' : s.method === 'cash_ves' ? 'Efectivo Bs' : 'Fiado';
        return `${name}: ${formatUSD(s.amountUSD)}`;
      })
      .join(', ');
    paymentText = `Pago Mixto (${splitsStr})`;
  } else if (ticket.paymentMethod === 'cash_usd') {
    paymentText = `💵 Efectivo $ USD`;
  } else if (ticket.paymentMethod === 'pago_movil') {
    paymentText = `📱 Pago Móvil`;
  } else if (ticket.paymentMethod === 'punto') {
    paymentText = `💳 Punto de Venta`;
  } else if (ticket.paymentMethod === 'cash_ves') {
    paymentText = `🇻🇪 Efectivo Bolívares`;
  } else if (ticket.paymentMethod === 'fiado') {
    paymentText = `⚠️ Compra a Crédito (Fiado)`;
  } else {
    paymentText = '✅ Contado';
  }

  const isFiado = ticket.paymentMethod === 'fiado' || ticket.status === 'pending';

  // Fidelis loyalty progress summary if applicable
  const fidelisProfiles = loadFidelisProfiles();
  const fidelisCustomer = findFidelisProfile(
    { cedula: ticket.customerCedula, phone: ticket.customerPhone, name: ticket.customerName },
    fidelisProfiles
  );
  let fidelisLoyaltyText = '';
  if (fidelisCustomer) {
    fidelisLoyaltyText = `\n⭐ *TUS PUNTOS FIDELIS:*
• Sellos de Recurrencia: *${fidelisCustomer.stampsCount}/10*
• Compras VIP (≥$18 USD): *${fidelisCustomer.highValueCount}/4*
${fidelisCustomer.stampsCount >= 10 ? '🎁 ¡Tienes un premio por 10 sellos disponible para canjear!\n' : ''}${fidelisCustomer.highValueCount >= 4 ? '👑 ¡Tienes un premio VIP Fidelis Oro disponible para canjear!\n' : ''}━━━━━━━━━━━━━━━━━━━━\n`;
  }

  const message = `✨ *¡Hola, ${firstName}!* 🧀🥩

En *${settings.businessName}* queremos darte las gracias de todo corazón por tu compra y por preferirnos para llevar calidad, sabor y frescura a tu hogar. ¡Nos alegra muchísimo atenderte! 🥰🙏

━━━━━━━━━━━━━━━━━━━━
🧾 *COMPROBANTE DE COMPRA - TICKET #${ticket.ticketNumber}*
📅 *Fecha:* ${dateStr}
👤 *Cliente:* ${ticket.customerName}
💰 *TOTAL DE LA COMPRA:* *${formatUSD(ticket.totalUSD)} USD* (~${formatVES(ticket.totalVES)})
💳 *Modalidad de Pago:* ${paymentText}
${isFiado ? `⚠️ *Saldo Pendiente:* ${formatUSD(ticket.pendingUSD)} (~${formatVES(ticket.pendingVES)})` : '✅ *Estado:* Totalmente Cancelado'}
━━━━━━━━━━━━━━━━━━━━${fidelisLoyaltyText}
📎 *Nota importante:* Te adjuntamos aquí en la conversación tu *Factura Digital en imagen (PNG)* detallada con cada producto adquirido, para que la guardes o imprimas en tu impresora térmica. 

¡Fue un inmenso placer atenderte! Te esperamos pronto de vuelta con la atención y la sonrisa de siempre. 🥖🥛🥓

¡Que disfrutes mucho tu compra y que tengas un excelente y bendecido día! ✨❤️`;

  const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}` : '';

  return { url, message };
}

// --- WhatsApp Payment Reminder Generator ---
export function generateWhatsAppReminder(
  debtor: DebtorCustomer,
  settings: AppSettings
): { url: string; message: string } {
  const cleanPhone = sanitizePhoneForWhatsApp(debtor.phone);
  const totalUSD = debtor.totalDebtUSD;
  const totalVES = totalUSD * settings.bcvRate;

  // Format date helper
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
        .toString()
        .padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return iso;
    }
  };

  // Build purchases detail lines
  const purchasesLines = debtor.tickets
    .map((t) => {
      const dateStr = formatDate(t.date);
      const itemsBrief = t.items.map((it) => `${it.product.name} (${formatQuantity(it.quantity, it.product.unit)})`).join(', ');
      return `• *Ticket #${t.ticketNumber}* (${dateStr}): Saldo pendiente: *${formatUSD(t.pendingUSD)}* (~${formatVES(t.pendingUSD * settings.bcvRate)})\n   _Detalle:_ ${itemsBrief}`;
    })
    .join('\n\n');

  // Formatted WhatsApp message according to exact specifications
  const message = `👋 *Estimado(a) ${debtor.name}*, un cordial saludo de parte de *${settings.businessName}* 🧀🥩

Le escribimos para recordarle amablemente el estado de su cuenta de compras fiadas en nuestro local:

📋 *DETALLE DE COMPRAS PENDIENTES:*
${purchasesLines}

━━━━━━━━━━━━━━━━━━━━
💰 *TOTAL EXIGIBLE A CANCELAR:*
👉 *${formatUSD(totalUSD)} USD*
👉 *${formatVES(totalVES)}*
_(Calculado a la Tasa Oficial BCV del día: ${formatVES(settings.bcvRate)} / USD)_
━━━━━━━━━━━━━━━━━━━━

🏦 *DATOS BANCARIOS PARA PAGO MÓVIL:*
• *Banco Receptor:* ${settings.pagoMovil.bankName} (${settings.pagoMovil.bankCode})
• *Teléfono:* ${settings.pagoMovil.phone}
• *Cédula / RIF:* ${settings.pagoMovil.cedula}
• *Monto exacto en Bs.:* ${formatVES(totalVES)}

🏪 *Otras formas de pago:*
Si lo prefiere, también puede cancelar en efectivo (Dólares o Bolívares) o Punto de Venta directamente en nuestra charcutería.

🙏 *Por favor, al realizar su abono o pago, envíenos el comprobante o número de referencia por este medio* para registrarlo inmediatamente en su cuenta y actualizar su saldo.

¡Muchas gracias por su preferencia y confianza! Que tenga un excelente día. ✨`;

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return { url, message };
}

// --- Automatic Amortization Engine ---
// Applies payment chronologically to the oldest unpaid tickets of that customer
export function amortizeCustomerPayment(
  allTickets: SaleTicket[],
  customerPhoneOrCedula: string,
  abonoUSD: number,
  abonoMethod: 'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto',
  reference: string,
  notes: string,
  bcvRate: number
): { updatedTickets: SaleTicket[]; appliedTotalUSD: number } {
  let remainingUSD = abonoUSD;
  const now = new Date().toISOString();

  const targetDigits = customerPhoneOrCedula.replace(/[^0-9]/g, '');
  const targetNorm = customerPhoneOrCedula.trim().toLowerCase();

  // Find tickets for this customer that are pending or partially_paid
  const customerTickets = allTickets
    .filter((t) => {
      const ticketPhoneDigits = t.customerPhone ? t.customerPhone.replace(/[^0-9]/g, '') : '';
      const matchPhone =
        (t.customerPhone && t.customerPhone.trim() === customerPhoneOrCedula.trim()) ||
        (targetDigits.length >= 7 && ticketPhoneDigits.length >= 7 && (ticketPhoneDigits === targetDigits || ticketPhoneDigits.endsWith(targetDigits) || targetDigits.endsWith(ticketPhoneDigits)));
      
      const ticketCedulaClean = t.customerCedula ? t.customerCedula.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : '';
      const targetCedulaClean = customerPhoneOrCedula.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
      const matchCedula =
        customerPhoneOrCedula.trim().toUpperCase() !== 'V-00000000' &&
        ticketCedulaClean &&
        ticketCedulaClean === targetCedulaClean;

      const matchName = t.customerName && t.customerName.trim().toLowerCase() === targetNorm;
      const isUnpaid = (t.status === 'pending' || t.status === 'partially_paid') && t.pendingUSD > 0.001;
      return (matchPhone || matchCedula || matchName) && isUnpaid;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // oldest first

  if (customerTickets.length === 0) {
    return { updatedTickets: allTickets, appliedTotalUSD: 0 };
  }

  const updatedTicketsMap = new Map<string, SaleTicket>();

  for (const ticket of customerTickets) {
    if (remainingUSD <= 0.001) break;

    const amountForThisTicket = Math.min(ticket.pendingUSD, remainingUSD);
    const newPendingUSD = Math.max(0, ticket.pendingUSD - amountForThisTicket);
    const newStatus = newPendingUSD <= 0.001 ? 'paid' : 'partially_paid';

    const newAbono: PaymentAbono = {
      id: `abono-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: now,
      amountUSD: amountForThisTicket,
      amountVES: amountForThisTicket * bcvRate,
      bcvRate,
      method: abonoMethod,
      reference,
      notes: notes || `Abono amortizado a Ticket #${ticket.ticketNumber}`,
    };

    const updatedTicket: SaleTicket = {
      ...ticket,
      pendingUSD: newPendingUSD,
      pendingVES: newPendingUSD * bcvRate,
      status: newStatus,
      abonos: [...(ticket.abonos || []), newAbono],
    };

    updatedTicketsMap.set(ticket.id, updatedTicket);
    remainingUSD -= amountForThisTicket;
  }

  // Replace affected tickets in main list
  const finalTickets = allTickets.map((t) => (updatedTicketsMap.has(t.id) ? updatedTicketsMap.get(t.id)! : t));

  saveTickets(finalTickets);
  return { updatedTickets: finalTickets, appliedTotalUSD: abonoUSD - remainingUSD };
}

// --- Void / Delete Defective Ticket (Facturas Malas) & Restore Inventory ---
export function voidOrDeleteTicket(
  ticketId: string,
  deletePermanently: boolean,
  reason: string,
  allTickets: SaleTicket[],
  allProducts: Product[]
): { updatedTickets: SaleTicket[]; updatedProducts: Product[]; restoredItemsSummary: string[] } {
  const target = allTickets.find((t) => t.id === ticketId);
  if (!target) {
    return { updatedTickets: allTickets, updatedProducts: allProducts, restoredItemsSummary: [] };
  }

  // Restore inventory if not already voided
  const restoredItemsSummary: string[] = [];
  let updatedProducts = [...allProducts];

  if (!target.isVoided) {
    const stockAddMap = new Map<string, number>();
    for (const item of target.items) {
      const cur = stockAddMap.get(item.product.id) || 0;
      stockAddMap.set(item.product.id, cur + item.quantity);
      restoredItemsSummary.push(`${item.product.name} (+${formatQuantity(item.quantity, item.product.unit)})`);
    }

    updatedProducts = updatedProducts.map((prod) => {
      const toAdd = stockAddMap.get(prod.id);
      if (toAdd && toAdd > 0) {
        return {
          ...prod,
          stock: Math.round((prod.stock + toAdd) * 1000) / 1000,
        };
      }
      return prod;
    });

    saveProducts(updatedProducts);

    // Al eliminar o anular la factura se elimina el sello Fidelis correspondiente
    revertFidelisSale(target, loadFidelisProfiles());
  }

  let updatedTickets: SaleTicket[];
  if (deletePermanently) {
    updatedTickets = allTickets.filter((t) => t.id !== ticketId);
  } else {
    const now = new Date().toISOString();
    updatedTickets = allTickets.map((t) => {
      if (t.id !== ticketId) return t;
      return {
        ...t,
        isVoided: true,
        status: 'voided' as const,
        voidReason: reason || 'Factura anulada por error de emisión (Factura mala)',
        voidedAt: now,
        pendingUSD: 0,
        pendingVES: 0,
      };
    });
  }

  saveTickets(updatedTickets);
  return { updatedTickets, updatedProducts, restoredItemsSummary };
}

// --- Delete Debtor Account (Eliminación de Cuenta Deudora) ---
export function deleteDebtorAccount(
  customerKey: string,
  restoreInventory: boolean,
  allTickets: SaleTicket[],
  allProducts: Product[]
): { updatedTickets: SaleTicket[]; updatedProducts: Product[] } {
  const normKey = customerKey.trim().toLowerCase();
  const keyDigits = customerKey.replace(/[^0-9]/g, '');

  const isMatchingTicket = (t: SaleTicket) => {
    if (t.isVoided) return false;
    const ticketPhoneDigits = t.customerPhone ? t.customerPhone.replace(/[^0-9]/g, '') : '';
    const matchPhone =
      (t.customerPhone && t.customerPhone.trim().toLowerCase() === normKey) ||
      (keyDigits.length >= 7 && ticketPhoneDigits.length >= 7 && (ticketPhoneDigits === keyDigits || ticketPhoneDigits.endsWith(keyDigits) || keyDigits.endsWith(ticketPhoneDigits)));
    
    const ticketCedulaClean = t.customerCedula ? t.customerCedula.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : '';
    const keyCedulaClean = customerKey.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
    const matchCedula =
      normKey !== 'v-00000000' && normKey !== '0' && ticketCedulaClean && ticketCedulaClean === keyCedulaClean;

    const matchName = t.customerName && t.customerName.trim().toLowerCase() === normKey;
    return matchPhone || matchCedula || matchName;
  };

  // Find all tickets associated with this debtor that are unpaid/fiado
  const debtorTickets = allTickets.filter((t) => isMatchingTicket(t));

  let updatedProducts = [...allProducts];
  if (restoreInventory) {
    const stockAddMap = new Map<string, number>();
    for (const ticket of debtorTickets) {
      if (ticket.status === 'pending' || ticket.status === 'partially_paid') {
        for (const item of ticket.items) {
          const cur = stockAddMap.get(item.product.id) || 0;
          stockAddMap.set(item.product.id, cur + item.quantity);
        }
      }
    }

    updatedProducts = updatedProducts.map((prod) => {
      const toAdd = stockAddMap.get(prod.id);
      if (toAdd && toAdd > 0) {
        return {
          ...prod,
          stock: Math.round((prod.stock + toAdd) * 1000) / 1000,
        };
      }
      return prod;
    });

    saveProducts(updatedProducts);
  }

  // Mark all debtor tickets as voided or delete them
  const updatedTickets = allTickets.map((t) => {
    if (isMatchingTicket(t) && (t.status === 'pending' || t.status === 'partially_paid')) {
      return {
        ...t,
        isVoided: true,
        status: 'voided' as const,
        voidReason: 'Cuenta deudora eliminada o saldada manualmente',
        voidedAt: new Date().toISOString(),
        pendingUSD: 0,
        pendingVES: 0,
      };
    }
    return t;
  });

  saveTickets(updatedTickets);
  return { updatedTickets, updatedProducts };
}

// --- Backup & Restore JSON ---
export function exportDatabaseBackupString(): string {
  const data = {
    app: 'Charcutería Jhojan POS',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    settings: loadSettings(),
    products: loadProducts(),
    tickets: loadTickets(),
    expenses: loadExpenses(),
    restocks: loadRestocks(),
    mermas: loadMermas(),
    fidelis: loadFidelisProfiles(),
  };
  return JSON.stringify(data, null, 2);
}

export function exportDatabaseBackup(): void {
  const jsonStr = exportDatabaseBackupString();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `backup-charcuteria-jhojan-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importDatabaseBackup(jsonString: string): { success: boolean; message: string } {
  try {
    const data = JSON.parse(jsonString);
    if (!data.products || !data.tickets || !data.settings) {
      return { success: false, message: 'El archivo no tiene el formato válido de respaldo de Charcutería Jhojan POS.' };
    }

    const maxTicketNum = Array.isArray(data.tickets)
      ? data.tickets.reduce((max: number, t: any) => Math.max(max, Number(t.ticketNumber) || 0), 0)
      : 0;
    const adjustedSettings: AppSettings = {
      ...data.settings,
      ticketCounter: Math.max(Number(data.settings.ticketCounter) || 1, maxTicketNum + 1),
    };

    saveSettings(adjustedSettings);
    saveProducts(data.products);
    saveTickets(data.tickets);
    if (Array.isArray(data.expenses)) {
      saveExpenses(data.expenses);
    }
    if (Array.isArray(data.restocks)) {
      saveRestocks(data.restocks);
    }
    if (Array.isArray(data.mermas)) {
      saveMermas(data.mermas);
    }
    // Carga de facturas: Buscar a quién le corresponde cada compra y sumar los sellos
    const baseFidelis = data.fidelis && typeof data.fidelis === 'object' ? data.fidelis : {};
    const syncResult = syncAndSumTicketsToFidelis(data.tickets, baseFidelis, {
      resetBeforeSync: !data.fidelis,
    });
    saveFidelisProfiles(syncResult.updatedProfiles);

    return {
      success: true,
      message: `Respaldo restaurado exitosamente: ${data.products.length} productos, ${data.tickets.length} tickets, ${data.expenses?.length || 0} egresos, ${data.restocks?.length || 0} compras a proveedores, ${data.mermas?.length || 0} mermas y perfiles Fidelis actualizados (+${syncResult.totalStampsAdded} sellos sumados a ${syncResult.matchedCustomersCount} clientes).`,
    };
  } catch (err) {
    console.error('Error importing backup:', err);
    return { success: false, message: 'Error al procesar el archivo JSON. Verifica que el archivo no esté dañado.' };
  }
}

/**
 * Carga de Facturas por Lote / Archivo:
 * Importa facturas desde JSON o archivo, busca a quién le corresponde cada compra y suma los sellos automáticamente.
 */
export function importTicketsBatch(
  rawInput: string | SaleTicket[],
  existingTickets: SaleTicket[] = loadTickets()
): {
  success: boolean;
  message: string;
  importedCount: number;
  matchedCustomersCount: number;
  stampsAdded: number;
  updatedTickets: SaleTicket[];
} {
  try {
    let newTicketsList: SaleTicket[] = [];
    if (typeof rawInput === 'string') {
      const parsed = JSON.parse(rawInput);
      if (Array.isArray(parsed)) {
        newTicketsList = parsed;
      } else if (parsed && Array.isArray(parsed.tickets)) {
        newTicketsList = parsed.tickets;
      } else {
        return {
          success: false,
          message: 'El archivo no contiene un listado válido de facturas.',
          importedCount: 0,
          matchedCustomersCount: 0,
          stampsAdded: 0,
          updatedTickets: existingTickets,
        };
      }
    } else if (Array.isArray(rawInput)) {
      newTicketsList = rawInput;
    }

    if (!newTicketsList || newTicketsList.length === 0) {
      return {
        success: false,
        message: 'No se encontraron facturas en el archivo suministrado.',
        importedCount: 0,
        matchedCustomersCount: 0,
        stampsAdded: 0,
        updatedTickets: existingTickets,
      };
    }

    // Merge with existing tickets, preventing ID duplication
    const existingIds = new Set(existingTickets.map((t) => t.id));
    const toAdd: SaleTicket[] = [];
    for (const t of newTicketsList) {
      if (!t || !t.id) continue;
      if (!existingIds.has(t.id)) {
        toAdd.push(t);
        existingIds.add(t.id);
      }
    }

    const mergedTickets = [...toAdd, ...existingTickets].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    saveTickets(mergedTickets);

    // Buscar a quién le corresponde la compra y sumar los sellos en Fidelis
    const currentFidelis = loadFidelisProfiles();
    const ticketsToCredit = toAdd.length > 0 ? toAdd : newTicketsList;
    const syncRes = syncAndSumTicketsToFidelis(ticketsToCredit, currentFidelis, {
      resetBeforeSync: false,
    });
    saveFidelisProfiles(syncRes.updatedProfiles);

    return {
      success: true,
      message: `Carga de facturas exitosa: se cargaron ${toAdd.length} facturas nuevas. Se identificaron ${syncRes.matchedCustomersCount} clientes y se sumaron ${syncRes.totalStampsAdded} sellos Fidelis.`,
      importedCount: toAdd.length,
      matchedCustomersCount: syncRes.matchedCustomersCount,
      stampsAdded: syncRes.totalStampsAdded,
      updatedTickets: mergedTickets,
    };
  } catch (err) {
    console.error('Error in importTicketsBatch:', err);
    return {
      success: false,
      message: 'Error al procesar el archivo de facturas. Verifica que el archivo JSON esté bien estructurado.',
      importedCount: 0,
      matchedCustomersCount: 0,
      stampsAdded: 0,
      updatedTickets: existingTickets,
    };
  }
}

// --- GOOGLE DRIVE & TELEGRAM UNIFIED BACKUP AND RESTORE HUB ---

export const TELEGRAM_BACKUP_DELIMITER_START = '=== CODIGO_RESPALDO_JHOJAN_POS_START ===';
export const TELEGRAM_BACKUP_DELIMITER_END = '=== CODIGO_RESPALDO_JHOJAN_POS_END ===';

/**
 * Exporta el archivo de respaldo formateado y optimizado específicamente para Google Drive.
 * Descarga directamente el archivo .JSON oficial para subirlo a Google Drive.
 */
export function exportGoogleDriveBackupFile(): void {
  const jsonStr = exportDatabaseBackupString();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `respaldo-google-drive-charcuteria-jhojan-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Genera el paquete completo y unificado de respaldo para Telegram.
 * Incluye informe ejecutivo legible + bloque de código estructurado para restauración directa.
 */
export function generateUnifiedTelegramBackup(params: {
  tickets: SaleTicket[];
  debtors: DebtorCustomer[];
  products: Product[];
  expenses: ExpenseRecord[];
  settings: AppSettings;
}): {
  url: string;
  shareableText: string;
  fullMessageWithCode: string;
  fullJson: string;
} {
  const { tickets, debtors, products, expenses, settings } = params;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-VE');
  const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  // 1. Facturas metrics
  const validTickets = tickets.filter((t) => !t.isVoided);
  const totalFacturadoUSD = validTickets.reduce((sum, t) => sum + t.totalUSD, 0);
  const totalFacturadoVES = validTickets.reduce((sum, t) => sum + t.totalVES, 0);

  let cashUSD = 0;
  let cashVES = 0;
  let pagoMovilVES = 0;
  let puntoVES = 0;
  let fiadoUSD = 0;

  for (const t of validTickets) {
    if (t.paymentMethod === 'mixed' && t.paymentSplits) {
      for (const sp of t.paymentSplits) {
        if (sp.method === 'cash_usd') cashUSD += sp.amountUSD;
        else if (sp.method === 'cash_ves') cashVES += sp.amountUSD * settings.bcvRate;
        else if (sp.method === 'pago_movil') pagoMovilVES += sp.amountUSD * settings.bcvRate;
        else if (sp.method === 'punto') puntoVES += sp.amountUSD * settings.bcvRate;
        else if (sp.method === 'fiado') fiadoUSD += sp.amountUSD;
      }
    } else if (t.paymentMethod === 'cash_usd') {
      cashUSD += t.totalUSD;
    } else if (t.paymentMethod === 'cash_ves') {
      cashVES += t.totalVES;
    } else if (t.paymentMethod === 'pago_movil') {
      pagoMovilVES += t.totalVES;
    } else if (t.paymentMethod === 'punto') {
      puntoVES += t.totalVES;
    } else if (t.paymentMethod === 'fiado') {
      fiadoUSD += t.totalUSD;
    }
  }

  // 2. Fiados metrics
  const totalDeudaUSD = debtors.reduce((sum, d) => sum + d.totalDebtUSD, 0);
  const totalDeudaVES = totalDeudaUSD * settings.bcvRate;
  const topDebtors = debtors.slice(0, 5).map((d) => {
    return `   • ${d.name}: *${formatUSD(d.totalDebtUSD)}* (~${formatVES(d.totalDebtUSD * settings.bcvRate)})`;
  });

  // 3. Egresos y Cuadre de Caja
  const totalEgresosUSD = expenses.reduce((sum, e) => sum + e.amountUSD, 0);
  const totalCobradoUSD = cashUSD + (cashVES + pagoMovilVES + puntoVES) / (settings.bcvRate || 1);
  const saldoNetoCajaUSD = totalCobradoUSD - totalEgresosUSD;

  // 4. Inventario metrics
  const invSummary = calculateInventorySummary(products, settings);
  const lowStockCount = products.filter((p) => p.stock <= (p.minStockAlert || 3)).length;

  const lines = [
    `📦 *RESPALDO GENERAL CONSOLIDADO - TELEGRAM*`,
    `🏪 *${settings.businessName}*`,
    `📅 *Fecha:* ${dateStr} - ${timeStr} | *Tasa BCV:* ${formatVES(settings.bcvRate)}/USD`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🧾 *1. FACTURAS:*`,
    `• Facturas emitidas: *${validTickets.length} válidas* (${tickets.length - validTickets.length} anuladas)`,
    `• Total Facturado: *${formatUSD(totalFacturadoUSD)}* (~${formatVES(totalFacturadoVES)})`,
    `• Efectivo Divisas $: *${formatUSD(cashUSD)}*`,
    `• Pago Móvil: *${formatVES(pagoMovilVES)}* | Punto: *${formatVES(puntoVES)}*`,
    `• Efectivo Bs.: *${formatVES(cashVES)}* | Fiado: *${formatUSD(fiadoUSD)}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📋 *2. LIBRO DE FIADOS:*`,
    `• Clientes con deuda: *${debtors.length} personas*`,
    `• Cartera Total por Cobrar: *${formatUSD(totalDeudaUSD)}* (~${formatVES(totalDeudaVES)})`,
    debtors.length > 0 ? `• Principales deudores:\n${topDebtors.join('\n')}` : '• No hay deudores pendientes.',
    `━━━━━━━━━━━━━━━━━━━━`,
    `📊 *3. CAJA & EGRESOS:*`,
    `• Total Cobrado: *${formatUSD(totalCobradoUSD)}*`,
    `• Total Egresos: *${formatUSD(totalEgresosUSD)}* (${expenses.length} egresos)`,
    `• Saldo Neto en Caja: *${formatUSD(saldoNetoCajaUSD)}* (Efectivo $: *${formatUSD(cashUSD)}*)`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📦 *4. INVENTARIO:*`,
    `• Total Artículos: *${invSummary.totalProducts} productos*`,
    `• Existencia Total: *${invSummary.totalStockKG.toFixed(2)} KG* y *${invSummary.totalStockUnits} UN*`,
    `• Inversión en Mercancía: *${formatUSD(invSummary.totalCostUSD)}*`,
    `• Valor Comercial (PVP): *${formatUSD(invSummary.totalRetailUSD)}* (Ganancia: *+${formatUSD(invSummary.potentialProfitUSD)}*)`,
    lowStockCount > 0 ? `⚠️ *Stock Bajo:* ${lowStockCount} productos` : '✅ Stock en niveles correctos.',
  ];

  const shareableText = lines.join('\n');
  const fullJson = exportDatabaseBackupString();

  // Full message including the embedded restoration payload
  const fullMessageWithCode = `${shareableText}\n━━━━━━━━━━━━━━━━━━━━\n🔄 *CÓDIGO DE RESTAURACIÓN PARA OTRO TELÉFONO:*\n(Copia este mensaje completo o el código siguiente y pégalo en "Restaurar desde Telegram" dentro del POS):\n\n${TELEGRAM_BACKUP_DELIMITER_START}\n${fullJson}\n${TELEGRAM_BACKUP_DELIMITER_END}\n\n🔒 _Respaldo oficial generado por Charcutería Jhojan POS_`;

  // Standard telegram web/app share URL with summary text
  const url = generateTelegramShareUrl(shareableText);

  return {
    url,
    shareableText,
    fullMessageWithCode,
    fullJson,
  };
}

/**
 * Restaura la base de datos a partir de texto o código copiado de Telegram.
 * Detecta automáticamente si el texto incluye los delimitadores de Telegram,
 * si es un bloque JSON directo, o si contiene un fragmento de respaldo.
 */
export function restoreFromTelegramBackup(rawInput: string): {
  success: boolean;
  message: string;
} {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      success: false,
      message: 'Por favor pega el mensaje o código recibido en tu chat de Telegram.',
    };
  }

  let jsonPayload = '';

  // 1. Extraer bloque con delimitadores
  if (
    trimmed.includes(TELEGRAM_BACKUP_DELIMITER_START) &&
    trimmed.includes(TELEGRAM_BACKUP_DELIMITER_END)
  ) {
    const startIndex =
      trimmed.indexOf(TELEGRAM_BACKUP_DELIMITER_START) + TELEGRAM_BACKUP_DELIMITER_START.length;
    const endIndex = trimmed.indexOf(TELEGRAM_BACKUP_DELIMITER_END);
    jsonPayload = trimmed.slice(startIndex, endIndex).trim();
  } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    // 2. Bloque JSON puro
    jsonPayload = trimmed;
  } else {
    // 3. Buscar cualquier objeto JSON dentro del texto
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonPayload = trimmed.slice(firstBrace, lastBrace + 1).trim();
    }
  }

  if (!jsonPayload) {
    return {
      success: false,
      message:
        'No se encontró un código de respaldo válido en el texto pegado. Asegúrate de copiar el mensaje completo de Telegram que contiene el bloque de restauración.',
    };
  }

  // Comprobar si estaba codificado en Base64
  try {
    if (!jsonPayload.startsWith('{')) {
      const decoded = atob(jsonPayload);
      if (decoded.startsWith('{')) {
        jsonPayload = decoded;
      }
    }
  } catch (e) {
    // Continuar con jsonPayload original
  }

  return importDatabaseBackup(jsonPayload);
}

// Compatibilidad básica
export function getLinkedGoogleAccount(): GoogleAccountInfo {
  return {
    email: 'Google Drive',
    isLinked: true,
    displayName: 'Google Drive',
    autoDailyBackupEnabled: false,
  };
}

export function saveLinkedGoogleAccount(_account: GoogleAccountInfo): void {}
export function unlinkGoogleAccount(): void {}
export function getGoogleDailyBackups(_email?: string): GoogleDailyBackup[] {
  return [];
}
export function saveGoogleDailyBackups(_backups: GoogleDailyBackup[]): void {}
export function createDailyGoogleBackup(_customEmail?: string): {
  success: boolean;
  backup: GoogleDailyBackup;
  message: string;
} {
  return {
    success: true,
    backup: {
      id: `drive-${Date.now()}`,
      day: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      accountEmail: 'Google Drive',
      productCount: 0,
      ticketCount: 0,
      expenseCount: 0,
      debtorsCount: 0,
      fidelisCount: 0,
      dataJson: '',
      sizeBytes: 0,
    },
    message: 'Respaldo generado.',
  };
}
export function restoreFromGoogleDailyBackup(_backupId: string): { success: boolean; message: string } {
  return { success: false, message: 'Función reemplazada por Google Drive y Telegram.' };
}
export function restoreFromGoogleEmail(_email: string): { success: boolean; message: string } {
  return { success: false, message: 'Función reemplazada por Google Drive y Telegram.' };
}
export function checkAndRunAutoDailyBackup(): GoogleDailyBackup | null {
  return null;
}

// --- Z-REPORT / CIERRE FISCAL Y DIARIO GENERATOR ---
export type ZReportPeriodFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

export function buildZReportData(
  tickets: SaleTicket[],
  expenses: ExpenseRecord[],
  settings: AppSettings,
  period: ZReportPeriodFilter = 'today',
  customStart?: string,
  customEnd?: string
): ZReportData {
  const now = new Date();
  let startMs = 0;
  let endMs = Infinity;
  let dateRangeLabel = 'Cierre Diario (Hoy)';

  if (period === 'today') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    startMs = startOfToday.getTime();
    endMs = endOfToday.getTime();
    dateRangeLabel = `Hoy (${now.toLocaleDateString('es-VE')})`;
  } else if (period === 'yesterday') {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    startMs = startOfYesterday.getTime();
    endMs = endOfYesterday.getTime();
    dateRangeLabel = `Ayer (${yesterday.toLocaleDateString('es-VE')})`;
  } else if (period === 'week') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startMs = sevenDaysAgo.getTime();
    endMs = now.getTime();
    dateRangeLabel = `Últimos 7 Días`;
  } else if (period === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    startMs = startOfMonth.getTime();
    endMs = endOfMonth.getTime();
    dateRangeLabel = `Este Mes (${now.toLocaleString('es-VE', { month: 'long', year: 'numeric' })})`;
  } else if (period === 'custom' && customStart && customEnd) {
    startMs = new Date(customStart + 'T00:00:00').getTime();
    endMs = new Date(customEnd + 'T23:59:59.999').getTime();
    dateRangeLabel = `Desde ${customStart} hasta ${customEnd}`;
  } else {
    dateRangeLabel = 'Histórico Completo';
  }

  // Filter tickets in period
  const periodTickets = tickets.filter((t) => {
    const tMs = new Date(t.date).getTime();
    return tMs >= startMs && tMs <= endMs;
  });

  // Sort chronologically by ticket number / date
  periodTickets.sort((a, b) => a.ticketNumber - b.ticketNumber);

  // Filter expenses in period
  const periodExpenses = expenses.filter((e) => {
    const eMs = new Date(e.date).getTime();
    return eMs >= startMs && eMs <= endMs;
  });

  // Tickets boundaries
  const firstTicketNumber = periodTickets.length > 0 ? periodTickets[0].ticketNumber : null;
  const lastTicketNumber = periodTickets.length > 0 ? periodTickets[periodTickets.length - 1].ticketNumber : null;
  const totalTicketsIssued = periodTickets.length;

  let validTicketsCount = 0;
  let voidedTicketsCount = 0;
  let grossSalesUSD = 0;
  let grossSalesVES = 0;
  let voidedSalesUSD = 0;
  let voidedSalesVES = 0;

  // Incomes by payment channel
  let incomeCashUSD = 0;
  let incomeCashUSD_inVES = 0;
  let incomeCashVES = 0;
  let incomePuntoVES = 0;
  let incomePagoMovilVES = 0;
  let incomeFiadoUSD = 0;
  let incomeFiadoVES = 0;

  // Products sold aggregation map
  const productSalesMap = new Map<string, ZReportProductSummary>();
  const voidedTicketsList: ZReportData['voidedTicketsList'] = [];

  for (const t of periodTickets) {
    if (t.isVoided) {
      voidedTicketsCount++;
      voidedSalesUSD += t.totalUSD;
      voidedSalesVES += t.totalVES;
      voidedTicketsList.push({
        ticketNumber: t.ticketNumber,
        customerName: t.customerName,
        totalUSD: t.totalUSD,
        reason: t.voidReason || 'Error en producto / Factura mala',
      });
      continue;
    }

    validTicketsCount++;
    grossSalesUSD += t.totalUSD;
    grossSalesVES += t.totalVES;

    // Income channels
    if (t.paymentMethod === 'cash_usd') {
      incomeCashUSD += t.totalUSD;
      incomeCashUSD_inVES += t.totalVES;
    } else if (t.paymentMethod === 'cash_ves') {
      incomeCashVES += t.totalVES;
    } else if (t.paymentMethod === 'punto') {
      incomePuntoVES += t.totalVES;
    } else if (t.paymentMethod === 'pago_movil') {
      incomePagoMovilVES += t.totalVES;
    } else if (t.paymentMethod === 'fiado') {
      incomeFiadoUSD += t.pendingUSD;
      incomeFiadoVES += t.pendingVES;
    } else if (t.paymentMethod === 'mixed' && t.paymentSplits) {
      for (const sp of t.paymentSplits) {
        if (sp.method === 'cash_usd') {
          incomeCashUSD += sp.amountUSD;
          incomeCashUSD_inVES += sp.amountVES;
        } else if (sp.method === 'cash_ves') {
          incomeCashVES += sp.amountVES;
        } else if (sp.method === 'punto') {
          incomePuntoVES += sp.amountVES;
        } else if (sp.method === 'pago_movil') {
          incomePagoMovilVES += sp.amountVES;
        } else if (sp.method === 'fiado') {
          incomeFiadoUSD += sp.amountUSD;
          incomeFiadoVES += sp.amountVES;
        }
      }
    }

    // Products breakdown
    for (const item of t.items) {
      const pid = item.product.id;
      const unitCost = typeof item.product.costUSD === 'number' && item.product.costUSD > 0
        ? item.product.costUSD
        : item.unitPriceUSD * 0.72;
      const itemCost = Math.round(unitCost * item.quantity * 100) / 100;
      const existing = productSalesMap.get(pid);
      if (existing) {
        existing.quantitySold += item.quantity;
        existing.totalUSD += item.totalUSD;
        existing.totalVES += item.totalVES;
        existing.totalCostUSD = (existing.totalCostUSD || 0) + itemCost;
        existing.grossProfitUSD = Math.round((existing.totalUSD - (existing.totalCostUSD || 0)) * 100) / 100;
      } else {
        const grossProfit = Math.round((item.totalUSD - itemCost) * 100) / 100;
        const margin = itemCost > 0 ? Math.round((grossProfit / itemCost) * 1000) / 10 : 35.0;
        productSalesMap.set(pid, {
          productId: pid,
          productName: item.product.name,
          unit: item.product.unit,
          category: item.product.category,
          quantitySold: item.quantity,
          totalUSD: item.totalUSD,
          totalVES: item.totalVES,
          unitCostUSD: unitCost,
          unitPriceUSD: item.unitPriceUSD,
          marginPercent: item.product.marginPercent ?? margin,
          totalCostUSD: itemCost,
          grossProfitUSD: grossProfit,
        });
      }
    }
  }

  // Recalculate margin % and round profit for all aggregated products
  for (const item of productSalesMap.values()) {
    const cost = item.totalCostUSD || 0;
    item.grossProfitUSD = Math.round((item.totalUSD - cost) * 100) / 100;
    if (cost > 0) {
      item.marginPercent = Math.round((item.grossProfitUSD / cost) * 1000) / 10;
    }
  }

  // Abonos collected during this period (from all tickets that have abonos in this period)
  let collectedAbonosUSD = 0;
  let collectedAbonosVES = 0;

  for (const t of tickets) {
    if (t.abonos && t.abonos.length > 0) {
      for (const ab of t.abonos) {
        const abMs = new Date(ab.date).getTime();
        if (abMs >= startMs && abMs <= endMs) {
          collectedAbonosUSD += ab.amountUSD;
          collectedAbonosVES += ab.amountVES;

          if (ab.method === 'cash_usd') {
            incomeCashUSD += ab.amountUSD;
            incomeCashUSD_inVES += ab.amountVES;
          } else if (ab.method === 'cash_ves') {
            incomeCashVES += ab.amountVES;
          } else if (ab.method === 'punto') {
            incomePuntoVES += ab.amountVES;
          } else if (ab.method === 'pago_movil') {
            incomePagoMovilVES += ab.amountVES;
          }
        }
      }
    }
  }

  // Expenses totals & breakdowns
  let totalExpensesUSD = 0;
  let totalExpensesVES = 0;
  let expensesCashUSD = 0;
  let expensesCashVES = 0;
  let expensesDigitalVES = 0;

  const categoryExpensesMap = new Map<
    string,
    { category: any; totalUSD: number; totalVES: number; count: number }
  >();

  for (const exp of periodExpenses) {
    totalExpensesUSD += exp.amountUSD;
    totalExpensesVES += exp.amountVES;

    if (exp.paymentMethod === 'cash_usd') {
      expensesCashUSD += exp.amountUSD;
    } else if (exp.paymentMethod === 'cash_ves') {
      expensesCashVES += exp.amountVES;
    } else {
      expensesDigitalVES += exp.amountVES;
    }

    const catExisting = categoryExpensesMap.get(exp.category);
    if (catExisting) {
      catExisting.totalUSD += exp.amountUSD;
      catExisting.totalVES += exp.amountVES;
      catExisting.count++;
    } else {
      categoryExpensesMap.set(exp.category, {
        category: exp.category,
        totalUSD: exp.amountUSD,
        totalVES: exp.amountVES,
        count: 1,
      });
    }
  }

  // Expected Cash Drawer / Arqueo
  const expectedCashDrawerUSD = Math.max(0, incomeCashUSD - expensesCashUSD);
  const expectedCashDrawerVES = Math.max(0, incomeCashVES - expensesCashVES);
  const expectedDigitalVES = Math.max(0, incomePuntoVES + incomePagoMovilVES - expensesDigitalVES);

  const netSalesUSD = grossSalesUSD;
  const netSalesVES = grossSalesVES;
  const netOperatingFlowUSD = netSalesUSD - totalExpensesUSD;
  const netOperatingFlowVES = netSalesVES - totalExpensesVES;

  // Products array sorted by quantity descending
  const productsSold = Array.from(productSalesMap.values()).sort(
    (a, b) => b.quantitySold - a.quantitySold
  );

  let totalUnitsCount = 0;
  let totalKilosWeight = 0;
  for (const p of productsSold) {
    if (p.unit === 'KG') {
      totalKilosWeight += p.quantitySold;
    } else {
      totalUnitsCount += p.quantitySold;
    }
  }

  const reportNumber = Math.floor(Math.abs(startMs / 86400000)) % 10000 || 1;

  return {
    reportNumber,
    generatedAt: now.toISOString(),
    dateRangeLabel,
    startDate: new Date(startMs).toISOString(),
    endDate: new Date(Math.min(endMs, now.getTime())).toISOString(),
    firstTicketNumber,
    lastTicketNumber,
    totalTicketsIssued,
    validTicketsCount,
    voidedTicketsCount,
    grossSalesUSD,
    grossSalesVES,
    voidedSalesUSD,
    voidedSalesVES,
    netSalesUSD,
    netSalesVES,
    incomeCashUSD,
    incomeCashUSD_inVES,
    incomeCashVES,
    incomePuntoVES,
    incomePagoMovilVES,
    incomeFiadoUSD,
    incomeFiadoVES,
    collectedAbonosUSD,
    collectedAbonosVES,
    expensesCount: periodExpenses.length,
    totalExpensesUSD,
    totalExpensesVES,
    expensesCashUSD,
    expensesCashVES,
    expensesDigitalVES,
    expensesByCategory: Array.from(categoryExpensesMap.values()).sort((a, b) => b.totalUSD - a.totalUSD),
    expectedCashDrawerUSD,
    expectedCashDrawerVES,
    expectedDigitalVES,
    netOperatingFlowUSD,
    netOperatingFlowVES,
    productsSold,
    totalUnitsCount,
    totalKilosWeight,
    voidedTicketsList,
    currentBcvRate: settings.bcvRate,
  };
}

// Generate formatted WhatsApp message for Reporte Z
export function generateWhatsAppZReport(
  report: ZReportData,
  settings: AppSettings
): { url: string; message: string } {
  const lines: string[] = [
    `📊 *REPORTE Z - CIERRE DE CAJA*`,
    `🏪 *${settings.businessName}*`,
    `📋 RIF: ${settings.rif} | 📅 ${report.dateRangeLabel}`,
    `⏰ Generado: ${new Date(report.generatedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`,
    `💵 Tasa BCV: ${formatVES(report.currentBcvRate)}/USD`,
    `----------------------------------------`,
    `🧾 *RESUMEN DE FACTURACIÓN:*`,
    `• Tickets Emitidos: ${report.totalTicketsIssued} (N° ${report.firstTicketNumber || 0} al N° ${report.lastTicketNumber || 0})`,
    `• Facturas Válidas: ${report.validTicketsCount}`,
    report.voidedTicketsCount > 0 ? `• Facturas Anuladas: ${report.voidedTicketsCount} (${formatUSD(report.voidedSalesUSD)})` : null,
    `• *VENTAS BRUTAS: ${formatUSD(report.grossSalesUSD)} / ${formatVES(report.grossSalesVES)}*`,
    `----------------------------------------`,
    `💰 *DESGLOSE DE INGRESOS:*`,
    `• 💵 Efectivo $: ${formatUSD(report.incomeCashUSD)}`,
    `• 🇻🇪 Efectivo Bs.: ${formatVES(report.incomeCashVES)}`,
    `• 💳 Punto de Venta: ${formatVES(report.incomePuntoVES)}`,
    `• 📲 Pago Móvil: ${formatVES(report.incomePagoMovilVES)}`,
    report.incomeFiadoUSD > 0 ? `• ⏳ Crédito / Fiado Otorgado: ${formatUSD(report.incomeFiadoUSD)}` : null,
    report.collectedAbonosUSD > 0 ? `• 📥 Abonos de Fiados Cobrados: ${formatUSD(report.collectedAbonosUSD)}` : null,
    `----------------------------------------`,
    `📉 *EGRESOS Y GASTOS OPERATIVOS:*`,
    `• Total Egresos Registrados: ${report.expensesCount}`,
    `• *TOTAL EGRESOS: -${formatUSD(report.totalExpensesUSD)} / -${formatVES(report.totalExpensesVES)}*`,
    `  - Salida Efectivo $: -${formatUSD(report.expensesCashUSD)}`,
    `  - Salida Efectivo Bs.: -${formatVES(report.expensesCashVES)}`,
    `  - Salida Banco/Pago Móvil: -${formatVES(report.expensesDigitalVES)}`,
    `----------------------------------------`,
    `📥 *ARQUEO DE CAJA (EFECTIVO ESPERADO):*`,
    `• 💵 Efectivo $ en Gaveta: *${formatUSD(report.expectedCashDrawerUSD)}*`,
    `• 🇻🇪 Efectivo Bs. en Gaveta: *${formatVES(report.expectedCashDrawerVES)}*`,
    `• 💳 En Bancos (Punto + PM): *${formatVES(report.expectedDigitalVES)}*`,
    `----------------------------------------`,
    `📈 *BALANCE OPERATIVO NETO:*`,
    `• *FLUJO NETO: ${formatUSD(report.netOperatingFlowUSD)} / ${formatVES(report.netOperatingFlowVES)}*`,
    `• Mercancía despachada: ${report.totalKilosWeight.toFixed(2)} KG y ${report.totalUnitsCount} UN`,
    `----------------------------------------`,
    `_Reporte emitido desde Charcutería Jhojan POS_`,
  ].filter(Boolean) as string[];

  const message = lines.join('\n');
  const encoded = encodeURIComponent(message);
  const cleanPhone = sanitizePhoneForWhatsApp(settings.phone);
  const url = `https://wa.me/${cleanPhone}?text=${encoded}`;

  return { url, message };
}

// --- REPORTE INTEGRAL DEL SISTEMA: PÉRDIDAS Y GANANCIAS (P&L) ---
export function buildSystemPandLReport(
  tickets: SaleTicket[],
  expenses: ExpenseRecord[],
  restocks: RestockRecord[],
  products: Product[],
  settings: AppSettings,
  period: ZReportPeriodFilter = 'month',
  customStart?: string,
  customEnd?: string,
  mermas?: MermaRecord[]
): SystemPandLData {
  const now = new Date();
  let startMs = 0;
  let endMs = Infinity;
  let periodLabel = 'Este Mes';

  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    startMs = start.getTime();
    endMs = end.getTime();
    periodLabel = `Hoy (${now.toLocaleDateString('es-VE')})`;
  } else if (period === 'yesterday') {
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
    const end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
    startMs = start.getTime();
    endMs = end.getTime();
    periodLabel = `Ayer (${yest.toLocaleDateString('es-VE')})`;
  } else if (period === 'week') {
    startMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    endMs = now.getTime();
    periodLabel = 'Últimos 7 Días';
  } else if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    startMs = start.getTime();
    endMs = end.getTime();
    periodLabel = `Mes Actual (${now.toLocaleString('es-VE', { month: 'long', year: 'numeric' })})`;
  } else if (period === 'custom' && customStart && customEnd) {
    startMs = new Date(customStart + 'T00:00:00').getTime();
    endMs = new Date(customEnd + 'T23:59:59.999').getTime();
    periodLabel = `Desde ${customStart} hasta ${customEnd}`;
  } else {
    periodLabel = 'Histórico Completo';
  }

  // 1. Filter tickets in period
  const periodTickets = tickets.filter((t) => {
    const ms = new Date(t.date).getTime();
    return ms >= startMs && ms <= endMs;
  });

  let validTicketsCount = 0;
  let voidedTicketsCount = 0;
  let totalSalesUSD = 0;
  let totalSalesVES = 0;
  let voidedSalesUSD = 0;
  let voidedSalesVES = 0;

  let collectedSalesUSD = 0;
  let collectedSalesVES = 0;
  let creditSalesUSD = 0;
  let creditSalesVES = 0;

  let cashUSD = 0;
  let cashUSD_inVES = 0;
  let cashVES = 0;
  let puntoVES = 0;
  let pagoMovilVES = 0;
  let fiadoUSD = 0;

  // Product sales map for COGS and top sellers
  const productSalesMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      unit: 'KG' | 'UN';
      category: any;
      quantitySold: number;
      revenueUSD: number;
      costUSD: number;
    }
  >();

  let totalWeightSoldKG = 0;
  let totalUnitsSoldUN = 0;

  for (const t of periodTickets) {
    if (t.isVoided) {
      voidedTicketsCount++;
      voidedSalesUSD += t.totalUSD;
      voidedSalesVES += t.totalVES;
      continue;
    }

    validTicketsCount++;
    totalSalesUSD += t.totalUSD;
    totalSalesVES += t.totalVES;

    // Track credit vs immediate collection
    if (t.paymentMethod === 'fiado') {
      creditSalesUSD += t.totalUSD;
      creditSalesVES += t.totalVES;
      fiadoUSD += t.totalUSD;
    } else if (t.paymentMethod === 'mixed' && t.paymentSplits) {
      for (const split of t.paymentSplits) {
        if (split.method === 'cash_usd') {
          cashUSD += split.amountUSD;
          cashUSD_inVES += split.amountVES;
          collectedSalesUSD += split.amountUSD;
          collectedSalesVES += split.amountVES;
        } else if (split.method === 'cash_ves') {
          cashVES += split.amountVES;
          collectedSalesVES += split.amountVES;
          collectedSalesUSD += split.amountUSD;
        } else if (split.method === 'punto') {
          puntoVES += split.amountVES;
          collectedSalesVES += split.amountVES;
          collectedSalesUSD += split.amountUSD;
        } else if (split.method === 'pago_movil') {
          pagoMovilVES += split.amountVES;
          collectedSalesVES += split.amountVES;
          collectedSalesUSD += split.amountUSD;
        } else if (split.method === 'fiado') {
          fiadoUSD += split.amountUSD;
          creditSalesUSD += split.amountUSD;
          creditSalesVES += split.amountVES;
        }
      }
    } else {
      collectedSalesUSD += t.totalUSD;
      collectedSalesVES += t.totalVES;
      if (t.paymentMethod === 'cash_usd') {
        cashUSD += t.totalUSD;
        cashUSD_inVES += t.totalVES;
      } else if (t.paymentMethod === 'cash_ves') {
        cashVES += t.totalVES;
      } else if (t.paymentMethod === 'punto') {
        puntoVES += t.totalVES;
      } else if (t.paymentMethod === 'pago_movil') {
        pagoMovilVES += t.totalVES;
      }
    }

    // Process items for COGS and quantities
    for (const item of t.items) {
      if (item.product.unit === 'KG') {
        totalWeightSoldKG += item.quantity;
      } else {
        totalUnitsSoldUN += item.quantity;
      }

      // Determine product unit cost
      const prodInCatalog = products.find((p) => p.id === item.product.id);
      const unitCost = prodInCatalog?.costUSD || item.product.costUSD || item.unitPriceUSD * 0.65;
      const itemCost = Math.round(unitCost * item.quantity * 100) / 100;

      const existing = productSalesMap.get(item.product.id);
      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenueUSD += item.totalUSD;
        existing.costUSD += itemCost;
      } else {
        productSalesMap.set(item.product.id, {
          productId: item.product.id,
          productName: item.product.name,
          unit: item.product.unit,
          category: item.product.category,
          quantitySold: item.quantity,
          revenueUSD: item.totalUSD,
          costUSD: itemCost,
        });
      }
    }
  }

  // Abonos de fiados recibidos dentro del periodo seleccionado
  let collectedFiadosAbonosUSD = 0;
  let collectedFiadosAbonosVES = 0;
  for (const t of tickets) {
    if (t.abonos && t.abonos.length > 0) {
      for (const ab of t.abonos) {
        const abMs = new Date(ab.date).getTime();
        if (abMs >= startMs && abMs <= endMs) {
          collectedFiadosAbonosUSD += ab.amountUSD;
          collectedFiadosAbonosVES += ab.amountVES;
          if (ab.method === 'cash_usd') {
            cashUSD += ab.amountUSD;
            cashUSD_inVES += ab.amountVES;
          } else if (ab.method === 'cash_ves') {
            cashVES += ab.amountVES;
          } else if (ab.method === 'punto') {
            puntoVES += ab.amountVES;
          } else if (ab.method === 'pago_movil') {
            pagoMovilVES += ab.amountVES;
          }
        }
      }
    }
  }

  // Calculate total Cost of Goods Sold (COGS)
  let costOfGoodsSoldUSD = 0;
  const topProducts = Array.from(productSalesMap.values()).map((p) => {
    costOfGoodsSoldUSD += p.costUSD;
    const profit = Math.round((p.revenueUSD - p.costUSD) * 100) / 100;
    const margin = p.revenueUSD > 0 ? Math.round((profit / p.revenueUSD) * 1000) / 10 : 0;
    return {
      productId: p.productId,
      productName: p.productName,
      unit: p.unit,
      category: p.category,
      quantitySold: Math.round(p.quantitySold * 1000) / 1000,
      revenueUSD: Math.round(p.revenueUSD * 100) / 100,
      costUSD: Math.round(p.costUSD * 100) / 100,
      profitUSD: profit,
      marginPercent: margin,
    };
  });
  topProducts.sort((a, b) => b.revenueUSD - a.revenueUSD);
  costOfGoodsSoldUSD = Math.round(costOfGoodsSoldUSD * 100) / 100;
  const costOfGoodsSoldVES = Math.round(costOfGoodsSoldUSD * settings.bcvRate * 100) / 100;

  // 2. Restocks in period
  const periodRestocks = restocks.filter((r) => {
    const ms = new Date(r.date).getTime();
    return ms >= startMs && ms <= endMs;
  });

  let totalRestocksCostUSD = 0;
  let restocksPaidUSD = 0;
  let restocksPendingUSD = 0;

  for (const r of periodRestocks) {
    totalRestocksCostUSD += r.totalCostUSD;
    restocksPaidUSD += r.paidUSD;
    restocksPendingUSD += r.pendingUSD;
  }
  const totalRestocksCostVES = Math.round(totalRestocksCostUSD * settings.bcvRate * 100) / 100;
  const restocksPaidVES = Math.round(restocksPaidUSD * settings.bcvRate * 100) / 100;
  const restocksPendingVES = Math.round(restocksPendingUSD * settings.bcvRate * 100) / 100;

  // 3. Expenses in period
  const periodExpenses = expenses.filter((e) => {
    const ms = new Date(e.date).getTime();
    return ms >= startMs && ms <= endMs;
  });

  let totalExpensesUSD = 0;
  let totalExpensesVES = 0;
  let operatingExpensesUSD = 0;
  let operatingExpensesVES = 0;
  let expensesCashUSD = 0;
  let expensesCashVES = 0;
  let expensesDigitalVES = 0;

  const categoryMap = new Map<string, { totalUSD: number; totalVES: number; count: number }>();

  for (const exp of periodExpenses) {
    totalExpensesUSD += exp.amountUSD;
    totalExpensesVES += exp.amountVES;

    if (exp.category !== 'Mercancía/Proveedores') {
      operatingExpensesUSD += exp.amountUSD;
      operatingExpensesVES += exp.amountVES;
    }

    if (exp.paymentMethod === 'cash_usd') {
      expensesCashUSD += exp.amountUSD;
    } else if (exp.paymentMethod === 'cash_ves') {
      expensesCashVES += exp.amountVES;
    } else {
      expensesDigitalVES += exp.amountVES;
    }

    const cat = categoryMap.get(exp.category) || { totalUSD: 0, totalVES: 0, count: 0 };
    cat.totalUSD += exp.amountUSD;
    cat.totalVES += exp.amountVES;
    cat.count++;
    categoryMap.set(exp.category, cat);
  }

  const expensesByCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category: category as any,
    totalUSD: Math.round(data.totalUSD * 100) / 100,
    totalVES: Math.round(data.totalVES * 100) / 100,
    count: data.count,
  }));

  // 3b. Mermas Físicas y Desperdicios por Manipulación en el periodo
  const actualMermas = mermas && mermas.length > 0 ? mermas : loadMermas();
  const periodMermas = actualMermas.filter((m) => {
    const ms = new Date(m.date).getTime();
    return ms >= startMs && ms <= endMs;
  });

  let totalMermaCostUSD = 0;
  let totalMermaWeightKG = 0;
  let totalMermaUnitsUN = 0;
  const mermaReasonMap = new Map<MermaReason, { totalUSD: number; count: number; weightKG: number }>();

  for (const m of periodMermas) {
    totalMermaCostUSD += m.totalCostUSD;
    if (m.unit === 'KG') {
      totalMermaWeightKG += m.quantity;
    } else {
      totalMermaUnitsUN += m.quantity;
    }
    const curr = mermaReasonMap.get(m.reason) || { totalUSD: 0, count: 0, weightKG: 0 };
    curr.totalUSD += m.totalCostUSD;
    curr.count++;
    if (m.unit === 'KG') curr.weightKG += m.quantity;
    mermaReasonMap.set(m.reason, curr);
  }

  totalMermaCostUSD = Math.round(totalMermaCostUSD * 100) / 100;
  const totalMermaCostVES = Math.round(totalMermaCostUSD * settings.bcvRate * 100) / 100;
  const mermasBreakdown = Array.from(mermaReasonMap.entries()).map(([reason, d]) => ({
    reason,
    totalUSD: Math.round(d.totalUSD * 100) / 100,
    totalVES: Math.round(d.totalUSD * settings.bcvRate * 100) / 100,
    count: d.count,
    weightKG: Math.round(d.weightKG * 1000) / 1000,
  }));

  // 4. Utilidad Bruta = Ventas Totales - Costo de Mercancía Vendida
  const grossProfitUSD = Math.round((totalSalesUSD - costOfGoodsSoldUSD) * 100) / 100;
  const grossProfitVES = Math.round((totalSalesVES - costOfGoodsSoldVES) * 100) / 100;
  const grossMarginPercent = totalSalesUSD > 0 ? Math.round((grossProfitUSD / totalSalesUSD) * 1000) / 10 : 0;

  // 5. Ganancia o Pérdida Neta Real = Utilidad Bruta - Gastos Operativos - Mermas Físicas
  const netProfitUSD = Math.round((grossProfitUSD - operatingExpensesUSD - totalMermaCostUSD) * 100) / 100;
  const netProfitVES = Math.round((grossProfitVES - operatingExpensesVES - totalMermaCostVES) * 100) / 100;
  const netMarginPercent = totalSalesUSD > 0 ? Math.round((netProfitUSD / totalSalesUSD) * 1000) / 10 : 0;
  const isProfit = netProfitUSD >= 0;

  // 6. Cuentas Corrientes Globales del Sistema (Estado actual)
  let currentAccountsReceivableUSD = 0;
  for (const t of tickets) {
    if (!t.isVoided && (t.status === 'pending' || t.status === 'partially_paid') && t.pendingUSD > 0) {
      currentAccountsReceivableUSD += t.pendingUSD;
    }
  }
  const currentAccountsReceivableVES = Math.round(currentAccountsReceivableUSD * settings.bcvRate * 100) / 100;

  let currentAccountsPayableUSD = 0;
  for (const r of restocks) {
    if (!r.isPaid && r.pendingUSD > 0) {
      currentAccountsPayableUSD += r.pendingUSD;
    }
  }
  const currentAccountsPayableVES = Math.round(currentAccountsPayableUSD * settings.bcvRate * 100) / 100;

  // 7. Flujo de Caja en Mano
  const cashInDrawerUSD = Math.max(0, Math.round((cashUSD - expensesCashUSD) * 100) / 100);
  const cashInDrawerVES = Math.max(0, Math.round((cashVES - expensesCashVES) * 100) / 100);
  const digitalInBankVES = Math.max(0, Math.round((puntoVES + pagoMovilVES - expensesDigitalVES) * 100) / 100);

  return {
    periodLabel,
    startDate: new Date(startMs).toISOString().slice(0, 10),
    endDate: new Date(endMs === Infinity ? Date.now() : endMs).toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    bcvRate: settings.bcvRate,

    totalSalesUSD: Math.round(totalSalesUSD * 100) / 100,
    totalSalesVES: Math.round(totalSalesVES * 100) / 100,
    validTicketsCount,
    voidedTicketsCount,
    voidedSalesUSD: Math.round(voidedSalesUSD * 100) / 100,
    voidedSalesVES: Math.round(voidedSalesVES * 100) / 100,

    collectedSalesUSD: Math.round(collectedSalesUSD * 100) / 100,
    collectedSalesVES: Math.round(collectedSalesVES * 100) / 100,
    creditSalesUSD: Math.round(creditSalesUSD * 100) / 100,
    creditSalesVES: Math.round(creditSalesVES * 100) / 100,
    collectedFiadosAbonosUSD: Math.round(collectedFiadosAbonosUSD * 100) / 100,
    collectedFiadosAbonosVES: Math.round(collectedFiadosAbonosVES * 100) / 100,

    salesByMethod: {
      cashUSD: Math.round(cashUSD * 100) / 100,
      cashUSD_inVES: Math.round(cashUSD_inVES * 100) / 100,
      cashVES: Math.round(cashVES * 100) / 100,
      puntoVES: Math.round(puntoVES * 100) / 100,
      pagoMovilVES: Math.round(pagoMovilVES * 100) / 100,
      fiadoUSD: Math.round(fiadoUSD * 100) / 100,
    },

    totalRestocksCostUSD: Math.round(totalRestocksCostUSD * 100) / 100,
    totalRestocksCostVES,
    restocksPaidUSD: Math.round(restocksPaidUSD * 100) / 100,
    restocksPaidVES,
    restocksPendingUSD: Math.round(restocksPendingUSD * 100) / 100,
    restocksPendingVES,
    costOfGoodsSoldUSD,
    costOfGoodsSoldVES,

    grossProfitUSD,
    grossProfitVES,
    grossMarginPercent,

    operatingExpensesUSD: Math.round(operatingExpensesUSD * 100) / 100,
    operatingExpensesVES: Math.round(operatingExpensesVES * 100) / 100,
    totalExpensesUSD: Math.round(totalExpensesUSD * 100) / 100,
    totalExpensesVES: Math.round(totalExpensesVES * 100) / 100,
    expensesByCategory,

    netProfitUSD,
    netProfitVES,
    netMarginPercent,
    isProfit,

    totalMermaCostUSD,
    totalMermaCostVES,
    totalMermaWeightKG: Math.round(totalMermaWeightKG * 1000) / 1000,
    totalMermaUnitsUN,
    mermasCount: periodMermas.length,
    mermasBreakdown,

    currentAccountsReceivableUSD: Math.round(currentAccountsReceivableUSD * 100) / 100,
    currentAccountsReceivableVES,
    currentAccountsPayableUSD: Math.round(currentAccountsPayableUSD * 100) / 100,
    currentAccountsPayableVES,

    cashInDrawerUSD,
    cashInDrawerVES,
    digitalInBankVES,

    totalWeightSoldKG: Math.round(totalWeightSoldKG * 1000) / 1000,
    totalUnitsSoldUN,
    topProducts,
  };
}

export function generateWhatsAppPandLReport(
  report: SystemPandLData,
  settings: AppSettings
): { url: string; message: string } {
  const isProfit = report.isProfit;
  const resultHeader = isProfit
    ? `🟢 *GANANCIA NETA: ${formatUSD(report.netProfitUSD)} (${report.netMarginPercent}%)*`
    : `🔴 *PÉRDIDA NETA: -${formatUSD(Math.abs(report.netProfitUSD))}*`;

  const lines = [
    `📊 *ESTADO INTEGRAL DE PÉRDIDAS Y GANANCIAS (P&L)*`,
    `🏪 *${settings.businessName}*`,
    `📅 Período: ${report.periodLabel}`,
    `💵 Tasa BCV: ${formatVES(report.bcvRate)}/USD`,
    `----------------------------------------`,
    `📈 *VENTAS E INGRESOS:*`,
    `• Facturas Válidas: ${report.validTicketsCount} transacciones`,
    `• *Ventas Totales: ${formatUSD(report.totalSalesUSD)}* (${formatVES(report.totalSalesVES)})`,
    `• Cobranza Inmediata: ${formatUSD(report.collectedSalesUSD)}`,
    report.creditSalesUSD > 0 ? `• Fiados Otorgados: ${formatUSD(report.creditSalesUSD)}` : null,
    report.collectedFiadosAbonosUSD > 0 ? `• Abonos Fiados Cobrados: ${formatUSD(report.collectedFiadosAbonosUSD)}` : null,
    `----------------------------------------`,
    `📦 *COSTO DE MERCANCÍA Y MARGEN:*`,
    `• Costo de Mercancía Vendida (COGS): -${formatUSD(report.costOfGoodsSoldUSD)}`,
    `• *UTILIDAD BRUTA: ${formatUSD(report.grossProfitUSD)}* (Margen: ${report.grossMarginPercent}%)`,
    `----------------------------------------`,
    `📉 *GASTOS Y MERMAS DEDUCIDOS:*`,
    `• Total Gastos Operativos: -${formatUSD(report.operatingExpensesUSD)}`,
    report.totalMermaCostUSD > 0
      ? `• 🧀 Mermas Físicas / Manipulación: -${formatUSD(report.totalMermaCostUSD)} (${report.totalMermaWeightKG.toFixed(3)} kg, ${report.mermasCount} reg.)`
      : null,
    `----------------------------------------`,
    `🏆 *RESULTADO FINAL NETO:*`,
    resultHeader,
    `• En Bolívares: ${formatVES(report.netProfitVES)}`,
    `----------------------------------------`,
    `⚖️ *SALDOS Y CUENTAS CORRIENTES:*`,
    `• 📥 Cuentas por Cobrar (Fiados en calle): ${formatUSD(report.currentAccountsReceivableUSD)}`,
    `• 📤 Cuentas por Pagar a Proveedores: ${formatUSD(report.currentAccountsPayableUSD)}`,
    `----------------------------------------`,
    `💵 *EFECTIVO EN CAJA Y BANCOS:*`,
    `• Efectivo $ en Gaveta: ${formatUSD(report.cashInDrawerUSD)}`,
    `• Efectivo Bs. en Gaveta: ${formatVES(report.cashInDrawerVES)}`,
    `• Banco (Punto + PM): ${formatVES(report.digitalInBankVES)}`,
    `----------------------------------------`,
    `_Informe generado automáticamente desde Charcutería Jhojan POS_`,
  ].filter(Boolean) as string[];

  const message = lines.join('\n');
  const encoded = encodeURIComponent(message);
  const cleanPhone = sanitizePhoneForWhatsApp(settings.phone);
  const url = `https://wa.me/${cleanPhone}?text=${encoded}`;

  return { url, message };
}

// --- EXPORTACIÓN A EXCEL / CSV PARA CONTABILIDAD EXTERNA ---

function downloadCSVFile(filename: string, csvContent: string): void {
  // \uFEFF es el BOM de UTF-8 que obliga a Microsoft Excel a abrir con tildes y caracteres en español correctamente
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCSVField(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exporta el libro de ventas (facturas y tickets) a formato CSV compatible con Microsoft Excel.
 */
export function exportTicketsToCSV(
  tickets: SaleTicket[],
  settings: AppSettings,
  periodLabel = 'historico'
): void {
  const headers = [
    'Nro Ticket',
    'Fecha',
    'Hora',
    'Cliente',
    'Cedula',
    'Telefono',
    'Metodo de Pago',
    'Estado',
    'Total USD',
    'Tasa BCV',
    'Total VES',
    'Cobrado USD',
    'Saldo Pendiente USD',
    'Cant. Articulos',
    'Detalle de Productos y Gramajes',
    'Notas / Motivo Anulacion',
  ];

  const methodTranslations: Record<string, string> = {
    cash_usd: 'Efectivo USD ($)',
    cash_ves: 'Efectivo Bs.',
    punto: 'Punto de Venta',
    pago_movil: 'Pago Movil',
    fiado: 'Fiado (Credito)',
    mixed: 'Pago Mixto (Combinado)',
  };

  const statusTranslations: Record<string, string> = {
    paid: 'Cobrado',
    pending: 'Pendiente (Fiado)',
    partially_paid: 'Abonado Parcial',
    voided: 'ANULADO',
  };

  const rows = tickets.map((t) => {
    const d = new Date(t.date);
    const dateStr = d.toLocaleDateString('es-VE');
    const timeStr = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

    const itemsSummary = t.items
      .map(
        (i) =>
          `${i.product.name} (${i.product.unit === 'KG' ? `${i.quantity.toFixed(3)} KG` : `${i.quantity} UN`} @ $${i.unitPriceUSD.toFixed(2)})`
      )
      .join('; ');

    const totalAbonado = (t.abonos || []).reduce((sum, a) => sum + a.amountUSD, 0);
    const cobradoUSD = t.status === 'paid' ? t.totalUSD : totalAbonado;

    return [
      escapeCSVField(t.ticketNumber),
      escapeCSVField(dateStr),
      escapeCSVField(timeStr),
      escapeCSVField(t.customerName),
      escapeCSVField(t.customerCedula),
      escapeCSVField(t.customerPhone),
      escapeCSVField(methodTranslations[t.paymentMethod] || t.paymentMethod),
      escapeCSVField(t.isVoided ? 'ANULADO' : statusTranslations[t.status] || t.status),
      escapeCSVField(t.totalUSD.toFixed(2)),
      escapeCSVField(t.bcvRate.toFixed(2)),
      escapeCSVField(t.totalVES.toFixed(2)),
      escapeCSVField(cobradoUSD.toFixed(2)),
      escapeCSVField((t.pendingUSD || 0).toFixed(2)),
      escapeCSVField(t.items.length),
      escapeCSVField(itemsSummary),
      escapeCSVField(t.isVoided ? `ANULADO: ${t.voidReason || 'Sin motivo'}` : t.notes || ''),
    ].join(';');
  });

  const csvContent = [headers.join(';'), ...rows].join('\r\n');
  const cleanPeriod = periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSVFile(`ventas-charcuteria-jhojan-${cleanPeriod}-${dateStr}.csv`, csvContent);
}

/**
 * Exporta el libro de deudores y cuentas por cobrar a formato CSV compatible con Microsoft Excel.
 */
export function exportDebtorsToCSV(
  debtors: DebtorCustomer[],
  settings: AppSettings
): void {
  const headers = [
    'Nombre del Cliente',
    'Cedula',
    'Telefono',
    'Total Deuda USD',
    'Tasa BCV',
    'Total Deuda VES',
    'Tickets Pendientes',
    'Ultima Compra',
    'Numeros de Ticket Asociados',
  ];

  const rows = debtors.map((d) => {
    const ticketNums = d.tickets.map((t) => `#${t.ticketNumber}`).join(', ');
    const lastDate = d.lastPurchaseDate
      ? new Date(d.lastPurchaseDate).toLocaleDateString('es-VE')
      : 'N/A';

    return [
      escapeCSVField(d.name),
      escapeCSVField(d.cedula),
      escapeCSVField(d.phone),
      escapeCSVField(d.totalDebtUSD.toFixed(2)),
      escapeCSVField(settings.bcvRate.toFixed(2)),
      escapeCSVField(d.totalDebtVES.toFixed(2)),
      escapeCSVField(d.tickets.length),
      escapeCSVField(lastDate),
      escapeCSVField(ticketNums),
    ].join(';');
  });

  const csvContent = [headers.join(';'), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSVFile(`libro-deudores-fiados-${dateStr}.csv`, csvContent);
}

/**
 * Exporta el catálogo completo de productos, costos, márgenes y valor de inventario a CSV / Excel.
 */
export function exportInventoryToCSV(
  products: Product[],
  settings: AppSettings
): void {
  const headers = [
    'Codigo',
    'Codigo de Barras',
    'Producto',
    'Categoria',
    'Unidad',
    'Stock Actual',
    'Costo Unitario USD',
    'Precio Venta USD',
    'Margen Utilidad %',
    'Precio en Bs (BCV)',
    'Valor Stock a Costo USD',
    'Valor Stock a Venta USD',
    'Ganancia Potencial USD',
    'Alerta Stock Minimo',
    'Estado Stock',
  ];

  const rows = products.map((p) => {
    const cost = p.costUSD || Math.round(p.priceUSD * 0.72 * 100) / 100;
    const margin = p.marginPercent || Math.round(((p.priceUSD - cost) / cost) * 1000) / 10;
    const stockValCost = Math.round(p.stock * cost * 100) / 100;
    const stockValRetail = Math.round(p.stock * p.priceUSD * 100) / 100;
    const potentialProfit = Math.round((stockValRetail - stockValCost) * 100) / 100;
    const priceVES = Math.round(p.priceUSD * settings.bcvRate * 100) / 100;
    const isLow = p.stock <= (p.minStockAlert || 3);

    return [
      escapeCSVField(p.code || ''),
      escapeCSVField(p.barcode || ''),
      escapeCSVField(p.name),
      escapeCSVField(p.category),
      escapeCSVField(p.unit),
      escapeCSVField(p.unit === 'KG' ? p.stock.toFixed(3) : p.stock.toString()),
      escapeCSVField(cost.toFixed(2)),
      escapeCSVField(p.priceUSD.toFixed(2)),
      escapeCSVField(`${margin.toFixed(1)}%`),
      escapeCSVField(priceVES.toFixed(2)),
      escapeCSVField(stockValCost.toFixed(2)),
      escapeCSVField(stockValRetail.toFixed(2)),
      escapeCSVField(potentialProfit.toFixed(2)),
      escapeCSVField(p.minStockAlert || 3),
      escapeCSVField(isLow ? 'ALERTA: BAJO STOCK' : 'Normal'),
    ].join(';');
  });

  const csvContent = [headers.join(';'), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSVFile(`inventario-catalogo-${dateStr}.csv`, csvContent);
}

/**
 * Exporta el reporte de pérdidas y ganancias (P&L) a CSV compatible con Microsoft Excel.
 */
export function exportPandLToCSV(
  report: SystemPandLData,
  settings: AppSettings
): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `"ESTADO DE PERDIDAS Y GANANCIAS (P&L) - CHARCUTERIA JHOJAN"`,
    `"Periodo";${escapeCSVField(report.periodLabel)}`,
    `"Fecha de Generacion";${escapeCSVField(new Date(report.generatedAt).toLocaleString('es-VE'))}`,
    `"Tasa BCV Referencial";${escapeCSVField(`${report.bcvRate.toFixed(2)} Bs/USD`)}`,
    `""`,
    `"1. INGRESOS Y VENTAS";"Monto USD";"Monto Bs (VES)"`,
    `"Ventas Brutas Totales";${escapeCSVField(report.totalSalesUSD.toFixed(2))};${escapeCSVField(report.totalSalesVES.toFixed(2))}`,
    `"Facturas Validas Emitidas";${escapeCSVField(report.validTicketsCount)};""`,
    `"Cobranza Inmediata Contado";${escapeCSVField(report.collectedSalesUSD.toFixed(2))};${escapeCSVField(report.collectedSalesVES.toFixed(2))}`,
    `"Fiados Nuevos Otorgados";${escapeCSVField(report.creditSalesUSD.toFixed(2))};${escapeCSVField(report.creditSalesVES.toFixed(2))}`,
    `"Abonos de Fiados Cobrados";${escapeCSVField(report.collectedFiadosAbonosUSD.toFixed(2))};${escapeCSVField(report.collectedFiadosAbonosVES.toFixed(2))}`,
    `""`,
    `"2. COSTOS DIRECTOS DE MERCANCIA";"Monto USD";"Monto Bs (VES)"`,
    `"Costo de Mercancia Vendida (COGS)";${escapeCSVField(`-${report.costOfGoodsSoldUSD.toFixed(2)}`)};${escapeCSVField(`-${report.costOfGoodsSoldVES.toFixed(2)}`)}`,
    `"UTILIDAD BRUTA (Margen ${report.grossMarginPercent}%)";${escapeCSVField(report.grossProfitUSD.toFixed(2))};${escapeCSVField(report.grossProfitVES.toFixed(2))}`,
    `""`,
    `"3. GASTOS OPERATIVOS DEDUCIDOS";"Monto USD";"Monto Bs (VES)"`,
    `"Total Gastos Operativos";${escapeCSVField(`-${report.operatingExpensesUSD.toFixed(2)}`)};${escapeCSVField(`-${report.operatingExpensesVES.toFixed(2)}`)}`,
    ...report.expensesByCategory.map(
      (c) =>
        `"  Gasto: ${c.category} (${c.count} reg.)";${escapeCSVField(`-${c.totalUSD.toFixed(2)}`)};${escapeCSVField(`-${c.totalVES.toFixed(2)}`)}`
    ),
    `""`,
    `"4. MERMAS FISICAS Y DESPERDICIOS";"Monto USD";"Monto Bs (VES)"`,
    `"Total Perdidas por Merma";${escapeCSVField(`-${report.totalMermaCostUSD.toFixed(2)}`)};${escapeCSVField(`-${report.totalMermaCostVES.toFixed(2)}`)}`,
    `"Kilos Perdidos en Secado/Recortes";${escapeCSVField(`${report.totalMermaWeightKG.toFixed(3)} KG`)};""`,
    ...(report.mermasBreakdown || []).map(
      (m) =>
        `"  Merma: ${m.reason} (${m.count} reg., ${m.weightKG.toFixed(3)} kg)";${escapeCSVField(`-${m.totalUSD.toFixed(2)}`)};${escapeCSVField(`-${m.totalVES.toFixed(2)}`)}`
    ),
    `""`,
    `"5. RESULTADO FINAL (GANANCIA / PERDIDA NETA)";"Monto USD";"Monto Bs (VES)"`,
    `"${report.isProfit ? 'GANANCIA NETA REAL' : 'PERDIDA NETA'}";${escapeCSVField(report.netProfitUSD.toFixed(2))};${escapeCSVField(report.netProfitVES.toFixed(2))}`,
    `"Margen Neto Real";${escapeCSVField(`${report.netMarginPercent}%`)};""`,
    `""`,
    `"6. CUENTAS CORRIENTES Y SALDOS";"Monto USD";"Monto Bs (VES)"`,
    `"Cuentas por Cobrar (Fiados en la calle)";${escapeCSVField(report.currentAccountsReceivableUSD.toFixed(2))};${escapeCSVField(report.currentAccountsReceivableVES.toFixed(2))}`,
    `"Cuentas por Pagar a Proveedores";${escapeCSVField(report.currentAccountsPayableUSD.toFixed(2))};${escapeCSVField(report.currentAccountsPayableVES.toFixed(2))}`,
    `"Posicion Neta (Cobrar - Pagar)";${escapeCSVField((report.currentAccountsReceivableUSD - report.currentAccountsPayableUSD).toFixed(2))};""`,
    `""`,
    `"7. ARQUEO DE EFECTIVO Y BANCOS";"Monto USD";"Monto Bs (VES)"`,
    `"Efectivo USD en Gaveta";${escapeCSVField(report.cashInDrawerUSD.toFixed(2))};""`,
    `"Efectivo Bs en Gaveta";"";${escapeCSVField(report.cashInDrawerVES.toFixed(2))}`,
    `"Bancos (Punto + Pago Movil)";"";${escapeCSVField(report.digitalInBankVES.toFixed(2))}`,
    `""`,
    `"8. TOP PRODUCTOS MAS VENDIDOS Y RENTABLES"`,
    `"Producto";"Unidad";"Cant. Vendida";"Ingreso USD";"Costo USD";"Ganancia USD";"Margen %"`,
    ...report.topProducts.map(
      (p) =>
        `${escapeCSVField(p.productName)};${escapeCSVField(p.unit)};${escapeCSVField(p.quantitySold)};${escapeCSVField(p.revenueUSD.toFixed(2))};${escapeCSVField(p.costUSD.toFixed(2))};${escapeCSVField(p.profitUSD.toFixed(2))};${escapeCSVField(`${p.marginPercent}%`)}`
    ),
  ];

  downloadCSVFile(`reporte-pyg-pandl-${dateStr}.csv`, lines.join('\r\n'));
}

/**
 * Computes global inventory valuation, cost totals, potential profits, and averages.
 */
export function calculateInventorySummary(
  products: Product[],
  settings: AppSettings
): InventoryReportSummary {
  let totalStockUnits = 0;
  let totalStockKG = 0;
  let totalCostUSD = 0;
  let totalRetailUSD = 0;
  let lowStockCount = 0;

  for (const p of products) {
    if (p.unit === 'KG') {
      totalStockKG += p.stock;
    } else {
      totalStockUnits += p.stock;
    }
    const unitCost = typeof p.costUSD === 'number' && p.costUSD > 0
      ? p.costUSD
      : Math.round(p.priceUSD * 0.72 * 100) / 100;

    totalCostUSD += p.stock * unitCost;
    totalRetailUSD += p.stock * p.priceUSD;

    if (p.stock <= (p.minStockAlert || 3)) {
      lowStockCount++;
    }
  }

  totalCostUSD = Math.round(totalCostUSD * 100) / 100;
  totalRetailUSD = Math.round(totalRetailUSD * 100) / 100;
  const potentialProfitUSD = Math.round((totalRetailUSD - totalCostUSD) * 100) / 100;
  const totalCostVES = Math.round(totalCostUSD * settings.bcvRate * 100) / 100;
  const totalRetailVES = Math.round(totalRetailUSD * settings.bcvRate * 100) / 100;
  const potentialProfitVES = Math.round(potentialProfitUSD * settings.bcvRate * 100) / 100;
  const averageMarginPercent = totalCostUSD > 0
    ? Math.round((potentialProfitUSD / totalCostUSD) * 1000) / 10
    : 35.0;

  return {
    totalProducts: products.length,
    totalStockUnits: Math.round(totalStockUnits),
    totalStockKG: Math.round(totalStockKG * 1000) / 1000,
    totalCostUSD,
    totalCostVES,
    totalRetailUSD,
    totalRetailVES,
    potentialProfitUSD,
    potentialProfitVES,
    averageMarginPercent,
    lowStockCount,
  };
}

/**
 * Generates an executive WhatsApp report of Inventory, Costs, Margins, and Projected Profits.
 */
export function generateWhatsAppInventoryReport(
  products: Product[],
  settings: AppSettings
): { url: string; message: string } {
  const summary = calculateInventorySummary(products, settings);
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const categories: ('Quesos' | 'Embutidos' | 'Lácteos' | 'Varios')[] = [
    'Quesos',
    'Embutidos',
    'Lácteos',
    'Varios',
  ];

  const categoryLines: string[] = [];
  for (const cat of categories) {
    const catProds = products.filter((p) => p.category === cat);
    if (catProds.length === 0) continue;

    categoryLines.push(`\n📂 *${cat.toUpperCase()} (${catProds.length} artículos):*`);
    for (const p of catProds) {
      const unitCost = typeof p.costUSD === 'number' && p.costUSD > 0 ? p.costUSD : p.priceUSD * 0.72;
      const margin = typeof p.marginPercent === 'number' ? p.marginPercent : (unitCost > 0 ? ((p.priceUSD - unitCost) / unitCost) * 100 : 35);
      const stockInvestUSD = Math.round(p.stock * unitCost * 100) / 100;
      const stockRetailUSD = Math.round(p.stock * p.priceUSD * 100) / 100;
      const profitUSD = Math.round((stockRetailUSD - stockInvestUSD) * 100) / 100;
      const isLow = p.stock <= (p.minStockAlert || 3);

      categoryLines.push(
        `${p.emoji || '📦'} *${p.name}* ${isLow ? '⚠️ _(Stock Bajo)_' : ''}\n` +
        `  • Existencia: *${formatQuantity(p.stock, p.unit)}*\n` +
        `  • Costo: *${formatUSD(unitCost)}* | Margen: *+${margin.toFixed(1)}%*\n` +
        `  • Venta: *${formatUSD(p.priceUSD)}* (~${formatVES(p.priceUSD * settings.bcvRate)})\n` +
        `  • Inversión: ${formatUSD(stockInvestUSD)} | Venta Proy: ${formatUSD(stockRetailUSD)} | Ganancia: *+${formatUSD(profitUSD)}*`
      );
    }
  }

  const lines = [
    `📊 *REPORTE GENERAL DE INVENTARIO, COSTOS Y MÁRGENES*`,
    `🏪 *${settings.businessName}*`,
    `📅 Fecha: ${dateStr} ${timeStr}`,
    `💵 Tasa BCV: ${formatVES(settings.bcvRate)}/USD`,
    `----------------------------------------`,
    `💼 *VALORIZACIÓN DEL INVENTARIO:*`,
    `• Catálogo: ${summary.totalProducts} productos`,
    `• Existencia total: ${summary.totalStockKG.toFixed(3)} KG y ${summary.totalStockUnits} Unidades`,
    `• *Inversión Total a Costo:* *${formatUSD(summary.totalCostUSD)}* (${formatVES(summary.totalCostVES)})`,
    `• *Valor Total de Venta:* *${formatUSD(summary.totalRetailUSD)}* (${formatVES(summary.totalRetailVES)})`,
    `• *UTILIDAD PROYECTADA:* *+${formatUSD(summary.potentialProfitUSD)}* (${formatVES(summary.potentialProfitVES)})`,
    `• *Margen Promedio Ponderado:* *+${summary.averageMarginPercent}%*`,
    summary.lowStockCount > 0 ? `⚠️ *Productos con Stock Crítico:* ${summary.lowStockCount} alertas` : null,
    `----------------------------------------`,
    `📋 *DETALLE POR PRODUCTO:*`,
    ...categoryLines,
    `----------------------------------------`,
    `_Informe generado automáticamente desde Charcutería Jhojan POS_`,
  ].filter(Boolean) as string[];

  const message = lines.join('\n');
  const encoded = encodeURIComponent(message);
  const cleanPhone = sanitizePhoneForWhatsApp(settings.phone);
  const url = `https://wa.me/${cleanPhone}?text=${encoded}`;

  return { url, message };
}

// ==========================================
// --- TELEGRAM INTEGRATION & BACKUP HUB ---
// ==========================================

/**
 * Creates standard Telegram share URL
 * Opens Telegram app or web with pre-filled message, allowing user to select
 * any contact, group, channel, or their own "Saved Messages" (Mensajes Guardados).
 */
export function generateTelegramShareUrl(message: string): string {
  return `https://t.me/share/url?url=&text=${encodeURIComponent(message)}`;
}

/**
 * Generates formatted Telegram Thank You / Receipt message
 */
export function generateTelegramThankYou(
  ticket: SaleTicket,
  settings: AppSettings
): { url: string; message: string } {
  const result = generateWhatsAppThankYou(ticket, settings);
  const url = generateTelegramShareUrl(result.message);
  return { url, message: result.message };
}

/**
 * Generates formatted Telegram Payment Reminder message
 */
export function generateTelegramReminder(
  debtor: DebtorCustomer,
  settings: AppSettings
): { url: string; message: string } {
  const result = generateWhatsAppReminder(debtor, settings);
  const url = generateTelegramShareUrl(result.message);
  return { url, message: result.message };
}

/**
 * Generates full Debtors Portfolio (Libro de Fiados) Report for Telegram
 */
export function generateTelegramFiadosReport(
  debtors: DebtorCustomer[],
  settings: AppSettings
): { url: string; message: string } {
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-VE');
  const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  const totalUSD = debtors.reduce((sum, d) => sum + d.totalDebtUSD, 0);
  const totalVES = totalUSD * settings.bcvRate;

  const debtorLines = debtors.map((d, idx) => {
    const ves = d.totalDebtUSD * settings.bcvRate;
    return `${idx + 1}. 👤 *${d.name}* ${d.phone ? `(${d.phone})` : ''}\n   • Saldo: *${formatUSD(d.totalDebtUSD)}* (~${formatVES(ves)})\n   • Compras pendientes: ${d.tickets.length} tickets`;
  });

  const lines = [
    `📋 *RESPALDO Y REPORTE DEL LIBRO DE FIADOS*`,
    `🏪 *${settings.businessName}*`,
    `📅 Fecha: ${dateStr} - ${timeStr}`,
    `💵 Tasa BCV: ${formatVES(settings.bcvRate)}/USD`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💰 *RESUMEN DE CUENTAS POR COBRAR:*`,
    `• Clientes Deudores: *${debtors.length} personas*`,
    `• Total Cartera por Cobrar: *${formatUSD(totalUSD)}* (~${formatVES(totalVES)})`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👥 *DETALLE DE DEUDORES:*`,
    debtors.length > 0 ? debtorLines.join('\n\n') : '✅ No hay clientes con saldo pendiente en este momento.',
    `━━━━━━━━━━━━━━━━━━━━`,
    `_Respaldo generado automáticamente desde Charcutería Jhojan POS_`,
  ];

  const message = lines.join('\n');
  const url = generateTelegramShareUrl(message);
  return { url, message };
}

/**
 * Generates Invoices History Summary for Telegram
 */
export function generateTelegramTicketsSummary(
  tickets: SaleTicket[],
  settings: AppSettings,
  label = 'Respaldo de Facturas'
): { url: string; message: string } {
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-VE');
  const validTickets = tickets.filter((t) => !t.isVoided);
  const voidedTickets = tickets.filter((t) => t.isVoided);

  const totalFacturadoUSD = validTickets.reduce((sum, t) => sum + t.totalUSD, 0);
  const totalFacturadoVES = validTickets.reduce((sum, t) => sum + t.totalVES, 0);

  let cashUSD = 0;
  let cashVES = 0;
  let pagoMovilVES = 0;
  let puntoVES = 0;
  let fiadoUSD = 0;

  for (const t of validTickets) {
    if (t.paymentMethod === 'mixed' && t.paymentSplits) {
      for (const sp of t.paymentSplits) {
        if (sp.method === 'cash_usd') cashUSD += sp.amountUSD;
        else if (sp.method === 'cash_ves') cashVES += sp.amountUSD * settings.bcvRate;
        else if (sp.method === 'pago_movil') pagoMovilVES += sp.amountUSD * settings.bcvRate;
        else if (sp.method === 'punto') puntoVES += sp.amountUSD * settings.bcvRate;
        else if (sp.method === 'fiado') fiadoUSD += sp.amountUSD;
      }
    } else if (t.paymentMethod === 'cash_usd') {
      cashUSD += t.totalUSD;
    } else if (t.paymentMethod === 'cash_ves') {
      cashVES += t.totalVES;
    } else if (t.paymentMethod === 'pago_movil') {
      pagoMovilVES += t.totalVES;
    } else if (t.paymentMethod === 'punto') {
      puntoVES += t.totalVES;
    } else if (t.paymentMethod === 'fiado') {
      fiadoUSD += t.totalUSD;
    }
  }

  // Last 5 tickets sample
  const recentTicketsLines = validTickets.slice(0, 5).map((t) => {
    return `• Ticket #${t.ticketNumber} - ${t.customerName}: *${formatUSD(t.totalUSD)}* (${t.paymentMethod.toUpperCase()})`;
  });

  const lines = [
    `🧾 *${label.toUpperCase()}*`,
    `🏪 *${settings.businessName}*`,
    `📅 Fecha: ${dateStr}`,
    `💵 Tasa BCV: ${formatVES(settings.bcvRate)}/USD`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📊 *MÉTRICAS DE FACTURACIÓN:*`,
    `• Facturas Emitidas: *${validTickets.length} válidas* (${voidedTickets.length} anuladas)`,
    `• Total Facturado: *${formatUSD(totalFacturadoUSD)}* (~${formatVES(totalFacturadoVES)})`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💳 *RECAUDACIÓN POR CANAL DE PAGO:*`,
    `• 💵 Efectivo Dólares ($): *${formatUSD(cashUSD)}*`,
    `• 🇻🇪 Efectivo Bolívares: *${formatVES(cashVES)}* (~${formatUSD(cashVES / (settings.bcvRate || 1))})`,
    `• 📱 Pago Móvil: *${formatVES(pagoMovilVES)}* (~${formatUSD(pagoMovilVES / (settings.bcvRate || 1))})`,
    `• 💳 Punto de Venta: *${formatVES(puntoVES)}* (~${formatUSD(puntoVES / (settings.bcvRate || 1))})`,
    `• ⚠️ Ventas Fiadas (Crédito): *${formatUSD(fiadoUSD)}*`,
    recentTicketsLines.length > 0 ? `\n🧾 *Últimas facturas registradas:*\n${recentTicketsLines.join('\n')}` : '',
    `━━━━━━━━━━━━━━━━━━━━`,
    `_Respaldo generado automáticamente desde Charcutería Jhojan POS_`,
  ].filter(Boolean);

  const message = lines.join('\n');
  const url = generateTelegramShareUrl(message);
  return { url, message };
}

/**
 * Generates Inventory Executive Summary for Telegram
 */
export function generateTelegramInventoryReport(
  products: Product[],
  settings: AppSettings
): { url: string; message: string } {
  const summary = calculateInventorySummary(products, settings);
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-VE');

  // Low stock alert items
  const lowStockProds = products.filter((p) => p.stock <= (p.minStockAlert || 3));
  const lowStockLines = lowStockProds.slice(0, 5).map((p) => {
    return `⚠️ ${p.name}: *${formatQuantity(p.stock, p.unit)}* (mínimo: ${p.minStockAlert || 3})`;
  });

  const lines = [
    `📦 *RESPALDO DE INVENTARIO Y STOCK*`,
    `🏪 *${settings.businessName}*`,
    `📅 Fecha: ${dateStr}`,
    `💵 Tasa BCV: ${formatVES(settings.bcvRate)}/USD`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💼 *VALORIZACIÓN GENERAL:*`,
    `• Total Productos Registrados: *${summary.totalProducts} ítems*`,
    `• Existencia Total: *${summary.totalStockKG.toFixed(2)} KG* y *${summary.totalStockUnits} Unidades*`,
    `• Inversión Total a Costo: *${formatUSD(summary.totalCostUSD)}* (~${formatVES(summary.totalCostVES)})`,
    `• Valor Comercial Total (PVP): *${formatUSD(summary.totalRetailUSD)}* (~${formatVES(summary.totalRetailVES)})`,
    `• Utilidad Proyectada: *+${formatUSD(summary.potentialProfitUSD)}* (+${summary.averageMarginPercent}%)`,
    lowStockProds.length > 0
      ? `\n🚨 *Alertas de Stock Bajo (${lowStockProds.length}):*\n${lowStockLines.join('\n')}${lowStockProds.length > 5 ? `\n...y ${lowStockProds.length - 5} artículos más.` : ''}`
      : '✅ Todos los productos cuentan con inventario óptimo.',
    `━━━━━━━━━━━━━━━━━━━━`,
    `_Respaldo generado automáticamente desde Charcutería Jhojan POS_`,
  ];

  const message = lines.join('\n');
  const url = generateTelegramShareUrl(message);
  return { url, message };
}

/**
 * MASTER TELEGRAM BACKUP GENERATOR:
 * Concatena y genera el respaldo total solicitado por el usuario:
 * "Que sean las facturas, los fiados, reporte e inventario. También tenga un botón para enviar por Telegram."
 */
export function generateTelegramFullMasterBackup(params: {
  tickets: SaleTicket[];
  debtors: DebtorCustomer[];
  products: Product[];
  expenses: ExpenseRecord[];
  settings: AppSettings;
}): { url: string; message: string; fullJson: string } {
  const { tickets, debtors, products, expenses, settings } = params;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-VE');
  const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  // 1. Facturas metrics
  const validTickets = tickets.filter((t) => !t.isVoided);
  const totalFacturadoUSD = validTickets.reduce((sum, t) => sum + t.totalUSD, 0);
  const totalFacturadoVES = validTickets.reduce((sum, t) => sum + t.totalVES, 0);

  let cashUSD = 0;
  let cashVES = 0;
  let pagoMovilVES = 0;
  let puntoVES = 0;
  let fiadoUSD = 0;

  for (const t of validTickets) {
    if (t.paymentMethod === 'mixed' && t.paymentSplits) {
      for (const sp of t.paymentSplits) {
        if (sp.method === 'cash_usd') cashUSD += sp.amountUSD;
        else if (sp.method === 'cash_ves') cashVES += sp.amountUSD * settings.bcvRate;
        else if (sp.method === 'pago_movil') pagoMovilVES += sp.amountUSD * settings.bcvRate;
        else if (sp.method === 'punto') puntoVES += sp.amountUSD * settings.bcvRate;
        else if (sp.method === 'fiado') fiadoUSD += sp.amountUSD;
      }
    } else if (t.paymentMethod === 'cash_usd') {
      cashUSD += t.totalUSD;
    } else if (t.paymentMethod === 'cash_ves') {
      cashVES += t.totalVES;
    } else if (t.paymentMethod === 'pago_movil') {
      pagoMovilVES += t.totalVES;
    } else if (t.paymentMethod === 'punto') {
      puntoVES += t.totalVES;
    } else if (t.paymentMethod === 'fiado') {
      fiadoUSD += t.totalUSD;
    }
  }

  // 2. Fiados metrics
  const totalDeudaUSD = debtors.reduce((sum, d) => sum + d.totalDebtUSD, 0);
  const totalDeudaVES = totalDeudaUSD * settings.bcvRate;
  const topDebtors = debtors.slice(0, 4).map((d) => {
    return `   • ${d.name}: *${formatUSD(d.totalDebtUSD)}* (~${formatVES(d.totalDebtUSD * settings.bcvRate)})`;
  });

  // 3. Egresos y Cuadre de Caja
  const totalEgresosUSD = expenses.reduce((sum, e) => sum + e.amountUSD, 0);
  const totalEgresosVES = expenses.reduce((sum, e) => sum + e.amountVES, 0);
  const totalCobradoUSD = cashUSD + (cashVES + pagoMovilVES + puntoVES) / (settings.bcvRate || 1);
  const saldoNetoCajaUSD = totalCobradoUSD - totalEgresosUSD;

  // 4. Inventario metrics
  const invSummary = calculateInventorySummary(products, settings);
  const lowStockCount = products.filter((p) => p.stock <= (p.minStockAlert || 3)).length;

  const lines = [
    `📦 *RESPALDO GENERAL CONSOLIDADO - TELEGRAM*`,
    `🏪 *${settings.businessName}*`,
    `📅 *Fecha de Respaldo:* ${dateStr} - ${timeStr}`,
    `💵 *Tasa BCV:* ${formatVES(settings.bcvRate)}/USD`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🧾 *1. FACTURAS:*`,
    `• Facturas emitidas: *${validTickets.length} válidas* (${tickets.length - validTickets.length} anuladas)`,
    `• Total Facturado: *${formatUSD(totalFacturadoUSD)}* (~${formatVES(totalFacturadoVES)})`,
    `• Efectivo Divisas $: *${formatUSD(cashUSD)}*`,
    `• Pago Móvil: *${formatVES(pagoMovilVES)}*`,
    `• Punto de Venta: *${formatVES(puntoVES)}*`,
    `• Efectivo Bolívares: *${formatVES(cashVES)}*`,
    `• Facturado en Fiado: *${formatUSD(fiadoUSD)}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📋 *2. LIBRO DE FIADOS:*`,
    `• Clientes con deuda: *${debtors.length} personas*`,
    `• Cartera Total por Cobrar: *${formatUSD(totalDeudaUSD)}* (~${formatVES(totalDeudaVES)})`,
    debtors.length > 0 ? `• Principales deudores:\n${topDebtors.join('\n')}` : '• No hay deudores pendientes.',
    `━━━━━━━━━━━━━━━━━━━━`,
    `📊 *3. REPORTE DE CAJA & EGRESOS:*`,
    `• Dinero Recogido (Cobranza): *${formatUSD(totalCobradoUSD)}*`,
    `• Dinero Sacado (Egresos): *${formatUSD(totalEgresosUSD)}* (${expenses.length} egresos)`,
    `• Balance Neto en Caja: *${formatUSD(saldoNetoCajaUSD)}*`,
    `• Efectivo $ esperado en caja: *${formatUSD(cashUSD)}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📦 *4. INVENTARIO:*`,
    `• Total Artículos: *${invSummary.totalProducts} productos*`,
    `• Existencia Total: *${invSummary.totalStockKG.toFixed(2)} KG* y *${invSummary.totalStockUnits} UN*`,
    `• Inversión en Mercancía: *${formatUSD(invSummary.totalCostUSD)}* (~${formatVES(invSummary.totalCostVES)})`,
    `• Valor Comercial (PVP): *${formatUSD(invSummary.totalRetailUSD)}*`,
    `• Ganancia Proyectada: *+${formatUSD(invSummary.potentialProfitUSD)}* (+${invSummary.averageMarginPercent}%)`,
    lowStockCount > 0 ? `⚠️ *Alertas de Stock Bajo:* ${lowStockCount} productos` : '✅ Stock en niveles correctos.',
    `━━━━━━━━━━━━━━━━━━━━`,
    `💾 _Copia de respaldo instantánea enviada a Telegram._`,
    `🔒 _Todos los módulos respaldados exitosamente._`,
  ];

  const message = lines.join('\n');
  const url = generateTelegramShareUrl(message);

  // Generate complete snapshot export JSON
  const fullJson = exportDatabaseBackupString();

  return { url, message, fullJson };
}

export function generateEmailFullMasterBackup(params: {
  tickets: SaleTicket[];
  debtors: DebtorCustomer[];
  products: Product[];
  expenses: ExpenseRecord[];
  settings: AppSettings;
  targetEmail: string;
}): { mailtoUrl: string; webGmailUrl: string; subject: string; body: string } {
  const telegramData = generateTelegramFullMasterBackup(params);
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-VE');
  const subject = `[RESPALDO POS JHOJAN] Copia Consolidada ${dateStr} - ${params.settings.businessName}`;
  const body = `${telegramData.message}\n\nNota: Para restaurar tu base de datos completa en otro dispositivo, descarga el archivo .JSON desde el sistema o impórtalo desde la opción "Restaurar desde archivo .JSON".`;

  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const target = encodeURIComponent(params.targetEmail.trim() || 'jhojancalles4@gmail.com');

  const mailtoUrl = `mailto:${target}?subject=${encodedSubject}&body=${encodedBody}`;
  const webGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${target}&su=${encodedSubject}&body=${encodedBody}`;

  return { mailtoUrl, webGmailUrl, subject, body };
}

/**
 * Envía exclusivamente el ARCHIVO de respaldo (.json) a la aplicación de Telegram
 * del número de teléfono especificado, sin enviar mensajes de texto largos y sin
 * abrir páginas web intermedias.
 */
export async function sendTelegramBackupFile(targetPhone?: string): Promise<{
  success: boolean;
  method: 'share' | 'download_and_app';
  fileName: string;
  message: string;
}> {
  const jsonStr = exportDatabaseBackupString();
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `respaldo-charcuteria-jhojan-${dateStr}.json`;
  const cleanPhone = (targetPhone || '').replace(/[^0-9]/g, '');
  const internationalPhone = cleanPhone
    ? cleanPhone.startsWith('58')
      ? cleanPhone
      : cleanPhone.startsWith('0')
      ? `58${cleanPhone.slice(1)}`
      : `58${cleanPhone}`
    : '';

  // 1. En móviles (Android / iOS), usar Web Share con archivo real
  // Esto abre directamente la app de Telegram del teléfono con el archivo adjunto
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([jsonStr], fileName, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Respaldo Jhojan POS - ${dateStr}`,
        });
        return {
          success: true,
          method: 'share',
          fileName,
          message: 'Archivo enviado a la aplicación de Telegram.',
        };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          method: 'share',
          fileName,
          message: 'Envío de archivo cancelado.',
        };
      }
      console.warn('Web Share no disponible para archivos, usando método alternativo:', err);
    }
  }

  // 2. Descargar el archivo .JSON en el teléfono
  exportDatabaseBackup();

  // 3. Abrir la app nativa de Telegram (tg://) hacia el número si está disponible, sin ir a web
  if (cleanPhone) {
    try {
      const tgAppUrl = `tg://msg?to=+${internationalPhone}`;
      const link = document.createElement('a');
      link.href = tgAppUrl;
      link.click();
    } catch {
      // Ignorar si el protocolo tg:// no está registrado en el navegador
    }
  }

  return {
    success: true,
    method: 'download_and_app',
    fileName,
    message: `Archivo ${fileName} listo. Selecciona Telegram para guardarlo en tu cuenta.`,
  };
}

