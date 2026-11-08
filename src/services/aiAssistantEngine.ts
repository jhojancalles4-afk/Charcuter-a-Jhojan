import {
  AppSettings,
  DebtorCustomer,
  ExpenseRecord,
  MarketingPromotion,
  MermaRecord,
  Product,
  RestockRecord,
  SaleTicket,
  AIRestockPrediction,
  AIPatternsReport,
} from '../types';
import {
  formatUSD,
  formatVES,
  formatQuantity,
  generateWhatsAppReminder,
  THANK_YOU_TONE_PRESETS,
  REMINDER_TONE_PRESETS,
  DEFAULT_THANK_YOU_TEMPLATE,
  DEFAULT_REMINDER_TEMPLATE,
} from './storage';
import {
  calculateAIRestockPredictions,
  generateAIPatternsReport,
} from './restockAI';

export type AIActionType =
  | 'set_bcv_rate'
  | 'set_pref_rate'
  | 'create_product'
  | 'update_product_price'
  | 'update_product_stock'
  | 'toggle_product_status'
  | 'add_expense'
  | 'delete_expense'
  | 'register_abono_fiado'
  | 'register_restock_order'
  | 'register_supplier_abono'
  | 'register_merma'
  | 'create_fidelis_customer'
  | 'claim_fidelis_reward'
  | 'void_ticket'
  | 'navigate_tab'
  | 'update_reminder_template'
  | 'update_thank_you_template'
  | 'save_promotion'
  | 'share_promotion'
  | 'open_reminder'
  | 'update_business_info'
  | 'execute_cierre_z'
  | 'toggle_autonomous_mode'
  | 'open_backup';

export interface AIActionProposal {
  id: string;
  type: AIActionType;
  title: string;
  description: string;
  payload: any;
  status: 'pending' | 'executed' | 'cancelled';
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  category?: 'demand' | 'report' | 'action' | 'general' | 'debtors' | 'inventory' | 'marketing' | 'template';
  structuredData?: {
    type: 'table' | 'cards' | 'report' | 'action_proposal' | 'promotion_card';
    title?: string;
    items?: any[];
    summary?: Record<string, string | number>;
    promotion?: MarketingPromotion;
  };
  actionProposal?: AIActionProposal;
}

export interface AIExecutiveReport {
  title: string;
  generatedAt: string;
  periodLabel: string;
  metrics: {
    label: string;
    valueUSD: string;
    valueVES?: string;
    changeText?: string;
    isPositive?: boolean;
  }[];
  sections: {
    title: string;
    content: string[];
    bulletPoints?: string[];
  }[];
  recommendations: string[];
  plainTextWhatsApp: string;
}

/**
 * Genera el Reporte Financiero de Ganancias y Pérdidas (P&L) del negocio
 */
export function generateFinancialPLReport(
  tickets: SaleTicket[],
  expenses: ExpenseRecord[],
  products: Product[],
  settings: AppSettings,
  days: number = 30
): AIExecutiveReport {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const filteredTickets = tickets.filter(
    (t) => !t.isVoided && new Date(t.date) >= startDate
  );
  const filteredExpenses = expenses.filter(
    (e) => new Date(e.date) >= startDate
  );

  let grossRevenueUSD = 0;
  let totalCostOfGoodsUSD = 0;
  let totalPaidSalesUSD = 0;
  let totalFiadoSalesUSD = 0;

  filteredTickets.forEach((t) => {
    grossRevenueUSD += t.totalUSD;
    if (t.status === 'paid') {
      totalPaidSalesUSD += t.totalUSD;
    } else {
      totalPaidSalesUSD += t.totalUSD - (t.pendingUSD || 0);
      totalFiadoSalesUSD += t.pendingUSD || 0;
    }

    t.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.product.id) || item.product;
      const unitCost = prod.costUSD && prod.costUSD > 0 ? prod.costUSD : item.unitPriceUSD * 0.72;
      totalCostOfGoodsUSD += item.quantity * unitCost;
    });
  });

  let totalExpensesUSD = 0;
  filteredExpenses.forEach((e) => {
    totalExpensesUSD += e.amountUSD;
  });

  const grossProfitUSD = Math.max(0, grossRevenueUSD - totalCostOfGoodsUSD);
  const netProfitUSD = grossProfitUSD - totalExpensesUSD;
  const grossMarginPercent = grossRevenueUSD > 0 ? Math.round((grossProfitUSD / grossRevenueUSD) * 100) : 0;
  const netMarginPercent = grossRevenueUSD > 0 ? Math.round((netProfitUSD / grossRevenueUSD) * 100) : 0;

  const bcv = settings.bcvRate || 1;
  const periodLabel = days === 1 ? 'Hoy' : days === 7 ? 'Últimos 7 días' : `Últimos ${days} días`;

  const whatsAppText = `📊 *REPORTE FINANCIERO Y RESULTADOS (P&L)*
🏪 *${settings.businessName}* • Período: ${periodLabel}
━━━━━━━━━━━━━━━━━━━━
💰 *Ventas Brutas:* ${formatUSD(grossRevenueUSD)} (~${formatVES(grossRevenueUSD * bcv)})
📦 *Costo de Ventas (COGS):* ${formatUSD(totalCostOfGoodsUSD)}
💵 *Ganancia Bruta:* ${formatUSD(grossProfitUSD)} (Margen: ${grossMarginPercent}%)
📉 *Gastos Operativos (Egresos):* ${formatUSD(totalExpensesUSD)}
━━━━━━━━━━━━━━━━━━━━
🏆 *UTILIDAD NETA FINAL:* ${formatUSD(netProfitUSD)} (~${formatVES(netProfitUSD * bcv)})
📈 *Margen Neto Operativo:* ${netMarginPercent}%
━━━━━━━━━━━━━━━━━━━━
📥 Ventas cobradas de contado: ${formatUSD(totalPaidSalesUSD)}
⏳ Ventas otorgadas a crédito (fiado): ${formatUSD(totalFiadoSalesUSD)}
_Generado por el Copiloto IA de ${settings.businessName}_`;

  return {
    title: `Estado de Resultados y Ganancias (${periodLabel})`,
    generatedAt: now.toLocaleString('es-VE'),
    periodLabel,
    metrics: [
      {
        label: 'Ventas Brutas',
        valueUSD: formatUSD(grossRevenueUSD),
        valueVES: formatVES(grossRevenueUSD * bcv),
        isPositive: true,
      },
      {
        label: 'Ganancia Bruta',
        valueUSD: formatUSD(grossProfitUSD),
        changeText: `${grossMarginPercent}% margen`,
        isPositive: grossProfitUSD > 0,
      },
      {
        label: 'Gastos Operativos',
        valueUSD: formatUSD(totalExpensesUSD),
        isPositive: false,
      },
      {
        label: 'Utilidad Neta',
        valueUSD: formatUSD(netProfitUSD),
        valueVES: formatVES(netProfitUSD * bcv),
        changeText: `${netMarginPercent}% rendimiento neto`,
        isPositive: netProfitUSD > 0,
      },
    ],
    sections: [
      {
        title: 'Desglose de Cobranza',
        content: [
          `Total facturado en el período: ${formatUSD(grossRevenueUSD)} a través de ${filteredTickets.length} ventas.`,
          `Cobrado de contado: ${formatUSD(totalPaidSalesUSD)} (${Math.round((totalPaidSalesUSD / (grossRevenueUSD || 1)) * 100)}%).`,
          `Crédito fiado otorgado: ${formatUSD(totalFiadoSalesUSD)} (${Math.round((totalFiadoSalesUSD / (grossRevenueUSD || 1)) * 100)}%).`,
        ],
      },
      {
        title: 'Eficiencia de Mercancía',
        content: [
          `El costo estimado de mercancía representa el ${grossRevenueUSD > 0 ? Math.round((totalCostOfGoodsUSD / grossRevenueUSD) * 100) : 0}% de los ingresos brutos.`,
          `Se registraron ${filteredExpenses.length} egresos operativos en este lapso sumando ${formatUSD(totalExpensesUSD)}.`,
        ],
      },
    ],
    recommendations: [
      netMarginPercent < 15
        ? '⚠️ El margen neto está por debajo del 15%. Se recomienda revisar los precios en productos con bajo recargo o controlar egresos no esenciales.'
        : '✅ El margen operativo es saludable. Mantener control de reposición para sostener la rentabilidad.',
      totalFiadoSalesUSD > grossRevenueUSD * 0.35
        ? '⚠️ Las ventas a crédito superan el 35% del volumen facturado. Priorizar la cobranza para no comprometer el flujo de caja.'
        : '✅ El nivel de cartera fiada se encuentra en niveles manejables respecto al total facturado.',
    ],
    plainTextWhatsApp: whatsAppText,
  };
}

