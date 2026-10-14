import { AppSettings, SaleTicket, ZReportData } from '../types';
import { formatQuantity, formatUSD, formatVES } from './storage';
import { findFidelisProfile, loadFidelisProfiles } from './fidelis';

// Bluetooth ESC/POS Standard Services & Characteristics
const BLUETOOTH_PRINT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
  '0000e781-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

/**
 * Renders a pixel-perfect, high-contrast thermal receipt onto an HTML5 Canvas
 * and returns the canvas element.
 */
export function generateReceiptCanvas(ticket: SaleTicket, settings: AppSettings): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Thermal width: 576px (corresponds to standard 80mm roll at 203 DPI, or crisp 2x 58mm)
  const width = 576;
  const paddingX = 28;
  const contentWidth = width - paddingX * 2;

  // Calculate dynamic canvas height
  let estimatedHeight = 380; // Header & customer info
  estimatedHeight += ticket.items.length * 52; // Items table
  estimatedHeight += 180; // Totals & rates
  if (ticket.paymentSplits && ticket.paymentSplits.length > 0) {
    estimatedHeight += ticket.paymentSplits.length * 28 + 40;
  } else {
    estimatedHeight += 60;
  }
  if (ticket.pendingUSD > 0.001 || ticket.paymentMethod === 'fiado') {
    estimatedHeight += 70;
  }
  if (ticket.isVoided) {
    estimatedHeight += 80;
  }

  // Check if customer has a Fidelis loyalty profile
  const fidelisProfiles = loadFidelisProfiles();
  const fidelisCustomer = findFidelisProfile(
    { cedula: ticket.customerCedula, phone: ticket.customerPhone, name: ticket.customerName },
    fidelisProfiles
  );
  if (fidelisCustomer) {
    estimatedHeight += 120;
  }

  estimatedHeight += 240; // Barcode & footer

  canvas.width = width;
  canvas.height = estimatedHeight;

  // Background: Solid crisp white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, estimatedHeight);

  // Set font defaults: Crisp high-contrast thermal typography
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  let y = 30;

  // Helper for drawing horizontal dashed thermal line
  const drawDashedDivider = (pattern = '-') => {
    ctx.font = '16px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    const repeatCount = 46;
    ctx.fillText(pattern.repeat(repeatCount), width / 2, y);
    y += 24;
  };

  // Helper for drawing double divider
  const drawDoubleDivider = () => {
    ctx.font = 'bold 16px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('='.repeat(46), width / 2, y);
    y += 24;
  };

  // 1. BUSINESS HEADER
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px "Courier New", Courier, monospace';
  ctx.fillText(settings.businessName.toUpperCase(), width / 2, y);
  y += 34;

  ctx.font = 'bold 17px "Courier New", Courier, monospace';
  ctx.fillText(`RIF: ${settings.rif.toUpperCase()}`, width / 2, y);
  y += 24;

  ctx.font = '15px "Courier New", Courier, monospace';
  ctx.fillText(`TEL: ${settings.phone}`, width / 2, y);
  y += 22;

  if (settings.address) {
    ctx.font = '13px "Courier New", Courier, monospace';
    // Split long address if needed
    const addr = settings.address.length > 50 ? settings.address.substring(0, 48) + '...' : settings.address;
    ctx.fillText(addr, width / 2, y);
    y += 22;
  }

  y += 6;
  drawDashedDivider();

  // 2. VOIDED / CANCELLED WATERMARK / BANNER IF APPLICABLE
  if (ticket.isVoided) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(paddingX, y, contentWidth, 36);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "Courier New", Courier, monospace';
    ctx.fillText('*** FACTURA ANULADA / MALA ***', width / 2, y + 8);
    ctx.fillStyle = '#000000';
    y += 44;
    if (ticket.voidReason) {
      ctx.textAlign = 'center';
      ctx.font = 'italic 13px "Courier New", Courier, monospace';
      ctx.fillText(`Motivo: ${ticket.voidReason}`, width / 2, y);
      y += 22;
    }
    drawDashedDivider();
  }

  // 3. TICKET METADATA
  const dateFormatted = new Date(ticket.date).toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  ctx.textAlign = 'left';
  ctx.font = 'bold 18px "Courier New", Courier, monospace';
  ctx.fillText(`FACTURA / TICKET #: ${ticket.ticketNumber}`, paddingX, y);
  y += 26;

  ctx.font = '15px "Courier New", Courier, monospace';
  ctx.fillText(`FECHA: ${dateFormatted}`, paddingX, y);
  y += 22;

  ctx.fillText(`CLIENTE: ${ticket.customerName.toUpperCase()}`, paddingX, y);
  y += 22;

  if (ticket.customerCedula && ticket.customerCedula !== 'V-00000000') {
    ctx.fillText(`CÉDULA / RIF: ${ticket.customerCedula}`, paddingX, y);
    y += 22;
  }

  if (ticket.customerPhone) {
    ctx.fillText(`TELÉFONO: ${ticket.customerPhone}`, paddingX, y);
    y += 22;
  }

  y += 6;
  drawDashedDivider();

  // 4. ITEMS TABLE HEADERS
  ctx.font = 'bold 15px "Courier New", Courier, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CANT / DESCRIPCIÓN', paddingX, y);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL USD', width - paddingX, y);
  y += 22;
  drawDashedDivider('.');

  // 5. ITEMS ROWS
  for (const item of ticket.items) {
    ctx.font = 'bold 15px "Courier New", Courier, monospace';
    ctx.textAlign = 'left';

    // Product name (truncate to fit line)
    const maxChars = 34;
    const nameStr = item.product.name.length > maxChars 
      ? item.product.name.substring(0, maxChars - 2) + '..' 
      : item.product.name;
    ctx.fillText(nameStr, paddingX, y);

    // Total USD on right
    ctx.textAlign = 'right';
    ctx.fillText(`$${item.totalUSD.toFixed(2)}`, width - paddingX, y);
    y += 20;

    // Sub-line: Quantity, unit price, and equivalent in Bs.
    ctx.font = '13px "Courier New", Courier, monospace';
    ctx.textAlign = 'left';
    const qtyStr = formatQuantity(item.quantity, item.product.unit);
    const unitPriceStr = `$${item.unitPriceUSD.toFixed(2)}/${item.product.unit}`;
    ctx.fillText(` ${qtyStr} x ${unitPriceStr}`, paddingX, y);

    ctx.textAlign = 'right';
    ctx.fillText(`(Bs. ${item.totalVES.toFixed(2)})`, width - paddingX, y);
    y += 24;
  }

  drawDoubleDivider();

  // 6. TOTALS & EXCHANGE RATES
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px "Courier New", Courier, monospace';
  ctx.fillText('TOTAL USD:', paddingX, y);
  ctx.textAlign = 'right';
  ctx.fillText(`$ ${ticket.totalUSD.toFixed(2)}`, width - paddingX, y);
  y += 30;

  ctx.textAlign = 'left';
  ctx.font = 'bold 18px "Courier New", Courier, monospace';
  ctx.fillText('TOTAL BOLÍVARES:', paddingX, y);
  ctx.textAlign = 'right';
  ctx.fillText(`Bs. ${ticket.totalVES.toFixed(2)}`, width - paddingX, y);
  y += 28;

  // Show official BCV rate ONLY (preferential rate MUST NOT appear on invoice)
  ctx.font = '14px "Courier New", Courier, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('• Tasa Oficial BCV:', paddingX, y);
  ctx.textAlign = 'right';
  ctx.fillText(`Bs. ${ticket.bcvRate.toFixed(2)} / $`, width - paddingX, y);
  y += 20;

  drawDashedDivider();

  // 7. PAYMENT METHOD BREAKDOWN (Single vs Mixed)
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px "Courier New", Courier, monospace';

  if (ticket.paymentMethod === 'mixed' && ticket.paymentSplits && ticket.paymentSplits.length > 0) {
    ctx.fillText('MODALIDAD: PAGO MIXTO (DETALLE)', paddingX, y);
    y += 22;

    ctx.font = '14px "Courier New", Courier, monospace';
    for (const split of ticket.paymentSplits) {
      let methodName = 'Pago';
      if (split.method === 'cash_usd') methodName = '💵 Efectivo $ USD';
      else if (split.method === 'pago_movil') methodName = '📱 Pago Móvil';
      else if (split.method === 'punto') methodName = '💳 Punto de Venta';
      else if (split.method === 'cash_ves') methodName = '🇻🇪 Efectivo Bolívares';
      else if (split.method === 'fiado') methodName = '⚠️ Saldo a Crédito (Fiado)';

      ctx.textAlign = 'left';
      ctx.fillText(` • ${methodName}:`, paddingX + 8, y);
      ctx.textAlign = 'right';
      ctx.fillText(`$${split.amountUSD.toFixed(2)} (~Bs. ${split.amountVES.toFixed(2)})`, width - paddingX, y);
      y += 22;
    }
  } else {
    let methodTitle = 'CONTADO';
    if (ticket.paymentMethod === 'cash_usd') methodTitle = 'EFECTIVO $ USD';
    else if (ticket.paymentMethod === 'pago_movil') methodTitle = 'PAGO MÓVIL';
    else if (ticket.paymentMethod === 'punto') methodTitle = 'PUNTO DE VENTA';
    else if (ticket.paymentMethod === 'cash_ves') methodTitle = 'EFECTIVO BOLÍVARES';
    else if (ticket.paymentMethod === 'fiado') methodTitle = 'VENTA A CRÉDITO (FIADO)';

    ctx.fillText(`MODALIDAD: ${methodTitle}`, paddingX, y);
    y += 24;
  }

  // If debt / fiado remaining
  if (ticket.pendingUSD > 0.001 || ticket.paymentMethod === 'fiado') {
    y += 4;
    ctx.fillStyle = '#000000';
    ctx.fillRect(paddingX, y, contentWidth, 32);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px "Courier New", Courier, monospace';
    ctx.fillText(`SALDO FIADO PENDIENTE: $ ${ticket.pendingUSD.toFixed(2)} (~Bs. ${ticket.pendingVES.toFixed(2)})`, width / 2, y + 8);
    ctx.fillStyle = '#000000';
    y += 40;
  }

  // 7.5. FIDELIS LOYALTY STATUS (IF REGISTERED)
  if (fidelisCustomer) {
    drawDashedDivider();
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px "Courier New", Courier, monospace';
    ctx.fillText('★ PROGRAMA DE RECOMPENSAS FIDELIS ★', width / 2, y);
    y += 22;

    ctx.textAlign = 'left';
    ctx.font = '13px "Courier New", Courier, monospace';
    ctx.fillText(`• Sellos de Recurrencia: ${fidelisCustomer.stampsCount}/10 Sellos`, paddingX, y);
    y += 18;
    ctx.fillText(`• Compras de Alto Valor (≥$18): ${fidelisCustomer.highValueCount}/4 Compras`, paddingX, y);
    y += 20;

    if (fidelisCustomer.stampsCount >= 10 || fidelisCustomer.highValueCount >= 4) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px "Courier New", Courier, monospace';
      ctx.fillText('¡FELICIDADES! TIENE RECOMPENSA LISTA PARA CANJEAR', width / 2, y);
      y += 20;
    }
  }

  drawDashedDivider();

  // 8. BARCODE & FOOTER
  y += 6;
  // Draw simulated barcode lines
  const barcodeX = paddingX + 40;
  const barcodeWidth = contentWidth - 80;
  const barcodeHeight = 38;
  const barPattern = [3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 1, 2, 3, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 4, 1, 2, 3, 4, 2, 1, 3, 1, 2];
  let curX = barcodeX;
  const totalSlots = barPattern.reduce((a, b) => a + b, 0);
  const slotWidth = barcodeWidth / totalSlots;

  for (let i = 0; i < barPattern.length; i++) {
    const widthBar = barPattern[i] * slotWidth;
    if (i % 2 === 0) {
      ctx.fillRect(curX, y, widthBar, barcodeHeight);
    }
    curX += widthBar;
  }
  y += barcodeHeight + 8;

  ctx.textAlign = 'center';
  ctx.font = 'bold 14px "Courier New", Courier, monospace';
  ctx.fillText(`* JHOJAN-POS-${ticket.ticketNumber}-${new Date(ticket.date).getFullYear()} *`, width / 2, y);
  y += 26;

  ctx.font = 'bold 17px "Courier New", Courier, monospace';
  ctx.fillText('¡GRACIAS POR SU COMPRA!', width / 2, y);
  y += 22;

  ctx.font = '14px "Courier New", Courier, monospace';
  ctx.fillText('Calidad, frescura y el mejor precio para su hogar.', width / 2, y);
  y += 20;

  ctx.font = 'italic 12px "Courier New", Courier, monospace';
  ctx.fillText('Conserve esta factura digital en su dispositivo.', width / 2, y);
  y += 28;

  return canvas;
}

