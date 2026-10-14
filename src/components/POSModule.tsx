import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Scale,
  DollarSign,
  CreditCard,
  Phone,
  User,
  CheckCircle2,
  FileText,
  Send,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Calculator,
  X,
  Camera,
  Barcode,
  Check,
} from 'lucide-react';
import { AppSettings, CartItem, FidelisCustomerProfile, PaymentMethod, PaymentSplit, Product, ProductCategory, SaleTicket } from '../types';
import { formatUSD, formatVES, formatQuantity, sanitizePhoneForWhatsApp } from '../services/storage';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { CameraScannerModal } from './CameraScannerModal';
import { FidelisExpressWidget } from './FidelisExpressWidget';
import { FidelisDirectoryModal } from './FidelisDirectoryModal';

interface POSModuleProps {
  products: Product[];
  settings: AppSettings;
  onCompleteSale: (ticket: SaleTicket, updatedProducts: Product[]) => void;
  existingCustomers: { name: string; cedula: string; phone: string }[];
  fidelisProfiles: Record<string, FidelisCustomerProfile>;
  onClaimFidelisReward: (customerId: string, rewardType: 'stamps' | 'highValue') => void;
  onNavigateToInventory?: (product?: Product) => void;
}

export const POSModule: React.FC<POSModuleProps> = ({
  products,
  settings,
  onCompleteSale,
  existingCustomers,
  fidelisProfiles,
  onClaimFidelisReward,
  onNavigateToInventory,
}) => {
  // State
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'Todos'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isFidelisDirectoryOpen, setIsFidelisDirectoryOpen] = useState(false);

  // Out of stock popup modal state
  const [outOfStockProduct, setOutOfStockProduct] = useState<Product | null>(null);
  const [weightModalError, setWeightModalError] = useState<string | null>(null);

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerCedula, setCustomerCedula] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);

  // Weight and Monetary Amount modal state (for KG products)
  const [weightModalProduct, setWeightModalProduct] = useState<Product | null>(null);
  const [weightModalMode, setWeightModalMode] = useState<'weight' | 'money'>('weight');
  const [weightInputValue, setWeightInputValue] = useState<string>('0.250');
  const [moneyInputValue, setMoneyInputValue] = useState<string>('2.00');
  const [moneyCurrency, setMoneyCurrency] = useState<'USD' | 'VES'>('USD');

  // Checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'single' | 'mixed'>('single');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_usd');
  const [applySuggestedUSD, setApplySuggestedUSD] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Multi-Payment (Pago Mixto) Splits State
  const [splitCashUSD, setSplitCashUSD] = useState<string>('');
  const [splitPagoMovilVES, setSplitPagoMovilVES] = useState<string>('');
  const [splitPuntoVES, setSplitPuntoVES] = useState<string>('');
  const [splitCashVES, setSplitCashVES] = useState<string>('');
  const [splitFiadoUSD, setSplitFiadoUSD] = useState<string>('');
  const [splitReference, setSplitReference] = useState<string>('');

  // Post-sale ticket modal
  const [completedTicket, setCompletedTicket] = useState<SaleTicket | null>(null);

  // Phone Camera Scanner state
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [scannerToast, setScannerToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

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
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Existing customer auto-complete suggestions
  const customerSuggestions = useMemo(() => {
    if (!customerName.trim() && !customerPhone.trim()) return [];
    const qName = customerName.trim().toLowerCase();
    const qPhone = customerPhone.trim();
    return existingCustomers
      .filter((c) => {
        const matchName = qName && c.name.toLowerCase().includes(qName);
        const matchPhone = qPhone && c.phone.includes(qPhone);
        return matchName || matchPhone;
      })
      .slice(0, 4);
  }, [customerName, customerPhone, existingCustomers]);

  // Cart totals
  const { totalUSD, totalVES, totalItemsCount } = useMemo(() => {
    let usd = 0;
    let count = 0;
    for (const item of cart) {
      usd += item.totalUSD;
      count += item.product.unit === 'UN' ? item.quantity : 1;
    }
    return {
      totalUSD: usd,
      totalVES: usd * settings.bcvRate,
      totalItemsCount: count,
    };
  }, [cart, settings.bcvRate]);

  // Add or edit product in cart (Strict stock validation)
  const handleSelectProduct = (product: Product) => {
    // If product has no stock, trigger out-of-stock popup modal and prevent sale
    if (product.stock <= 0) {
      setOutOfStockProduct(product);
      return;
    }

    if (product.unit === 'KG') {
      // Open weight selector modal
      setWeightModalProduct(product);
      setWeightModalMode('weight');
      setWeightInputValue('0.250'); // default 250g
      setMoneyInputValue('2.00'); // default $2
      setMoneyCurrency('USD');
      setWeightModalError(null);
    } else {
      // Unit product: check if adding 1 exceeds available stock
      const existingInCart = cart.find((item) => item.product.id === product.id);
      const currentQty = existingInCart ? existingInCart.quantity : 0;
      if (currentQty + 1 > product.stock) {
        setOutOfStockProduct(product);
        return;
      }
      addItemToCart(product, 1);
    }
  };

  const addItemToCart = (product: Product, quantity: number) => {
    if (quantity <= 0) return;
    if (product.stock <= 0) {
      setOutOfStockProduct(product);
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      const unitPrice = product.priceUSD;

      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + quantity;
        if (newQty > product.stock) {
          setScannerToast({
            message: `⚠️ Stock máximo alcanzado para ${product.name}: solo hay ${formatQuantity(product.stock, product.unit)} disponible.`,
            type: 'warning',
          });
          setTimeout(() => setScannerToast(null), 4000);
          return prev;
        }
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          totalUSD: Math.round(newQty * unitPrice * 100) / 100,
          totalVES: Math.round(newQty * unitPrice * settings.bcvRate * 100) / 100,
        };
        return updated;
      } else {
        if (quantity > product.stock) {
          setScannerToast({
            message: `⚠️ Stock máximo alcanzado para ${product.name}: solo hay ${formatQuantity(product.stock, product.unit)} disponible.`,
            type: 'warning',
          });
          setTimeout(() => setScannerToast(null), 4000);
          return prev;
        }
        const item: CartItem = {
          product,
          quantity,
          unitPriceUSD: unitPrice,
          totalUSD: Math.round(quantity * unitPrice * 100) / 100,
          totalVES: Math.round(quantity * unitPrice * settings.bcvRate * 100) / 100,
        };
        return [...prev, item];
      }
    });
  };

  const handleConfirmWeightModal = () => {
    if (!weightModalProduct) return;

    if (weightModalProduct.stock <= 0) {
      const prod = weightModalProduct;
      setWeightModalProduct(null);
      setOutOfStockProduct(prod);
      return;
    }

    let qty = 0;
    if (weightModalMode === 'money') {
      const moneyNum = parseFloat(moneyInputValue.replace(',', '.')) || 0;
      const moneyUSD =
        moneyCurrency === 'USD'
          ? moneyNum
          : settings.bcvRate > 0
          ? moneyNum / settings.bcvRate
          : 0;
      qty =
        weightModalProduct.priceUSD > 0
          ? Math.round((moneyUSD / weightModalProduct.priceUSD) * 1000) / 1000
          : 0;
    } else {
      qty = parseFloat(weightInputValue.replace(',', '.'));
    }

    if (!isNaN(qty) && qty > 0) {
      const existingInCart = cart.find((item) => item.product.id === weightModalProduct.id);
      const currentQty = existingInCart ? existingInCart.quantity : 0;
      if (currentQty + qty > weightModalProduct.stock) {
        setWeightModalError(
          `Solo hay ${formatQuantity(weightModalProduct.stock, 'KG')} disponible en inventario. No es posible despachar ${formatQuantity(qty, 'KG')}.`
        );
        return;
      }
      addItemToCart(weightModalProduct, qty);
      setWeightModalProduct(null);
      setWeightModalError(null);
    }
  };

  // Handle scanned barcode from phone camera
  const handleBarcodeScanned = (scannedCode: string): boolean => {
    const cleanCode = scannedCode.trim().toLowerCase();
    if (!cleanCode) return false;

    // Look up in products by barcode, code, or ID
    const matchedProduct = products.find((p) => {
      const codeMatch = p.code && p.code.toLowerCase() === cleanCode;
      const barcodeMatch = p.barcode && p.barcode.toLowerCase() === cleanCode;
      const idMatch = p.id.toLowerCase() === cleanCode;
      return codeMatch || barcodeMatch || idMatch;
    });

    if (matchedProduct) {
      if (matchedProduct.stock <= 0) {
        setIsCameraScannerOpen(false);
        setOutOfStockProduct(matchedProduct);
        return false;
      }

      if (matchedProduct.unit === 'UN') {
        const existingInCart = cart.find((item) => item.product.id === matchedProduct.id);
        const currentQty = existingInCart ? existingInCart.quantity : 0;
        if (currentQty + 1 > matchedProduct.stock) {
          setIsCameraScannerOpen(false);
          setOutOfStockProduct(matchedProduct);
          return false;
        }

        // Automatically add 1 unit to cart
        addItemToCart(matchedProduct, 1);
        setScannerToast({
          message: `✅ Agregado: ${matchedProduct.emoji} ${matchedProduct.name} (+1 UN)`,
          type: 'success',
        });
        setTimeout(() => setScannerToast(null), 3500);
        return true;
      } else {
        // Product is weighed (KG)
        // Close camera and open weight modal so cashier can punch or weigh
        setIsCameraScannerOpen(false);
        setWeightModalProduct(matchedProduct);
        setWeightInputValue('0.250');
        setWeightModalError(null);
        setScannerToast({
          message: `⚖️ ${matchedProduct.emoji} ${matchedProduct.name}: ingresa el peso a despachar.`,
          type: 'success',
        });
        setTimeout(() => setScannerToast(null), 3500);
        return true;
      }
    } else {
      // Product not found, set search query so cashier can see and act
      setSearchQuery(scannedCode.trim());
      setScannerToast({
        message: `⚠️ Código "${scannedCode}" no encontrado en inventario.`,
        type: 'warning',
      });
      setTimeout(() => setScannerToast(null), 4000);
      return false;
    }
  };

  const updateCartItemQty = (productId: string, delta: number) => {
    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) return;

    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const step = item.product.unit === 'KG' ? 0.100 : 1;
          const newQty = Math.round((item.quantity + delta * step) * 1000) / 1000;
          if (newQty <= 0.0001) return null;

          if (newQty > targetProduct.stock) {
            setScannerToast({
              message: `⚠️ Stock máximo alcanzado para ${targetProduct.name}: solo hay ${formatQuantity(targetProduct.stock, targetProduct.unit)} disponible.`,
              type: 'warning',
            });
            setTimeout(() => setScannerToast(null), 4000);
            return item;
          }

          return {
            ...item,
            quantity: newQty,
            totalUSD: Math.round(newQty * item.unitPriceUSD * 100) / 100,
            totalVES: Math.round(newQty * item.unitPriceUSD * settings.bcvRate * 100) / 100,
          };
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const removeCartItem = (productId: string) => {
    setCart((prev) => prev.filter((it) => it.product.id !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('¿Deseas vaciar el carrito actual?')) {
      setCart([]);
    }
  };

  // Preferential rate for cash USD
  const prefRate = settings.preferentialRate || settings.bcvRate;

  // Suggested Cash USD calculation (100% in USD, no bolivares)
  const suggestedCashUSD =
    prefRate > 0 ? Math.round(((totalUSD * settings.bcvRate) / prefRate) * 100) / 100 : totalUSD;
  const cashDiscountUSD = Math.max(0, Math.round((totalUSD - suggestedCashUSD) * 100) / 100);

  // Live calculations for mixed payment splits
  const parsedSplitCashUSD = Math.max(0, parseFloat(splitCashUSD.replace(',', '.')) || 0);
  const parsedSplitPagoMovilVES = Math.max(0, parseFloat(splitPagoMovilVES.replace(',', '.')) || 0);
  const parsedSplitPuntoVES = Math.max(0, parseFloat(splitPuntoVES.replace(',', '.')) || 0);
  const parsedSplitCashVES = Math.max(0, parseFloat(splitCashVES.replace(',', '.')) || 0);
  const parsedSplitFiadoUSD = Math.max(0, parseFloat(splitFiadoUSD.replace(',', '.')) || 0);

  const mixedPagoMovilUSD = settings.bcvRate > 0 ? parsedSplitPagoMovilVES / settings.bcvRate : 0;
  const mixedPuntoUSD = settings.bcvRate > 0 ? parsedSplitPuntoVES / settings.bcvRate : 0;
  const mixedCashVESUSD = settings.bcvRate > 0 ? parsedSplitCashVES / settings.bcvRate : 0;

  const totalCoveredUSD = Math.round(
    (parsedSplitCashUSD + mixedPagoMovilUSD + mixedPuntoUSD + mixedCashVESUSD + parsedSplitFiadoUSD) * 100
  ) / 100;
  const remainingUSD = Math.round((totalUSD - totalCoveredUSD) * 100) / 100;
  const remainingVES = Math.round(remainingUSD * settings.bcvRate * 100) / 100;

  // Process checkout
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setCheckoutError(null);
    setPaymentMode('single');
    setPaymentMethod('cash_usd');
    setApplySuggestedUSD(false);
    setSplitCashUSD('');
    setSplitPagoMovilVES('');
    setSplitPuntoVES('');
    setSplitCashVES('');
    setSplitFiadoUSD('');
    setSplitReference('');
    setIsCheckoutOpen(true);
  };

  const handleConfirmSale = () => {
    setCheckoutError(null);

    let finalPaymentMethod: PaymentMethod = paymentMethod;
    let finalStatus: 'paid' | 'pending' | 'partially_paid' = 'paid';
    let finalPendingUSD = 0;
    let finalPendingVES = 0;
    const splits: PaymentSplit[] = [];
    let effectiveRate = settings.bcvRate;

    if (paymentMode === 'mixed') {
      finalPaymentMethod = 'mixed';

      if (remainingUSD > 0.05) {
        setCheckoutError(`Aún faltan ${formatUSD(remainingUSD)} (~${formatVES(remainingVES)}) por cubrir. Asigna el resto a algún método o colócalo como fiado.`);
        return;
      }

      if (parsedSplitFiadoUSD > 0.01) {
        if (!customerName.trim()) {
          setCheckoutError('El Nombre del cliente es obligatorio cuando hay una porción fiada (a crédito).');
          return;
        }
        if (!customerPhone.trim()) {
          setCheckoutError('El Teléfono WhatsApp es obligatorio para la porción fiada.');
          return;
        }
        finalStatus = totalCoveredUSD - parsedSplitFiadoUSD > 0.01 ? 'partially_paid' : 'pending';
        finalPendingUSD = parsedSplitFiadoUSD;
        finalPendingVES = parsedSplitFiadoUSD * settings.bcvRate;
      } else {
        finalStatus = 'paid';
        finalPendingUSD = 0;
        finalPendingVES = 0;
      }

      // Build splits
      if (parsedSplitCashUSD > 0) {
        splits.push({
          id: `sp-${Date.now()}-1`,
          method: 'cash_usd',
          amountUSD: parsedSplitCashUSD,
          amountVES: Math.round(parsedSplitCashUSD * prefRate * 100) / 100,
          appliedRate: prefRate,
        });
      }
      if (parsedSplitPagoMovilVES > 0) {
        splits.push({
          id: `sp-${Date.now()}-2`,
          method: 'pago_movil',
          amountUSD: Math.round(mixedPagoMovilUSD * 100) / 100,
          amountVES: parsedSplitPagoMovilVES,
          appliedRate: settings.bcvRate,
          reference: splitReference.trim() || undefined,
        });
      }
      if (parsedSplitPuntoVES > 0) {
        splits.push({
          id: `sp-${Date.now()}-3`,
          method: 'punto',
          amountUSD: Math.round(mixedPuntoUSD * 100) / 100,
          amountVES: parsedSplitPuntoVES,
          appliedRate: settings.bcvRate,
        });
      }
      if (parsedSplitCashVES > 0) {
        splits.push({
          id: `sp-${Date.now()}-4`,
          method: 'cash_ves',
          amountUSD: Math.round(mixedCashVESUSD * 100) / 100,
          amountVES: parsedSplitCashVES,
          appliedRate: settings.bcvRate,
        });
      }
      if (parsedSplitFiadoUSD > 0) {
        splits.push({
          id: `sp-${Date.now()}-5`,
          method: 'fiado',
          amountUSD: parsedSplitFiadoUSD,
          amountVES: Math.round(parsedSplitFiadoUSD * settings.bcvRate * 100) / 100,
          appliedRate: settings.bcvRate,
        });
      }

      if (splits.length === 0) {
        setCheckoutError('Debes ingresar al menos un monto en alguno de los métodos de pago.');
        return;
      }
    } else {
      // Single payment mode
      finalPaymentMethod = paymentMethod;
      if (paymentMethod === 'fiado') {
        if (!customerName.trim()) {
          setCheckoutError('El Nombre del cliente es obligatorio para registrar una venta fiada.');
          return;
        }
        if (!customerPhone.trim()) {
          setCheckoutError('El Teléfono WhatsApp es obligatorio para enviar recordatorios de cobranza.');
          return;
        }
        finalStatus = 'pending';
        finalPendingUSD = totalUSD;
        finalPendingVES = totalVES;
      } else {
        finalStatus = 'paid';
        finalPendingUSD = 0;
        finalPendingVES = 0;
      }

      if (paymentMethod === 'cash_usd') {
        effectiveRate = prefRate;
      }
    }

    // Strict Stock Check: Do not permit selling products without stock
    const outOfStockItem = cart.find((it) => {
      const prod = products.find((p) => p.id === it.product.id) || it.product;
      return prod.stock <= 0 || it.quantity > prod.stock;
    });

    if (outOfStockItem) {
      const targetProd = products.find((p) => p.id === outOfStockItem.product.id) || outOfStockItem.product;
      setIsCheckoutOpen(false);
      setOutOfStockProduct(targetProd);
      return;
    }

    // Deduct stock from products
    const updatedProducts = products.map((prod) => {
      const cartItem = cart.find((it) => it.product.id === prod.id);
      if (cartItem) {
        return {
          ...prod,
          stock: Math.max(0, Math.round((prod.stock - cartItem.quantity) * 1000) / 1000),
        };
      }
      return prod;
    });

    const finalChargedUSD =
      paymentMethod === 'cash_usd' && paymentMode === 'single' && applySuggestedUSD
        ? suggestedCashUSD
        : totalUSD;
    const calculatedTotalVES = Math.round(finalChargedUSD * settings.bcvRate * 100) / 100;

    const newTicket: SaleTicket = {
      id: `TICK-${settings.ticketCounter}`,
      ticketNumber: settings.ticketCounter,
      date: new Date().toISOString(),
      customerName: customerName.trim() || 'Consumidor Final',
      customerCedula: customerCedula.trim() || 'V-00000000',
      customerPhone: customerPhone.trim(),
      items: [...cart],
      totalUSD: finalChargedUSD,
      totalVES: calculatedTotalVES,
      bcvRate: settings.bcvRate,
      preferentialRate: prefRate,
      effectiveRate,
      paymentMethod: finalPaymentMethod,
      paymentSplits: splits.length > 0 ? splits : undefined,
      status: finalStatus,
      pendingUSD: finalPendingUSD,
      pendingVES: finalPendingVES,
      abonos: [],
      notes: saleNotes.trim() || (finalStatus !== 'paid' ? 'Compra a crédito (Fiado)' : 'Venta de contado'),
    };

    onCompleteSale(newTicket, updatedProducts);

    // Show ticket confirmation modal
    setCompletedTicket(newTicket);
    setIsCheckoutOpen(false);

    // Clear cart & customer fields
    setCart([]);
    setCustomerName('');
    setCustomerCedula('');
    setCustomerPhone('');
    setSaleNotes('');
  };

  // Generate WhatsApp ticket text for sharing
  const getShareTicketWhatsAppUrl = (ticket: SaleTicket) => {
    const cleanPhone = sanitizePhoneForWhatsApp(ticket.customerPhone);
    const dateStr = new Date(ticket.date).toLocaleString('es-VE');
    const itemsList = ticket.items
      .map((it) => `• ${it.product.name} (${formatQuantity(it.quantity, it.product.unit)}) = ${formatUSD(it.totalUSD)}`)
      .join('\n');

    const isCredit = ticket.paymentMethod === 'fiado';
    const message = `🧾 *COMPROBANTE DE COMPRA* - *${settings.businessName}*
*Ticket #${ticket.ticketNumber}*
📅 Fecha: ${dateStr}
👤 Cliente: ${ticket.customerName} (${ticket.customerCedula})
━━━━━━━━━━━━━━━━━━━━
🛒 *DETALLE DE PRODUCTOS:*
${itemsList}
━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL:* ${formatUSD(ticket.totalUSD)}
🇻🇪 *TOTAL BS:* ${formatVES(ticket.totalVES)}
_(Tasa BCV: ${formatVES(ticket.bcvRate)})_
💳 *MODALIDAD:* ${isCredit ? '⚠️ A CRÉDITO (FIADO)' : '✅ CONTADO'}
${isCredit ? `\n*Saldo Pendiente:* ${formatUSD(ticket.pendingUSD)} (~${formatVES(ticket.pendingVES)})` : ''}

¡Gracias por su compra en Charcutería Jhojan! ✨`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div id="pos-module-container" className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* LEFT COLUMN: Catalog & Products (8 cols on lg) */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3">
        {/* Search & Category Filter Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-md space-y-3">
          {/* Scanner Toast notification */}
          {scannerToast && (
            <div
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 ${
                scannerToast.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-200'
                  : 'bg-amber-950/80 border-amber-800/80 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Barcode className="w-4 h-4 shrink-0" />
                <span className="truncate">{scannerToast.message}</span>
              </div>
              <button
                onClick={() => setScannerToast(null)}
                className="text-slate-400 hover:text-white text-[11px] shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="pos-product-search-input"
                type="text"
                placeholder="Buscar por nombre, código o EAN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length === 1) {
                    e.preventDefault();
                    handleSelectProduct(filteredProducts[0]);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-rose-500 focus:border-rose-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Camera Barcode Scanner Button */}
            <button
              type="button"
              id="btn-pos-camera-scanner"
              onClick={() => setIsCameraScannerOpen(true)}
              className="px-3 sm:px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-rose-950/40 transition shrink-0 cursor-pointer"
              title="Abrir cámara del teléfono para escanear código de barras o QR"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Escanear</span>
              <Barcode className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {(['Todos', 'Quesos', 'Embutidos', 'Lácteos', 'Varios'] as const).map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  id={`cat-btn-${cat.toLowerCase()}`}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/60'
                  }`}
                >
                  {cat === 'Todos' && '🏷️ '}
                  {cat === 'Quesos' && '🧀 '}
                  {cat === 'Embutidos' && '🥩 '}
                  {cat === 'Lácteos' && '🥛 '}
                  {cat === 'Varios' && '🥖 '}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
          {filteredProducts.map((product) => {
            const priceVES = product.priceUSD * settings.bcvRate;
            const isOutOfStock = product.stock <= 0;
            const isLowStock = !isOutOfStock && product.stock <= (product.minStockAlert || 3);
            const isKg = product.unit === 'KG';

            return (
              <button
                key={product.id}
                id={`product-card-${product.id}`}
                onClick={() => handleSelectProduct(product)}
                className={`group relative flex flex-col justify-between text-left p-3 rounded-2xl border transition-all duration-150 shadow-md active:scale-[0.98] cursor-pointer ${
                  isOutOfStock
                    ? 'bg-slate-900/95 border-rose-900/70 hover:border-rose-500 hover:bg-rose-950/20'
                    : 'bg-slate-900 hover:bg-slate-800/90 border-slate-800 hover:border-rose-500/50 hover:shadow-rose-950/20'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <span className="text-2xl filter drop-shadow-xs">{product.emoji}</span>
                    <div className="flex items-center gap-1">
                      {isOutOfStock && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
                          SIN STOCK
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md ${
                          isKg
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                        }`}
                      >
                        {product.unit}
                      </span>
                    </div>
                  </div>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-100 line-clamp-2 leading-snug group-hover:text-rose-300 transition">
                    {product.name}
                  </h4>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
                      {formatUSD(product.priceUSD)}
                      <span className="text-[10px] font-normal text-slate-400">/{product.unit}</span>
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    ~{formatVES(priceVES)}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px]">
                    <span
                      className={`font-mono ${
                        isOutOfStock
                          ? 'text-rose-400 font-bold'
                          : isLowStock
                          ? 'text-amber-400 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      Stock: {formatQuantity(product.stock, product.unit)}
                    </span>
                    <span
                      className={`font-bold transition ${
                        isOutOfStock
                          ? 'text-rose-400'
                          : 'text-rose-400 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isOutOfStock ? '⚠️ Agotado' : isKg ? '+ Pesar' : '+ Agregar'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm">No se encontraron productos con esos filtros.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Ticket / Shopping Cart & Customer Details (5 cols on lg) */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-full">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5">
                <span>Ticket Actual</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 font-mono text-slate-300">
                  #{settings.ticketCounter}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {cart.length} productos agregados
              </p>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 transition cursor-pointer"
                title="Vaciar carrito"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar</span>
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="my-3 flex-1 overflow-y-auto max-h-[300px] space-y-2 pr-1">
            {cart.map((item) => (
              <div
                key={item.product.id}
                id={`cart-item-${item.product.id}`}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{item.product.emoji}</span>
                    <h5 className="text-xs font-semibold text-slate-100 truncate">
                      {item.product.name}
                    </h5>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                    <span>
                      {formatQuantity(item.quantity, item.product.unit)} × {formatUSD(item.unitPriceUSD)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Quantity controls */}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => updateCartItemQty(item.product.id, -1)}
                      className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                      title="Disminuir"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-12 text-center text-xs font-bold font-mono text-slate-200">
                      {item.product.unit === 'KG'
                        ? item.quantity.toFixed(3)
                        : item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartItemQty(item.product.id, 1)}
                      className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                      title="Aumentar"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Price */}
                  <div className="text-right min-w-[70px]">
                    <div className="text-xs font-bold font-mono text-emerald-400">
                      {formatUSD(item.totalUSD)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {formatVES(item.totalVES)}
                    </div>
                  </div>

                  <button
                    onClick={() => removeCartItem(item.product.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                    title="Eliminar ítem"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <Scale className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">El ticket está vacío</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Selecciona productos del catálogo para comenzar la venta.
                </p>
              </div>
            )}
          </div>

          {/* Customer Form with Auto-complete */}
          <div className="pt-3 border-t border-slate-800 space-y-2 relative">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300">
              <span className="flex items-center gap-1 text-slate-300">
                <User className="w-3.5 h-3.5 text-rose-400" />
                <span>Datos del Cliente</span>
              </span>
              <span className="text-[10px] text-slate-500">
                (Obligatorio para Fiados)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="relative">
                <input
                  id="input-customer-name"
                  type="text"
                  placeholder="Nombre y Apellido"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setCustomerSuggestionsOpen(true);
                  }}
                  onFocus={() => setCustomerSuggestionsOpen(true)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-rose-500 focus:border-rose-500"
                />

                {/* Auto-complete suggestions */}
                {customerSuggestionsOpen && customerSuggestions.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
                    <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 bg-slate-800/80">
                      Clientes Registrados:
                    </div>
                    {customerSuggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCustomerName(sug.name);
                          setCustomerCedula(sug.cedula);
                          setCustomerPhone(sug.phone);
                          setCustomerSuggestionsOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 border-b border-slate-800/60 last:border-0 cursor-pointer"
                      >
                        <div className="font-semibold text-xs text-rose-300">{sug.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {sug.cedula} • {sug.phone}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                id="input-customer-cedula"
                type="text"
                placeholder="Cédula / RIF (ej. V-12345678)"
                value={customerCedula}
                onChange={(e) => setCustomerCedula(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400" />
              <input
                id="input-customer-phone"
                type="tel"
                placeholder="Teléfono WhatsApp (ej. 0414-1234567)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-rose-500 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Fidelis Express Widget: Dual-Metric Loyalty Embedded Panel */}
          <div className="pt-2">
            <FidelisExpressWidget
              customerCedula={customerCedula}
              customerPhone={customerPhone}
              customerName={customerName}
              currentCartTotalUSD={totalUSD}
              profiles={fidelisProfiles}
              onClaimReward={onClaimFidelisReward}
              onOpenDirectory={() => setIsFidelisDirectoryOpen(true)}
            />
          </div>

          {/* Totals Summary */}
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 bg-slate-950/50 p-3 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Tasa BCV Aplicada</span>
              <span className="font-mono font-bold text-slate-300">
                {formatVES(settings.bcvRate)}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-300">TOTAL USD ($)</span>
              <span id="pos-total-usd" className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                {formatUSD(totalUSD)}
              </span>
            </div>

            <div className="flex items-baseline justify-between border-t border-slate-800/80 pt-1">
              <span className="text-xs font-semibold text-slate-400">TOTAL BOLÍVARES (Bs.)</span>
              <span id="pos-total-ves" className="text-base sm:text-lg font-bold font-mono text-slate-200">
                {formatVES(totalVES)}
              </span>
            </div>
          </div>

          {/* Action Button: Cobrar */}
          <button
            id="btn-pos-checkout"
            onClick={handleOpenCheckout}
            disabled={cart.length === 0}
            className={`mt-3 w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              cart.length > 0
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50 active:scale-[0.99]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Cobrar Venta ({formatUSD(totalUSD)})</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: Weight & Monetary Amount Selector for KG products */}
      {weightModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{weightModalProduct.emoji}</span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base leading-tight">
                    {weightModalProduct.name}
                  </h3>
                  <p className="text-xs font-mono text-emerald-400">
                    {formatUSD(weightModalProduct.priceUSD)}/KG (~{formatVES(weightModalProduct.priceUSD * settings.bcvRate)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWeightModalProduct(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Available stock indicator & error banner */}
            <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Stock disponible en inventario:</span>
              <span className="font-mono text-emerald-400 font-bold">
                {formatQuantity(weightModalProduct.stock, 'KG')}
              </span>
            </div>

            {weightModalError && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{weightModalError}</span>
              </div>
            )}

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1.5 mt-3 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setWeightModalMode('weight')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  weightModalMode === 'weight'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Por Peso (Balanza)</span>
              </button>

              <button
                type="button"
                onClick={() => setWeightModalMode('money')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  weightModalMode === 'money'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Por Monto de Dinero ($ / Bs)</span>
              </button>
            </div>

            {/* MODE A: BY WEIGHT */}
            {weightModalMode === 'weight' && (
              <>
                {/* Quick Weight Fractions Chips */}
                <div className="mt-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Selección Rápida de Peso:
                    </label>
                    <button
                      type="button"
                      onClick={() => setWeightModalMode('money')}
                      className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                    >
                      ¿El cliente pidió $2 de queso? 👉
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '100g', val: '0.100' },
                      { label: '250g', val: '0.250' },
                      { label: '350g', val: '0.350' },
                      { label: '500g', val: '0.500' },
                      { label: '750g', val: '0.750' },
                      { label: '1.00 kg', val: '1.000' },
                      { label: '1.25 kg', val: '1.250' },
                      { label: '1.50 kg', val: '1.500' },
                    ].map((chip) => (
                      <button
                        key={chip.val}
                        type="button"
                        onClick={() => setWeightInputValue(chip.val)}
                        className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
                          weightInputValue === chip.val
                            ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual weight input */}
                <div className="mt-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-400">Peso Exacto en Balanza:</span>
                    <span className="text-xs text-rose-400 font-mono">KG</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-emerald-400" />
                    <input
                      type="number"
                      step="0.001"
                      min="0.010"
                      max="100.000"
                      autoFocus
                      value={weightInputValue}
                      onChange={(e) => setWeightInputValue(e.target.value)}
                      className="w-full bg-transparent text-xl sm:text-2xl font-bold font-mono text-white focus:outline-none"
                      placeholder="0.000"
                    />
                  </div>

                  {/* Subtotal preview */}
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Subtotal Calculado:</span>
                    <div className="text-right">
                      <span className="font-bold text-emerald-400">
                        {formatUSD((parseFloat(weightInputValue.replace(',', '.')) || 0) * weightModalProduct.priceUSD)}
                      </span>
                      <span className="text-slate-400 ml-2">
                        (~{formatVES((parseFloat(weightInputValue.replace(',', '.')) || 0) * weightModalProduct.priceUSD * settings.bcvRate)})
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* MODE B: BY MONETARY AMOUNT (E.g. $2 de queso -> 300 gramos) */}
            {weightModalMode === 'money' && (
              <div className="mt-3.5 space-y-3">
                {/* Currency selector & explanation */}
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Monto que solicitó el cliente:
                  </label>
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-950 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setMoneyCurrency('USD')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                        moneyCurrency === 'USD'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      $ Dólares
                    </button>
                    <button
                      type="button"
                      onClick={() => setMoneyCurrency('VES')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                        moneyCurrency === 'VES'
                          ? 'bg-cyan-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Bs. Bolívares
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-6 gap-1.5">
                  {moneyCurrency === 'USD'
                    ? ['1.00', '1.50', '2.00', '2.50', '3.00', '5.00'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setMoneyInputValue(val)}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold transition border cursor-pointer ${
                            moneyInputValue === val
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          ${val}
                        </button>
                      ))
                    : ['50', '100', '150', '200', '300', '500'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setMoneyInputValue(val)}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold transition border cursor-pointer ${
                            moneyInputValue === val
                              ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          {val} Bs
                        </button>
                      ))}
                </div>

                {/* Money Input Box */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">
                      Escribe el monto a cobrar ({moneyCurrency === 'USD' ? 'USD $' : 'Bolívares Bs'}):
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      {moneyCurrency === 'USD' ? '$' : 'Bs.'}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.10"
                      autoFocus
                      value={moneyInputValue}
                      onChange={(e) => setMoneyInputValue(e.target.value)}
                      className="w-full bg-transparent text-2xl font-bold font-mono text-white focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Conversion Calculation Result */}
                {(() => {
                  const moneyNum = parseFloat(moneyInputValue.replace(',', '.')) || 0;
                  const moneyUSD =
                    moneyCurrency === 'USD'
                      ? moneyNum
                      : settings.bcvRate > 0
                      ? moneyNum / settings.bcvRate
                      : 0;
                  const qtyKG =
                    weightModalProduct.priceUSD > 0 ? moneyUSD / weightModalProduct.priceUSD : 0;
                  const grams = Math.round(qtyKG * 1000);
                  const exactKG = (grams / 1000).toFixed(3);
                  const exactTotalUSD = (grams / 1000) * weightModalProduct.priceUSD;
                  const exactTotalVES = exactTotalUSD * settings.bcvRate;

                  return (
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/70 to-slate-950 border border-emerald-500/40 text-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                        <span>⚖️ EQUIVALENTE A PESAR EN BALANZA:</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {exactKG} KG
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold font-mono text-emerald-300 tracking-tight">
                          {grams}
                        </span>
                        <span className="text-base font-bold text-slate-300">gramos</span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-tight">
                        Coloca <strong className="text-emerald-300 font-bold">{grams} gramos</strong> de {weightModalProduct.name} en la balanza para despachar exactamente{' '}
                        <strong className="text-white">
                          {moneyCurrency === 'USD' ? `$${moneyNum.toFixed(2)} USD` : `${moneyNum.toFixed(2)} Bs.`}
                        </strong>.
                      </p>

                      <div className="pt-2 border-t border-emerald-900/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">Total en el Ticket:</span>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400">{formatUSD(exactTotalUSD)}</span>
                          <span className="text-slate-400 ml-2">(~{formatVES(exactTotalVES)})</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setWeightModalProduct(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmWeightModal}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-950/40 cursor-pointer"
              >
                Agregar al Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Checkout & Payment Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base sm:text-lg">Finalizar Cobro</h3>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner */}
            {checkoutError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Order Total Overview */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Total a Pagar:</span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                  {formatUSD(totalUSD)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">En Bolívares (Tasa BCV):</span>
                <span className="text-base sm:text-lg font-bold font-mono text-slate-200">
                  {formatVES(totalVES)}
                </span>
                <span className="text-[10px] text-slate-500 block font-mono">
                  1$ = Bs. {settings.bcvRate.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Mode Selector: Single vs Mixed */}
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Tipo de Cobro:
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentMode('single')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMode === 'single'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Pago Único</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('mixed')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMode === 'mixed'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Cobro Mixto (Varios Métodos)</span>
                </button>
              </div>
            </div>

            {/* MODE 1: SINGLE PAYMENT */}
            {paymentMode === 'single' && (
              <div className="mt-4 space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">
                  Selecciona la Modalidad de Pago:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'cash_usd', label: 'Efectivo $ USD', icon: '💵', desc: 'Sugerencia en USD', highlightPref: true },
                    { id: 'cash_ves', label: 'Efectivo Bs.', icon: '🇻🇪', desc: 'Bolívares billete' },
                    { id: 'punto', label: 'Punto de Venta', icon: '💳', desc: 'Tarjeta débito' },
                    { id: 'pago_movil', label: 'Pago Móvil', icon: '📱', desc: settings.pagoMovil.bankName.split(' ')[0] },
                    { id: 'fiado', label: 'Cobro Fiado', icon: '⚠️', desc: 'A crédito (Deuda)', highlight: true },
                  ].map((pm) => {
                    const isSelected = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(pm.id as PaymentMethod);
                          setCheckoutError(null);
                        }}
                        className={`p-3 rounded-2xl text-left border transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? pm.highlight
                              ? 'bg-rose-950/80 border-rose-500 shadow-md ring-1 ring-rose-500'
                              : 'bg-emerald-950/80 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                            : 'bg-slate-800/80 border-slate-700/70 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg">{pm.icon}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="font-semibold text-xs text-slate-100">{pm.label}</div>
                        <div className={`text-[10px] ${pm.highlightPref ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
                          {pm.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Preferential Rate Info Banner for Cash USD (Strictly USD - Nada de Bolívares) */}
                {paymentMethod === 'cash_usd' && (
                  <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-xs space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Sugerencia de Precio en USD (Efectivo):</span>
                      </span>
                      <span className="font-mono font-black text-amber-300 text-base">
                        ${suggestedCashUSD.toFixed(2)} USD
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950/70 border border-amber-900/40 space-y-1 font-mono text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Total Base en Carrito:</span>
                        <span className="text-slate-200 font-bold">${totalUSD.toFixed(2)} USD</span>
                      </div>
                      {prefRate > settings.bcvRate && (
                        <div className="flex justify-between text-emerald-400 font-bold">
                          <span>Ajuste por billete en mano:</span>
                          <span>-${cashDiscountUSD.toFixed(2)} USD</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setApplySuggestedUSD(!applySuggestedUSD)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        applySuggestedUSD
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/50'
                          : 'bg-amber-950/80 border border-amber-500/60 text-amber-300 hover:bg-amber-900/60'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {applySuggestedUSD
                          ? `Cobrando Precio Sugerido: $${suggestedCashUSD.toFixed(2)} USD`
                          : `Aplicar Precio Sugerido: $${suggestedCashUSD.toFixed(2)} USD`}
                      </span>
                    </button>

                    <p className="text-[10px] text-slate-400 italic text-center">
                      * Cálculo 100% en dólares USD (sin bolívares). La tasa preferencial no se imprimirá en la factura.
                    </p>
                  </div>
                )}

                {/* Special info for Pago Movil */}
                {paymentMethod === 'pago_movil' && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <span className="font-semibold text-slate-300 block">Datos del Pago Móvil del Negocio:</span>
                    <p className="text-slate-400 font-mono">
                      Banco: <strong className="text-slate-200">{settings.pagoMovil.bankName} ({settings.pagoMovil.bankCode})</strong>
                    </p>
                    <p className="text-slate-400 font-mono">
                      Teléfono: <strong className="text-slate-200">{settings.pagoMovil.phone}</strong> | Cédula: <strong className="text-slate-200">{settings.pagoMovil.cedula}</strong>
                    </p>
                    <p className="text-slate-400 font-mono">
                      Monto a recibir: <strong className="text-emerald-400">{formatVES(totalVES)}</strong>
                    </p>
                  </div>
                )}

                {/* Special alert & mandatory fields for Fiado */}
                {paymentMethod === 'fiado' && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Atención: Venta Fiada (Cuentas por Cobrar)</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Esta compra quedará registrada en el <strong>Libro de Fiados</strong> a nombre de este cliente. Podrás enviarle recordatorios por WhatsApp con los datos de Pago Móvil.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Nombre del Deudor (*)</label>
                        <input
                          type="text"
                          placeholder="Nombre del cliente"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Teléfono WhatsApp (*)</label>
                        <input
                          type="tel"
                          placeholder="0414-0000000"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 2: MIXED PAYMENT (MÚLTIPLES MÉTODOS) */}
            {paymentMode === 'mixed' && (
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/50 text-xs">
                  <div className="font-semibold text-indigo-300 mb-1 flex items-center justify-between">
                    <span>Cobro Mixto / Fraccionado:</span>
                    <span className="font-mono text-slate-300">Total: {formatUSD(totalUSD)}</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Ingresa cuánto abona el cliente en cada método de pago. Puedes utilizar los botones "Completar" para asignar el resto con un solo toque.
                  </p>
                </div>

                {/* Split 1: Cash USD */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span>💵</span>
                      <span>Efectivo $ USD (Divisa en mano)</span>
                    </span>
                    {remainingUSD > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newUSD = Math.round((parsedSplitCashUSD + remainingUSD) * 100) / 100;
                          setSplitCashUSD(newUSD > 0 ? newUSD.toFixed(2) : '');
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition cursor-pointer"
                      >
                        Completar (${remainingUSD.toFixed(2)})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={splitCashUSD}
                        onChange={(e) => setSplitCashUSD(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    {parsedSplitCashUSD > 0 && (
                      <span className="text-[11px] font-mono text-amber-300 shrink-0">
                        (${parsedSplitCashUSD.toFixed(2)} USD)
                      </span>
                    )}
                  </div>
                </div>

                {/* Split 2: Pago Móvil (Bs.) */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span>📱</span>
                      <span>Pago Móvil (Bolívares)</span>
                    </span>
                    {remainingUSD > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const neededVES = Math.round(remainingUSD * settings.bcvRate * 100) / 100;
                          const newVES = Math.round((parsedSplitPagoMovilVES + neededVES) * 100) / 100;
                          setSplitPagoMovilVES(newVES > 0 ? newVES.toFixed(2) : '');
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition cursor-pointer"
                      >
                        Completar ({formatVES(remainingVES)})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">Bs.</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={splitPagoMovilVES}
                        onChange={(e) => setSplitPagoMovilVES(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    {parsedSplitPagoMovilVES > 0 && (
                      <span className="text-[11px] font-mono text-slate-300 shrink-0">
                        = {formatUSD(mixedPagoMovilUSD)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Split 3: Punto de Venta (Tarjeta Bs.) */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span>💳</span>
                      <span>Punto de Venta / Tarjeta (Bs.)</span>
                    </span>
                    {remainingUSD > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const neededVES = Math.round(remainingUSD * settings.bcvRate * 100) / 100;
                          const newVES = Math.round((parsedSplitPuntoVES + neededVES) * 100) / 100;
                          setSplitPuntoVES(newVES > 0 ? newVES.toFixed(2) : '');
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition cursor-pointer"
                      >
                        Completar ({formatVES(remainingVES)})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">Bs.</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={splitPuntoVES}
                        onChange={(e) => setSplitPuntoVES(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    {parsedSplitPuntoVES > 0 && (
                      <span className="text-[11px] font-mono text-slate-300 shrink-0">
                        = {formatUSD(mixedPuntoUSD)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Split 4: Cash VES (Bolívares Efectivo) */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span>🇻🇪</span>
                      <span>Efectivo en Bolívares (Bs.)</span>
                    </span>
                    {remainingUSD > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const neededVES = Math.round(remainingUSD * settings.bcvRate * 100) / 100;
                          const newVES = Math.round((parsedSplitCashVES + neededVES) * 100) / 100;
                          setSplitCashVES(newVES > 0 ? newVES.toFixed(2) : '');
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition cursor-pointer"
                      >
                        Completar ({formatVES(remainingVES)})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">Bs.</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={splitCashVES}
                        onChange={(e) => setSplitCashVES(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    {parsedSplitCashVES > 0 && (
                      <span className="text-[11px] font-mono text-slate-300 shrink-0">
                        = {formatUSD(mixedCashVESUSD)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Split 5: Fiado / Crédito restante */}
                <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/60 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Dejar Saldo Fiado / Deuda ($ USD)</span>
                    </span>
                    {remainingUSD > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newUSD = Math.round((parsedSplitFiadoUSD + remainingUSD) * 100) / 100;
                          setSplitFiadoUSD(newUSD > 0 ? newUSD.toFixed(2) : '');
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-900 text-amber-200 border border-amber-700 hover:bg-amber-800 transition cursor-pointer"
                      >
                        Asignar Restante a Fiado (${remainingUSD.toFixed(2)})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-mono text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={splitFiadoUSD}
                        onChange={(e) => setSplitFiadoUSD(e.target.value)}
                        className="w-full bg-slate-900 border border-amber-700/80 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    {parsedSplitFiadoUSD > 0 && (
                      <span className="text-[11px] font-mono text-amber-300 shrink-0">
                        = {formatVES(parsedSplitFiadoUSD * settings.bcvRate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reference for transfer / mobile payment */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Número de Referencia o Comprobante (Opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Ref #4829 Pago Móvil"
                    value={splitReference}
                    onChange={(e) => setSplitReference(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>

                {/* Mixed Payment Balancing Summary */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Total Ingresado:</span>
                    <span className="font-bold text-white">{formatUSD(totalCoveredUSD)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                    <span className="font-sans font-semibold">Estado del cobro:</span>
                    {Math.abs(remainingUSD) <= 0.01 ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ¡Cubierto al 100%!
                      </span>
                    ) : remainingUSD > 0.01 ? (
                      <span className="text-amber-400 font-bold">
                        Faltan: {formatUSD(remainingUSD)} (~{formatVES(remainingVES)})
                      </span>
                    ) : (
                      <span className="text-blue-400 font-bold">
                        Vuelto / Cambio: {formatUSD(Math.abs(remainingUSD))} (~{formatVES(Math.abs(remainingVES))})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Customer Information (Shared across modes) */}
            <div className="mt-4 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Datos del Cliente para la Factura y WhatsApp:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Nombre y Apellido</label>
                  <input
                    type="text"
                    placeholder="Ej. Carlos Mendoza"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Teléfono WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="0414-1234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Notes field */}
            <div className="mt-3">
              <label className="text-xs text-slate-400 block mb-1">Nota o Observación adicional:</label>
              <input
                type="text"
                placeholder="Ej. Empacar en bolsas separadas / Abona el resto el sábado"
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>

            {/* Actions */}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Volver al Carrito
              </button>
              <button
                type="button"
                id="btn-confirm-pos-sale"
                onClick={handleConfirmSale}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-950/40 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar y Generar Factura</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Thermal Receipt Modal (PNG Invoice Generation, Bluetooth Printing, WhatsApp Message) */}
      {completedTicket && (
        <ThermalReceiptModal
          ticket={completedTicket}
          settings={settings}
          onClose={() => setCompletedTicket(null)}
        />
      )}

      {/* MODAL 4: Phone Camera Barcode / QR Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Escáner de Productos (Cámara)"
        subtitle="Escanea el código de barras o QR para agregarlo a la venta"
        allowContinuous={true}
      />

      {/* MODAL 5: Fidelis Loyalty Customer Directory */}
      <FidelisDirectoryModal
        isOpen={isFidelisDirectoryOpen}
        onClose={() => setIsFidelisDirectoryOpen(false)}
        profiles={fidelisProfiles}
        onClaimReward={onClaimFidelisReward}
        onSelectCustomer={(cust) => {
          setCustomerName(cust.name);
          setCustomerCedula(cust.cedula);
          setCustomerPhone(cust.phone);
        }}
      />

      {/* MODAL 6: VENTANA EMERGENTE - PRODUCTO SIN STOCK */}
      {outOfStockProduct && (
        <div
          id="modal-out-of-stock-alert"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-rose-950/60 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Header with Alert Icon */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-950/90 border border-rose-700 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                    ¡Producto Sin Stock Disponible!
                  </h3>
                  <span className="text-xs text-rose-400 font-semibold">
                    Venta no permitida (Existencias agotadas)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOutOfStockProduct(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-3">
                <span className="text-3xl filter drop-shadow-xs">{outOfStockProduct.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-100 text-sm truncate">
                    {outOfStockProduct.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-medium">
                      {outOfStockProduct.category}
                    </span>
                    <span>•</span>
                    <span className="font-mono font-semibold text-slate-300">
                      Unidad: {outOfStockProduct.unit}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Stock actual en inventario:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 font-mono font-bold">
                    {formatQuantity(outOfStockProduct.stock, outOfStockProduct.unit)} (Agotado)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Precio de venta:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {formatUSD(outOfStockProduct.priceUSD)} / {outOfStockProduct.unit}
                    <span className="text-slate-500 font-normal ml-1">
                      (~{formatVES(outOfStockProduct.priceUSD * settings.bcvRate)})
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Instruction Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/70 text-xs text-amber-200 leading-relaxed flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-100 mb-0.5">
                  Acción requerida:
                </p>
                <p>
                  No hay stock de este producto en el sistema. Para poder agregarlo a la venta, debe dirigirse a revisar en el <strong>Inventario</strong> para registrar la reposición o actualizar las existencias disponibles.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                id="btn-go-to-inventory-from-modal"
                onClick={() => {
                  if (onNavigateToInventory) {
                    onNavigateToInventory(outOfStockProduct);
                  }
                  setOutOfStockProduct(null);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:from-rose-700 active:to-rose-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/60 transition cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Dirigirse a Revisar en Inventario</span>
              </button>

              <button
                type="button"
                onClick={() => setOutOfStockProduct(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Entendido / Cerrar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