/**
 * Genera el Reporte de Demanda y Rotación de Productos
 */
export function generateDemandReport(
  products: Product[],
  tickets: SaleTicket[],
  restocks: RestockRecord[],
  settings: AppSettings,
  days: number = 30
): AIExecutiveReport {
  const predictions = calculateAIRestockPredictions(products, tickets, restocks, days);
  const patterns = generateAIPatternsReport(products, tickets, restocks, days);
  const now = new Date();

  const critical = predictions.filter((p) => p.urgencyLevel === 'critical');
  const warning = predictions.filter((p) => p.urgencyLevel === 'warning');
  const healthy = predictions.filter((p) => p.urgencyLevel === 'optimal');
  const lowTurnover = predictions.filter((p) => p.urgencyLevel === 'low_turnover');

  const topFastMoving = [...predictions]
    .sort((a, b) => b.dailySalesRate - a.dailySalesRate)
    .slice(0, 5);

  const whatsAppText = `📦 *REPORTE DE DEMANDA Y AGOTAMIENTO PREDICTIVO*
🏪 *${settings.businessName}* • Auditoría IA
━━━━━━━━━━━━━━━━━━━━
🚨 *PRODUCTOS CRÍTICOS (&lt;3 DÍAS DE STOCK):* ${critical.length}
${critical.length > 0 ? critical.map((p) => `• ${p.productName}: ${formatQuantity(p.currentStock, p.unit)} restante (Agotamiento: ${p.predictedDepletionDate})`).join('\n') : '• Ninguno, ¡inventario cubierto!'}

⚠️ *PRÓXIMOS A AGOTAR (3 A 7 DÍAS):* ${warning.length}
${warning.length > 0 ? warning.map((p) => `• ${p.productName}: Salida ${p.dailySalesRate} ${p.unit}/día`).join('\n') : '• Sin alertas moderadas.'}

━━━━━━━━━━━━━━━━━━━━
🔥 *TOP PRODUCTOS MÁS VENDIDOS:*
${topFastMoving.map((p, idx) => `${idx + 1}. ${p.productName} (${p.dailySalesRate} ${p.unit}/día)`).join('\n')}

💵 *Presupuesto Sugerido de Reposición:* ${formatUSD(patterns.totalRecommendedPurchaseUSD)}
📅 *Día Pico Semanal:* ${patterns.peakDaysOfWeek[0]?.dayName || 'Fin de semana'}
_Copiloto IA de Demanda • ${settings.businessName}_`;

  return {
    title: 'Análisis Predictivo de Demanda y Agotamiento',
    generatedAt: now.toLocaleString('es-VE'),
    periodLabel: `Ventana de ${days} días`,
    metrics: [
      {
        label: 'Productos Críticos',
        valueUSD: `${critical.length} en riesgo`,
        isPositive: critical.length === 0,
      },
      {
        label: 'Próximos a Reordenar',
        valueUSD: `${warning.length} productos`,
        isPositive: warning.length === 0,
      },
      {
        label: 'Presupuesto Reposición',
        valueUSD: formatUSD(patterns.totalRecommendedPurchaseUSD),
        valueVES: formatVES(patterns.totalRecommendedPurchaseUSD * settings.bcvRate),
        isPositive: true,
      },
      {
        label: 'Stock Saludable',
        valueUSD: `${healthy.length} productos`,
        isPositive: true,
      },
    ],
    sections: [
      {
        title: 'Velocidad de Salida y Top Demanda',
        content: topFastMoving.map(
          (p) =>
            `${p.productName}: Venta promedio de ${p.dailySalesRate} ${p.unit}/día. Stock actual: ${formatQuantity(p.currentStock, p.unit)}.`
        ),
      },
      {
        title: 'Patrones de Compra y Estacionalidad',
        content: [
          `El día con mayor movimiento de clientes es el ${patterns.peakDaysOfWeek[0]?.dayName || 'Sábado'}, representando el ${patterns.peakDaysOfWeek[0]?.percentage || 25}% del volumen total.`,
          `Se detectaron ${patterns.basketAffinities.length} asociaciones habituales en compras de clientes.`,
        ],
      },
    ],
    recommendations: [
      critical.length > 0
        ? `🚨 Emitir pedido urgente para ${critical.map((c) => c.productName).join(', ')} antes del agotamiento.`
        : '✅ No hay riesgos inmediatos de ruptura de inventario.',
      `Planificar la recepción de mercancía antes del ${patterns.peakDaysOfWeek[0]?.dayName || 'viernes'} para abastecer el pico de ventas.`,
    ],
    plainTextWhatsApp: whatsAppText,
  };
}

/**
 * Genera el Reporte de Cuentas por Cobrar (Deudores Fiados)
 */
export function generateDebtorsAuditReport(
  debtors: DebtorCustomer[],
  settings: AppSettings
): AIExecutiveReport {
  const now = new Date();
  let totalDebtUSD = 0;
  debtors.forEach((d) => (totalDebtUSD += d.totalDebtUSD));

  const sortedDebtors = [...debtors].sort((a, b) => b.totalDebtUSD - a.totalDebtUSD);
  const bcv = settings.bcvRate || 1;

  const whatsAppText = `📋 *AUDITORÍA DE CUENTAS POR COBRAR (LIBRO DE FIADOS)*
🏪 *${settings.businessName}* • Control de Cartera
━━━━━━━━━━━━━━━━━━━━
👥 *Total Clientes Deudores:* ${debtors.length}
💵 *DEUDA TOTAL PENDIENTE:* ${formatUSD(totalDebtUSD)} USD
🇻🇪 *Equivalente Oficial BCV:* ${formatVES(totalDebtUSD * bcv)} Bs.
━━━━━━━━━━━━━━━━━━━━
🏆 *PRINCIPALES CUENTAS POR COBRAR:*
${sortedDebtors
  .slice(0, 8)
  .map(
    (d, i) =>
      `${i + 1}. *${d.name}*: ${formatUSD(d.totalDebtUSD)} USD (${d.tickets.length} factura${d.tickets.length > 1 ? 's' : ''})${d.phone ? ` • Tel: ${d.phone}` : ''}`
  )
  .join('\n')}
━━━━━━━━━━━━━━━━━━━━
_Gestión centralizada mediante el Copiloto IA de ${settings.businessName}_`;

  return {
    title: 'Auditoría de Cuentas por Cobrar (Fiados)',
    generatedAt: now.toLocaleString('es-VE'),
    periodLabel: 'Cartera Vigente',
    metrics: [
      {
        label: 'Deuda Total Activa',
        valueUSD: formatUSD(totalDebtUSD),
        valueVES: formatVES(totalDebtUSD * bcv),
        isPositive: false,
      },
      {
        label: 'Clientes con Saldo',
        valueUSD: `${debtors.length} personas`,
        isPositive: debtors.length <= 10,
      },
      {
        label: 'Mayor Deudor Individual',
        valueUSD: sortedDebtors[0] ? formatUSD(sortedDebtors[0].totalDebtUSD) : '$0.00',
        changeText: sortedDebtors[0]?.name || 'Ninguno',
        isPositive: false,
      },
    ],
    sections: [
      {
        title: 'Top Cuentas Pendientes',
        content: sortedDebtors.slice(0, 5).map(
          (d) =>
            `${d.name}: Debe ${formatUSD(d.totalDebtUSD)} USD repartidos en ${d.tickets.length} compra(s). ${d.phone ? `Tel: ${d.phone}` : 'Sin teléfono'}.`
        ),
      },
    ],
    recommendations: [
      totalDebtUSD > 150
        ? '💡 Se aconseja enviar recordatorios cordiales por WhatsApp a los 5 mayores deudores para recuperar liquidez esta semana.'
        : '✅ Cartera de crédito controlada dentro de los parámetros normales del negocio.',
    ],
    plainTextWhatsApp: whatsAppText,
  };
}

/**
 * Motor NLP y de Procesamiento de Lenguaje Natural en el Asistente IA
 * Interpreta la intención del usuario, evalúa el contexto completo y devuelve
 * respuesta ejecutiva con datos matemáticos exactos y propuestas de acción directa.
 */