/**
 * Generates and triggers download of the ticket as a high-resolution PNG file.
 */
export function downloadReceiptPNG(ticket: SaleTicket, settings: AppSettings): string {
  const canvas = generateReceiptCanvas(ticket, settings);
  const dataUrl = canvas.toDataURL('image/png');

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `Factura_Jhojan_Ticket_${ticket.ticketNumber}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return dataUrl;
}

/**
 * Standard Thermal Printing via browser print dialog formatted specifically
 * for 58mm/80mm thermal rolls without headers, footers or margins.
 * Perfectly compatible with Android Bluetooth Print service, RawBT, iOS AirPrint, and PC Bluetooth printers.
 */
export function printReceiptThermal(ticket: SaleTicket, settings: AppSettings): void {
  const canvas = generateReceiptCanvas(ticket, settings);
  const dataUrl = canvas.toDataURL('image/png');

  // Create an isolated printable iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket #${ticket.ticketNumber} - ${settings.businessName}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
              background: #fff;
            }
            img {
              width: 100%;
              max-width: 80mm;
              display: block;
              margin: 0 auto;
            }
          }
          body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
          }
          img {
            width: 100%;
            max-width: 576px;
            display: block;
          }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" onload="window.print();" />
      </body>
    </html>
  `);
  doc.close();

  // Clean up iframe after printing
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 2000);
}

