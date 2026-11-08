import {
  Product,
  SaleTicket,
  RestockRecord,
  AIRestockPrediction,
  AIPatternsReport,
  RestockUrgencyLevel,
  RestockSalesTrend,
} from '../types';

/**
 * Motor de Inteligencia Artificial Básica para Análisis Predictivo de Reposición y Demanda.
 * Analiza el historial de ventas, velocidad de consumo, estacionalidad por día y
 * tiempos de reabastecimiento para predecir con exactitud cuándo y cuánto comprar.
 */

export function calculateAIRestockPredictions(
  products: Product[],
  tickets: SaleTicket[],
  restocks: RestockRecord[],
  analysisWindowDays: number = 30
): AIRestockPrediction[] {
  const now = new Date();
  const validTickets = tickets.filter((t) => !t.isVoided);

  // Filter tickets within window
  const windowStart = new Date(now.getTime() - analysisWindowDays * 24 * 60 * 60 * 1000);
  const recentTickets = validTickets.filter((t) => new Date(t.date) >= windowStart);

  // Group sales by product for velocity and trend calculation
  const productSalesMap = new Map<
    string,
    {
      totalQtyWindow: number;
      recent7DaysQty: number;
      prior7DaysQty: number;
      orderCount: number;
      lastSaleDate?: string;
    }
  >();

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  for (const t of recentTickets) {
    const ticketDate = new Date(t.date);
    for (const item of t.items) {
      const pid = item.product.id;
      const prev = productSalesMap.get(pid) || {
        totalQtyWindow: 0,
        recent7DaysQty: 0,
        prior7DaysQty: 0,
        orderCount: 0,
      };

      prev.totalQtyWindow += item.quantity;
      prev.orderCount += 1;

      if (ticketDate >= sevenDaysAgo) {
        prev.recent7DaysQty += item.quantity;
      } else if (ticketDate >= fourteenDaysAgo) {
        prev.prior7DaysQty += item.quantity;
      }

      if (!prev.lastSaleDate || ticketDate > new Date(prev.lastSaleDate)) {
        prev.lastSaleDate = t.date;
      }

      productSalesMap.set(pid, prev);
    }
  }

  // Pre-index supplier history by product
  const supplierByProductMap = new Map<
    string,
    {
      name: string;
      phone?: string;
      lastUnitCostUSD: number;
      invoiceCount: number;
    }
  >();

  for (const r of restocks) {
    const existing = supplierByProductMap.get(r.productId);
    if (!existing) {
      supplierByProductMap.set(r.productId, {
        name: r.supplierName,
        phone: r.supplierPhone,
        lastUnitCostUSD: r.unitCostUSD,
        invoiceCount: 1,
      });
    } else {
      existing.invoiceCount += 1;
      // prioritize lower cost or recent supplier
      if (r.unitCostUSD > 0 && r.unitCostUSD <= existing.lastUnitCostUSD) {
        existing.lastUnitCostUSD = r.unitCostUSD;
        existing.name = r.supplierName;
        if (r.supplierPhone) existing.phone = r.supplierPhone;
      }
    }
  }

  const effectiveDays = Math.max(1, analysisWindowDays);

  const predictions: AIRestockPrediction[] = products.map((prod) => {
    const stats = productSalesMap.get(prod.id);
    const totalQty = stats?.totalQtyWindow || 0;

    // Daily sales rate (weighted with recent 7 days)
    const rawDailyRate = totalQty / effectiveDays;
    const recentDailyRate = (stats?.recent7DaysQty || 0) / 7;
    // Weighted combination: 60% recent week + 40% window average
    const dailySalesRate =
      recentDailyRate > 0
        ? Math.round((recentDailyRate * 0.6 + rawDailyRate * 0.4) * 1000) / 1000
        : Math.round(rawDailyRate * 1000) / 1000;

    const weeklySalesRate = Math.round(dailySalesRate * 7 * 1000) / 1000;

    // Determine sales trend
    let salesTrend: RestockSalesTrend = 'stable';
    if (stats && stats.prior7DaysQty > 0) {
      const growth = (stats.recent7DaysQty - stats.prior7DaysQty) / stats.prior7DaysQty;
      if (growth > 0.15) salesTrend = 'accelerating';
      else if (growth < -0.15) salesTrend = 'declining';
    } else if (stats && stats.recent7DaysQty > 0) {
      salesTrend = 'accelerating';
    }

    // Runway (Days of stock left)
    let daysOfStockLeft = 999;
    if (dailySalesRate > 0.0001) {
      daysOfStockLeft = Math.round((prod.stock / dailySalesRate) * 10) / 10;
    } else if (prod.stock <= 0) {
      daysOfStockLeft = 0;
    }

    // Predicted depletion date
    let predictedDepletionDate = 'Sin fecha inmediata';
    if (daysOfStockLeft < 365) {
      const depDate = new Date(now.getTime() + daysOfStockLeft * 24 * 60 * 60 * 1000);
      predictedDepletionDate = depDate.toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }

    // Urgency level
    let urgencyLevel: RestockUrgencyLevel = 'optimal';
    let estimatedStockoutRiskPercent = 10;

    if (prod.stock <= 0) {
      urgencyLevel = 'critical';
      estimatedStockoutRiskPercent = 100;
    } else if (daysOfStockLeft <= 3 || prod.stock <= (prod.minStockAlert || 1)) {
      urgencyLevel = 'critical';
      estimatedStockoutRiskPercent = 95;
    } else if (daysOfStockLeft <= 7) {
      urgencyLevel = 'warning';
      estimatedStockoutRiskPercent = 65;
    } else if (dailySalesRate === 0 && prod.stock > (prod.minStockAlert || 5) * 2) {
      urgencyLevel = 'low_turnover';
      estimatedStockoutRiskPercent = 5;
    } else {
      urgencyLevel = 'optimal';
      estimatedStockoutRiskPercent = 20;
    }

    // Suggested Restock Quantity:
    // Target buffer = 10 days of sales + safety margin (3 days) - current stock
    const targetDaysCoverage = 10;
    let suggestedRestockQty = 0;
    if (dailySalesRate > 0) {
      const targetStock = dailySalesRate * targetDaysCoverage;
      suggestedRestockQty = Math.max(0, targetStock - prod.stock);
    } else if (prod.stock <= (prod.minStockAlert || 1)) {
      // Default restock buffer if no historical sales
      suggestedRestockQty = prod.unit === 'KG' ? 10 : 12;
    }

    // Rounding based on unit
    if (prod.unit === 'KG') {
      suggestedRestockQty = Math.round(suggestedRestockQty * 10) / 10;
    } else {
      suggestedRestockQty = Math.ceil(suggestedRestockQty);
    }

    // Unit cost estimation
    const unitCostUSD = prod.costUSD && prod.costUSD > 0 ? prod.costUSD : prod.priceUSD * 0.75;
    const suggestedRestockCostUSD = Math.round(suggestedRestockQty * unitCostUSD * 100) / 100;

    // Supplier match
    const suggestedSupplier = supplierByProductMap.get(prod.id);

    // AI Reasoning narrative
    let reasoning = '';
    if (prod.stock <= 0) {
      reasoning = `¡Agotado! Se han perdido ventas potenciales. Se sugiere reposición inmediata de ${suggestedRestockQty} ${prod.unit}.`;
    } else if (urgencyLevel === 'critical') {
      reasoning = `Al ritmo actual (${dailySalesRate} ${prod.unit}/día), el inventario se agotará en ${daysOfStockLeft} días. Reabastecer antes del ${predictedDepletionDate}.`;
    } else if (urgencyLevel === 'warning') {
      reasoning = `Inventario para ${daysOfStockLeft} días de operación. Momento ideal para emitir orden de compra y evitar quiebre.`;
    } else if (urgencyLevel === 'low_turnover') {
      reasoning = `Baja rotación en los últimos ${analysisWindowDays} días. Evitar compras adicionales para no inmovilizar capital.`;
    } else {
      reasoning = `Stock equilibrado para ${daysOfStockLeft} días de demanda estimada. No requiere reabastecimiento urgente.`;
    }

    return {
      productId: prod.id,
      productName: prod.name,
      category: prod.category,
      unit: prod.unit,
      emoji: prod.emoji,
      currentStock: prod.stock,
      minStockAlert: prod.minStockAlert || (prod.unit === 'KG' ? 3 : 5),
      dailySalesRate,
      weeklySalesRate,
      daysOfStockLeft,
      predictedDepletionDate,
      urgencyLevel,
      suggestedRestockQty,
      suggestedRestockCostUSD,
      estimatedStockoutRiskPercent,
      suggestedSupplier,
      salesTrend,
      reasoning,
    };
  });

  // Sort by urgency: critical first, then warning, then lowest days left
  return predictions.sort((a, b) => {
    const order: Record<RestockUrgencyLevel, number> = {
      critical: 0,
      warning: 1,
      optimal: 2,
      low_turnover: 3,
    };
    if (order[a.urgencyLevel] !== order[b.urgencyLevel]) {
      return order[a.urgencyLevel] - order[b.urgencyLevel];
    }
    return a.daysOfStockLeft - b.daysOfStockLeft;
  });
}