export function processAIChatQuery(
  query: string,
  context: {
    products: Product[];
    tickets: SaleTicket[];
    debtors: DebtorCustomer[];
    restocks: RestockRecord[];
    expenses: ExpenseRecord[];
    mermas: MermaRecord[];
    settings: AppSettings;
  }
): AIChatMessage {
  const q = query.toLowerCase().trim();
  const now = new Date();
  const timestamp = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  const bcv = context.settings.bcvRate || 1;

  // 1. Detectar comando: Modificar Tasa BCV
  // Ej: "cambiar tasa bcv a 82.5", "actualizar bcv 80", "sube la tasa a 79"
  const bcvMatch = q.match(/(?:tasa\s*bcv|cambiar\s*bcv|actualizar\s*bcv|bcv\s*a|subir\s*bcv|tasa\s*a)\s*(\d+[.,]?\d*)/i);
  if (bcvMatch && bcvMatch[1]) {
    const newRate = parseFloat(bcvMatch[1].replace(',', '.'));
    if (!isNaN(newRate) && newRate > 0) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        category: 'action',
        timestamp,
        text: `Entendido. He preparado la orden para actualizar la **Tasa Oficial BCV** a **${formatVES(newRate)} Bs./USD** (Tasa actual: ${formatVES(context.settings.bcvRate)} Bs.).\n\n¿Deseas aplicar este ajuste de inmediato en toda la aplicación?`,
        actionProposal: {
          id: `act-bcv-${Date.now()}`,
          type: 'set_bcv_rate',
          title: `Actualizar Tasa BCV a ${formatVES(newRate)}`,
          description: `Modificará la tasa de cambio en todos los cálculos del POS, facturas e inventario.`,
          payload: { newRate },
          status: 'pending',
        },
      };
    }
  }

  // 2. Detectar comando: Modificar Tasa Preferencial de Divisas
  // Ej: "cambiar tasa divisa a 85", "preferencial 86", "tasa efectivo 84"
  const prefMatch = q.match(/(?:tasa\s*divisa|tasa\s*efectivo|preferencial|tasa\s*preferencial)\s*(?:a)?\s*(\d+[.,]?\d*)/i);
  if (prefMatch && prefMatch[1]) {
    const newRate = parseFloat(prefMatch[1].replace(',', '.'));
    if (!isNaN(newRate) && newRate > 0) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        category: 'action',
        timestamp,
        text: `Detecté tu solicitud para modificar la **Tasa Preferencial de Divisas en Efectivo** a **${formatVES(newRate)} Bs.** (Actual: ${formatVES(context.settings.preferentialRate || context.settings.bcvRate)} Bs.).\n\nEsto actualizará automáticamente los renglones de incentivo en caja al cobrar en dólares en efectivo.`,
        actionProposal: {
          id: `act-pref-${Date.now()}`,
          type: 'set_pref_rate',
          title: `Aplicar Tasa Divisa Efectivo: ${formatVES(newRate)}`,
          description: `Cambiará la tasa para cobros de divisa en efectivo en caja.`,
          payload: { newRate },
          status: 'pending',
        },
      };
    }
  }

  // 3. CONTROL TOTAL: Alternar Modo Autónomo / Piloto Automático
  // Ej: "activar modo autonomo", "desactivar modo autonomo", "modo autonomo"
  if (q.includes('autonomo') || q.includes('piloto automatico') || q.includes('control total automatico')) {
    const activate = !q.includes('desactivar') && !q.includes('apagar') && !q.includes('desactivado');
    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'action',
      timestamp,
      text: activate
        ? `⚡ **Modo Autónomo de Control Total ACTIVADO:**\n\nA partir de este momento, cualquier orden que me des *(ajustar precios, registrar gastos, crear productos, modificar stock, abonar fiados, cambiar tasas)* se ejecutará **de forma inmediata y directa** en la base de datos sin requerir confirmación manual.`
        : `🛡️ **Modo Autónomo DESACTIVADO (Modo Asistido):**\n\nHe cambiado el sistema al modo asistido. Cada vez que me solicites una operación, te mostraré una tarjeta de resumen con botón de confirmación antes de impactar el sistema.`,
      actionProposal: {
        id: `act-auto-${Date.now()}`,
        type: 'toggle_autonomous_mode',
        title: activate ? 'Activar Modo Autónomo' : 'Desactivar Modo Autónomo',
        description: activate ? 'Permite a la IA ejecutar órdenes directamente sin confirmación manual.' : 'Requiere botón de confirmación para cada orden.',
        payload: { enabled: activate },
        status: 'pending',
      },
    };
  }

  // 4. CONTROL TOTAL: Crear Nuevo Producto
  // Ej: "crea un producto Queso Paisa a 6.5$ costo 4.5$ stock 15kg", "nuevo producto Mortadela Tapara a 3.2$"
  if (
    q.includes('crear producto') ||
    q.includes('nuevo producto') ||
    q.includes('agregar producto') ||
    q.includes('crea el producto') ||
    q.includes('añadir producto')
  ) {
    // Extraer detalles con expresiones regulares o defaults
    const priceMatch = q.match(/(?:precio|a|\$)\s*\$?(\d+[.,]?\d*)/i);
    const costMatch = q.match(/(?:costo|coste)\s*\$?(\d+[.,]?\d*)/i);
    const stockMatch = q.match(/(?:stock|cantidad|inicial)\s*(\d+[.,]?\d*)/i);
    const isUnit = q.includes('unid') || q.includes('unidad') || q.includes('paquete') || q.includes('pieza');

    let cleanName = query
      .replace(/crear\s*(?:un\s*)?(?:nuevo\s*)?producto/i, '')
      .replace(/agregar\s*(?:un\s*)?(?:nuevo\s*)?producto/i, '')
      .replace(/añadir\s*(?:un\s*)?(?:nuevo\s*)?producto/i, '')
      .replace(/(?:precio|a|\$)\s*\$?(\d+[.,]?\d*).*/i, '')
      .trim();

    if (!cleanName || cleanName.length < 2) {
      cleanName = 'Nuevo Producto Charcutería';
    }

    const priceUSD = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 5.0;
    const costUSD = costMatch ? parseFloat(costMatch[1].replace(',', '.')) : Math.round(priceUSD * 0.72 * 100) / 100;
    const stock = stockMatch ? parseFloat(stockMatch[1].replace(',', '.')) : 10;
    const unit: 'KG' | 'UN' = isUnit ? 'UN' : 'KG';

    // Determinar categoría válida por nombre
    let category: 'Quesos' | 'Embutidos' | 'Lácteos' | 'Varios' = 'Embutidos';
    const lowerName = cleanName.toLowerCase();
    if (lowerName.includes('queso') || lowerName.includes('mozzarella') || lowerName.includes('gouda') || lowerName.includes('parmesano')) {
      category = 'Quesos';
    } else if (lowerName.includes('leche') || lowerName.includes('crema') || lowerName.includes('suero') || lowerName.includes('mantequilla')) {
      category = 'Lácteos';
    } else if (lowerName.includes('pan') || lowerName.includes('harina') || lowerName.includes('refresco') || lowerName.includes('salsa')) {
      category = 'Varios';
    }

    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'action',
      timestamp,
      text: `📦 **Orden de Catálogo: Creación de Nuevo Producto**\n\n• **Nombre:** **${cleanName}**\n• **Categoría:** ${category}\n• **Precio de Venta:** **${formatUSD(priceUSD)} / ${unit}** (~${formatVES(priceUSD * bcv)} Bs.)\n• **Costo Unitario:** ${formatUSD(costUSD)} / ${unit}\n• **Stock Inicial:** ${formatQuantity(stock, unit)}\n\n¿Procedo a ingresarlo en el inventario activo de la tienda?`,
      actionProposal: {
        id: `act-new-prod-${Date.now()}`,
        type: 'create_product',
        title: `Crear Producto: "${cleanName}" (${formatUSD(priceUSD)}/${unit})`,
        description: `Se registrará en el catálogo para facturación inmediata con stock inicial de ${formatQuantity(stock, unit)}.`,
        payload: {
          name: cleanName,
          priceUSD,
          costUSD,
          stock,
          unit,
          category,
        },
        status: 'pending',
      },
    };
  }

  // 5. CONTROL TOTAL: Modificar Precio de Producto
  // Ej: "subir el precio del queso llanero a 5.8$", "cambiar precio de jamón a 8.5", "pon el queso a 6$"
  const priceUpdateMatch = q.match(/(?:cambiar|modificar|poner|pon|subir|bajar|actualizar|fijar)\s+(?:el\s+)?precio\s+(?:de\s+|del\s+)?(.+?)\s+(?:a|en)\s*\$?(\d+[.,]?\d*)/i);
  if (priceUpdateMatch) {
    const rawProdQuery = priceUpdateMatch[1].trim().toLowerCase();
    const newPrice = parseFloat(priceUpdateMatch[2].replace(',', '.'));
    const matchedProduct = context.products.find((p) =>
      p.name.toLowerCase().includes(rawProdQuery) || rawProdQuery.includes(p.name.toLowerCase())
    );

    if (matchedProduct && !isNaN(newPrice) && newPrice > 0) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        category: 'action',
        timestamp,
        text: `🏷️ **Ajuste de Precio para "${matchedProduct.name}":**\n\n• **Precio Actual:** ${formatUSD(matchedProduct.priceUSD)} / ${matchedProduct.unit}\n• **Nuevo Precio Propuesto:** **${formatUSD(newPrice)} / ${matchedProduct.unit}** (~${formatVES(newPrice * bcv)} Bs.)\n• **Variación:** ${newPrice > matchedProduct.priceUSD ? `🔺 +${formatUSD(newPrice - matchedProduct.priceUSD)}` : `🔻 -${formatUSD(matchedProduct.priceUSD - newPrice)}`}\n\n¿Deseas aplicar este nuevo precio de venta de inmediato?`,
        actionProposal: {
          id: `act-price-${matchedProduct.id}-${Date.now()}`,
          type: 'update_product_price',
          title: `Actualizar precio de ${matchedProduct.name} a ${formatUSD(newPrice)}`,
          description: `Cambiará el precio de venta en catálogo y en el Punto de Venta.`,
          payload: {
            productId: matchedProduct.id,
            productName: matchedProduct.name,
            newPriceUSD: newPrice,
          },
          status: 'pending',
        },
      };
    }
  }

  // 6. CONTROL TOTAL: Ajustar Stock de Producto
  // Ej: "ajusta el stock de queso llanero a 35 kg", "stock de jamon a 12", "pon el inventario de salchicha en 20"
  const stockUpdateMatch = q.match(/(?:ajustar|cambiar|fijar|actualizar|poner|pon)\s+(?:el\s+)?(?:stock|inventario)\s+(?:de\s+|del\s+)?(.+?)\s+(?:a|en)\s*(\d+[.,]?\d*)/i);
  if (stockUpdateMatch) {
    const rawProdQuery = stockUpdateMatch[1].trim().toLowerCase();
    const newStock = parseFloat(stockUpdateMatch[2].replace(',', '.'));
    const matchedProduct = context.products.find((p) =>
      p.name.toLowerCase().includes(rawProdQuery) || rawProdQuery.includes(p.name.toLowerCase())
    );

    if (matchedProduct && !isNaN(newStock) && newStock >= 0) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        category: 'action',
        timestamp,
        text: `📦 **Ajuste de Inventario Físico para "${matchedProduct.name}":**\n\n• **Stock Actual en Sistema:** ${formatQuantity(matchedProduct.stock, matchedProduct.unit)}\n• **Nuevo Stock Físico:** **${formatQuantity(newStock, matchedProduct.unit)}**\n• **Diferencia:** ${formatQuantity(newStock - matchedProduct.stock, matchedProduct.unit)}\n\n¿Deseas asentar este conteo físico en el inventario?`,
        actionProposal: {
          id: `act-stock-${matchedProduct.id}-${Date.now()}`,
          type: 'update_product_stock',
          title: `Fijar stock de ${matchedProduct.name} en ${formatQuantity(newStock, matchedProduct.unit)}`,
          description: `Ajustará la cantidad disponible en el catálogo de productos.`,
          payload: {
            productId: matchedProduct.id,
            productName: matchedProduct.name,
            newStock,
          },
          status: 'pending',
        },
      };
    }
  }

  // 7. CONTROL TOTAL: Registrar Gasto Operativo / Egreso
  // Ej: "registra gasto de 15$ de hielo y bolsas", "egreso de 50$ en ayudante de mostrador", "gasto de 25$ de luz"
  const expenseMatch = q.match(/(?:registrar\s+)?(?:gasto|egreso|pago)\s+(?:de\s+)?\$?(\d+[.,]?\d*)\s*(?:\$|usd)?\s*(?:en|de|por)\s*(.+)/i);
  if (expenseMatch) {
    const amountUSD = parseFloat(expenseMatch[1].replace(',', '.'));
    const descriptionRaw = expenseMatch[2].trim();
    if (!isNaN(amountUSD) && amountUSD > 0) {
      let category = 'Otros Gastos';
      const descLower = descriptionRaw.toLowerCase();
      if (descLower.includes('bolsa') || descLower.includes('empaque') || descLower.includes('hielo') || descLower.includes('papel')) {
        category = 'Bolsas y Empaques';
      } else if (descLower.includes('luz') || descLower.includes('agua') || descLower.includes('internet') || descLower.includes('cantv') || descLower.includes('servicio')) {
        category = 'Servicios';
      } else if (descLower.includes('nomina') || descLower.includes('ayudante') || descLower.includes('sueldo') || descLower.includes('personal') || descLower.includes('chico') || descLower.includes('cajero')) {
        category = 'Personal/Nómina';
      } else if (descLower.includes('mantenimiento') || descLower.includes('reparacion') || descLower.includes('tecnico') || descLower.includes('rebanadora') || descLower.includes('balanza')) {
        category = 'Mantenimiento';
      } else if (descLower.includes('alquiler') || descLower.includes('local')) {
        category = 'Alquiler/Local';
      }

      const amountVES = amountUSD * bcv;
      return {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        category: 'action',
        timestamp,
        text: `💸 **Registro de Egreso / Gasto Operativo:**\n\n• **Concepto:** **${descriptionRaw}**\n• **Monto:** **${formatUSD(amountUSD)} USD** (~${formatVES(amountVES)} Bs. Tasa BCV)\n• **Categoría Asignada:** ${category}\n• **Impacto:** Se deducirá automáticamente de la Utilidad Neta del negocio en el Reporte P&L.\n\n¿Procedo a asentar el gasto en el libro de egresos?`,
        actionProposal: {
          id: `act-exp-${Date.now()}`,
          type: 'add_expense',
          title: `Registrar Gasto: ${formatUSD(amountUSD)} (${descriptionRaw})`,
          description: `Asentará el egreso en la categoría "${category}".`,
          payload: {
            description: descriptionRaw,
            category,
            amountUSD,
            amountVES,
            currency: 'USD',
            appliedRate: bcv,
            paymentMethod: 'cash_usd',
          },
          status: 'pending',
        },
      };
    }
  }

  // 8. CONTROL TOTAL: Registrar Abono a Fiado / Deuda de Cliente
  // Ej: "abona 10$ a carmen", "abono de 20$ al fiado de pedro", "cliente maria abona 15$"
  const abonoMatch = q.match(/(?:abona(?:r)?|abono\s+de)\s+(?:de\s+)?\$?(\d+[.,]?\d*)\s*(?:\$|usd)?\s*(?:a|al fiado de|para|del cliente)?\s*(.+)/i);
  if (abonoMatch) {
    const amountUSD = parseFloat(abonoMatch[1].replace(',', '.'));
    const debtorQuery = abonoMatch[2].trim().toLowerCase();
    const matchedDebtor = context.debtors.find((d) =>
      d.name.toLowerCase().includes(debtorQuery) || debtorQuery.includes(d.name.toLowerCase())
    );

    if (matchedDebtor && !isNaN(amountUSD) && amountUSD > 0) {
      const remainingDebt = Math.max(0, matchedDebtor.totalDebtUSD - amountUSD);
      return {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        category: 'action',
        timestamp,
        text: `📋 **Abono a Cuenta por Cobrar (Libro de Fiados):**\n\n• **Cliente:** **${matchedDebtor.name}**\n• **Deuda Actual:** ${formatUSD(matchedDebtor.totalDebtUSD)} USD\n• **Monto del Abono:** **${formatUSD(amountUSD)} USD** (~${formatVES(amountUSD * bcv)} Bs.)\n• **Saldo Restante:** **${formatUSD(remainingDebt)} USD** ${remainingDebt === 0 ? '🎉 *(¡Deuda Totalmente Saldada!)*' : ''}\n\n¿Deseas aplicar este abono de inmediato a sus facturas pendientes?`,
        actionProposal: {
          id: `act-abono-${Date.now()}`,
          type: 'register_abono_fiado',
          title: `Abonar ${formatUSD(amountUSD)} a ${matchedDebtor.name}`,
          description: `Disminuirá el saldo fiado pendiente en el libro de deudores.`,
          payload: {
            debtorName: matchedDebtor.name,
            debtorCedula: matchedDebtor.cedula,
            amountUSD,
          },
          status: 'pending',
        },
      };
    }
  }

  // 9. CONTROL TOTAL: Registrar Merma de Producto
  // Ej: "registra merma de 0.4 kg de queso por vencimiento", "merma de 0.5 kg de jamón"
  const mermaMatch = q.match(/(?:registrar\s+)?merma\s+(?:de\s+)?(\d+[.,]?\d*)\s*(?:kg|kilos|unid)?\s*(?:de\s+|del\s+)?(.+?)(?:\s+(?:por|causa|motivo)\s+(.+))?$/i);
  if (mermaMatch) {
    const qty = parseFloat(mermaMatch[1].replace(',', '.'));
    const prodQuery = mermaMatch[2].trim().toLowerCase();
    const reasonRaw = mermaMatch[3] ? mermaMatch[3].trim() : 'Deterioro / Pérdida en mostrador';
    const matchedProduct = context.products.find((p) =>
      p.name.toLowerCase().includes(prodQuery) || prodQuery.includes(p.name.toLowerCase())
    );

    if (matchedProduct && !isNaN(qty) && qty > 0) {
      const costPerUnit = matchedProduct.costUSD || matchedProduct.priceUSD * 0.72;
      const totalLossUSD = qty * costPerUnit;
      return {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        category: 'action',
        timestamp,
        text: `⚖️ **Registro de Merma / Desperdicio:**\n\n• **Producto:** **${matchedProduct.name}**\n• **Cantidad a Descargar:** **${formatQuantity(qty, matchedProduct.unit)}**\n• **Causa Declarada:** ${reasonRaw}\n• **Impacto Económico (Costo):** **${formatUSD(totalLossUSD)} USD**\n• **Stock Resultante:** ${formatQuantity(Math.max(0, matchedProduct.stock - qty), matchedProduct.unit)}\n\n¿Procedo a asentar la merma y descargar el stock en sistema?`,
        actionProposal: {
          id: `act-merma-${Date.now()}`,
          type: 'register_merma',
          title: `Registrar Merma de ${formatQuantity(qty, matchedProduct.unit)} (${matchedProduct.name})`,
          description: `Descargará el inventario físico y asentará la pérdida en el historial de mermas.`,
          payload: {
            productId: matchedProduct.id,
            productName: matchedProduct.name,
            quantity: qty,
            reason: reasonRaw,
            lossUSD: totalLossUSD,
          },
          status: 'pending',
        },
      };
    }
  }

  // 10. CONTROL TOTAL: Cierre de Caja / Reporte Z
  // Ej: "cerrar caja", "cierre de caja", "reporte z de hoy", "hacer cierre"
  if (
    q.includes('cierre de caja') ||
    q.includes('cierre z') ||
    q.includes('reporte z') ||
    q.includes('cerrar caja') ||
    q.includes('cuadre de caja')
  ) {
    const today = new Date().toDateString();
    const todayTickets = context.tickets.filter((t) => !t.isVoided && new Date(t.date).toDateString() === today);
    const totalTodayUSD = todayTickets.reduce((sum, t) => sum + t.totalUSD, 0);

    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'action',
      timestamp,
      text: `🧾 **Cierre de Caja y Generación de Reporte Z (Hoy):**\n\n• **Tickets Facturados Hoy:** ${todayTickets.length} operaciones\n• **Monto Total Facturado:** **${formatUSD(totalTodayUSD)} USD** (~${formatVES(totalTodayUSD * bcv)} Bs.)\n• **Tasa de Cierre:** ${formatVES(context.settings.bcvRate)} Bs.\n\nHe consolidado los totales listos para auditar y generar el comprobante fiscal y térmico de cierre Z.`,
      actionProposal: {
        id: `act-z-${Date.now()}`,
        type: 'execute_cierre_z',
        title: `Generar Cierre de Caja / Reporte Z Oficial`,
        description: `Abrirá la auditoría de tickets y el módulo de impresión de Reporte Z.`,
        payload: { date: today, totalTickets: todayTickets.length, totalUSD: totalTodayUSD },
        status: 'pending',
      },
    };
  }

  // 11. CONTROL TOTAL: Navegación Inmediata entre Módulos
  // Ej: "ir al inventario", "abre el pos", "ver fiados", "ir a reposicion", "ver gastos"
  if (
    q.includes('ir a') ||
    q.includes('llevame a') ||
    q.includes('abrir pos') ||
    q.includes('abrir fiados') ||
    q.includes('abrir inventario') ||
    q.includes('ver fiados') ||
    q.includes('ver inventario') ||
    q.includes('ver gastos') ||
    q.includes('ver tickets')
  ) {
    let targetTab: 'pos' | 'tickets' | 'fiados' | 'restocks' | 'inventory' | 'settings' | 'ai' = 'pos';
    let tabName = 'Punto de Venta (POS)';
    if (q.includes('inventario') || q.includes('stock') || q.includes('almacen')) {
      targetTab = 'inventory';
      tabName = 'Control de Inventario';
    } else if (q.includes('fiado') || q.includes('deuda') || q.includes('cobrar')) {
      targetTab = 'fiados';
      tabName = 'Libro de Fiados';
    } else if (q.includes('reposicion') || q.includes('proveedor') || q.includes('compras')) {
      targetTab = 'restocks';
      tabName = 'Reposición & Cuentas por Pagar';
    } else if (q.includes('ticket') || q.includes('factura') || q.includes('gasto') || q.includes('historial')) {
      targetTab = 'tickets';
      tabName = 'Historial de Facturas & Egresos';
    } else if (q.includes('ajuste') || q.includes('configuracion') || q.includes('tasa')) {
      targetTab = 'settings';
      tabName = 'Ajustes del Sistema';
    }

    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'action',
      timestamp,
      text: `🚀 **Navegación del Sistema:**\n\nHe preparado la orden para cambiar de vista a **${tabName}**.`,
      actionProposal: {
        id: `act-nav-${Date.now()}`,
        type: 'navigate_tab',
        title: `Ir a pestaña "${tabName}"`,
        description: `Cambiará la pantalla activa a ${tabName}.`,
        payload: { tab: targetTab },
        status: 'pending',
      },
    };
  }

  // 12. CONTROL TOTAL: Copia de Seguridad y Respaldo
  if (q.includes('copia de seguridad') || q.includes('respaldo') || q.includes('backup') || q.includes('guardar datos')) {
    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'action',
      timestamp,
      text: `💾 **Copia de Seguridad y Respaldo de Datos:**\n\nPuedo exportar o sincronizar todos los datos del sistema *(inventario, tickets, libro de fiados, egresos, clientes fidelis y mermas)* para mantener tu información 100% blindada.`,
      actionProposal: {
        id: `act-backup-${Date.now()}`,
        type: 'open_backup',
        title: `Abrir Centro de Respaldo & Backup`,
        description: `Permite exportar a Excel/JSON o sincronizar con Google Cloud.`,
        payload: {},
        status: 'pending',
      },
    };
  }

  // 3. Detectar consulta de Demanda / Qué se va a agotar / Qué comprar
  if (
    q.includes('demanda') ||
    q.includes('agotar') ||
    q.includes('quiebre') ||
    q.includes('reponer') ||
    q.includes('comprar') ||
    q.includes('abastecer') ||
    q.includes('rotacion') ||
    q.includes('mas vendido')
  ) {
    const predictions = calculateAIRestockPredictions(
      context.products,
      context.tickets,
      context.restocks,
      30
    );
    const critical = predictions.filter((p) => p.urgencyLevel === 'critical');
    const warning = predictions.filter((p) => p.urgencyLevel === 'warning');

    let responseText = `🧠 **Diagnóstico de Demanda e Inventario (IA):**\n\n`;

    if (critical.length > 0) {
      responseText += `🚨 **Atención Urgente:** Tienes **${critical.length} producto(s)** con riesgo crítico de agotarse en menos de 3 días:\n`;
      critical.forEach((p) => {
        responseText += `• **${p.productName}**: Stock actual de ${formatQuantity(p.currentStock, p.unit)}. Salida de ${p.dailySalesRate} ${p.unit}/día. Se proyecta agotamiento para el **${p.predictedDepletionDate}**.\n  👉 *Sugerencia de compra:* **${formatQuantity(p.suggestedRestockQty, p.unit)}** (~${formatUSD(p.suggestedRestockCostUSD)})${p.suggestedSupplier ? ` con proveedor ${p.suggestedSupplier.name}` : ''}.\n`;
      });
    } else {
      responseText += `✅ **Buenas noticias:** No tienes productos con quiebre inminente (<3 días).\n`;
    }

    if (warning.length > 0) {
      responseText += `\n⚠️ **Próximos a reordenar (3 a 7 días de stock):**\n`;
      warning.slice(0, 4).forEach((p) => {
        responseText += `• **${p.productName}**: ${formatQuantity(p.currentStock, p.unit)} disponible (${p.daysOfStockLeft} días restantes).\n`;
      });
    }

    const topSeller = [...predictions].sort((a, b) => b.dailySalesRate - a.dailySalesRate)[0];
    if (topSeller) {
      responseText += `\n🔥 **Producto estrella de mayor rotación:** **${topSeller.productName}** con ${topSeller.dailySalesRate} ${topSeller.unit}/día.`;
    }

    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'demand',
      timestamp,
      text: responseText,
      structuredData: {
        type: 'cards',
        title: 'Productos Prioritarios de Reposición',
        items: [...critical, ...warning].slice(0, 6),
      },
    };
  }

  // 4. Detectar consulta sobre Deudores / Fiados / Cuentas por Cobrar
  if (
    q.includes('deuda') ||
    q.includes('deudor') ||
    q.includes('fiado') ||
    q.includes('cobrar') ||
    q.includes('me deben') ||
    q.includes('quien debe')
  ) {
    let totalDebtUSD = 0;
    context.debtors.forEach((d) => (totalDebtUSD += d.totalDebtUSD));
    const sorted = [...context.debtors].sort((a, b) => b.totalDebtUSD - a.totalDebtUSD);

    if (context.debtors.length === 0) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        category: 'debtors',
        timestamp,
        text: `🎉 **¡Excelente! No hay clientes deudores registrados en este momento.** Todas las ventas a crédito han sido completamente saldadas.`,
      };
    }

    let responseText = `📋 **Auditoría de Cuentas por Cobrar (Libro de Fiados):**\n\n`;
    responseText += `• **Total por Cobrar:** **${formatUSD(totalDebtUSD)} USD** (~${formatVES(totalDebtUSD * bcv)} Bs.).\n`;
    responseText += `• **Número de Clientes Deudores:** **${context.debtors.length} persona(s)**.\n\n`;
    responseText += `**Mayores saldos pendientes:**\n`;

    sorted.slice(0, 5).forEach((d, i) => {
      responseText += `${i + 1}. **${d.name}**: **${formatUSD(d.totalDebtUSD)} USD** (${d.tickets.length} compra${d.tickets.length > 1 ? 's' : ''})${d.phone ? ` • Tel: ${d.phone}` : ''}\n`;
    });

    const highest = sorted[0];
    let actionProposal: AIActionProposal | undefined = undefined;
    if (highest && highest.phone) {
      const wa = generateWhatsAppReminder(highest, context.settings);
      actionProposal = {
        id: `act-wa-${Date.now()}`,
        type: 'open_reminder',
        title: `Enviar Recordatorio WhatsApp a ${highest.name}`,
        description: `Abrirá WhatsApp con mensaje cordial y montos exclusivamente en divisa USD ($${highest.totalDebtUSD.toFixed(2)}).`,
        payload: { url: wa.url, debtorName: highest.name },
        status: 'pending',
      };
    }

    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'debtors',
      timestamp,
      text: responseText,
      actionProposal,
      structuredData: {
        type: 'table',
        title: 'Ranking de Deudores',
        items: sorted.slice(0, 8).map((d) => ({
          Cliente: d.name,
          'Deuda USD': formatUSD(d.totalDebtUSD),
          Facturas: d.tickets.length,
          Teléfono: d.phone || 'N/A',
        })),
      },
    };
  }

  // 5. Detectar solicitud de Reportes Financieros / Ventas / Ganancias
  if (
    q.includes('reporte') ||
    q.includes('ganancia') ||
    q.includes('venta') ||
    q.includes('balance') ||
    q.includes('cuanto vendimos') ||
    q.includes('p&l') ||
    q.includes('utilidad')
  ) {
    const days = q.includes('hoy') ? 1 : q.includes('semana') ? 7 : 30;
    const report = generateFinancialPLReport(
      context.tickets,
      context.expenses,
      context.products,
      context.settings,
      days
    );

    let responseText = `📊 **${report.title}:**\n\n`;
    report.metrics.forEach((m) => {
      responseText += `• **${m.label}:** ${m.valueUSD}${m.valueVES ? ` (${m.valueVES} Bs.)` : ''}${m.changeText ? ` _[${m.changeText}]_` : ''}\n`;
    });

    responseText += `\n💡 **Recomendación IA:**\n${report.recommendations.join('\n')}`;

    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'report',
      timestamp,
      text: responseText,
      structuredData: {
        type: 'report',
        title: report.title,
        summary: {
          'Ventas Brutas': report.metrics[0].valueUSD,
          'Ganancia Bruta': report.metrics[1].valueUSD,
          'Gastos Operativos': report.metrics[2].valueUSD,
          'Utilidad Neta': report.metrics[3].valueUSD,
        },
      },
    };
  }

  // 6. Detectar consulta de Inventario y Stock
  if (
    q.includes('inventario') ||
    q.includes('stock') ||
    q.includes('cuanto hay') ||
    q.includes('disponible') ||
    q.includes('queso') ||
    q.includes('jamon')
  ) {
    // Buscar si menciona un producto específico
    const foundProduct = context.products.find((p) =>
      q.includes(p.name.toLowerCase())
    );

    if (foundProduct) {
      const isOutOfStock = foundProduct.stock <= 0;
      return {
        id: `msg-${Date.now()}`,
        sender: 'ai',
        category: 'inventory',
        timestamp,
        text: `📦 **Ficha de Inventario para "${foundProduct.name}":**\n\n• **Stock Actual:** **${formatQuantity(foundProduct.stock, foundProduct.unit)}** ${isOutOfStock ? '🚨 *(¡Agotado!)*' : '✅'}\n• **Precio de Venta:** **${formatUSD(foundProduct.priceUSD)} / ${foundProduct.unit}** (~${formatVES(foundProduct.priceUSD * bcv)} Bs.)\n• **Costo Unitario:** ${foundProduct.costUSD ? `${formatUSD(foundProduct.costUSD)}` : 'No registrado'}\n• **Categoría:** ${foundProduct.category}\n• **Alerta Mínima:** ${formatQuantity(foundProduct.minStockAlert || 2, foundProduct.unit)}\n\n${isOutOfStock ? '⚠️ *Este producto no puede venderse hasta que se ingrese reposición de mercancía.*' : 'El producto está activo para facturación inmediata.'}`,
      };
    }

    let totalInventoryCostUSD = 0;
    let totalInventoryRetailUSD = 0;
    let outOfStockCount = 0;

    context.products.forEach((p) => {
      const cost = p.costUSD || p.priceUSD * 0.72;
      totalInventoryCostUSD += p.stock * cost;
      totalInventoryRetailUSD += p.stock * p.priceUSD;
      if (p.stock <= 0) outOfStockCount++;
    });

    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'inventory',
      timestamp,
      text: `📦 **Valoración y Estado del Inventario:**\n\n• **Total de Ítems en Catálogo:** ${context.products.length} productos.\n• **Productos Agotados (Stock 0):** ${outOfStockCount} producto(s).\n• **Valor Total del Inventario (al Costo):** **${formatUSD(totalInventoryCostUSD)} USD**.\n• **Valor Proyectado a Precio de Venta:** **${formatUSD(totalInventoryRetailUSD)} USD**.\n• **Margen Potencial Bruto en Estantería:** **${formatUSD(Math.max(0, totalInventoryRetailUSD - totalInventoryCostUSD))} USD**.\n\nSi deseas consultar un producto específico, escribe su nombre (ej: *"¿Cuánto hay de queso llanero?"*).`,
    };
  }

  // 7. MANAGER COPY: Modificar Mensaje de Recordatorio de Deudas (Cobranza Fiados)
  if (
    q.includes('recordatorio') ||
    q.includes('mensaje de cobro') ||
    q.includes('cobrar fiado') ||
    q.includes('cambiar recordatorio') ||
    q.includes('modificar recordatorio') ||
    q.includes('texto de deuda') ||
    q.includes('plantilla de cobro')
  ) {
    let selectedTone: 'cordial' | 'asertivo' | 'urgente' | 'efectivo' = 'cordial';
    if (q.includes('urgente') || q.includes('firme') || q.includes('vencid') || q.includes('presion')) {
      selectedTone = 'urgente';
    } else if (q.includes('asertiv') || q.includes('formal') || q.includes('comercial') || q.includes('serio')) {
      selectedTone = 'asertivo';
    } else if (q.includes('efectivo') || q.includes('dolar') || q.includes('divisa') || q.includes('beneficio') || q.includes('ahorro')) {
      selectedTone = 'efectivo';
    } else if (q.includes('amigable') || q.includes('suave') || q.includes('calid') || q.includes('cordial')) {
      selectedTone = 'cordial';
    }

    const proposedTemplate = REMINDER_TONE_PRESETS[selectedTone];
    const toneTitles = {
      cordial: 'Cordial & Respetuoso (Fidelizador)',
      asertivo: 'Comercial & Asertivo (Control de Cierre)',
      urgente: 'Prioritario con Fecha Límite (Cobranza Activa)',
      efectivo: 'Incentivo de Pago en Divisa Efectivo',
    };

    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'template',
      timestamp,
      text: `✍️ **Optimización de Copy para Recordatorio de Cobranza (Libro de Fiados):**\n\nComo tu **Manager Copy**, he redactado una versión estratégica con tono **${toneTitles[selectedTone]}**. Conserva todas las etiquetas inteligentes (\`{cliente}\`, \`{totalUSD}\`, \`{comprasPendientes}\`, etc.) para que se personalice automáticamente para cada cliente:\n\n\`\`\`\n${proposedTemplate}\n\`\`\`\n\n¿Deseas aplicar esta plantilla como el mensaje activo para los recordatorios de WhatsApp?`,
      actionProposal: {
        id: `act-remind-${Date.now()}`,
        type: 'update_reminder_template',
        title: `Aplicar Plantilla de Recordatorio (${toneTitles[selectedTone]})`,
        description: `Actualizará el texto que se genera al presionar 'Enviar Recordatorio' en el Libro de Fiados.`,
        payload: {
          newTemplate: proposedTemplate,
          tone: selectedTone,
        },
        status: 'pending',
      },
    };
  }

  // 8. MANAGER COPY: Modificar Mensaje de Agradecimiento (Post-Venta / Factura)
  if (
    q.includes('agradecimiento') ||
    q.includes('mensaje de gracias') ||
    q.includes('mensaje de factura') ||
    q.includes('cambiar agradecimiento') ||
    q.includes('modificar agradecimiento') ||
    q.includes('despedida de factura') ||
    q.includes('dar las gracias')
  ) {
    let selectedTone: 'calido' | 'dinamico' | 'fidelis' | 'gourmet' = 'calido';
    if (q.includes('corto') || q.includes('rapido') || q.includes('dinamic') || q.includes('conciso') || q.includes('breve')) {
      selectedTone = 'dinamico';
    } else if (q.includes('fidelis') || q.includes('sello') || q.includes('premio') || q.includes('puntos')) {
      selectedTone = 'fidelis';
    } else if (q.includes('gourmet') || q.includes('elegante') || q.includes('calidad') || q.includes('exclusiv')) {
      selectedTone = 'gourmet';
    } else {
      selectedTone = 'calido';
    }

    const proposedTemplate = THANK_YOU_TONE_PRESETS[selectedTone];
    const toneTitles = {
      calido: 'Cálido & Familiar (Cercanía Total)',
      dinamico: 'Ejecutivo & Dinámico (Corto y al Grano)',
      fidelis: 'Fidelis VIP (Enfoque en Sellos y Premios)',
      gourmet: 'Charcutero Gourmet (Sabor y Calidad Superior)',
    };

    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'template',
      timestamp,
      text: `✨ **Optimización de Copy para Mensaje de Agradecimiento (Facturas):**\n\nHe preparado una versión con enfoque **${toneTitles[selectedTone]}**. Utiliza la fórmula de retención de clientes para incrementar la recurrencia de compra, manteniendo las variables dinámicas (\`{cliente}\`, \`{factura}\`, \`{totalUSD}\`, \`{fidelis}\`):\n\n\`\`\`\n${proposedTemplate}\n\`\`\`\n\n¿Deseas activar esta plantilla en todas las facturas y ventas del sistema?`,
      actionProposal: {
        id: `act-thank-${Date.now()}`,
        type: 'update_thank_you_template',
        title: `Aplicar Plantilla de Agradecimiento (${toneTitles[selectedTone]})`,
        description: `Se enviará automáticamente a los clientes al emitir un ticket o compartir el comprobante por WhatsApp.`,
        payload: {
          newTemplate: proposedTemplate,
          tone: selectedTone,
        },
        status: 'pending',
      },
    };
  }

  // 9. MANAGER COPY: Creación de Promociones, Combos y Copywriting Comercial
  if (
    q.includes('promo') ||
    q.includes('promocion') ||
    q.includes('combo') ||
    q.includes('oferta') ||
    q.includes('campana') ||
    q.includes('publicidad') ||
    q.includes('anuncio') ||
    q.includes('copy') ||
    q.includes('redactar') ||
    q.includes('arepero') ||
    q.includes('parrillero') ||
    q.includes('marketing') ||
    q.includes('descuento') ||
    q.includes('propaganda') ||
    q.includes('vender mas') ||
    q.includes('estado de whatsapp')
  ) {
    // Generate specialized promotion
    const newPromo = generateAICopyPromotion(q, context.products, context.settings);

    let rationale = `🎯 **Estrategia Copywriting Aplicada:**\n`;
    rationale += `• **Gancho Psicológico:** Utiliza el principio de apetito y tradición familiar venezolana (desayunos abundantes y frescura).\n`;
    rationale += `• **Claridad Bimonetaria:** Presenta el monto tanto en $ USD como en Bolívares a Tasa Oficial BCV (${formatVES(context.settings.bcvRate)} Bs.) para máxima confianza y cero objeciones.\n`;
    rationale += `• **Llamado a la Acción (CTA):** Enfoque de escasez natural ("hasta agotar el lote en mostrador") para acelerar la decisión de compra.\n`;

    return {
      id: `msg-${Date.now()}`,
      sender: 'ai',
      category: 'marketing',
      timestamp,
      text: `🔥 **¡Campaña Publicitaria Generada por tu Manager Copy Experta!**\n\nHe diseñado una promoción lista para compartir en grupos de WhatsApp, estados y redes sociales:\n\n━━━━━━━━━━━━━━━━━━━━\n${newPromo.bodyWhatsApp}\n━━━━━━━━━━━━━━━━━━━━\n\n📲 **Texto Corto para Estados de WhatsApp / Instagram Stories:**\n_${newPromo.shortSocialCopy}_\n\n${rationale}`,
      structuredData: {
        type: 'promotion_card',
        promotion: newPromo,
      },
      actionProposal: {
        id: `act-save-promo-${Date.now()}`,
        type: 'save_promotion',
        title: `Guardar "${newPromo.title}" en Campañas Activas`,
        description: `Guardará esta promoción en la sección de Marketing para tenerla a mano y transmitirla en cualquier momento.`,
        payload: { promotion: newPromo },
        status: 'pending',
      },
    };
  }

  // 10. Respuesta Asistencial General y Multiuso
  return {
    id: `msg-${Date.now()}`,
    sender: 'ai',
    category: 'general',
    timestamp,
    text: `Hola, soy tu **Copiloto de Inteligencia Artificial & Manager Copy Experta** de **${context.settings.businessName}** 🤖🧀🥩\n\nPuedo responder preguntas, redactar copies comerciales y ejecutar tareas sobre todo tu negocio:\n\n• 📢 **Manager Copy & Promociones:** *"Crea un combo arepero para este fin de semana", "Redacta una oferta relámpago de queso llanero", "Escribe un copy persuasivo para estados de WhatsApp"*\n• 💬 **Plantillas de WhatsApp:** *"Modifica el mensaje de recordatorio para que sea más cordial", "Cambia el mensaje de agradecimiento al estilo Fidelis VIP"*\n• 📈 **Demanda & Agotamiento:** *"¿Qué productos se van a agotar primero?", "¿Cuánto queso debemos comprar?"*\n• 📊 **Finanzas & Ganancias:** *"Generar reporte financiero de este mes", "¿Cuál es el margen operativo?"*\n• 📋 **Libro de Fiados:** *"¿Quiénes nos deben?", "Prepara el mensaje para cobrar fiados"*\n• ⚙️ **Parámetros Económicos:** *"Cambia la tasa BCV a 82.5", "Ajusta la tasa divisa a 85"*\n\n¿Qué campaña o gestión deseas poner en marcha hoy?`,
  };
}