/**
 * Direct ESC/POS Bluetooth Thermal Printer connector via Web Bluetooth API.
 * Transmits initialization and text bytes directly to paired Bluetooth thermal printers.
 */
export async function printReceiptBluetoothDirect(
  ticket: SaleTicket,
  settings: AppSettings
): Promise<{ success: boolean; message: string }> {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    // Fall back to thermal print dialog
    printReceiptThermal(ticket, settings);
    return {
      success: true,
      message: 'Web Bluetooth no está soportado en este navegador. Abriendo ventana de impresión térmica compatible con Bluetooth.',
    };
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLUETOOTH_PRINT_SERVICES,
    });

    if (!device || !device.gatt) {
      throw new Error('Dispositivo no seleccionado.');
    }

    const server = await device.gatt.connect();

    // Find printable characteristic
    let printCharacteristic: any = null;
    for (const serviceUuid of BLUETOOTH_PRINT_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            printCharacteristic = char;
            break;
          }
        }
        if (printCharacteristic) break;
      } catch {
        // Continue trying next service
      }
    }

    // Build raw ESC/POS command stream
    const encoder = new TextEncoder();
    const escInit = new Uint8Array([0x1b, 0x40]); // ESC @ Initialize
    const escCenter = new Uint8Array([0x1b, 0x61, 0x01]); // ESC a 1 Center align
    const escLeft = new Uint8Array([0x1b, 0x61, 0x00]); // ESC a 0 Left align
    const escBoldOn = new Uint8Array([0x1b, 0x45, 0x01]); // Bold on
    const escBoldOff = new Uint8Array([0x1b, 0x45, 0x00]); // Bold off
    const escCut = new Uint8Array([0x1d, 0x56, 0x41, 0x10]); // GS V A 16 Cut

    let plainText = `\n${settings.businessName.toUpperCase()}\n`;
    plainText += `RIF: ${settings.rif}\n`;
    plainText += `TEL: ${settings.phone}\n`;
    plainText += `--------------------------------\n`;
    plainText += `TICKET #: ${ticket.ticketNumber}\n`;
    plainText += `FECHA: ${new Date(ticket.date).toLocaleString('es-VE')}\n`;
    plainText += `CLIENTE: ${ticket.customerName}\n`;
    if (ticket.customerPhone) plainText += `TEL: ${ticket.customerPhone}\n`;
    plainText += `--------------------------------\n`;
    plainText += `CANT  DESCRIP.            TOTAL\n`;
    plainText += `--------------------------------\n`;

    for (const it of ticket.items) {
      const q = formatQuantity(it.quantity, it.product.unit);
      plainText += `${it.product.name.slice(0, 20)}\n`;
      plainText += `  ${q} x $${it.unitPriceUSD.toFixed(2)}    $${it.totalUSD.toFixed(2)}\n`;
    }
    plainText += `================================\n`;
    plainText += `TOTAL USD:       $${ticket.totalUSD.toFixed(2)}\n`;
    plainText += `TOTAL BS:        Bs. ${ticket.totalVES.toFixed(2)}\n`;
    plainText += `Tasa BCV:        Bs. ${ticket.bcvRate.toFixed(2)}\n`;
    plainText += `--------------------------------\n`;
    plainText += `¡GRACIAS POR SU COMPRA!\n\n\n\n`;

    const textBytes = encoder.encode(plainText);

    if (printCharacteristic) {
      await printCharacteristic.writeValue(escInit);
      await printCharacteristic.writeValue(escCenter);
      await printCharacteristic.writeValue(textBytes);
      await printCharacteristic.writeValue(escCut);
      return { success: true, message: `Impreso exitosamente en ${device.name || 'Impresora Bluetooth'}` };
    } else {
      // Fallback
      printReceiptThermal(ticket, settings);
      return { success: true, message: 'Conectado a Bluetooth. Enviado a impresión térmica.' };
    }
  } catch (err: any) {
    console.warn('Bluetooth print cancelled or error:', err);
    // Open standard thermal print
    printReceiptThermal(ticket, settings);
    return {
      success: true,
      message: 'Abriendo impresión térmica (conéctala a tu impresora Bluetooth en el diálogo de impresión).',
    };
  }
}

