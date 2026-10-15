import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Scale,
  AlertTriangle,
  Scissors,
  Droplets,
  Calendar,
  Check,
  TrendingDown,
  Trash2,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  User,
  History,
} from 'lucide-react';
import { AppSettings, MermaReason, MermaRecord, Product, ProductCategory } from '../types';
import {
  formatUSD,
  formatVES,
  formatQuantity,
  processNewMerma,
  deleteMermaRecord,
} from '../services/storage';
import { playBeepSound, triggerHapticFeedback } from '../utils/audioFeedback';

interface MermaAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  mermas: MermaRecord[];
  settings: AppSettings;
  preselectedProduct?: Product | null;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateMermas: (mermas: MermaRecord[]) => void;
  onSuccessToast?: (msg: string) => void;
}

export const MermaAdjustmentModal: React.FC<MermaAdjustmentModalProps> = ({
  isOpen,
  onClose,
  products,
  mermas,
  settings,
  preselectedProduct,
  onUpdateProducts,
  onUpdateMermas,
  onSuccessToast,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'Todos'>('Todos');

  // Input mode for KG products: 'grams' (e.g. 150g) or 'kilos' (e.g. 0.150 kg)
  const [inputUnitMode, setInputUnitMode] = useState<'grams' | 'kilos'>('grams');
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<MermaReason>('Secado / Pérdida de humedad');
  const [notes, setNotes] = useState<string>('');
  const [performedBy, setPerformedBy] = useState<string>('Encargado de Charcutería');
  const [formError, setFormError] = useState<string | null>(null);

  // History section toggle
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [deletingMermaId, setDeletingMermaId] = useState<string | null>(null);

  // Reset or initialize product when modal opens
  useEffect(() => {
    if (isOpen) {
      if (preselectedProduct) {
        setSelectedProductId(preselectedProduct.id);
        setInputUnitMode(preselectedProduct.unit === 'KG' ? 'grams' : 'kilos');
      } else if (!selectedProductId && products.length > 0) {
        // default to first queso or product
        const firstQueso = products.find((p) => p.category === 'Quesos');
        setSelectedProductId(firstQueso ? firstQueso.id : products[0].id);
      }
      setQuantityInput('');
      setNotes('');
      setFormError(null);
    }
  }, [isOpen, preselectedProduct]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Adjust input unit mode if selected product changes
  useEffect(() => {
    if (selectedProduct && selectedProduct.unit === 'UN') {
      setInputUnitMode('kilos'); // for UN, integer units
    }
  }, [selectedProduct]);

  // Filtered product choices for selection
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = categoryFilter === 'Todos' || p.category === categoryFilter;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [products, productSearch, categoryFilter]);

  // Parse entered quantity in clean standard units (KG or UN)
  const parsedQuantity = useMemo(() => {
    if (!selectedProduct) return 0;
    const cleanStr = quantityInput.replace(',', '.').trim();
    const val = parseFloat(cleanStr);
    if (isNaN(val) || val <= 0) return 0;

    if (selectedProduct.unit === 'KG') {
      if (inputUnitMode === 'grams') {
        return Math.round((val / 1000) * 1000) / 1000;
      }
      return Math.round(val * 1000) / 1000;
    }

    // For UN
    return Math.round(val);
  }, [quantityInput, inputUnitMode, selectedProduct]);

  // Financial calculations
  const unitCostUSD = useMemo(() => {
    if (!selectedProduct) return 0;
    return selectedProduct.costUSD && selectedProduct.costUSD > 0
      ? selectedProduct.costUSD
      : Math.round(selectedProduct.priceUSD * 0.65 * 100) / 100;
  }, [selectedProduct]);

  const estimatedLossUSD = useMemo(() => {
    return Math.round(parsedQuantity * unitCostUSD * 100) / 100;
  }, [parsedQuantity, unitCostUSD]);

  const estimatedLossVES = useMemo(() => {
    return Math.round(estimatedLossUSD * settings.bcvRate * 100) / 100;
  }, [estimatedLossUSD, settings.bcvRate]);

  const unearnedRetailUSD = useMemo(() => {
    if (!selectedProduct) return 0;
    return Math.round(parsedQuantity * selectedProduct.priceUSD * 100) / 100;
  }, [parsedQuantity, selectedProduct]);

  const newStockPreview = useMemo(() => {
    if (!selectedProduct) return 0;
    return Math.max(0, Math.round((selectedProduct.stock - parsedQuantity) * 1000) / 1000);
  }, [selectedProduct, parsedQuantity]);

  // Quick preset adder
  const handleAddQuickQty = (amount: number, isGrams = true) => {
    if (isGrams && inputUnitMode === 'grams') {
      const current = parseFloat(quantityInput.replace(',', '.')) || 0;
      setQuantityInput((current + amount).toString());
    } else if (!isGrams && inputUnitMode === 'kilos') {
      const current = parseFloat(quantityInput.replace(',', '.')) || 0;
      setQuantityInput((Math.round((current + amount) * 1000) / 1000).toString());
    } else if (inputUnitMode === 'grams') {
      // adding kilos into grams mode
      const current = parseFloat(quantityInput.replace(',', '.')) || 0;
      setQuantityInput((current + amount * 1000).toString());
    } else {
      // adding grams into kilos mode
      const current = parseFloat(quantityInput.replace(',', '.')) || 0;
      setQuantityInput((Math.round((current + amount / 1000) * 1000) / 1000).toString());
    }
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProduct) {
      setFormError('Por favor selecciona un producto');
      return;
    }

    if (parsedQuantity <= 0) {
      setFormError('Ingresa una cantidad mayor a 0 para el ajuste de merma');
      return;
    }

    if (parsedQuantity > selectedProduct.stock) {
      setFormError(
        `La cantidad a descontar (${formatQuantity(parsedQuantity, selectedProduct.unit)}) supera el stock actual disponible (${formatQuantity(selectedProduct.stock, selectedProduct.unit)})`
      );
      return;
    }

    try {
      const result = processNewMerma(
        {
          productId: selectedProduct.id,
          quantity: parsedQuantity,
          reason: selectedReason,
          notes: notes.trim(),
          performedBy: performedBy.trim(),
        },
        products,
        mermas,
        settings
      );

      onUpdateProducts(result.updatedProducts);
      onUpdateMermas(result.updatedMermas);

      playBeepSound(1400, 150);
      triggerHapticFeedback();

      if (onSuccessToast) {
        onSuccessToast(
          `Merma registrada: -${formatQuantity(parsedQuantity, selectedProduct.unit)} de ${selectedProduct.name} (-$${estimatedLossUSD.toFixed(2)} en P&L)`
        );
      }

      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Error al procesar el ajuste de merma');
    }
  };

  // Delete / Revert a previous merma
  const handleRevertMerma = (merma: MermaRecord) => {
    const res = deleteMermaRecord(merma.id, true, products, mermas);
    onUpdateProducts(res.updatedProducts);
    onUpdateMermas(res.updatedMermas);
    setDeletingMermaId(null);
    if (onSuccessToast) {
      onSuccessToast(
        `Merma revertida: Se restauraron +${formatQuantity(merma.quantity, merma.unit)} a ${merma.productName}`
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Ajuste de Merma Física & Manipulación
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 uppercase tracking-wide">
                  Charcutería
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Descuenta gramos perdidos (secado en mostrador, recortes de barra o descarte) y los refleja en el reporte P&L.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          {formError && (
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-xs font-semibold text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Product Selector */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-2">
              1. Seleccionar Producto de Charcutería
            </label>

            {/* If product is not yet selected or user wants to switch */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar queso, jamón, mortadela..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {(['Todos', 'Quesos', 'Embutidos', 'Lácteos'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product quick grid */}
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-slate-800 p-1 bg-slate-950/50">
                {filteredProducts.map((p) => {
                  const isSelected = p.id === selectedProductId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setInputUnitMode(p.unit === 'KG' ? 'grams' : 'kilos');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/20 border border-amber-500/50 text-white font-bold'
                          : 'hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{p.emoji || '🧀'}</span>
                        <div>
                          <span className="text-xs block font-semibold">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.category} • Costo: ${p.costUSD ? p.costUSD.toFixed(2) : (p.priceUSD * 0.65).toFixed(2)}/
                            {p.unit}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-amber-400">
                          {formatQuantity(p.stock, p.unit)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">Stock actual</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Product Card & Stats */}
          {selectedProduct && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 rounded-xl bg-slate-900 border border-slate-800">
                  {selectedProduct.emoji || '🧀'}
                </span>
                <div>
                  <h4 className="text-sm font-bold text-white">{selectedProduct.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Stock en sistema:{' '}
                    <strong className="text-amber-400">{formatQuantity(selectedProduct.stock, selectedProduct.unit)}</strong>{' '}
                    • Costo unitario: ${unitCostUSD.toFixed(2)} USD
                  </p>
                </div>
              </div>

              {selectedProduct.unit === 'KG' && (
                <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      if (inputUnitMode !== 'grams') {
                        setInputUnitMode('grams');
                        if (quantityInput) {
                          const val = parseFloat(quantityInput.replace(',', '.')) || 0;
                          setQuantityInput((val * 1000).toString());
                        }
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      inputUnitMode === 'grams'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Gramos (g)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (inputUnitMode !== 'kilos') {
                        setInputUnitMode('kilos');
                        if (quantityInput) {
                          const val = parseFloat(quantityInput.replace(',', '.')) || 0;
                          setQuantityInput((Math.round((val / 1000) * 1000) / 1000).toString());
                        }
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      inputUnitMode === 'kilos'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Kilos (kg)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. Amount Input & Quick Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                2. Cantidad a Descontar por Merma ({inputUnitMode === 'grams' ? 'Gramos' : selectedProduct?.unit || 'KG'})
              </label>
              {parsedQuantity > 0 && selectedProduct && (
                <span className="text-xs font-mono font-bold text-amber-400">
                  Descuento: -{formatQuantity(parsedQuantity, selectedProduct.unit)}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                placeholder={inputUnitMode === 'grams' ? 'Ej: 150 (para 150 gramos)' : 'Ej: 0.150'}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-lg font-mono font-bold text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400 uppercase font-mono">
                {inputUnitMode === 'grams' ? 'g' : selectedProduct?.unit || 'KG'}
              </span>
            </div>

            {/* Quick Add Chips tailored for deli */}
            {selectedProduct?.unit === 'KG' ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-semibold text-slate-500 mr-1">Rápido:</span>
                {[
                  { label: '+50g', val: 50 },
                  { label: '+100g', val: 100 },
                  { label: '+150g', val: 150 },
                  { label: '+250g', val: 250 },
                  { label: '+500g', val: 500 },
                  { label: '+1 kg', val: 1000 },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleAddQuickQty(chip.val, true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold transition cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setQuantityInput('')}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-slate-300 text-xs font-semibold ml-auto transition cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] font-semibold text-slate-500 mr-1">Rápido:</span>
                {[1, 2, 5].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleAddQuickQty(u, false)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold transition cursor-pointer"
                  >
                    +{u} UN
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Reason for Wastage */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              3. Causa / Motivo del Ajuste de Merma
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  id: 'Secado / Pérdida de humedad',
                  title: 'Secado / Pérdida de Humedad',
                  desc: 'Deshidratación natural en refrigerador o mostrador',
                  icon: Droplets,
                  color: 'text-blue-400',
                },
                {
                  id: 'Recortes / Extremos de pieza',
                  title: 'Recortes / Extremos de Pieza',
                  desc: 'Puntas secas o bordes no rebanables descartados',
                  icon: Scissors,
                  color: 'text-amber-400',
                },
                {
                  id: 'Daño / Vencimiento',
                  title: 'Daño / Vencimiento',
                  desc: 'Deterioro, hongos o rotura de empaque al vacío',
                  icon: AlertTriangle,
                  color: 'text-rose-400',
                },
                {
                  id: 'Ajuste de inventario físico',
                  title: 'Ajuste de Conteo Físico',
                  desc: 'Diferencia hallada tras pesar la barra completa',
                  icon: Scale,
                  color: 'text-emerald-400',
                },
              ].map((reason) => {
                const Icon = reason.icon;
                const isSelected = selectedReason === reason.id;
                return (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => setSelectedReason(reason.id as MermaReason)}
                    className={`p-3 rounded-2xl text-left border transition flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                        : 'bg-slate-950 border-slate-800/80 hover:bg-slate-800/40 text-slate-400'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${reason.color}`} />
                    <div>
                      <span className={`text-xs font-bold block ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {reason.title}
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight block">
                        {reason.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Real-time Impact Simulator Box */}
          {selectedProduct && parsedQuantity > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-amber-400" />
                  <span>Impacto Financiero en P&L e Inventario</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Tasa BCV: {formatVES(settings.bcvRate)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-amber-500/20">
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Stock Resultante:</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {formatQuantity(selectedProduct.stock, selectedProduct.unit)} ➔{' '}
                    <strong className="text-emerald-400">
                      {formatQuantity(newStockPreview, selectedProduct.unit)}
                    </strong>
                  </span>
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Pérdida en Costo (P&L):</span>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    -{formatUSD(estimatedLossUSD)}{' '}
                    <span className="text-[10px] text-slate-400 block">(~{formatVES(estimatedLossVES)})</span>
                  </span>
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 block">Venta no Percibida:</span>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    -{formatUSD(unearnedRetailUSD)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 5. Notes & Performed By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                <span>Observaciones / Detalle (Opcional):</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Extremo duro no rebanable o secado de 3 días"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>Responsable del Ajuste:</span>
              </label>
              <input
                type="text"
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                placeholder="Ej: Encargado de Charcutería"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span>{showHistory ? 'Ocultar Historial' : `Historial de Mermas (${mermas.length})`}</span>
              {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-950/40 transition flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar y Descontar Stock</span>
              </button>
            </div>
          </div>
        </form>

        {/* Collapsible Recent Mermas Table */}
        {showHistory && (
          <div className="border-t border-slate-800 bg-slate-950/80 p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-400" />
                <span>Registro Histórico de Mermas Registradas ({mermas.length})</span>
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">
                Puedes revertir cualquier registro erróneo para devolver los gramos al inventario
              </span>
            </div>

            {mermas.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No hay mermas registradas todavía.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {mermas.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{m.productName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300">
                          {m.reason}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {new Date(m.date).toLocaleDateString('es-VE')} {new Date(m.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })} • Por: {m.performedBy || 'Encargado'}
                        {m.notes ? ` • "${m.notes}"` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <span className="text-rose-400 font-bold block">
                          -{formatQuantity(m.quantity, m.unit)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          -${m.totalCostUSD.toFixed(2)} USD
                        </span>
                      </div>

                      {deletingMermaId === m.id ? (
                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-rose-500/40">
                          <span className="text-[10px] text-rose-300 font-bold px-1">¿Revertir?</span>
                          <button
                            type="button"
                            onClick={() => handleRevertMerma(m)}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingMermaId(null)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingMermaId(m.id)}
                          title="Revertir merma y devolver stock"
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