/**
 * Genera el informe global de patrones de compra y demanda.
 */
export function generateAIPatternsReport(
  products: Product[],
  tickets: SaleTicket[],
  restocks: RestockRecord[],
  analysisWindowDays: number = 30
): AIPatternsReport {
  const predictions = calculateAIRestockPredictions(products, tickets, restocks, analysisWindowDays);
  const validTickets = tickets.filter((t) => !t.isVoided);

  // Peak days of week analysis
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const dayVolumes = [0, 0, 0, 0, 0, 0, 0];
  let totalVolumeUSD = 0;

  for (const t of validTickets) {
    const d = new Date(t.date).getDay();
    dayCounts[d] += 1;
    dayVolumes[d] += t.totalUSD;
    totalVolumeUSD += t.totalUSD;
  }

  const peakDaysOfWeek = dayNames.map((name, idx) => ({
    dayName: name,
    ticketCount: dayCounts[idx],
    volumeUSD: Math.round(dayVolumes[idx] * 100) / 100,
    percentage:
      totalVolumeUSD > 0
        ? Math.round((dayVolumes[idx] / totalVolumeUSD) * 1000) / 10
        : 0,
  }));

  // Basket Affinities (productos que suelen comprarse juntos)
  const coOccurMap = new Map<string, number>();
  for (const t of validTickets) {
    if (t.items.length < 2) continue;
    const names = Array.from(new Set(t.items.map((i) => i.product.name))).sort();
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = `${names[i]}|||${names[j]}`;
        coOccurMap.set(key, (coOccurMap.get(key) || 0) + 1);
      }
    }
  }

  const basketAffinities = Array.from(coOccurMap.entries())
    .map(([key, count]) => {
      const [productA, productB] = key.split('|||');
      return {
        productA,
        productB,
        coOccurrenceCount: count,
        percentage:
          validTickets.length > 0
            ? Math.round((count / validTickets.length) * 1000) / 10
            : 0,
      };
    })
    .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
    .slice(0, 5);

  // Top moving products
  const topMoving = predictions
    .filter((p) => p.dailySalesRate > 0)
    .sort((a, b) => b.dailySalesRate - a.dailySalesRate)
    .slice(0, 5)
    .map((p) => ({
      productId: p.productId,
      productName: p.productName,
      emoji: p.emoji,
      unit: p.unit,
      quantitySold: Math.round(p.dailySalesRate * analysisWindowDays * 10) / 10,
      dailyVelocity: p.dailySalesRate,
    }));

  const criticalStockoutsCount = predictions.filter((p) => p.urgencyLevel === 'critical').length;
  const warningStockoutsCount = predictions.filter((p) => p.urgencyLevel === 'warning').length;
  const totalRecommendedPurchaseUSD = predictions
    .filter((p) => p.urgencyLevel === 'critical' || p.urgencyLevel === 'warning')
    .reduce((sum, p) => sum + p.suggestedRestockCostUSD, 0);

  // AI Executive Summary
  const highestDay = [...peakDaysOfWeek].sort((a, b) => b.volumeUSD - a.volumeUSD)[0];
  const criticalNames = predictions
    .filter((p) => p.urgencyLevel === 'critical')
    .map((p) => p.productName)
    .slice(0, 3)
    .join(', ');

  const aiExecutiveSummary = [
    `📊 Análisis de Demanda: Se registraron ${validTickets.length} transacciones en la ventana de ${analysisWindowDays} días, con un volumen de $${totalVolumeUSD.toFixed(2)} USD.`,
    highestDay
      ? `📅 Día Pico: El ${highestDay.dayName} concentra el ${highestDay.percentage}% del volumen semanal de ventas.`
      : '',
    criticalStockoutsCount > 0
      ? `🚨 Alerta Preventiva: Hay ${criticalStockoutsCount} producto(s) en nivel crítico (${criticalNames || 'Sin detalles'}). Se recomienda emitir reposición estimada en $${totalRecommendedPurchaseUSD.toFixed(2)} USD para evitar roturas de stock.`
      : `✅ Inventario Saludable: No se detectan quiebres críticos inmediatos en el catálogo.`,
    basketAffinities.length > 0
      ? `🛒 Patrón de Cesta: Los clientes que compran "${basketAffinities[0].productA}" suelen adquirir simultáneamente "${basketAffinities[0].productB}" (${basketAffinities[0].coOccurrenceCount} veces).`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    analyzedTicketsCount: validTickets.length,
    analyzedDaysWindow: analysisWindowDays,
    totalSalesVolumeUSD: Math.round(totalVolumeUSD * 100) / 100,
    topMovingProducts: topMoving,
    peakDaysOfWeek,
    basketAffinities,
    criticalStockoutsCount,
    warningStockoutsCount,
    totalRecommendedPurchaseUSD: Math.round(totalRecommendedPurchaseUSD * 100) / 100,
    aiExecutiveSummary,
  };
}