/**
 * Generates an HTML5 Canvas rendering for the Z-Report (Cierre Diario)
 */
export function generateZReportCanvas(report: ZReportData, settings: AppSettings): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const width = 576;
  const paddingX = 28;

  // Calculate dynamic canvas height
  let estimatedHeight = 540; // Header, info, sales summary
  estimatedHeight += 240; // Income breakdown
  estimatedHeight += 180; // Expenses breakdown
  estimatedHeight += report.expensesByCategory.length * 28;
  estimatedHeight += 220; // Cash drawer arqueo & net flow
  estimatedHeight += 120 + report.productsSold.length * 36; // Products sold breakdown
  if (report.voidedTicketsList.length > 0) {
    estimatedHeight += 80 + report.voidedTicketsList.length * 28;
  }
  estimatedHeight += 180; // Footer signature & corte

  canvas.width = width;
  canvas.height = estimatedHeight;

  // Solid white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, estimatedHeight);

  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  let y = 30;

  const drawDashed = (pattern = '-') => {
    ctx.font = '16px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pattern.repeat(46), width / 2, y);
    y += 24;
  };

  const drawDouble = () => {
    ctx.font = 'bold 16px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('='.repeat(46), width / 2, y);
    y += 24;
  };

  // 1. BUSINESS HEADER
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px "Courier New", Courier, monospace';
  ctx.fillText(settings.businessName.toUpperCase(), width / 2, y);
  y += 34;

  ctx.font = 'bold 17px "Courier New", Courier, monospace';
  ctx.fillText(`RIF: ${settings.rif.toUpperCase()}`, width / 2, y);
  y += 24;

  ctx.font = '15px "Courier New", Courier, monospace';
  ctx.fillText(`TEL: ${settings.phone}`, width / 2, y);
  y += 24;

  drawDouble();

  // 2. REPORT TITLE
  ctx.font = 'bold 22px "Courier New", Courier, monospace';
  ctx.fillText('*** REPORTE Z - CIERRE DE CAJA ***', width / 2, y);
  y += 30;

  ctx.font = '15px "Courier New", Courier, monospace';
  ctx.fillText(`Período: ${report.dateRangeLabel}`, width / 2, y);
  y += 22;

  ctx.fillText(`Emisión: ${new Date(report.generatedAt).toLocaleString('es-VE')}`, width / 2, y);
  y += 22;

  ctx.fillText(`Tasa BCV Aplicada: ${formatVES(report.currentBcvRate)}/USD`, width / 2, y);
  y += 26;

  drawDashed();

  // Helper row drawer
  const drawRow = (left: string, right: string, isBold = false, size = 15) => {
    ctx.font = `${isBold ? 'bold ' : ''}${size}px "Courier New", Courier, monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(left, paddingX, y);
    ctx.textAlign = 'right';
    ctx.fillText(right, width - paddingX, y);
    y += size + 9;
  };

  // 3. SALES SUMMARY
  ctx.font = 'bold 16px "Courier New", Courier, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('1. RESUMEN DE VENTAS Y FACTURACIÓN', paddingX, y);
  y += 26;

  drawRow('Tickets Emitidos:', `${report.totalTicketsIssued} tickets`);
  if (report.firstTicketNumber && report.lastTicketNumber) {
    drawRow('Rango de Tickets:', `#${report.firstTicketNumber} al #${report.lastTicketNumber}`);
  }
  drawRow('Facturas Válidas:', `${report.validTicketsCount}`);
  if (report.voidedTicketsCount > 0) {
    drawRow('Facturas Anuladas / Malas:', `${report.voidedTicketsCount} (${formatUSD(report.voidedSalesUSD)})`);
  }
  drawRow('TOTAL VENTAS BRUTAS ($):', formatUSD(report.grossSalesUSD), true, 16);
  drawRow('TOTAL VENTAS BRUTAS (Bs):', formatVES(report.grossSalesVES), true, 16);

  drawDashed();

  // 4. INCOME CHANNELS BREAKDOWN
  ctx.font = 'bold 16px "Courier New", Courier, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('2. DESGLOSE DE INGRESOS POR MEDIO DE PAGO', paddingX, y);
  y += 26;

  drawRow('Efectivo Divisas ($ USD):', formatUSD(report.incomeCashUSD), true);
  drawRow('  Equivalente en Bs:', formatVES(report.incomeCashUSD_inVES));
  drawRow('Efectivo Bolívares (Bs):', formatVES(report.incomeCashVES), true);
  drawRow('Punto de Venta (Tarjetas Bs):', formatVES(report.incomePuntoVES), true);
  drawRow('Pago Móvil (Bs):', formatVES(report.incomePagoMovilVES), true);
  if (report.incomeFiadoUSD > 0) {
    drawRow('Créditos Otorgados (Fiados):', formatUSD(report.incomeFiadoUSD));
  }
  if (report.collectedAbonosUSD > 0) {
    drawRow('Abonos Cobrados (Deudas recuperadas):', formatUSD(report.collectedAbonosUSD));
  }

  drawDashed();

  // 5. EXPENSES BREAKDOWN
  ctx.font = 'bold 16px "Courier New", Courier, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('3. REGISTRO DE EGRESOS Y GASTOS OPERATIVOS', paddingX, y);
  y += 26;

  drawRow('Total Registros de Gasto:', `${report.expensesCount} egresos`);
  drawRow('TOTAL EGRESOS ($ USD):', `-${formatUSD(report.totalExpensesUSD)}`, true, 16);
  drawRow('TOTAL EGRESOS (Bs VES):', `-${formatVES(report.totalExpensesVES)}`, true, 16);

  drawRow('  Salida Efectivo $:', `-${formatUSD(report.expensesCashUSD)}`);
  drawRow('  Salida Efectivo Bs:', `-${formatVES(report.expensesCashVES)}`);
  drawRow('  Salida Bancos/Pago Móvil:', `-${formatVES(report.expensesDigitalVES)}`);

  if (report.expensesByCategory.length > 0) {
    y += 6;
    ctx.font = 'bold 14px "Courier New", Courier, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Gastos por Categoría:', paddingX, y);
    y += 20;

    for (const cat of report.expensesByCategory) {
      drawRow(`  • ${cat.category.slice(0, 22)}:`, `${formatUSD(cat.totalUSD)} (${formatVES(cat.totalVES)})`, false, 13);
    }
  }

  drawDashed();

  // 6. ARQUEO & BALANCE
  ctx.font = 'bold 16px "Courier New", Courier, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('4. ARQUEO DE CAJA (FONDOS FÍSICOS ESPERADOS)', paddingX, y);
  y += 26;

  drawRow('💵 EFECTIVO $ EN GAVETA:', formatUSD(report.expectedCashDrawerUSD), true, 16);
  drawRow('🇻🇪 EFECTIVO BS EN GAVETA:', formatVES(report.expectedCashDrawerVES), true, 16);
  drawRow('💳 FONDOS EN BANCOS (Punto+PM):', formatVES(report.expectedDigitalVES), true, 15);

  y += 6;
  drawRow('FLUJO OPERATIVO NETO ($):', formatUSD(report.netOperatingFlowUSD), true, 17);
  drawRow('FLUJO OPERATIVO NETO (Bs):', formatVES(report.netOperatingFlowVES), true, 17);

  drawDashed();

  // 7. PRODUCTS BREAKDOWN (COMPRAS / VENTAS)
  ctx.font = 'bold 16px "Courier New", Courier, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('5. REPORTE DE ARTÍCULOS DESPACHADOS', paddingX, y);
  y += 26;

  drawRow('Total Volumen Despachado:', `${report.totalKilosWeight.toFixed(3)} KG + ${report.totalUnitsCount} UN`, true);
  y += 6;

  ctx.font = 'bold 13px "Courier New", Courier, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('PRODUCTO                   CANTIDAD       TOTAL $', paddingX, y);
  y += 18;

  for (const item of report.productsSold) {
    const qStr = formatQuantity(item.quantitySold, item.unit);
    const namePart = item.productName.slice(0, 22).padEnd(23, ' ');
    const qPart = qStr.padEnd(12, ' ');
    const totalPart = formatUSD(item.totalUSD).padStart(11, ' ');
    ctx.font = '13px "Courier New", Courier, monospace';
    ctx.fillText(`${namePart} ${qPart} ${totalPart}`, paddingX, y);
    y += 18;
  }

  // 8. VOIDED TICKETS IF ANY
  if (report.voidedTicketsList.length > 0) {
    drawDashed();
    ctx.font = 'bold 16px "Courier New", Courier, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('6. FACTURAS ANULADAS (MALAS)', paddingX, y);
    y += 24;

    for (const v of report.voidedTicketsList) {
      drawRow(`Ticket #${v.ticketNumber} (${v.customerName.slice(0, 15)}):`, formatUSD(v.totalUSD), false, 13);
      ctx.font = 'italic 12px "Courier New", Courier, monospace';
      ctx.fillText(`   Motivo: ${v.reason.slice(0, 45)}`, paddingX, y);
      y += 18;
    }
  }

  drawDouble();

  // 9. SIGNATURE & CUT
  ctx.textAlign = 'center';
  ctx.font = '13px "Courier New", Courier, monospace';
  y += 20;
  ctx.fillText('___________________________________', width / 2, y);
  y += 20;
  ctx.fillText('FIRMA CAJERO / RESPONSABLE DE TURNO', width / 2, y);
  y += 30;

  ctx.font = 'italic 13px "Courier New", Courier, monospace';
  ctx.fillText('SISTEMA POS CHARCUTERÍA JHOJAN C.A.', width / 2, y);
  y += 20;
  ctx.fillText('FIN DEL REPORTE Z', width / 2, y);

  return canvas;
}

/**
 * Downloads the Z-Report as a high-resolution PNG image
 */
export function downloadZReportPNG(report: ZReportData, settings: AppSettings): void {
  const canvas = generateZReportCanvas(report, settings);
  const dateStr = new Date(report.generatedAt).toISOString().slice(0, 10);
  const fileName = `Reporte-Z-${settings.businessName.replace(/[^a-zA-Z0-9]/g, '_')}-${dateStr}.png`;

  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
}

/**
 * Standard thermal print for Z-Report
 */
export function printZReportThermal(report: ZReportData, settings: AppSettings): void {
  const canvas = generateZReportCanvas(report, settings);
  const dataUrl = canvas.toDataURL('image/png');

  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.warn('Ventanas emergentes bloqueadas. Por favor permite popups para imprimir.');
      window.print();
      return;
    }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Reporte Z - ${settings.businessName}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            display: flex;
            justify-content: center;
          }
          img {
            max-width: 100%;
            width: 80mm;
            height: auto;
            display: block;
          }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" onload="window.print(); setTimeout(() => window.close(), 1000);" />
      </body>
    </html>
  `);
  printWindow.document.close();
  } catch (e) {
    console.warn('Error al abrir ventana de impresión:', e);
    window.print();
  }
}
