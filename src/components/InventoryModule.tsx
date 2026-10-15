import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Scale,
  Check,
  X,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Camera,
  Barcode,
  FileText,
  Percent,
  Coins,
  Send,
} from 'lucide-react';
import { AppSettings, Product, ProductCategory, UnitType } from '../types';
import {
  formatUSD,
  formatVES,
  formatQuantity,
  calculateInventorySummary,
  generateTelegramInventoryReport,
} from '../services/storage';
import { CameraScannerModal } from './CameraScannerModal';
import { InventoryReportModal } from './InventoryReportModal';

interface InventoryModuleProps {
  products: Product[];
  settings: AppSettings;
  onUpdateProducts: (products: Product[]) => void;
  initialSearchQuery?: string;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  products,
  settings,
  onUpdateProducts,
  initialSearchQuery,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'Todos'>('Todos');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  React.useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  // Camera scanner state
  const [isSearchScannerOpen, setIsSearchScannerOpen] = useState(false);
  const [isFormScannerOpen, setIsFormScannerOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategory>('Quesos');
  const [formUnit, setFormUnit] = useState<UnitType>('KG');
  const [formCostUSD, setFormCostUSD] = useState('');
  const [formMarginPercent, setFormMarginPercent] = useState('35.0');
  const [formPriceUSD, setFormPriceUSD] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formEmoji, setFormEmoji] = useState('🧀');
  const [formCode, setFormCode] = useState('');
  const [formMinAlert, setFormMinAlert] = useState('3.0');
  const [formMermaPercent, setFormMermaPercent] = useState('3.0'); // Merma estimada para análisis en modal

  // Executive summary metrics
  const inventorySummary = useMemo(() => {
    return calculateInventorySummary(products, settings);
  }, [products, settings]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q);
      const isLow = p.stock <= (p.minStockAlert || 3);
      const matchesLowStock = !onlyLowStock || isLow;

