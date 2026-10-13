export type ProductCategory = 'Quesos' | 'Embutidos' | 'Lácteos' | 'Varios';
export type UnitType = 'KG' | 'UN';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  unit: UnitType;
  priceUSD: number;
  costUSD?: number;
  marginPercent?: number;
  stock: number;
  emoji: string;
  code?: string;
  barcode?: string;
  minStockAlert?: number;
}

export interface CartItem {
  product: Product;
  quantity: number; // For KG: fractional (e.g., 0.350), for UN: integer (e.g., 2)
  unitPriceUSD: number;
  totalUSD: number;
  totalVES: number;
}

export type PaymentMethod = 'cash_usd' | 'cash_ves' | 'punto' | 'pago_movil' | 'fiado' | 'mixed';
export type TicketStatus = 'paid' | 'pending' | 'partially_paid' | 'voided';

export interface PaymentSplit {
  id: string;
  method: 'cash_usd' | 'cash_ves' | 'punto' | 'pago_movil' | 'fiado';
  amountUSD: number;
  amountVES: number;
  appliedRate: number;
  reference?: string;
  notes?: string;
}

export interface PaymentAbono {
  id: string;
  date: string; // ISO string
  amountUSD: number;
  amountVES: number;
  bcvRate: number;
  method: 'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto';
  reference?: string;
  notes?: string;
}

export interface SaleTicket {
  id: string;
  ticketNumber: number;
  date: string;
  customerName: string;
  customerCedula: string;
  customerPhone: string;
  items: CartItem[];
  totalUSD: number;
  totalVES: number;
  bcvRate: number;
  preferentialRate?: number;
  effectiveRate?: number;
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  status: TicketStatus;
  pendingUSD: number;
  pendingVES: number;
  abonos: PaymentAbono[];
  notes?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
}

export interface PagoMovilConfig {
  bankCode: string;
  bankName: string;
  phone: string;
  cedula: string;
}

export interface AppSettings {
  businessName: string;
  rif: string;
  phone: string;
  address: string;
  bcvRate: number;
  bcvLastUpdated: string;
  preferentialRate: number;
  preferentialRateLastUpdated?: string;
  pagoMovil: PagoMovilConfig;
  ticketCounter: number;
  autoSyncCloud: boolean;
  lastCloudSync?: string;
}

export interface DebtorCustomer {
  name: string;
  cedula: string;
  phone: string;
  totalDebtUSD: number;
  totalDebtVES: number;
  tickets: SaleTicket[];
  lastPurchaseDate: string;
}

export type ExpenseCategory =
  | 'Mercancía/Proveedores'
  | 'Servicios'
  | 'Personal/Nómina'
  | 'Mantenimiento'
  | 'Bolsas y Empaques'
  | 'Alquiler/Local'
  | 'Otros Gastos';

export interface ExpenseRecord {
  id: string;
  expenseNumber: number;
  date: string; // ISO string
  description: string;
  category: ExpenseCategory;
  amountUSD: number;
  amountVES: number;
  currency: 'USD' | 'VES';
  appliedRate: number;
  paymentMethod: 'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia';
  recipient?: string;
  reference?: string;
  notes?: string;
}

export interface ZReportProductSummary {
  productId: string;
  productName: string;
  unit: UnitType;
  category: ProductCategory;
  quantitySold: number;
  totalUSD: number;
  totalVES: number;
  unitCostUSD?: number;
  unitPriceUSD?: number;
  marginPercent?: number;
  totalCostUSD?: number;
  grossProfitUSD?: number;
}

export interface InventoryReportSummary {
  totalProducts: number;
  totalStockUnits: number;
  totalStockKG: number;
  totalCostUSD: number;
  totalCostVES: number;
  totalRetailUSD: number;
  totalRetailVES: number;
  potentialProfitUSD: number;
  potentialProfitVES: number;
  averageMarginPercent: number;
  lowStockCount: number;
}

export interface ZReportData {
  reportNumber: number;
  generatedAt: string;
  dateRangeLabel: string;
  startDate: string;
  endDate: string;

