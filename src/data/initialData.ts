import { AppSettings, ExpenseRecord, MermaRecord, Product, RestockRecord, SaleTicket } from '../types';

export interface VenezuelanBank {
  code: string;
  name: string;
}

export const VENEZUELAN_BANKS: VenezuelanBank[] = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0105', name: 'Banco Mercantil' },
  { code: '0108', name: 'BBVA Banco Provincial' },
  { code: '0134', name: 'Banesco Banco Universal' },
  { code: '0172', name: 'Bancamiga Banco Universal' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0175', name: 'Banco Bicentenario' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
];

export const INITIAL_SETTINGS: AppSettings = {
  businessName: 'Charcutería Jhojan C.A.',
  rif: 'J-50284739-1',
  phone: '0414-7281945',
  address: 'Av. Bolívar, Local 4, Centro, Venezuela',
  bcvRate: 78.50,
  bcvLastUpdated: new Date().toISOString(),
  preferentialRate: 82.00,
  preferentialRateLastUpdated: new Date().toISOString(),
  pagoMovil: {
    bankCode: '0134',
    bankName: 'Banesco Banco Universal',
    phone: '04147281945',
    cedula: 'V-26894102',
  },
  ticketCounter: 1045,
  autoSyncCloud: true,
  lastCloudSync: new Date().toISOString(),
  telegramPhone: '0414-7281945',
  thankYouTone: 'calido',
  reminderTone: 'cordial',
  promotions: [
    {
      id: 'promo-1',
      title: 'Combo Arepero Familiar (Queso Llanero + Jamón Plumrose + Harina PAN)',
      category: 'combo',
      headline: '🔥 ¡DESAYUNA COMO REY! COMBO AREPERO FAMILIAR 🧀🥩',
      estimatedPriceUSD: 8.50,
      discountOrPrice: '$8.50 (~Bs. 667.25 BCV)',
      targetAudience: 'Familias y desayunos de fin de semana',
      validUntil: 'Hasta agotar existencia del lote',
      suggestedProducts: ['Queso Blanco Llanero Duro', 'Jamón Cocido Superior Plumrose', 'Harina PAN Maíz Blanco 1KG'],
      bodyWhatsApp: `🔥 *¡COMBO AREPERO FAMILIAR EN CHARCUTERÍA JHOJAN!* 🧀🥩🇻🇪

¿Listo para el desayuno más sabroso y rendidor de toda la semana? En *Charcutería Jhojan* te preparamos el combo perfecto para consentir a los tuyos:

📦 *EL COMBO INCLUYE:*
• 🧀 *1/2 KG Queso Blanco Llanero Duro* (punto exacto de sal, recién rallado)
• 🥩 *300g Jamón Cocido Superior Plumrose* (en lonjitas finas y tiernas)
• 🌽 *1 Paquete Harina PAN de 1KG*

━━━━━━━━━━━━━━━━━━━━
💰 *PRECIO ESPECIAL DEL COMBO:*
👉 *Solo $8.50 USD* (~667.25 Bs. Tasa BCV)
_(Ahorras más del 15% comprando el combo completo)_
━━━━━━━━━━━━━━━━━━━━

🛵 *Pide el tuyo antes de que se agote:*
📍 Visítanos: Av. Bolívar, Local 4, Centro
📲 Escríbenos directamente a este WhatsApp para apartar tu pedido.

¡Te esperamos con la frescura y la sonrisa de siempre! ✨❤️`,
      shortSocialCopy: `🧀🥩 ¡COMBO AREPERO EN PROMO! 1/2 kg Queso Llanero + 300g Jamón Plumrose + Harina PAN por solo $8.50 en Charcutería Jhojan. ¡Pide el tuyo hoy! 📲`,
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: 'promo-2',
      title: 'Oferta Relámpago: Queso Blanco Llanero Fresco',
      category: 'oferta_relampago',
      headline: '⚡ ¡OFERTA RELÁMPAGO! QUESO LLANERO FRESCO A PRECIO IMBATIBLE 🧀',
      estimatedPriceUSD: 4.90,
      discountOrPrice: '$4.90/KG (Antes $5.50)',
      targetAudience: 'Clientes frecuentes y amantes del buen queso',
      validUntil: 'Válido por 48 horas',
      suggestedProducts: ['Queso Blanco Llanero Duro'],
      bodyWhatsApp: `⚡ *¡OFERTA RELÁMPAGO: QUESO BLANCO LLANERO DE PRIMERA!* 🧀✨

Acaba de llegar queso llanero fresquito a *Charcutería Jhojan*, con el punto ideal de sal, consistencia perfecta para rallar y sabor insuperable.

━━━━━━━━━━━━━━━━━━━━
🔥 *PRECIO ESPECIAL POR ESTE FIN DE SEMANA:*
👉 *Solo $4.90 USD el Kilo* (Precio regular: $5.50)
🇻🇪 *Equivalente:* ~384.65 Bs. a Tasa Oficial BCV
━━━━━━━━━━━━━━━━━━━━

🚨 *Válido únicamente hasta agotar la pieza de 25 KG en mostrador.*
📍 *Charcutería Jhojan C.A.* • Av. Bolívar, Local 4, Centro.
¡Ven a probarlo o apártalo por aquí mismo antes de que se termine! 🛵✨`,
      shortSocialCopy: `⚡ ¡REBAJA RELÁMPAGO! Queso Llanero a $4.90/KG este fin de semana en Charcutería Jhojan. ¡Aprovecha antes de que se agote la pieza! 🧀`,
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: 'promo-3',
      title: 'Combo Picadera & Parrilla (Tocineta Ahumada + Salchichón + Queso Amarillo)',
      category: 'fin_de_semana',
      headline: '🥓🍻 ¿PLAN DE FIN DE SEMANA? ¡TENEMOS LA MEJOR PICADERA! 🧀',
      estimatedPriceUSD: 11.90,
      discountOrPrice: '$11.90 Combo Picada',
      targetAudience: 'Reuniones, parrilladas y picaderas entre amigos',
      validUntil: 'Fin de semana',
      suggestedProducts: ['Tocineta Ahumada Especial', 'Salchichón Criollo / Salchicha Frankfurt', 'Queso Amarillo Tipo Gouda Holandés'],
      bodyWhatsApp: `🥓🍻 *¿PLAN DE PARRILLA O COMPARTIR FAMILIAR?* 🧀🥩

Este fin de semana se celebra en casa con la mejor picadera charcutera de la ciudad:

🍢 *EL COMBO PICADERA INCLUYE:*
• 🥓 *250g Tocineta Ahumada Especial* (para dorar crocante)
• 🌭 *300g Salchichón Criollo / Salchicha Frankfurt*
• 🧀 *250g Queso Amarillo Tipo Gouda* (en cubos perfectos)

━━━━━━━━━━━━━━━━━━━━
💰 *PRECIO ESPECIAL PARRILLERO:*
👉 *Solo $11.90 USD* (~934.15 Bs. BCV)
━━━━━━━━━━━━━━━━━━━━

📍 Búscalo en *Charcutería Jhojan* (Av. Bolívar, Centro) o pide por WhatsApp para tenerlo listo al llegar. ¡Calidad garantizada en cada bocado! ✨🍺`,
      shortSocialCopy: `🥓🍻 ¡Picadera lista para el finde! Tocineta + Salchichón + Queso Amarillo por $11.90 en Charcutería Jhojan. ¡Haz tu pedido ya! 🧀`,
      createdAt: new Date().toISOString(),
      isActive: true,
    },
    {
      id: 'promo-4',
      title: 'Incentivo Pago en Dólares Efectivo a Tasa Preferencial',
      category: 'tasa_especial',
      headline: '💵 ¡TUS DÓLARES EN EFECTIVO RINDEN MÁS EN CHARCUTERÍA JHOJAN! 🌟',
      discountOrPrice: 'Tasa Preferencial Bs. 82.00',
      targetAudience: 'Clientes con divisas en efectivo',
      bodyWhatsApp: `💵 *¡TUS DÓLARES EN EFECTIVO VALEN MÁS CON NOSOTROS!* 🌟🥩🧀

En *Charcutería Jhojan C.A.* premiamos tu pago al contado con nuestra **Tasa Especial Preferencial**:

━━━━━━━━━━━━━━━━━━━━
💵 *TASA PREFERENCIAL EN EFECTIVO:*
👉 *Bs. 82.00 por cada $ USD* (BCV Oficial: Bs. 78.50)
━━━━━━━━━━━━━━━━━━━━
✨ Más mercancía, más queso y más embutidos por tus mismos billetes.

📍 Te esperamos hoy en Av. Bolívar, Local 4, Centro. ¡Ven y comprueba el verdadero rendimiento de tu dinero! 🛍️🧀`,
      shortSocialCopy: `💵 ¡Tus dólares en efectivo valen más! Paga a tasa preferencial en Charcutería Jhojan y lleva más por menos. ¡Te esperamos! 🧀✨`,
      createdAt: new Date().toISOString(),
      isActive: true,
    },
  ],
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Queso Blanco Llanero Duro',
    category: 'Quesos',
    unit: 'KG',
    costUSD: 4.00,
    marginPercent: 37.5,
    priceUSD: 5.50,
    stock: 24.85,
    emoji: '🧀',
    code: 'Q-001',
    minStockAlert: 5.0,
  },
  {
    id: 'prod-2',
    name: 'Queso Amarillo Gouda Torondoy',
    category: 'Quesos',
    unit: 'KG',
    costUSD: 7.00,
    marginPercent: 40.0,
    priceUSD: 9.80,
    stock: 12.30,
    emoji: '🧀',
    code: 'Q-002',
    minStockAlert: 3.0,
  },
  {
    id: 'prod-3',
    name: 'Queso Mozzarella de Búfala',
    category: 'Quesos',
    unit: 'KG',
    costUSD: 5.20,
    marginPercent: 38.5,
    priceUSD: 7.20,
    stock: 18.50,
    emoji: '🧀',
    code: 'Q-003',
    minStockAlert: 4.0,
  },
  {
    id: 'prod-4',
    name: 'Queso Paisa Pasteurizado',
    category: 'Quesos',
    unit: 'KG',
    costUSD: 6.20,
    marginPercent: 37.1,
    priceUSD: 8.50,
    stock: 15.00,
    emoji: '🧀',
    code: 'Q-004',
    minStockAlert: 4.0,
  },
  {
    id: 'prod-5',
    name: 'Jamón de Pierna Plumrose',
    category: 'Embutidos',
    unit: 'KG',
    costUSD: 8.50,
    marginPercent: 35.3,
    priceUSD: 11.50,
    stock: 16.45,
    emoji: '🥩',
    code: 'E-001',
    minStockAlert: 4.0,
  },
  {
    id: 'prod-6',
    name: 'Jamón de Espalda Cocido Fiambre',
    category: 'Embutidos',
    unit: 'KG',
    costUSD: 5.00,
    marginPercent: 38.0,
    priceUSD: 6.90,
    stock: 22.10,
    emoji: '🥩',
    code: 'E-002',
    minStockAlert: 5.0,
  },
  {
    id: 'prod-7',
    name: 'Tocineta Ahumada Especial',
    category: 'Embutidos',
    unit: 'KG',
    costUSD: 8.80,
    marginPercent: 36.4,
    priceUSD: 12.00,
    stock: 9.75,
    emoji: '🥓',
    code: 'E-003',
    minStockAlert: 2.5,
  },
  {
    id: 'prod-8',
    name: 'Salchichón Criollo / Salchicha Frankfurt',
    category: 'Embutidos',
    unit: 'KG',
    costUSD: 6.00,
    marginPercent: 36.7,
    priceUSD: 8.20,
    stock: 14.20,
    emoji: '🌭',
    code: 'E-004',
    minStockAlert: 3.0,
  },
  {
    id: 'prod-9',
    name: 'Mortadela Tapara Especial 1KG',
    category: 'Embutidos',
    unit: 'UN',
    costUSD: 2.80,
    marginPercent: 35.7,
    priceUSD: 3.80,
    stock: 35,
    emoji: '🍖',
    code: 'E-005',
    barcode: '7591001000501',
    minStockAlert: 8,
  },
  {
    id: 'prod-10',
    name: 'Salchichas Tipo Viena Plumrose (Paquete 12)',
    category: 'Embutidos',
    unit: 'UN',
    costUSD: 2.00,
    marginPercent: 37.5,
    priceUSD: 2.75,
    stock: 40,
    emoji: '🌭',
    code: 'E-006',
    barcode: '7591001000600',
    minStockAlert: 10,
  },
  {
    id: 'prod-11',
    name: 'Mantequilla Maracay con Sal 250g',
    category: 'Lácteos',
    unit: 'UN',
    costUSD: 1.65,
    marginPercent: 33.3,
    priceUSD: 2.20,
    stock: 28,
    emoji: '🧈',
    code: 'L-001',
    barcode: '7591001001102',
    minStockAlert: 6,
  },
  {
    id: 'prod-12',
    name: 'Suero Criollo Cremoso 1L',
    category: 'Lácteos',
    unit: 'UN',
    costUSD: 1.30,
    marginPercent: 38.5,
    priceUSD: 1.80,
    stock: 18,
    emoji: '🥛',
    code: 'L-002',
    barcode: '7591001001201',
    minStockAlert: 5,
  },
  {
    id: 'prod-13',
    name: 'Nata Criolla Casera 500g',
    category: 'Lácteos',
    unit: 'UN',
    costUSD: 1.80,
    marginPercent: 38.9,
    priceUSD: 2.50,
    stock: 14,
    emoji: '🥛',
    code: 'L-003',
    barcode: '7591001001300',
    minStockAlert: 4,
  },
  {
    id: 'prod-14',
    name: 'Harina PAN Maíz Blanco 1KG',
    category: 'Varios',
    unit: 'UN',
    costUSD: 1.10,
    marginPercent: 27.3,
    priceUSD: 1.40,
    stock: 60,
    emoji: '🌽',
    code: 'V-001',
    barcode: '7591001001409',
    minStockAlert: 15,
  },
  {
    id: 'prod-15',
    name: 'Refresco 1.5 Litros Surtido',
    category: 'Varios',
    unit: 'UN',
    costUSD: 1.50,
    marginPercent: 33.3,
    priceUSD: 2.00,
    stock: 25,
    emoji: '🥤',
    code: 'V-002',
    barcode: '7591001001508',
    minStockAlert: 6,
  },
  {
    id: 'prod-16',
    name: 'Pan de Sandwich Bimbo Familiar',
    category: 'Varios',
    unit: 'UN',
    costUSD: 2.20,
    marginPercent: 31.8,
    priceUSD: 2.90,
    stock: 19,
    emoji: '🍞',
    code: 'V-003',
    barcode: '7591001001607',
    minStockAlert: 5,
  },
];