/**
 * Generador Inteligente de Promociones y Copywriting para Charcutería
 */
export function generateAICopyPromotion(
  query: string,
  products: Product[],
  settings: AppSettings,
  options?: {
    customType?: 'combo' | 'descuento' | 'oferta_relampago' | 'fin_de_semana' | 'fidelis' | 'tasa_especial';
    targetProductId?: string;
    customDiscountOrPrice?: string;
    tone?: 'persuasivo' | 'familiar' | 'gourmet' | 'relampago';
  }
): MarketingPromotion {
  const q = query.toLowerCase();
  const bcv = settings.bcvRate || 1;
  const now = new Date();

  // Find relevant products
  const queso = products.find((p) => p.name.toLowerCase().includes('llanero') || p.category === 'Quesos') || products[0];
  const jamon = products.find((p) => p.name.toLowerCase().includes('jamón') || p.name.toLowerCase().includes('plumrose')) || products[1];
  const harina = products.find((p) => p.name.toLowerCase().includes('harina')) || products[3] || products[0];
  const tocineta = products.find((p) => p.name.toLowerCase().includes('tocineta') || p.name.toLowerCase().includes('salchichón')) || products[2];

  // 1. Combo Arepero / Desayuno Familiar
  if (options?.customType === 'combo' || q.includes('areper') || q.includes('desayuno') || q.includes('combo')) {
    const priceUSD = 8.50;
    const priceVES = priceUSD * bcv;
    return {
      id: `promo-${Date.now()}`,
      title: `Combo Arepero Familiar (${queso.name} + ${jamon.name} + ${harina.name})`,
      category: 'combo',
      headline: `🔥 ¡DESAYUNO EN FAMILIA CON TODO! COMBO AREPERO IRRESISTIBLE 🧀🥩`,
      estimatedPriceUSD: priceUSD,
      discountOrPrice: `$${priceUSD.toFixed(2)} USD (~${formatVES(priceVES)} Bs.)`,
      targetAudience: 'Familias, desayunos de fin de semana y amantes de la arepa',
      validUntil: 'Hasta agotar existencia del lote',
      suggestedProducts: [queso.name, jamon.name, harina.name],
      bodyWhatsApp: `🔥 *¡COMBO AREPERO FAMILIAR EN ${settings.businessName.toUpperCase()}!* 🧀🥩🇻🇪

¿Te provoca un desayuno abundante, fresco y que rinda para toda la familia? Te armamos el combo más sabroso y económico de la zona:

📦 *EL COMBO AREPERO INCLUYE:*
• 🧀 *1/2 KG ${queso.name}* (punto ideal de sal, suave y perfecto para rallar)
• 🥩 *300g ${jamon.name}* (en lonjitas recién cortadas)
• 🌽 *1 Paquete ${harina.name}*

━━━━━━━━━━━━━━━━━━━━
💰 *PRECIO ESPECIAL DEL COMBO:*
👉 *Solo $${priceUSD.toFixed(2)} USD* (~${formatVES(priceVES)} Bs. Tasa BCV)
_(Ahorras comprando el combo completo)_
━━━━━━━━━━━━━━━━━━━━

🛵 *Aparta el tuyo antes de que se agote:*
📍 Visítanos en: ${settings.address}
📲 Escríbenos directamente a este WhatsApp para tener tu pedido listo en mostrador.

¡Te esperamos con la mejor atención y calidad de siempre! ✨❤️`,
      shortSocialCopy: `🧀🥩 ¡COMBO AREPERO EN PROMO! 1/2 kg ${queso.name} + 300g ${jamon.name} + ${harina.name} por solo $${priceUSD.toFixed(2)} en ${settings.businessName}. ¡Pide el tuyo por WhatsApp! 📲`,
      createdAt: now.toISOString(),
      isActive: true,
    };
  }

  // 2. Parrilla / Fin de Semana / Compartir
  if (options?.customType === 'fin_de_semana' || q.includes('parrilla') || q.includes('finde') || q.includes('fin de semana') || q.includes('picadera')) {
    const priceUSD = 11.90;
    const priceVES = priceUSD * bcv;
    return {
      id: `promo-${Date.now()}`,
      title: `Combo Picadera & Parrilla (${tocineta.name} + Embutidos Especiales)`,
      category: 'fin_de_semana',
      headline: `🥓🍻 ¿PLAN DE FIN DE SEMANA? ¡TENEMOS LA MEJOR PICADERA CHARCUTERA! 🧀`,
      estimatedPriceUSD: priceUSD,
      discountOrPrice: `$${priceUSD.toFixed(2)} USD (~${formatVES(priceVES)} Bs.)`,
      targetAudience: 'Reuniones de amigos, parrilladas y picaderas de fin de semana',
      validUntil: 'Válido viernes, sábado y domingo',
      suggestedProducts: [tocineta.name, queso.name],
      bodyWhatsApp: `🥓🍻 *¿PLAN DE PARRILLA O COMPARTIR FAMILIAR?* 🧀🥩

Este fin de semana en *${settings.businessName}* te tenemos la picadera perfecta para acompañar tus bebidas y compartir con los tuyos:

🍢 *EL PACK PICADERA INCLUYE:*
• 🥓 *250g ${tocineta.name}* (ahumadita y lista para dorar crujiente)
• 🌭 *350g Embutidos y Salchichas Especiales*
• 🧀 *250g Queso Amarillo o Gouda* en cubos perfectos

━━━━━━━━━━━━━━━━━━━━
💰 *PRECIO ESPECIAL DE FIN DE SEMANA:*
👉 *Solo $${priceUSD.toFixed(2)} USD* (~${formatVES(priceVES)} Bs. BCV)
━━━━━━━━━━━━━━━━━━━━

📍 Búscalo en: ${settings.address}
📲 Envíanos un mensaje para reservar tu picada antes de que se agote. ¡Sabor insuperable garantizado! ✨🍺`,
      shortSocialCopy: `🥓🍻 ¡La mejor picadera charcutera para tu fin de semana por solo $${priceUSD.toFixed(2)} en ${settings.businessName}! Haz tu pedido al WhatsApp. 🧀`,
      createdAt: now.toISOString(),
      isActive: true,
    };
  }

  // 3. Oferta Relámpago en Queso o Producto Específico
  const targetProduct = options?.targetProductId
    ? products.find((p) => p.id === options.targetProductId) || queso
    : queso;

  const originalPrice = targetProduct.priceUSD;
  const promoPriceUSD = Math.round(originalPrice * 0.88 * 100) / 100;
  const promoPriceVES = promoPriceUSD * bcv;

  return {
    id: `promo-${Date.now()}`,
    title: `Oferta Relámpago: ${targetProduct.name} al Mejor Precio`,
    category: 'oferta_relampago',
    headline: `⚡ ¡OFERTA RELÁMPAGO EN ${targetProduct.name.toUpperCase()}! 🧀✨`,
    estimatedPriceUSD: promoPriceUSD,
    discountOrPrice: `$${promoPriceUSD.toFixed(2)} / ${targetProduct.unit} (Antes $${originalPrice.toFixed(2)})`,
    targetAudience: 'Clientes del sector y compradores habituales',
    validUntil: 'Válido por 48 horas o hasta agotar stock',
    suggestedProducts: [targetProduct.name],
    bodyWhatsApp: `⚡ *¡OFERTA RELÁMPAGO: ${targetProduct.name.toUpperCase()} FRESQUITO!* 🧀✨

Acaba de llegar lote especial a *${settings.businessName}* con la máxima frescura, textura ideal y el punto exacto de sabor que buscas:

━━━━━━━━━━━━━━━━━━━━
🔥 *PRECIO ESPECIAL REBAJADO:*
👉 *Solo $${promoPriceUSD.toFixed(2)} USD por ${targetProduct.unit}* (Precio regular: $${originalPrice.toFixed(2)})
🇻🇪 *Equivalente en Bolívares:* ~${formatVES(promoPriceVES)} Bs. a Tasa Oficial BCV
━━━━━━━━━━━━━━━━━━━━

🚨 *Atención:* Válido únicamente hasta agotar la existencia en mostrador.
📍 Visítanos en: ${settings.address}
📲 ¿Quieres que te lo apartemos rebanado o entero? ¡Respóndenos a este mensaje de inmediato! 🛵✨`,
    shortSocialCopy: `⚡ ¡REBAJA RELÁMPAGO! ${targetProduct.name} a $${promoPriceUSD.toFixed(2)}/${targetProduct.unit} en ${settings.businessName}. ¡Aprovecha hoy mismo! 🧀📲`,
    createdAt: now.toISOString(),
    isActive: true,
  };
}
