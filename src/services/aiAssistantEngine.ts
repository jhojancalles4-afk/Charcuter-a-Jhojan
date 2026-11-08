import {
  AppSettings,
  DebtorCustomer,
  ExpenseRecord,
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
} from './storage';
import {
  calculateAIRestockPredictions,
  generateAIPatternsReport,
} from './restockAI';

export interface AIActionProposal {
  id: string;
  type:
    | 'set_bcv_rate'
    | 'set_pref_rate'
    | 'adjust_stock'
    | 'add_stock'
    | 'open_reminder'
    | 'navigate_tab';
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
  category?: 'demand' | 'report' | 'action' | 'general' | 'debtors' | 'inventory';
  structuredData?: {
    type: 'table' | 'cards' | 'report' | 'action_proposal';
    title?: string;
    items?: any[];
    summary?: Record<string, string | number>;
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

  // 7. Respuesta Asistencial General y Multiuso
  return {
    id: `msg-${Date.now()}`,
    sender: 'ai',
    category: 'general',
    timestamp,
    text: `Hola, soy tu **Copiloto de Inteligencia Artificial** con control y monitoreo total de **${context.settings.businessName}** 🤖🧀🥩\n\nPuedo responder preguntas y ejecutar tareas sobre cualquier parte del negocio:\n\n• 📈 **Demanda & Agotamiento:** *"¿Qué productos debo comprar esta semana?", "¿Cuáles se van a agotar primero?"*\n• 📊 **Finanzas & Ganancias:** *"Generar reporte de ventas de hoy", "¿Cuál es la utilidad neta de este mes?"*\n• 📋 **Libro de Fiados:** *"¿Quiénes me deben?", "Prepara el recordatorio para cobrar fiados"*\n• 📦 **Inventario & Stock:** *"¿Cuánto queda de queso paisa?", "Valorar inventario"* \n• ⚙️ **Parámetros Económicos:** *"Cambia la tasa BCV a 82.5", "Ajusta la tasa divisa a 85"*\n\n¿En qué te puedo ayudar hoy?`,
  };
}