  // Correlative & tickets info
  firstTicketNumber: number | null;
  lastTicketNumber: number | null;
  totalTicketsIssued: number;
  validTicketsCount: number;
  voidedTicketsCount: number;

  // Sales Totals
  grossSalesUSD: number;
  grossSalesVES: number;
  voidedSalesUSD: number;
  voidedSalesVES: number;
  netSalesUSD: number;
  netSalesVES: number;

  // Income Breakdown by payment method
  incomeCashUSD: number;
  incomeCashUSD_inVES: number;
  incomeCashVES: number;
  incomePuntoVES: number;
  incomePagoMovilVES: number;
  incomeFiadoUSD: number;
  incomeFiadoVES: number;
  collectedAbonosUSD: number;
  collectedAbonosVES: number;

  // Expenses Breakdown
  expensesCount: number;
  totalExpensesUSD: number;
  totalExpensesVES: number;
  expensesCashUSD: number;
  expensesCashVES: number;
  expensesDigitalVES: number;
  expensesByCategory: {
    category: ExpenseCategory;
    totalUSD: number;
    totalVES: number;
    count: number;
  }[];

  // Cash Drawer & Arqueo
  expectedCashDrawerUSD: number;
  expectedCashDrawerVES: number;
  expectedDigitalVES: number;

  // Operating Net
  netOperatingFlowUSD: number;
  netOperatingFlowVES: number;

  // Products Sold Breakdown (Reporte de compras/artículos vendidos)
  productsSold: ZReportProductSummary[];
  totalUnitsCount: number;
  totalKilosWeight: number;

  // Voided tickets list
  voidedTicketsList: {
    ticketNumber: number;
    customerName: string;
    totalUSD: number;
    reason: string;
  }[];

  currentBcvRate: number;
}

// --- Módulo de Fidelización Fidelis (Métricas Duales) ---
export interface FidelisCustomerProfile {
  id: string; // ID único normalizado (cédula o teléfono o nombre)
  customerName: string;
  customerCedula: string;
  customerPhone: string;

  // Métrica 1: Sistema Base de Sellos (Meta estándar de 10 transacciones: X/10)
  stampsCount: number; // 0..10
  stampsGoal: number; // 10
  stampsCycles: number; // Veces que ha completado los 10 sellos
  stampsClaimed: number; // Total de recompensas de 10 sellos canjeadas

  // Métrica 2: Seguimiento de Alto Valor (Facturas ≥ $18 USD, meta 4 compras: Y/4)
  highValueCount: number; // 0..4
  highValueGoal: number; // 4
  highValueThresholdUSD: number; // 18 USD
  highValueCycles: number; // Veces que ha completado las 4 compras VIP
  highValueClaimed: number; // Total de recompensas VIP canjeadas

  // Métricas acumuladas y fechas
  totalSpentUSD: number;
  totalTransactions: number;
  lastPurchaseDate?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Módulo de Reposición de Mercancía & Cuentas por Pagar a Proveedores ---
export interface RestockAbono {
  id: string;
  date: string; // ISO string
  amountUSD: number;
  amountVES: number;
  bcvRate: number;
  paymentMethod: 'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia';
  reference?: string;
  notes?: string;
}

export interface RestockRecord {
  id: string;
  restockNumber: number;
  date: string; // ISO string
  productId: string;
  productName: string;
  unit: UnitType;
  category: ProductCategory;
  quantityAdded: number; // Kilos o unidades sumadas al stock
  previousStock: number;
  newStock: number;
  unitCostUSD: number;
  totalCostUSD: number;
  totalCostVES: number;
  bcvRate: number;

  supplierName: string;
  supplierPhone?: string;
  supplierInvoiceNumber?: string;

  // Condición de Pago
  paymentCondition: 'contado' | 'credito';
  isPaid: boolean;
  dueDate?: string; // Fecha límite de pago acordada con el proveedor