export const INITIAL_TICKETS: SaleTicket[] = [
  {
    id: 'TICK-1038',
    ticketNumber: 1038,
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    customerName: 'Carlos Mendoza',
    customerCedula: 'V-19482103',
    customerPhone: '04245551234',
    items: [
      {
        product: INITIAL_PRODUCTS[0], // Queso Blanco Llanero
        quantity: 0.750,
        unitPriceUSD: 5.50,
        totalUSD: 4.13,
        totalVES: 4.13 * 78.50,
      },
      {
        product: INITIAL_PRODUCTS[4], // Jamón Pierna Plumrose
        quantity: 0.400,
        unitPriceUSD: 11.50,
        totalUSD: 4.60,
        totalVES: 4.60 * 78.50,
      },
    ],
    totalUSD: 8.73,
    totalVES: 8.73 * 78.50,
    bcvRate: 78.50,
    paymentMethod: 'fiado',
    status: 'pending',
    pendingUSD: 8.73,
    pendingVES: 8.73 * 78.50,
    abonos: [],
    notes: 'Compra de charcutería semanal',
  },
  {
    id: 'TICK-1041',
    ticketNumber: 1041,
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    customerName: 'Carlos Mendoza',
    customerCedula: 'V-19482103',
    customerPhone: '04245551234',
    items: [
      {
        product: INITIAL_PRODUCTS[10], // Mantequilla Maracay
        quantity: 1,
        unitPriceUSD: 2.20,
        totalUSD: 2.20,
        totalVES: 2.20 * 78.50,
      },
      {
        product: INITIAL_PRODUCTS[13], // Harina PAN
        quantity: 2,
        unitPriceUSD: 1.40,
        totalUSD: 2.80,
        totalVES: 2.80 * 78.50,
      },
    ],
    totalUSD: 5.00,
    totalVES: 5.00 * 78.50,
    bcvRate: 78.50,
    paymentMethod: 'fiado',
    status: 'pending',
    pendingUSD: 5.00,
    pendingVES: 5.00 * 78.50,
    abonos: [],
    notes: 'Anotado para cobrar el viernes',
  },
  {
    id: 'TICK-1042',
    ticketNumber: 1042,
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    customerName: 'Elena Rodríguez',
    customerCedula: 'V-15829104',
    customerPhone: '04129876543',
    items: [
      {
        product: INITIAL_PRODUCTS[1], // Queso Amarillo
        quantity: 0.500,
        unitPriceUSD: 9.80,
        totalUSD: 4.90,
        totalVES: 4.90 * 78.50,
      },
      {
        product: INITIAL_PRODUCTS[6], // Tocineta Ahumada
        quantity: 0.350,
        unitPriceUSD: 12.00,
        totalUSD: 4.20,
        totalVES: 4.20 * 78.50,
      },
      {
        product: INITIAL_PRODUCTS[14], // Pan Sandwich
        quantity: 1,
        unitPriceUSD: 2.90,
        totalUSD: 2.90,
        totalVES: 2.90 * 78.50,
      },
    ],
    totalUSD: 12.00,
    totalVES: 12.00 * 78.50,
    bcvRate: 78.50,
    paymentMethod: 'fiado',
    status: 'partially_paid',
    pendingUSD: 7.00, // Abonó 5 USD
    pendingVES: 7.00 * 78.50,
    abonos: [
      {
        id: 'abono-1',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        amountUSD: 5.00,
        amountVES: 5.00 * 78.50,
        bcvRate: 78.50,
        method: 'pago_movil',
        reference: 'PM-849103',
        notes: 'Abono parcial por Pago Móvil',
      },
    ],
    notes: 'Vecina del edificio Los Samanes',
  },
  {
    id: 'TICK-1044',
    ticketNumber: 1044,
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    customerName: 'Manuel Silva',
    customerCedula: 'V-22104592',
    customerPhone: '04163456789',
    items: [
      {
        product: INITIAL_PRODUCTS[2], // Mozzarella
        quantity: 0.850,
        unitPriceUSD: 7.20,
        totalUSD: 6.12,
        totalVES: 6.12 * 78.50,
      },
      {
        product: INITIAL_PRODUCTS[5], // Jamon Fiambre
        quantity: 0.600,
        unitPriceUSD: 6.90,
        totalUSD: 4.14,
        totalVES: 4.14 * 78.50,
      },
    ],
    totalUSD: 10.26,
    totalVES: 10.26 * 78.50,
    bcvRate: 78.50,
    paymentMethod: 'fiado',
    status: 'pending',
    pendingUSD: 10.26,
    pendingVES: 10.26 * 78.50,
    abonos: [],
    notes: 'Taller mecánico de enfrente',
  },
];