      return matchesCategory && matchesSearch && matchesLowStock;
    });
  }, [products, selectedCategory, searchQuery, onlyLowStock]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory('Quesos');
    setFormUnit('KG');
    setFormCostUSD('');
    setFormMarginPercent('35.0');
    setFormPriceUSD('');
    setFormStock('10.0');
    setFormEmoji('🧀');
    setFormCode('');
    setFormMinAlert('3.0');
    setFormMermaPercent('3.0');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormUnit(p.unit);
    const cost =
      typeof p.costUSD === 'number' && p.costUSD > 0
        ? p.costUSD
        : Math.round(p.priceUSD * 0.72 * 100) / 100;
    const margin =
      typeof p.marginPercent === 'number'
        ? p.marginPercent
        : cost > 0
        ? Math.round(((p.priceUSD - cost) / cost) * 1000) / 10
        : 35.0;

    setFormCostUSD(cost.toString());
    setFormMarginPercent(margin.toString());
    setFormPriceUSD(p.priceUSD.toString());
    setFormStock(p.stock.toString());
    setFormEmoji(p.emoji || '🧀');
    setFormCode(p.code || '');
    setFormMinAlert((p.minStockAlert || 3).toString());
    setFormMermaPercent('3.0');
    setIsModalOpen(true);
  };

  // Bidirectional price / cost / margin handlers
  const handleCostChange = (val: string) => {
    setFormCostUSD(val);
    const cost = parseFloat(val.replace(',', '.'));
    const margin = parseFloat(formMarginPercent.replace(',', '.'));
    if (!isNaN(cost) && cost > 0 && !isNaN(margin)) {
      const calculatedPrice = cost * (1 + margin / 100);
      setFormPriceUSD(calculatedPrice.toFixed(2));
    }
  };

  const handleMarginChange = (val: string) => {
    setFormMarginPercent(val);
    const cost = parseFloat(formCostUSD.replace(',', '.'));
    const margin = parseFloat(val.replace(',', '.'));
    if (!isNaN(cost) && cost > 0 && !isNaN(margin)) {
      const calculatedPrice = cost * (1 + margin / 100);
      setFormPriceUSD(calculatedPrice.toFixed(2));
    }
  };

  const adjustMarginDelta = (delta: number) => {
    const current = parseFloat(formMarginPercent.replace(',', '.')) || 0;
    const next = Math.max(0, Math.round((current + delta) * 10) / 10);
    handleMarginChange(next.toFixed(1));
  };

  const handlePriceChange = (val: string) => {
    setFormPriceUSD(val);
    const price = parseFloat(val.replace(',', '.'));
    const cost = parseFloat(formCostUSD.replace(',', '.'));
    if (!isNaN(price) && price > 0 && !isNaN(cost) && cost > 0) {
      const calculatedMargin = ((price - cost) / cost) * 100;
      setFormMarginPercent((Math.round(calculatedMargin * 10) / 10).toFixed(1));
    }
  };

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const applyPresetMargin = (presetPct: number) => {
    handleMarginChange(presetPct.toString());
  };

  const handleDeleteProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setProductToDelete(prod);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const priceUSD = parseFloat(formPriceUSD.replace(',', '.'));
    const stock = parseFloat(formStock.replace(',', '.'));
    const minAlert = parseFloat(formMinAlert.replace(',', '.')) || 3;

    if (!formName.trim()) {
      setFormError('El nombre del producto es obligatorio.');
      return;
    }
    if (isNaN(priceUSD) || priceUSD <= 0) {
      setFormError('Introduce un precio de venta en USD válido.');
      return;
    }
    if (isNaN(stock) || stock < 0) {
      setFormError('Introduce un stock válido mayor o igual a cero.');
      return;
    }

    const costInput = parseFloat(formCostUSD.replace(',', '.'));
    const costUSD =
      !isNaN(costInput) && costInput > 0
        ? Math.round(costInput * 100) / 100
        : Math.round(priceUSD * 0.72 * 100) / 100;

    const marginInput = parseFloat(formMarginPercent.replace(',', '.'));
    const marginPercent =
      !isNaN(marginInput) && marginInput >= 0
        ? Math.round(marginInput * 100) / 100
        : costUSD > 0
        ? Math.round(((priceUSD - costUSD) / costUSD) * 1000) / 10
        : 35.0;

    if (editingProduct) {
      // Edit existing
      const updated = products.map((p) =>
        p.id === editingProduct.id
          ? {
              ...p,
              name: formName.trim(),
              category: formCategory,
              unit: formUnit,
              costUSD,
              marginPercent,
              priceUSD,
              stock,
              emoji: formEmoji || '🧀',
              code: formCode.trim() || undefined,
              minStockAlert: minAlert,
            }
          : p
      );
      onUpdateProducts(updated);
    } else {
      // Create new
      const newProd: Product = {
        id: `prod-${Date.now()}`,
        name: formName.trim(),
        category: formCategory,
        unit: formUnit,
        costUSD,
        marginPercent,
        priceUSD,
        stock,
        emoji: formEmoji || '🧀',
        code: formCode.trim() || undefined,
        minStockAlert: minAlert,
      };
      onUpdateProducts([newProd, ...products]);
    }

    setIsModalOpen(false);
  };

  // Quick stock adjustment
  const handleQuickAdjustStock = (productId: string, delta: number) => {
    const updated = products.map((p) => {
      if (p.id === productId) {
        const step = p.unit === 'KG' ? 1.0 : 1;
        const newStock = Math.max(0, Math.round((p.stock + delta * step) * 1000) / 1000);
        return { ...p, stock: newStock };
      }
      return p;
    });
    onUpdateProducts(updated);
  };

  // Computed values for current modal form
  const parsedCost = parseFloat(formCostUSD.replace(',', '.')) || 0;
  const parsedPrice = parseFloat(formPriceUSD.replace(',', '.')) || 0;
  const parsedStock = parseFloat(formStock.replace(',', '.')) || 0;
  const parsedMerma = parseFloat(formMermaPercent.replace(',', '.')) || 0;

  // 1. Ganancia Unitaria del producto
  const unitGrossProfit = parsedPrice - parsedCost;
  const grossMarginOnRevenue = parsedPrice > 0 ? (unitGrossProfit / parsedPrice) * 100 : 0;

  // 2. Ganancia y Valoración por Stock
  const totalStockCostUSD = parsedStock * parsedCost;
  const totalStockRetailUSD = parsedStock * parsedPrice;
  const totalStockProfitUSD = parsedStock * unitGrossProfit;

  // 3. Estimado de Pérdida por Merma
  const estimatedMermaQty = parsedStock * (parsedMerma / 100);
  const estimatedMermaLossCostUSD = estimatedMermaQty * parsedCost;
  const estimatedMermaLossRetailUSD = estimatedMermaQty * parsedPrice;
  const adjustedNetProfitAfterMermaUSD = totalStockProfitUSD - estimatedMermaLossCostUSD;

  return (
    <div id="inventory-module-container" className="space-y-4">
      {/* Top Header & Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-rose-400" />
            <span>Control de Inventario, Costos y Precios Bimonetarios</span>
          </h3>
          <p className="text-xs text-slate-400">
            {products.length} productos registrados. Precios base en USD y convertidos a Tasa BCV ({formatVES(settings.bcvRate)}).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="btn-telegram-inventory-backup"
            onClick={() => {
              const { url } = generateTelegramInventoryReport(products, settings);
              const a = document.createElement('a');
              a.href = url;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.click();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 border border-sky-800/60 text-sky-300 hover:text-white text-xs font-semibold transition shadow-sm cursor-pointer active:scale-95"
            title="Enviar respaldo de inventario y stock por Telegram"
          >
            <Send className="w-4 h-4 text-sky-400" />
            <span>Respaldo Telegram</span>
          </button>

          <button
            type="button"
            id="btn-open-inventory-report"
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition border border-slate-700 cursor-pointer shadow-sm"
            title="Abrir reporte oficial con costos, márgenes y utilidades proyectadas"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Reporte de Márgenes</span>
          </button>

          <button
            type="button"
            id="btn-add-product"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold transition shadow-lg shadow-rose-950/40 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Inversión en Costo */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block flex items-center justify-between">
            <span>Inversión en Mercancía</span>
            <span className="text-rose-400 text-[10px] font-mono">Costo</span>
          </span>
          <div className="text-base sm:text-lg font-bold font-mono text-rose-400">
            {formatUSD(inventorySummary.totalCostUSD)}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            ~{formatVES(inventorySummary.totalCostVES)}
          </div>
        </div>

        {/* Valor Venta Proyectada */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block flex items-center justify-between">
            <span>Valor Comercial Total</span>
            <span className="text-blue-400 text-[10px] font-mono">PVP</span>
          </span>
          <div className="text-base sm:text-lg font-bold font-mono text-slate-100">
            {formatUSD(inventorySummary.totalRetailUSD)}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            ~{formatVES(inventorySummary.totalRetailVES)}
          </div>
        </div>

        {/* Ganancia Potencial */}
        <div className="bg-slate-900 border border-emerald-900/40 rounded-2xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block flex items-center justify-between">
            <span>Utilidad Proyectada</span>
            <span className="text-emerald-400 text-[10px] font-mono font-bold">+{inventorySummary.averageMarginPercent}%</span>
          </span>
          <div className="text-base sm:text-lg font-bold font-mono text-emerald-400">
            +{formatUSD(inventorySummary.potentialProfitUSD)}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            ~{formatVES(inventorySummary.potentialProfitVES)}
          </div>
        </div>

        {/* Existencia & Alertas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block flex items-center justify-between">
            <span>Existencia Total</span>
            <Package className="w-3.5 h-3.5 text-slate-400" />
          </span>
          <div className="text-sm sm:text-base font-bold font-mono text-slate-200">
            {inventorySummary.totalStockKG.toFixed(2)} KG / {inventorySummary.totalStockUnits} UN
          </div>
          <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <span>{inventorySummary.totalProducts} productos</span>
            {inventorySummary.lowStockCount > 0 && (
              <span className="text-amber-400 font-semibold">⚠️ {inventorySummary.lowStockCount} stock bajo</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="inventory-search-input"
              type="text"
              placeholder="Buscar por nombre, código o EAN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-rose-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsSearchScannerOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
            title="Escanear código de barras con la cámara para buscar en inventario"
          >
            <Camera className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Escanear</span>
          </button>
        </div>

        {/* Category Pills & Low Stock Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['Todos', 'Quesos', 'Embutidos', 'Lácteos', 'Varios'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              onlyLowStock
                ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Stock Bajo</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 font-mono">
              <tr>
                <th className="py-3 px-3">Producto</th>
                <th className="py-3 px-2">Categoría</th>
                <th className="py-3 px-2">Unidad</th>
                <th className="py-3 px-2 text-right">Precio Costo</th>
                <th className="py-3 px-2 text-right">Margen</th>
                <th className="py-3 px-2 text-right">Precio Venta</th>
                <th className="py-3 px-2 text-right">Stock</th>
                <th className="py-3 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredProducts.map((p) => {
                const priceVES = p.priceUSD * settings.bcvRate;
                const unitCost =
                  typeof p.costUSD === 'number' && p.costUSD > 0
                    ? p.costUSD
                    : Math.round(p.priceUSD * 0.72 * 100) / 100;
                const costVES = unitCost * settings.bcvRate;
                const margin =
                  typeof p.marginPercent === 'number'
                    ? p.marginPercent
                    : unitCost > 0
                    ? Math.round(((p.priceUSD - unitCost) / unitCost) * 1000) / 10
                    : 35.0;
                const unitProfit = p.priceUSD - unitCost;
                const stockCostUSD = p.stock * unitCost;
                const stockRetailUSD = p.stock * p.priceUSD;
                const isLow = p.stock <= (p.minStockAlert || 3);
                const isKg = p.unit === 'KG';

                return (
                  <tr
                    key={p.id}
                    id={`inventory-row-${p.id}`}
                    className="hover:bg-slate-800/50 transition group"
                  >
                    {/* Name & Emoji */}
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xl shrink-0">{p.emoji}</span>
                        <div>
                          <div className="font-semibold text-xs sm:text-sm text-slate-100">
                            {p.name}
                          </div>
                          {p.code && (
                            <span className="text-[10px] font-mono text-slate-500">
                              Cód: {p.code}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-2 font-sans">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/60">
                        {p.category}
                      </span>
                    </td>

                    {/* Unit */}
                    <td className="py-2.5 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          isKg
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                        }`}
                      >
                        {p.unit}
                      </span>
                    </td>

                    {/* Cost USD & VES */}
                    <td className="py-2.5 px-2 text-right">
                      <div className="font-bold text-slate-200 text-xs">
                        {formatUSD(unitCost)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatVES(costVES)}
                      </div>
                    </td>

                    {/* Margin % */}
                    <td className="py-2.5 px-2 text-right">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          margin >= 35
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : margin >= 20
                            ? 'bg-blue-950 text-blue-300 border border-blue-800/50'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/50'
                        }`}
                      >
                        +{margin.toFixed(1)}%
                      </span>
                    </td>

                    {/* Price USD & VES */}
                    <td className="py-2.5 px-2 text-right">
                      <div className="font-bold text-emerald-400 text-xs sm:text-sm">
                        {formatUSD(p.priceUSD)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatVES(priceVES)}
                      </div>
                      {settings.preferentialRate && settings.preferentialRate > settings.bcvRate && (
                        <div className="text-[9px] text-amber-300 font-mono" title="Sugerencia de precio en dólares efectivo">
                          Sug: ${((p.priceUSD * settings.bcvRate) / settings.preferentialRate).toFixed(2)}
                        </div>
                      )}
                    </td>

                    {/* Stock */}
                    <td className="py-2.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span
                          className={`font-bold ${
                            isLow ? 'text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/40' : 'text-slate-200'
                          }`}
                        >
                          {formatQuantity(p.stock, p.unit)}
                        </span>
                        {isLow && (
                          <AlertTriangle className="w-3 h-3 text-rose-400" title="Stock bajo" />
                        )}
                      </div>
                      {/* Quick stock +/- */}
                      <div className="flex items-center justify-end gap-1 mt-1 opacity-60 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => handleQuickAdjustStock(p.id, -1)}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs cursor-pointer"
                          title="Descontar 1"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdjustStock(p.id, 1)}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs cursor-pointer"
                          title="Añadir 1"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Editar producto, costos y margen"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500 font-sans">
                    No se encontraron productos con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl text-slate-100 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-rose-400" />
                <span>{editingProduct ? 'Editar Ficha de Producto' : 'Nuevo Producto en Catálogo'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold">
                  {formError}
                </div>
              )}
              {/* Name & Emoji */}
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1">
                  <label className="text-slate-400 block mb-1">Ícono/Emoji</label>
                  <input
                    type="text"
                    value={formEmoji}
                    onChange={(e) => setFormEmoji(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-center text-lg"
                    placeholder="🧀"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-slate-400 block mb-1">Nombre del Producto (*)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Queso Amarillo Torondoy"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-rose-500"
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Categoría</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ProductCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-rose-500"
                  >
                    <option value="Quesos">🧀 Quesos</option>
                    <option value="Embutidos">🥩 Embutidos</option>
                    <option value="Lácteos">🥛 Lácteos</option>
                    <option value="Varios">🥖 Varios</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Tipo de Venta / Unidad</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as UnitType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold focus:outline-rose-500"
                  >
                    <option value="KG">⚖️ Por Peso (Kilogramo KG)</option>
                    <option value="UN">📦 Por Unidad (UN)</option>
                  </select>
                </div>
              </div>

              {/* SECTION: ESTRUCTURA DE PRECIOS, COSTO Y MARGEN */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Estructura de Precios y Margen de Ganancia</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Cálculo bidireccional automático
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Costo USD */}
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      1. Precio Costo ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ej. 4.00"
                        value={formCostUSD}
                        onChange={(e) => handleCostChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-6 pr-2.5 py-2 text-slate-100 font-mono font-bold text-xs focus:outline-rose-500"
                      />
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      ~{formatVES(parsedCost * settings.bcvRate)} (BCV)
                    </div>
                  </div>

                  {/* Margen % */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-medium block">
                        2. Margen Ganancia (%)
                      </label>
                      <div className="flex items-center gap-1 font-mono text-[10px]">
                        <button
                          type="button"
                          onClick={() => adjustMarginDelta(-0.1)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Restar 0.1%"
                        >
                          -0.1
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustMarginDelta(0.1)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 transition"
                          title="Sumar 0.1%"
                        >
                          +0.1
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="37.6"
                        value={formMarginPercent}
                        onChange={(e) => handleMarginChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-2.5 pr-6 py-2 text-slate-100 font-mono font-bold text-xs focus:outline-rose-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                        %
                      </span>
                    </div>
                    {/* Quick presets */}
                    <div className="flex items-center gap-1 mt-1 overflow-x-auto no-scrollbar">
                      {[25, 30, 35, 37.6, 37.8, 40.1, 50].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => applyPresetMargin(pct)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold transition cursor-pointer ${
                            parseFloat(formMarginPercent) === pct
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          +{pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Precio Venta USD */}
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      3. Precio Venta ($) (*)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500 font-mono text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="Ej. 5.50"
                        value={formPriceUSD}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-6 pr-2.5 py-2 text-emerald-400 font-mono font-bold text-xs focus:outline-emerald-500"
                      />
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
                      ~{formatVES(parsedPrice * settings.bcvRate)} (BCV)
                    </div>
                  </div>
                </div>

                {/* Projected Unit Profit Banner */}
                {parsedPrice > 0 && parsedCost > 0 && (
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-400 block font-sans">Ganancia Unitaria Proyectada:</span>
                      <span className="font-bold text-emerald-400 text-xs">
                        +{formatUSD(unitGrossProfit)} USD (~{formatVES(unitGrossProfit * settings.bcvRate)})
                      </span>
                      <span className="text-slate-500 ml-1">por cada {formUnit}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-400 block font-sans">Margen Comercial Efectivo:</span>
                      <span className="text-slate-200">
                        s/ Costo: <b className="text-emerald-400">+{formMarginPercent}%</b> | s/ Venta: <b>{grossMarginOnRevenue.toFixed(1)}%</b>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Stock & Alert */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">
                    Stock Disponible ({formUnit})
                  </label>
                  <input
                    type="number"
                    step={formUnit === 'KG' ? '0.001' : '1'}
                    min="0"
                    required
                    placeholder={formUnit === 'KG' ? '15.500' : '20'}
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono font-bold text-xs focus:outline-rose-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Alerta Stock Mínimo ({formUnit})</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="3.0"
                    value={formMinAlert}
                    onChange={(e) => setFormMinAlert(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Code / Barcode */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 block">Código / Código de Barra (EAN)</label>
                  <button
                    type="button"
                    onClick={() => setIsFormScannerOpen(true)}
                    className="text-rose-400 hover:text-rose-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                    title="Escanear código de barras con la cámara"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Escanear con Cámara</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ej. Q-005 o 759100100..."
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-slate-100 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setIsFormScannerOpen(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                    title="Escanear con cámara"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ESTIMADOS DE GANANCIA, STOCK Y MERMA (SOLICITADO POR EL USUARIO) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Estimados de Ganancia, Stock y Merma</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Proyección Comercial en Vivo
                  </span>
                </div>

                {/* 1. Estimado de Ganancia Unitaria del Producto */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold text-[11px] flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Estimado de Ganancia del Producto:</span>
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400">
                      +{formatUSD(unitGrossProfit)} / {formUnit}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] font-mono text-slate-400 pt-0.5">
                    <span>
                      En Bolívares: <strong className="text-emerald-300">~{formatVES(unitGrossProfit * settings.bcvRate)}</strong>
                    </span>
                    <span>
                      Margen s/ Costo: <strong className="text-slate-200">+{formMarginPercent}%</strong> (s/ Venta: {grossMarginOnRevenue.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* 2. Estimado de Ganancia por Stock */}
                <div className="p-3 rounded-xl bg-slate-900 border border-emerald-950/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold text-[11px] flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Estimado de Ganancia por Stock ({parsedStock} {formUnit}):</span>
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400">
                      +{formatUSD(totalStockProfitUSD)} USD
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60 text-[10px] font-mono">
                    <div>
                      <span className="text-slate-400 block">Inversión a Costo:</span>
                      <span className="text-rose-400 font-bold">{formatUSD(totalStockCostUSD)}</span>
                      <span className="text-slate-500 block text-[9px]">~{formatVES(totalStockCostUSD * settings.bcvRate)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">Valor Comercial (PVP):</span>
                      <span className="text-slate-100 font-bold">{formatUSD(totalStockRetailUSD)}</span>
                      <span className="text-slate-500 block text-[9px]">~{formatVES(totalStockRetailUSD * settings.bcvRate)}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Estimado de Pérdida por Merma (Quesos y Embutidos) */}
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300 font-semibold text-[11px] flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Estimado de Pérdida por Merma:</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Merma:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="50"
                        value={formMermaPercent}
                        onChange={(e) => setFormMermaPercent(e.target.value)}
                        className="w-14 bg-slate-900 border border-amber-700/60 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-amber-300 text-right focus:outline-amber-500"
                      />
                      <span className="text-[11px] text-amber-400 font-mono">%</span>
                    </div>
                  </div>

                  {/* Merma quick presets */}
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="text-slate-400 text-[9px]">Valores comunes:</span>
                    <div className="flex items-center gap-1">
                      {['1.5', '2.0', '3.0', '5.0'].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setFormMermaPercent(pct)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition cursor-pointer ${
                            formMermaPercent === pct
                              ? 'bg-amber-600 text-white font-bold'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-amber-900/40'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Merma impact calculations */}
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-amber-900/30 text-[10px] font-mono space-y-1.5">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Merma en peso/cantidad estimada ({formMermaPercent}%):</span>
                      <span className="font-bold text-amber-300">-{estimatedMermaQty.toFixed(3)} {formUnit}</span>
                    </div>
                    <div className="flex items-center justify-between text-rose-400">
                      <span>Pérdida económica estimada (a costo):</span>
                      <span className="font-bold">
                        -{formatUSD(estimatedMermaLossCostUSD)} (~{formatVES(estimatedMermaLossCostUSD * settings.bcvRate)})
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 text-emerald-400 font-bold">
                      <span>Ganancia Neta Real (tras deducir merma):</span>
                      <span className="text-xs">+{formatUSD(Math.max(0, adjustedNetProfitAfterMermaUSD))} USD</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-save-inventory-prod"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow-lg shadow-rose-950/40 cursor-pointer"
                >
                  {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Inventory, Cost & Margin Report Modal */}
      <InventoryReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        products={products}
        settings={settings}
      />

      {/* Search Bar Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isSearchScannerOpen}
        onClose={() => setIsSearchScannerOpen(false)}
        title="Buscar Producto por Código de Barra"
        subtitle="Enfoca el código de barras o QR para localizar el producto en inventario"
        onScan={(code) => {
          setSearchQuery(code);
          return true;
        }}
      />

      {/* Form Code Field Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isFormScannerOpen}
        onClose={() => setIsFormScannerOpen(false)}
        title="Escanear Código para el Producto"
        subtitle="Escanea el código de barra del empaque para asignarlo a este producto"
        onScan={(code) => {
          setFormCode(code);
          return true;
        }}
      />

      {/* Product Deletion Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">¿Eliminar Producto?</h4>
                <p className="text-xs text-slate-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <span>{productToDelete.emoji}</span>
                <span>{productToDelete.name}</span>
              </div>
              <p className="text-slate-400 font-mono">
                Stock actual: {formatQuantity(productToDelete.stock, productToDelete.unit)} • Precio: {formatUSD(productToDelete.priceUSD)}
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateProducts(products.filter((p) => p.id !== productToDelete.id));
                  setProductToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950/50 cursor-pointer"
              >
                Eliminar Producto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