  // Abonos realizados antes o en la fecha de pago
  abonos: RestockAbono[];
  paidUSD: number;
  pendingUSD: number;
  pendingVES: number;

  // Vinculación con Egresos
  expenseIds?: string[];
  notes?: string;
  createdAt: string;
}

// --- Reporte Integral de Pérdidas y Ganancias (P&L del Sistema) ---
export interface SystemPandLData {
  periodLabel: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  bcvRate: number;

  // 1. Ventas e Ingresos
  totalSalesUSD: number;
  totalSalesVES: number;
  validTicketsCount: number;
  voidedTicketsCount: number;
  voidedSalesUSD: number;
  voidedSalesVES: number;

  // Cobranzas Efectivas vs Crédito
  collectedSalesUSD: number;
  collectedSalesVES: number;
  creditSalesUSD: number; // Fiados generados en el periodo
  creditSalesVES: number;
  collectedFiadosAbonosUSD: number; // Abonos recibidos de deudores en el periodo
  collectedFiadosAbonosVES: number;

  // Desglose de ingresos por método
  salesByMethod: {
    cashUSD: number;
    cashUSD_inVES: number;
    cashVES: number;
    puntoVES: number;
    pagoMovilVES: number;
    fiadoUSD: number;
  };

  // 2. Costo de Mercancía & Compras
  totalRestocksCostUSD: number;
  totalRestocksCostVES: number;
  restocksPaidUSD: number; // Pagado de contado + abonos en el periodo
  restocksPaidVES: number;
  restocksPendingUSD: number; // Cuentas por pagar originadas
  restocksPendingVES: number;
  costOfGoodsSoldUSD: number; // Costo directo de lo vendido (COGS)
  costOfGoodsSoldVES: number;

  // 3. Utilidad Bruta
  grossProfitUSD: number; // Ventas Totales - Costo de Mercancía Vendida
  grossProfitVES: number;
  grossMarginPercent: number; // (Utilidad Bruta / Ventas) * 100

  // 4. Gastos Operativos (Egresos no de mercancía directa)
  operatingExpensesUSD: number;
  operatingExpensesVES: number;
  totalExpensesUSD: number; // Todos los egresos registrados
  totalExpensesVES: number;
  expensesByCategory: {
    category: ExpenseCategory;
    totalUSD: number;
    totalVES: number;
    count: number;
  }[];

  // 5. Ganancia o Pérdida Neta Real (P&L)
  netProfitUSD: number; // Utilidad Bruta - Gastos Operativos
  netProfitVES: number;
  netMarginPercent: number;
  isProfit: boolean;

  // 6. Cuentas Corrientes y Saldos
  currentAccountsReceivableUSD: number; // Cuentas por Cobrar (Libro de fiados pendientes)
  currentAccountsReceivableVES: number;
  currentAccountsPayableUSD: number; // Cuentas por Pagar a Proveedores (mercancía a crédito)
  currentAccountsPayableVES: number;

  // 7. Flujo de Caja en Mano
  cashInDrawerUSD: number;
  cashInDrawerVES: number;
  digitalInBankVES: number;

  // 8. Volumen Despachado y Top Productos
  totalWeightSoldKG: number;
  totalUnitsSoldUN: number;
  topProducts: {
    productId: string;
    productName: string;
    unit: UnitType;
    category: ProductCategory;
    quantitySold: number;
    revenueUSD: number;
    costUSD: number;
    profitUSD: number;
    marginPercent: number;
  }[];
}

export interface GoogleDailyBackup {
  id: string; // e.g. "backup-2026-10-13"
  day: string; // "2026-10-13"
  createdAt: string; // ISO
  accountEmail: string;
  productCount: number;
  ticketCount: number;
  expenseCount: number;
  debtorsCount: number;
  fidelisCount: number;
  dataJson: string; // serialized snapshot
  sizeBytes: number;
}

export interface GoogleAccountInfo {
  email: string;
  isLinked: boolean;
  linkedAt?: string;
  displayName?: string;
  lastBackupDate?: string;
  autoDailyBackupEnabled: boolean;
}