export const INITIAL_EXPENSES: ExpenseRecord[] = [
  {
    id: 'EXP-101',
    expenseNumber: 101,
    date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    description: 'Compra de bolsas plásticas transparentes (bulto 1.000 un)',
    category: 'Bolsas y Empaques',
    amountUSD: 14.00,
    amountVES: 14.00 * 78.50,
    currency: 'USD',
    appliedRate: 78.50,
    paymentMethod: 'cash_usd',
    recipient: 'Inversiones Plásticos Caracas',
    reference: 'FAC-8921',
    notes: 'Bolsas para despacho de charcutería y fiambres',
  },
  {
    id: 'EXP-102',
    expenseNumber: 102,
    date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    description: 'Pago de 3 bolsas de hielo en cubos para cava',
    category: 'Mantenimiento',
    amountUSD: 4.50,
    amountVES: 4.50 * 78.50,
    currency: 'VES',
    appliedRate: 78.50,
    paymentMethod: 'pago_movil',
    recipient: 'Hielo El Polo C.A.',
    reference: 'PM-772910',
    notes: 'Refrigeración para mantenimiento de vitrina',
  },
  {
    id: 'EXP-103',
    expenseNumber: 103,
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Abono a proveedor Distribuidora Lácteos Los Llanos',
    category: 'Mercancía/Proveedores',
    amountUSD: 45.00,
    amountVES: 45.00 * 78.50,
    currency: 'USD',
    appliedRate: 78.50,
    paymentMethod: 'cash_usd',
    recipient: 'Distribuidora Lácteos Los Llanos C.A.',
    reference: 'REC-0419',
    notes: 'Despacho de quesos llaneros y mozarella',
  },
];

