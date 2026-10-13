import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Truck,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  Phone,
  FileText,
  Send,
  User,
  ArrowRight,
  Filter,
  CheckCircle2,
  CalendarClock,
  Sparkles,
  HelpCircle,
  Hash,
} from 'lucide-react';
import {
  AppSettings,
  ExpenseRecord,
  Product,
  ProductCategory,
  RestockRecord,
  RestockAbono,
} from '../types';
import {
  formatUSD,
  formatVES,
  formatQuantity,
  processNewRestock,
  addAbonoToRestock,
  ProcessRestockInput,
} from '../services/storage';

interface RestockModuleProps {
  products: Product[];
  restocks: RestockRecord[];
  expenses: ExpenseRecord[];
  settings: AppSettings;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateRestocks: (restocks: RestockRecord[]) => void;
  onUpdateExpenses: (expenses: ExpenseRecord[]) => void;
  onShowToast: (msg: string) => void;
}

export const RestockModule: React.FC<RestockModuleProps> = ({
  products,
  restocks,
  expenses,
  settings,
  onUpdateProducts,
  onUpdateRestocks,
  onUpdateExpenses,
  onShowToast,
}) => {
  // Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [unitCostInput, setUnitCostInput] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('');
  const [paymentCondition, setPaymentCondition] = useState<'contado' | 'credito'>('contado');
  const [dueDate, setDueDate] = useState<string>(() => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return future.toISOString().slice(0, 10);
  });
  const [contadoMethod, setContadoMethod] = useState<
    'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia'
  >('cash_usd');

  // Initial Abono for Credit
  const [hasInitialAbono, setHasInitialAbono] = useState<boolean>(false);
  const [initialAbonoAmount, setInitialAbonoAmount] = useState<string>('');
  const [initialAbonoMethod, setInitialAbonoMethod] = useState<
    'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia'
  >('cash_usd');
  const [initialAbonoRef, setInitialAbonoRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Table Filter State
  const [tableFilter, setTableFilter] = useState<'all' | 'credito_pending' | 'credito_paid' | 'contado'>('all');
  const [tableSearch, setTableSearch] = useState<string>('');

  // Abono Modal State (to add an abono to an existing credit restock before due date)
  const [activeRestockForAbono, setActiveRestockForAbono] = useState<RestockRecord | null>(null);
  const [abonoAmountInput, setAbonoAmountInput] = useState<string>('');
  const [abonoPaymentMethod, setAbonoPaymentMethod] = useState<
    'cash_usd' | 'cash_ves' | 'pago_movil' | 'punto' | 'transferencia'
  >('cash_usd');
  const [abonoRefInput, setAbonoRefInput] = useState<string>('');
  const [abonoNotesInput, setAbonoNotesInput] = useState<string>('');

  // Selected product object
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // Suggested product filter
  const filteredProductOptions = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 15);
    const q = productSearch.toLowerCase().trim();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, productSearch]);

  // When a product is selected, auto-fill unitCost if available
  const handleSelectProduct = (prod: Product) => {
    setSelectedProductId(prod.id);
    setProductSearch(prod.name);
    if (prod.costUSD && prod.costUSD > 0) {
      setUnitCostInput(prod.costUSD.toString());
    } else {
      // Estimated default cost at ~65% of price
      setUnitCostInput((Math.round(prod.priceUSD * 0.65 * 100) / 100).toString());
    }
  };

  // Real-time calculation previews
  const parsedQuantity = parseFloat(quantityInput.replace(',', '.')) || 0;
  const parsedUnitCost = parseFloat(unitCostInput.replace(',', '.')) || 0;
  const calculatedTotalUSD = Math.round(parsedQuantity * parsedUnitCost * 100) / 100;
  const calculatedTotalVES = Math.round(calculatedTotalUSD * settings.bcvRate * 100) / 100;

  const parsedInitialAbono = hasInitialAbono ? parseFloat(initialAbonoAmount.replace(',', '.')) || 0 : 0;
  const pendingAfterInitialAbono = Math.max(0, Math.round((calculatedTotalUSD - parsedInitialAbono) * 100) / 100);

  const resultingStock = selectedProduct
    ? Math.round((selectedProduct.stock + parsedQuantity) * 1000) / 1000
    : 0;

  // Form Submission
  const handleSubmitRestock = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId || !selectedProduct) {
      alert('Por favor selecciona un producto para reponer.');
      return;
    }

    if (parsedQuantity <= 0) {
      alert('Por favor ingresa una cantidad válida mayor a cero.');
      return;
    }

    if (parsedUnitCost <= 0) {
      alert('Por favor ingresa un costo unitario válido.');
      return;
    }

    if (paymentCondition === 'credito' && !dueDate) {
      alert('Por favor indica la fecha límite de pago acordada con el proveedor.');
      return;
    }

    if (hasInitialAbono && parsedInitialAbono > calculatedTotalUSD) {
      alert('El abono inicial no puede ser mayor que el costo total de la reposición.');
      return;
    }

    try {
      const restockInput: ProcessRestockInput = {
        productId: selectedProductId,
        quantityAdded: parsedQuantity,
        unitCostUSD: parsedUnitCost,
        supplierName: supplierName.trim() || 'Distribuidor General',
        supplierPhone: supplierPhone.trim(),
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        paymentCondition,
        dueDate: paymentCondition === 'credito' ? dueDate : undefined,
        contadoPaymentMethod: contadoMethod,
        hasInitialAbono,
        initialAbonoUSD: parsedInitialAbono,
        initialAbonoMethod,
        initialAbonoRef,
        notes,
      };

      const result = processNewRestock(restockInput, products, restocks, expenses, settings);

      onUpdateProducts(result.updatedProducts);
      onUpdateRestocks(result.updatedRestocks);
      onUpdateExpenses(result.updatedExpenses);

      // Reset form
      setSelectedProductId('');
      setProductSearch('');
      setQuantityInput('');
      setUnitCostInput('');
      setSupplierInvoiceNumber('');
      setNotes('');
      setHasInitialAbono(false);
      setInitialAbonoAmount('');
      setInitialAbonoRef('');

      const msgCondition =
        paymentCondition === 'contado'
          ? 'pagada de contado y registrada en Egresos'
          : `a crédito (Saldo restante: $${pendingAfterInitialAbono.toFixed(2)}) con recordatorio en Egresos`;

      onShowToast(
        `✅ Reposición N° ${result.newRestock.restockNumber} guardada: +${formatQuantity(
          parsedQuantity,
          selectedProduct.unit
        )} sumados a "${selectedProduct.name}", ${msgCondition}.`
      );
    } catch (err: any) {
      console.error('Error saving restock:', err);
      alert(err.message || 'Error al procesar la reposición.');
    }
  };

  // Register an abono to an existing credit restock before due date
  const handleConfirmAbono = () => {
    if (!activeRestockForAbono) return;
    const amount = parseFloat(abonoAmountInput.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor ingresa un monto válido a abonar.');
      return;
    }

    if (amount > activeRestockForAbono.pendingUSD) {
      alert(`El abono no puede superar la deuda pendiente ($${activeRestockForAbono.pendingUSD.toFixed(2)}).`);
      return;
    }

    try {
      const result = addAbonoToRestock(
        activeRestockForAbono.id,
        amount,
        abonoPaymentMethod,
        abonoRefInput,
        abonoNotesInput,
        restocks,
        expenses,
        settings
      );

      onUpdateRestocks(result.updatedRestocks);
      onUpdateExpenses(result.updatedExpenses);
      setActiveRestockForAbono(null);
      setAbonoAmountInput('');
      setAbonoRefInput('');
      setAbonoNotesInput('');

      onShowToast(
        `💵 Abono de $${amount.toFixed(2)} registrado al proveedor "${result.updatedRestock.supplierName}". Saldo restante: $${result.updatedRestock.pendingUSD.toFixed(2)}.`
      );
    } catch (err: any) {
      alert(err.message || 'Error al registrar abono');
    }
  };

  // Metrics summary
  const restockMetrics = useMemo(() => {
    let totalRestocksCount = restocks.length;
    let totalCostAllUSD = 0;
    let totalPaidAllUSD = 0;
    let totalPendingAllUSD = 0;
    let pendingCreditCount = 0;

    for (const r of restocks) {
      totalCostAllUSD += r.totalCostUSD;
      totalPaidAllUSD += r.paidUSD;
      if (!r.isPaid && r.pendingUSD > 0) {
        totalPendingAllUSD += r.pendingUSD;
        pendingCreditCount++;
      }
    }

    return {
      totalRestocksCount,
      totalCostAllUSD,
      totalPaidAllUSD,
      totalPendingAllUSD,
      pendingCreditCount,
    };
  }, [restocks]);

  // Filtered restocks table
  const filteredRestocks = useMemo(() => {
    return restocks.filter((r) => {
      if (tableFilter === 'credito_pending' && (r.paymentCondition !== 'credito' || r.isPaid)) return false;
      if (tableFilter === 'credito_paid' && (r.paymentCondition !== 'credito' || !r.isPaid)) return false;
      if (tableFilter === 'contado' && r.paymentCondition !== 'contado') return false;

      if (!tableSearch.trim()) return true;
      const q = tableSearch.toLowerCase().trim();
      return (
        r.productName.toLowerCase().includes(q) ||
        r.supplierName.toLowerCase().includes(q) ||
        (r.supplierInvoiceNumber && r.supplierInvoiceNumber.toLowerCase().includes(q)) ||
        r.restockNumber.toString().includes(q)
      );
    });
  }, [restocks, tableFilter, tableSearch]);

  // WhatsApp supplier receipt notice generator
  const getSupplierWhatsAppUrl = (r: RestockRecord) => {
    if (!r.supplierPhone) return '';
    const cleanPhone = r.supplierPhone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('58') ? cleanPhone : '58' + cleanPhone;
    const isPaid = r.isPaid;
    const msg = [
      `🤝 *COMPROBANTE DE RECEPCIÓN Y PAGO DE MERCANCÍA*`,
      `🏪 *${settings.businessName}*`,
      `📦 Producto: *${r.productName}* (+${formatQuantity(r.quantityAdded, r.unit)})`,
      `💵 Costo Total: *${formatUSD(r.totalCostUSD)}*`,
      `📋 Condición: ${r.paymentCondition === 'contado' ? '✅ Contado' : '⏳ A Crédito'}`,
      r.dueDate ? `📅 Fecha Límite de Pago: *${r.dueDate}*` : null,
      r.abonos && r.abonos.length > 0
        ? `📥 Total Abonado a la fecha: *${formatUSD(r.paidUSD)}* (${r.abonos.length} pago${r.abonos.length > 1 ? 's' : ''})`
        : null,
      `💰 Saldo Restante: *${formatUSD(r.pendingUSD)}*`,
      isPaid ? `🎉 *ESTADO: TOTALMENTE LIQUIDADO / PAGADO*` : `⚠️ *ESTADO: PENDIENTE POR LIQUIDAR*`,
      r.supplierInvoiceNumber ? `🧾 N° Factura / Nota: ${r.supplierInvoiceNumber}` : null,
      `_Gracias por su atención comercial._`,
    ]
      .filter(Boolean)
      .join('\n');

    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Metrics */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Boxes className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Reposición de Mercancía & Cuentas por Pagar
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Llena la ficha de reposición para sumar stock automáticamente al inventario, controlar compras a crédito o
              contado, y generar los recordatorios y abonos a proveedores sincronizados con Egresos.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3">
              <span className="text-[11px] font-semibold text-slate-400 block">Total Comprado</span>
              <span className="text-base sm:text-lg font-mono font-black text-white">
                {formatUSD(restockMetrics.totalCostAllUSD)}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-emerald-900/40 rounded-2xl p-3">
              <span className="text-[11px] font-semibold text-emerald-400 block">Total Pagado</span>
              <span className="text-base sm:text-lg font-mono font-black text-emerald-400">
                {formatUSD(restockMetrics.totalPaidAllUSD)}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-amber-900/40 rounded-2xl p-3 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-amber-400 block flex items-center justify-between">
                <span>Por Pagar a Prov.</span>
                {restockMetrics.pendingCreditCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[9px] font-bold">
                    {restockMetrics.pendingCreditCount} pendientes
                  </span>
                )}
              </span>
              <span className="text-base sm:text-lg font-mono font-black text-amber-400">
                {formatUSD(restockMetrics.totalPendingAllUSD)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: FICHA DE REPOSICIÓN DE MERCANCÍA */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl">
        <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center font-bold">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white">
              Ficha de Entrada y Reposición de Mercancía
            </h3>
            <p className="text-xs text-slate-400">
              Al guardar, se sumará de forma automática al stock del producto seleccionado y se sincronizará con Egresos.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmitRestock} className="space-y-6">
          {/* Product Picker */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>1. Seleccionar Producto a Reponer:</span>
                {selectedProduct && (
                  <span className="text-emerald-400 font-mono text-[11px]">
                    Stock actual: {formatQuantity(selectedProduct.stock, selectedProduct.unit)}
                  </span>
                )}
              </label>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o categoría (ej: Queso Llanero, Jamón)..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    if (selectedProductId) setSelectedProductId('');
                  }}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              {/* Quick Matching Chips if no product yet selected */}
              {!selectedProductId && (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                  {filteredProductOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProduct(p)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>{p.emoji}</span>
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({formatQuantity(p.stock, p.unit)})</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedProduct && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedProduct.emoji}</span>
                    <div>
                      <span className="font-bold text-emerald-300 block">{selectedProduct.name}</span>
                      <span className="text-slate-400 text-[11px]">
                        Categoría: {selectedProduct.category} • Unidad: {selectedProduct.unit} • Precio Venta: {formatUSD(selectedProduct.priceUSD)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductId('');
                      setProductSearch('');
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer"
                  >
                    Cambiar
                  </button>
                </div>
              )}
            </div>

            {/* Quantity and Unit Cost Inputs */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  2. Cantidad a Sumar:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    placeholder={selectedProduct?.unit === 'KG' ? '0.000 KG' : '0 UN'}
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-rose-500 transition"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-rose-400 font-mono">
                    {selectedProduct ? selectedProduct.unit : 'CANT'}
                  </span>
                </div>
                {selectedProduct && parsedQuantity > 0 && (
                  <p className="text-[11px] text-slate-400">
                    Stock resultante: <strong className="text-emerald-400 font-mono">{resultingStock} {selectedProduct.unit}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  3. Costo Unitario ($):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={unitCostInput}
                    onChange={(e) => setUnitCostInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-rose-500 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Por cada {selectedProduct ? selectedProduct.unit : 'unidad'}
                </p>
              </div>
            </div>
          </div>

          {/* Supplier Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Nombre del Proveedor / Empresa:</label>
              <input
                type="text"
                required
                placeholder="Ej: Distribuidora Lácteos Los Llanos"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Teléfono / WhatsApp Proveedor:</label>
              <input
                type="text"
                placeholder="Ej: 0414-9988771"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">N° Factura / Nota Proveedor:</label>
              <input
                type="text"
                placeholder="Ej: FAC-4482 / GUIA-102"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Payment Condition: Contado vs Crédito */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-rose-400" />
                <span>¿Condición de Pago de la Mercancía?</span>
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentCondition('contado')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    paymentCondition === 'contado'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  ✅ Pagado de Contado
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentCondition('credito')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    paymentCondition === 'credito'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  ⏳ A Crédito (Cuenta por Pagar)
                </button>
              </div>
            </div>

            {/* If Contado */}
            {paymentCondition === 'contado' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                    Método con el que se canceló al proveedor:
                  </label>
                  <select
                    value={contadoMethod}
                    onChange={(e: any) => setContadoMethod(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="cash_usd">💵 Efectivo Divisas ($ USD)</option>
                    <option value="cash_ves">🇻🇪 Efectivo Bolívares (Bs.)</option>
                    <option value="pago_movil">📱 Pago Móvil</option>
                    <option value="punto">💳 Punto de Venta / Tarjeta</option>
                    <option value="transferencia">🏦 Transferencia Bancaria</option>
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span>
                    El monto de <strong>{formatUSD(calculatedTotalUSD)}</strong> se registrará de inmediato como un
                    Egreso en la categoría <strong>"Mercancía/Proveedores"</strong>.
                  </span>
                </div>
              </div>
            )}

            {/* If Crédito */}
            {paymentCondition === 'credito' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-amber-300 mb-1.5 block flex items-center gap-1.5">
                      <CalendarClock className="w-4 h-4 text-amber-400" />
                      <span>Fecha Límite de Pago Acordada con el Proveedor:</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-slate-900 border border-amber-600/50 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Aparecerá un recordatorio destacado en la sección de Egresos.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200">
                    <span className="font-bold block mb-1">Recordatorio en Egresos:</span>
                    <span>
                      Esta compra quedará registrada como Cuenta por Pagar a Proveedores por{' '}
                      <strong>{formatUSD(pendingAfterInitialAbono)}</strong> con fecha límite para el {dueDate}.
                    </span>
                  </div>
                </div>

                {/* Sub-section: Abono antes de la fecha de pago */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={hasInitialAbono}
                        onChange={(e) => setHasInitialAbono(e.target.checked)}
                        className="rounded border-slate-700 text-rose-500 focus:ring-rose-500 w-4 h-4"
                      />
                      <span>¿Se le abonó algo al proveedor antes de la fecha de pago?</span>
                    </label>
                    {hasInitialAbono && (
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">
                        Abono previo activo
                      </span>
                    )}
                  </div>

                  {hasInitialAbono && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Monto Abonado ($ USD):
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={calculatedTotalUSD}
                            placeholder="0.00"
                            value={initialAbonoAmount}
                            onChange={(e) => setInitialAbonoAmount(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Método de Pago del Abono:
                        </label>
                        <select
                          value={initialAbonoMethod}
                          onChange={(e: any) => setInitialAbonoMethod(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="cash_usd">💵 Efectivo Divisas ($ USD)</option>
                          <option value="cash_ves">🇻🇪 Efectivo Bolívares (Bs.)</option>
                          <option value="pago_movil">📱 Pago Móvil</option>
                          <option value="punto">💳 Punto de Venta</option>
                          <option value="transferencia">🏦 Transferencia Bancaria</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Referencia / Comprobante:
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: PM-129384 / Recibo"
                          value={initialAbonoRef}
                          onChange={(e) => setInitialAbonoRef(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Total Calculation & Action Submit */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Costo Total Lote:</span>
                <span className="text-base font-bold text-white">{formatUSD(calculatedTotalUSD)}</span>
                <span className="text-slate-500 ml-1.5">({formatVES(calculatedTotalVES)})</span>
              </div>

              {paymentCondition === 'credito' && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Saldo Deuda Pendiente:</span>
                  <span className="text-base font-bold text-amber-400">{formatUSD(pendingAfterInitialAbono)}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!selectedProductId || parsedQuantity <= 0 || parsedUnitCost <= 0}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                selectedProductId && parsedQuantity > 0 && parsedUnitCost > 0
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50 active:scale-[0.99]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Guardar Reposición (+{formatQuantity(parsedQuantity, selectedProduct?.unit || 'KG')})</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: HISTORIAL DE REPOSICIONES Y CUENTAS POR PAGAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-rose-400" />
              <span>Historial de Reposiciones y Control de Proveedores</span>
            </h3>
            <p className="text-xs text-slate-400">
              Consulta de lotes recibidos, estado de pagos a proveedores y registro de abonos antes de la fecha límite.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar proveedor o producto..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setTableFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  tableFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setTableFilter('credito_pending')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  tableFilter === 'credito_pending'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Crédito Pendiente
              </button>
              <button
                type="button"
                onClick={() => setTableFilter('credito_paid')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  tableFilter === 'credito_paid'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Crédito Pagado
              </button>
              <button
                type="button"
                onClick={() => setTableFilter('contado')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  tableFilter === 'contado' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Contado
              </button>
            </div>
          </div>
        </div>

        {/* Restocks Table */}
        <div className="overflow-x-auto">
          {filteredRestocks.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              No se encontraron registros de reposición para el criterio seleccionado.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRestocks.map((r) => {
                const isOverdue =
                  !r.isPaid && r.dueDate && new Date(r.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-2xl border transition ${
                      r.isPaid
                        ? 'bg-slate-950/60 border-slate-800/80'
                        : isOverdue
                        ? 'bg-rose-950/20 border-rose-600/40'
                        : 'bg-amber-950/15 border-amber-500/30'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Left: Product and Supplier */}
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                            r.isPaid ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                          }`}
                        >
                          #{r.restockNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm sm:text-base text-white">{r.productName}</h4>
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 font-mono text-xs font-bold">
                              +{formatQuantity(r.quantityAdded, r.unit)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                r.paymentCondition === 'contado'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : r.isPaid
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {r.paymentCondition === 'contado'
                                ? 'Contado'
                                : r.isPaid
                                ? 'Crédito Pagado'
                                : 'A Crédito (Pendiente)'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span>🏢 {r.supplierName}</span>
                            {r.supplierInvoiceNumber && <span>• Fac: {r.supplierInvoiceNumber}</span>}
                            <span>• 📅 {new Date(r.date).toLocaleDateString('es-VE')}</span>
                          </p>
                        </div>
                      </div>

                      {/* Middle: Financials */}
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Costo Total:</span>
                          <span className="font-bold text-white text-sm">{formatUSD(r.totalCostUSD)}</span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px]">Abonado/Pagado:</span>
                          <span className="font-bold text-emerald-400 text-sm">{formatUSD(r.paidUSD)}</span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px]">Saldo Deuda:</span>
                          <span
                            className={`font-bold text-sm ${r.pendingUSD > 0 ? 'text-amber-400' : 'text-slate-500'}`}
                          >
                            {formatUSD(r.pendingUSD)}
                          </span>
                        </div>

                        {r.dueDate && (
                          <div className="hidden sm:block">
                            <span className="text-slate-400 block text-[10px]">Fecha Límite:</span>
                            <span
                              className={`font-bold text-xs ${
                                isOverdue ? 'text-rose-400 font-black' : 'text-slate-300'
                              }`}
                            >
                              {r.dueDate} {isOverdue && '⚠️ Vencido'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!r.isPaid && r.pendingUSD > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRestockForAbono(r);
                              setAbonoAmountInput(r.pendingUSD.toFixed(2));
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Abonar a Proveedor</span>
                          </button>
                        )}

                        {r.supplierPhone && (
                          <a
                            href={getSupplierWhatsAppUrl(r)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
                            title="Notificar estado por WhatsApp al Proveedor"
                          >
                            <Send className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Abonos Breakdown Accordion / List */}
                    {r.abonos && r.abonos.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                        <span className="text-[11px] font-bold text-slate-400 block mb-1.5">
                          Historial de Abonos Realizados antes de la fecha límite ({r.abonos.length}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {r.abonos.map((ab, idx) => (
                            <div
                              key={ab.id || idx}
                              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-emerald-400 block">{formatUSD(ab.amountUSD)}</span>
                                <span className="text-slate-400 text-[10px]">
                                  {new Date(ab.date).toLocaleDateString('es-VE')} • {ab.paymentMethod}
                                </span>
                              </div>
                              {ab.reference && (
                                <span className="text-[10px] text-slate-500 truncate max-w-[80px]">
                                  Ref: {ab.reference}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: REGISTRAR ABONO AL PROVEEDOR */}
      {activeRestockForAbono && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base">Registrar Abono a Proveedor</h3>
                  <p className="text-xs text-slate-400">{activeRestockForAbono.supplierName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRestockForAbono(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Producto Repuesto:</span>
                <span className="font-bold text-white">{activeRestockForAbono.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Costo Total del Lote:</span>
                <span className="font-mono text-white">{formatUSD(activeRestockForAbono.totalCostUSD)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Abonado a la Fecha:</span>
                <span className="font-mono text-emerald-400">{formatUSD(activeRestockForAbono.paidUSD)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-amber-400 font-bold">Saldo Pendiente Actual:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {formatUSD(activeRestockForAbono.pendingUSD)}
                </span>
              </div>
              {activeRestockForAbono.dueDate && (
                <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>Fecha Límite de Pago:</span>
                  <span>{activeRestockForAbono.dueDate}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Monto del Abono ($ USD):</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={activeRestockForAbono.pendingUSD}
                    value={abonoAmountInput}
                    onChange={(e) => setAbonoAmountInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-rose-500"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Método de Pago:</label>
                <select
                  value={abonoPaymentMethod}
                  onChange={(e: any) => setAbonoPaymentMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="cash_usd">💵 Efectivo Divisas ($ USD)</option>
                  <option value="cash_ves">🇻🇪 Efectivo Bolívares (Bs.)</option>
                  <option value="pago_movil">📱 Pago Móvil</option>
                  <option value="punto">💳 Punto de Venta</option>
                  <option value="transferencia">🏦 Transferencia Bancaria</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">N° Referencia o Comprobante:</label>
                <input
                  type="text"
                  placeholder="Ej: PM-992019 / Recibo del chofer"
                  value={abonoRefInput}
                  onChange={(e) => setAbonoRefInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Notas / Observaciones:</label>
                <input
                  type="text"
                  placeholder="Abono realizado al chofer antes del vencimiento..."
                  value={abonoNotesInput}
                  onChange={(e) => setAbonoNotesInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300">
              ℹ️ Al confirmar, este abono se sumará a los pagos del proveedor y se agregará automáticamente como un
              egreso en la categoría "Mercancía/Proveedores".
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveRestockForAbono(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAbono}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                Confirmar Abono
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
