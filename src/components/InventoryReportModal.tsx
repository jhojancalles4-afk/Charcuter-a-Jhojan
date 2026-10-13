import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Printer,
  Download,
  Share2,
  TrendingUp,
  Package,
  Check,
  AlertTriangle,
  Search,
  DollarSign,
  Layers,
  Send,
} from 'lucide-react';
import { AppSettings, Product, ProductCategory } from '../types';
import {
  formatUSD,
  formatVES,
  formatQuantity,
  calculateInventorySummary,
  generateWhatsAppInventoryReport,
  generateTelegramInventoryReport,
} from '../services/storage';

interface InventoryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  settings: AppSettings;
}

export const InventoryReportModal: React.FC<InventoryReportModalProps> = ({
  isOpen,
  onClose,
  products,
  settings,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'Todos'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const summary = useMemo(() => {
    return calculateInventorySummary(products, settings);
  }, [products, settings]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'Todos' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Category breakdown for summary section
  const categoryStats = useMemo(() => {
    const categories: ProductCategory[] = ['Quesos', 'Embutidos', 'Lácteos', 'Varios'];
    return categories.map((cat) => {
      const prods = products.filter((p) => p.category === cat);
      let costTotal = 0;
      let retailTotal = 0;
      let units = 0;
      let kilos = 0;

      for (const p of prods) {
        const cost = typeof p.costUSD === 'number' && p.costUSD > 0 ? p.costUSD : p.priceUSD * 0.72;
        costTotal += p.stock * cost;
        retailTotal += p.stock * p.priceUSD;
        if (p.unit === 'KG') kilos += p.stock;
        else units += p.stock;
      }
      const profit = retailTotal - costTotal;
      const margin = costTotal > 0 ? (profit / costTotal) * 100 : 0;

      return {
        category: cat,
        count: prods.length,
        kilos,
        units,
        costTotal,
        retailTotal,
        profit,
        margin,
      };
    });
  }, [products]);

  if (!isOpen) return null;

  const handleShareWhatsApp = () => {
    const { url } = generateWhatsAppInventoryReport(products, settings);
    window.open(url, '_blank');
  };

  const handleShareTelegram = () => {
    const { url } = generateTelegramInventoryReport(products, settings);
    window.open(url, '_blank');
  };

  const handleCopyText = () => {
    const { message } = generateWhatsAppInventoryReport(products, settings);
    navigator.clipboard.writeText(message);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'Código',
      'Producto',
      'Categoría',
      'Unidad',
      'Stock Actual',
      'Costo USD',
      'Costo VES',
      'Margen %',
      'Precio Venta USD',
      'Precio Venta VES',
      'Ganancia Unitaria USD',
      'Inversión Total Costo USD',
      'Venta Proyectada USD',
      'Utilidad Proyectada USD',
    ];

    const rows = products.map((p) => {
      const unitCost = typeof p.costUSD === 'number' && p.costUSD > 0 ? p.costUSD : p.priceUSD * 0.72;
      const margin = typeof p.marginPercent === 'number' ? p.marginPercent : (unitCost > 0 ? ((p.priceUSD - unitCost) / unitCost) * 100 : 35);
      const unitProfit = p.priceUSD - unitCost;
      const totalCost = p.stock * unitCost;
      const totalRetail = p.stock * p.priceUSD;
      const totalProfit = totalRetail - totalCost;

      return [
        `"${p.code || ''}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        `"${p.unit}"`,
        p.stock.toFixed(3),
        unitCost.toFixed(2),
        (unitCost * settings.bcvRate).toFixed(2),
        margin.toFixed(1),
        p.priceUSD.toFixed(2),
        (p.priceUSD * settings.bcvRate).toFixed(2),
        unitProfit.toFixed(2),
        totalCost.toFixed(2),
        totalRetail.toFixed(2),
        totalProfit.toFixed(2),
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `reporte_inventario_costos_margenes_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                <span>Informe Oficial de Inventario, Costos y Márgenes</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                  Tasa: {formatVES(settings.bcvRate)}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Auditoría financiera de existencias, capital invertido, valor de venta y rendimiento proyectado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Imprimir informe"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Descargar archivo Excel / CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1: Inversión Total Costo */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block flex items-center justify-between">
                <span>Inversión en Mercancía</span>
                <span className="text-rose-400">Costo</span>
              </span>
              <div className="text-base sm:text-lg font-bold font-mono text-rose-400">
                {formatUSD(summary.totalCostUSD)}
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                {formatVES(summary.totalCostVES)}
              </div>
            </div>

            {/* Card 2: Valor Total Venta */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block flex items-center justify-between">
                <span>Venta Proyectada</span>
                <span className="text-blue-400">PVP</span>
              </span>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-100">
                {formatUSD(summary.totalRetailUSD)}
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                {formatVES(summary.totalRetailVES)}
              </div>
            </div>

            {/* Card 3: Utilidad Bruta Estimada */}
            <div className="bg-slate-950 border border-emerald-900/40 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block flex items-center justify-between">
                <span>Ganancia Potencial</span>
                <span className="text-emerald-400 font-bold">+{summary.averageMarginPercent}%</span>
              </span>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-400">
                +{formatUSD(summary.potentialProfitUSD)}
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                +{formatVES(summary.potentialProfitVES)}
              </div>
            </div>

            {/* Card 4: Existencia física */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block flex items-center justify-between">
                <span>Existencia Total</span>
                <Package className="w-3.5 h-3.5 text-slate-400" />
              </span>
              <div className="text-sm sm:text-base font-bold font-mono text-slate-200">
                {summary.totalStockKG.toFixed(2)} KG / {summary.totalStockUnits} UN
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                {summary.totalProducts} productos registrados
              </div>
            </div>
          </div>

          {/* Categorías Breakdown */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-rose-400" />
              <span>Rendimiento y Capital por Categoría</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {categoryStats.map((c) => (
                <div
                  key={c.category}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 font-mono"
                >
                  <div className="flex items-center justify-between font-sans">
                    <span className="font-bold text-slate-100 text-xs">{c.category}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-400">
                      +{c.margin.toFixed(1)}%
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between text-slate-400">
                      <span>Artículos:</span>
                      <span className="text-slate-200">{c.count}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Inversión:</span>
                      <span className="text-rose-400 font-bold">{formatUSD(c.costTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Venta Proy:</span>
                      <span className="text-slate-200">{formatUSD(c.retailTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 border-t border-slate-800/80 pt-1">
                      <span className="text-emerald-400 font-sans font-semibold">Ganancia:</span>
                      <span className="text-emerald-400 font-bold">+{formatUSD(c.profit)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters & Search in Report Modal */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {(['Todos', 'Quesos', 'Embutidos', 'Lácteos', 'Varios'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar producto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-rose-500"
              />
            </div>
          </div>

          {/* Full Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-2">Cat.</th>
                    <th className="py-2.5 px-2 text-right">Existencia</th>
                    <th className="py-2.5 px-2 text-right">Costo Unit.</th>
                    <th className="py-2.5 px-2 text-right">% Margen</th>
                    <th className="py-2.5 px-2 text-right">Precio Venta</th>
                    <th className="py-2.5 px-2 text-right text-rose-400">Total Costo</th>
                    <th className="py-2.5 px-2 text-right text-slate-200">Total Venta</th>
                    <th className="py-2.5 px-3 text-right text-emerald-400 font-bold">Ganancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredProducts.map((p) => {
                    const unitCost = typeof p.costUSD === 'number' && p.costUSD > 0 ? p.costUSD : p.priceUSD * 0.72;
                    const margin = typeof p.marginPercent === 'number' ? p.marginPercent : (unitCost > 0 ? ((p.priceUSD - unitCost) / unitCost) * 100 : 35);
                    const totalCost = p.stock * unitCost;
                    const totalRetail = p.stock * p.priceUSD;
                    const profit = totalRetail - totalCost;
                    const isLow = p.stock <= (p.minStockAlert || 3);

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span>{p.emoji}</span>
                            <div>
                              <span className="font-semibold block">{p.name}</span>
                              {p.code && <span className="text-[10px] text-slate-500 font-mono">Cód: {p.code}</span>}
                            </div>
                            {isLow && (
                              <span className="ml-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800">
                                Stock Bajo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-sans text-[11px] text-slate-400">
                          {p.category}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-slate-200">
                          {formatQuantity(p.stock, p.unit)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-300">
                          {formatUSD(unitCost)}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              margin >= 35
                                ? 'bg-emerald-950 text-emerald-400'
                                : margin >= 20
                                ? 'bg-blue-950 text-blue-300'
                                : 'bg-amber-950 text-amber-300'
                            }`}
                          >
                            +{margin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-slate-100">
                          {formatUSD(p.priceUSD)}
                          <span className="text-[9px] text-slate-400 block font-normal">
                            ~{formatVES(p.priceUSD * settings.bcvRate)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right text-rose-400 font-medium">
                          {formatUSD(totalCost)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-200 font-medium">
                          {formatUSD(totalRetail)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          +{formatUSD(profit)}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                        No se encontraron productos para el criterio seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-slate-400 text-xs">
            Mostrando <span className="font-bold text-slate-200 font-mono">{filteredProducts.length}</span> de{' '}
            <span className="font-bold text-slate-200 font-mono">{products.length}</span> productos en inventario.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? '¡Copiado!' : 'Copiar Resumen'}</span>
            </button>

            <button
              type="button"
              id="btn-share-inventory-telegram"
              onClick={handleShareTelegram}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-sky-950/40 cursor-pointer active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Enviar por Telegram</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-950/40 cursor-pointer active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>Enviar por WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