export const INITIAL_RESTOCKS: RestockRecord[] = [
  {
    id: 'RESTOCK-501',
    restockNumber: 501,
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    productId: 'prod-1', // Queso Blanco Llanero Duro
    productName: 'Queso Blanco Llanero Duro',
    unit: 'KG',
    category: 'Quesos',
    quantityAdded: 20.0,
    previousStock: 4.85,
    newStock: 24.85,
    unitCostUSD: 3.80,
    totalCostUSD: 76.00,
    totalCostVES: 76.00 * 78.50,
    bcvRate: 78.50,
    supplierName: 'Distribuidora Lácteos Los Llanos C.A.',
    supplierPhone: '0414-9988771',
    supplierInvoiceNumber: 'FAC-LL-4482',
    paymentCondition: 'credito',
    isPaid: false,
    dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 4 days from now
    abonos: [
      {
        id: 'ABONO-PROV-1',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        amountUSD: 45.00,
        amountVES: 45.00 * 78.50,
        bcvRate: 78.50,
        paymentMethod: 'cash_usd',
        reference: 'REC-0419',
        notes: 'Abono realizado al chofer antes de la fecha límite',
      },
    ],
    paidUSD: 45.00,
    pendingUSD: 31.00,
    pendingVES: 31.00 * 78.50,
    notes: 'Queso duro de excelente punto de sal. Saldo restante a liquidar el viernes.',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'RESTOCK-502',
    restockNumber: 502,
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    productId: 'prod-5', // Jamón Cocido Superior Plumrose
    productName: 'Jamón Cocido Superior Plumrose',
    unit: 'KG',
    category: 'Embutidos',
    quantityAdded: 10.0,
    previousStock: 6.8,
    newStock: 16.8,
    unitCostUSD: 6.20,
    totalCostUSD: 62.00,
    totalCostVES: 62.00 * 78.50,
    bcvRate: 78.50,
    supplierName: 'Embutidos Plumrose Distribución',
    supplierPhone: '0424-5544332',
    supplierInvoiceNumber: 'FAC-PLUM-892',
    paymentCondition: 'contado',
    isPaid: true,
    abonos: [
      {
        id: 'ABONO-PROV-2',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        amountUSD: 62.00,
        amountVES: 62.00 * 78.50,
        bcvRate: 78.50,
        paymentMethod: 'cash_usd',
        reference: 'EFE-CONTADO',
        notes: 'Pagado completo al recibir el pedido',
      },
    ],
    paidUSD: 62.00,
    pendingUSD: 0,
    pendingVES: 0,
    notes: 'Piezas selladas al vacío listas para rebanar',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const INITIAL_MERMAS: MermaRecord[] = [
  {
    id: 'MERMA-101',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    productId: 'prod-1',
    productName: 'Queso Blanco Llanero Duro',
    category: 'Quesos',
    unit: 'KG',
    quantity: 0.350,
    unitCostUSD: 4.00,
    totalCostUSD: 1.40,
    totalCostVES: 1.40 * 78.50,
    bcvRate: 78.50,
    reason: 'Secado / Pérdida de humedad',
    notes: 'Merma natural por deshidratación en exhibidor refrigerado durante 3 días.',
    performedBy: 'Encargado de Charcutería',
  },
  {
    id: 'MERMA-102',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    productId: 'prod-5',
    productName: 'Jamón Cocido Superior Plumrose',
    category: 'Embutidos',
    unit: 'KG',
    quantity: 0.180,
    unitCostUSD: 6.20,
    totalCostUSD: 1.12,
    totalCostVES: 1.12 * 78.50,
    bcvRate: 78.50,
    reason: 'Recortes / Extremos de pieza',
    notes: 'Tapas y extremos no rebanables retirados para mantener calidad de lonjas.',
    performedBy: 'Cajero / Mostrador',
  },
];

