// Impresión automática vía Epson ePOS-Print (SDK oficial de Epson).
//
// Cómo funciona:
//   1. Dibujamos la comanda en un <canvas> oculto, con el mismo diseño y las
//      mismas coordenadas que ya usa `generateOrderPrintHtml` en Orders.jsx
//      (mismo layout definido en comandaLayout.js, mismas posiciones de texto).
//   2. Le pasamos ese canvas al SDK de Epson (epos-2.x.js), que lo convierte
//      a formato de imagen para la impresora y lo manda por HTTP directo a
//      la IP de la impresora en la red local — sin pasar por el diálogo de
//      impresión del navegador ni por ningún servidor intermedio.
//
// Requisito: el SDK oficial de Epson debe estar cargado en la página. No lo
// incluimos aquí porque es un archivo con licencia de Epson (no se puede
// redistribuir libremente). Pasos para instalarlo:
//   1. Descargar "Epson ePOS SDK for JavaScript" desde:
//      https://download.epson-biz.com/modules/pos/index.php?page=single_soft&cid=6679&scat=57&pcat=52
//   2. Copiar el archivo `epos-2.27.0.js` (o la versión más reciente) a
//      client-admin/public/vendor/epos-2.27.0.js
//   3. Ya está referenciado en index.html (ver comentario ahí).
//
// Nota: si el SDK no está cargado (por ejemplo, mientras aún no tienes las
// impresoras), estas funciones fallan de forma controlada y Orders.jsx cae
// de vuelta al método anterior (window.print()).

import {
  TEMPLATE_PX,
  HEADER_IMAGE_URL,
  COLS_PX,
  META_FONT_PX,
  COLUMNS_HEADER_FONT_PX,
  ROW_FONT_PX,
  ROW_LINE_HEIGHT_PX,
  TOTALS_LABEL_FONT_PX,
  TOTALS_AMOUNT_FONT_PX,
  A_PAGAR_LABEL_FONT_PX,
  A_PAGAR_AMOUNT_FONT_PX,
  OBSERVATIONS_FONT_PX,
  TOGO_FONT_PX,
  TOGO_LABEL,
  createTextMeasurer,
  buildComandaLayout,
} from './comandaLayout.js';

let cachedHeaderImage = null;
const loadHeaderImage = () =>
  new Promise((resolve, reject) => {
    if (cachedHeaderImage) return resolve(cachedHeaderImage);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedHeaderImage = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = HEADER_IMAGE_URL;
  });

/** Reparte `text` en varias líneas de máximo `maxWidth` px, para el canvas. */
const wrapText = (ctx, text, maxWidth) => {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  });
  if (current) lines.push(current);
  return lines;
};

/**
 * Dibuja la comanda (mismo diseño limpio que la versión impresa por
 * window.print() en Orders.jsx) en un canvas y lo devuelve listo para
 * mandarlo a la impresora.
 */
export const buildTicketCanvas = async (order, scope, { isDrinkItem }) => {
  const header = await loadHeaderImage();
  // Mismo measurer (mismo font/tamaño) que usa buildComandaLayout para
  // decidir dónde partir los nombres largos en 2 líneas, así el cálculo de
  // posiciones y el dibujo real quedan siempre de acuerdo.
  const measureTextWidth = createTextMeasurer(ROW_FONT_PX, true);
  const layout = buildComandaLayout(order, scope, isDrinkItem, measureTextWidth);

  const canvas = document.createElement('canvas');
  canvas.width = TEMPLATE_PX.width;
  canvas.height = layout.pageHeightPx;
  const ctx = canvas.getContext('2d');

  // Fondo blanco + header de marca (logo + nombre del restaurante)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(header, 0, 0, canvas.width, layout.headerHeightPx);

  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  const drawText = (text, x, y, { fontPx = 12, bold = true, align = 'left' } = {}) => {
    ctx.font = `${bold ? '700' : '400'} ${fontPx}px Arial`;
    ctx.textAlign = align;
    ctx.fillText(String(text ?? ''), x, y);
  };
  const colCenter = ([left, right]) => (left + right) / 2;

  // Aviso "PARA LLEVAR": solo se dibuja si el pedido lo tiene marcado.
  if (layout.isToGo) {
    drawText(TOGO_LABEL, canvas.width / 2, layout.toGoBannerTop, { fontPx: TOGO_FONT_PX, align: 'center' });
  }

  // Mesero / No. Pedido / Fecha / Mesa
  layout.metaRows.forEach((row) => {
    drawText(`${row.label} ${row.value}`, layout.marginX, row.top, { fontPx: META_FONT_PX });
  });

  // Separador punteado
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(layout.marginX - 16, layout.dottedLineY);
  ctx.lineTo(layout.rightX + 16, layout.dottedLineY);
  ctx.stroke();
  ctx.restore();

  // Encabezado de columnas (sin "Precio (Q)": ya no se imprime el precio
  // unitario en ninguna comanda, ni cocina ni bebidas).
  drawText('Producto', COLS_PX.producto[0], layout.columnsHeaderTop, { fontPx: COLUMNS_HEADER_FONT_PX, align: 'left' });
  drawText('Cant.', colCenter(COLS_PX.cantidad), layout.columnsHeaderTop, { fontPx: COLUMNS_HEADER_FONT_PX, align: 'center' });
  drawText('Total (Q)', COLS_PX.total[1], layout.columnsHeaderTop, { fontPx: COLUMNS_HEADER_FONT_PX, align: 'right' });

  // Artículos
  if (layout.itemsEmpty) {
    drawText('Sin artículos', COLS_PX.producto[0], layout.items[0]?.top ?? layout.columnsHeaderTop + 42, {
      fontPx: ROW_FONT_PX,
      bold: false,
    });
  } else {
    layout.items.forEach((item) => {
      drawText(item.quantity, colCenter(COLS_PX.cantidad), item.top, { fontPx: ROW_FONT_PX, align: 'center' });
      // El nombre puede venir partido en 1 o 2 líneas (ver wrapProductName
      // en comandaLayout.js): se dibuja línea por línea para que nunca se
      // corra por encima de las columnas de Cant./Total.
      (item.nameLines || [item.name]).forEach((line, lineIndex) => {
        drawText(line, COLS_PX.producto[0], item.top + lineIndex * ROW_LINE_HEIGHT_PX, {
          fontPx: ROW_FONT_PX,
          align: 'left',
          bold: true,
        });
      });
      drawText(item.total, COLS_PX.total[1], item.top, { fontPx: ROW_FONT_PX, align: 'right' });
    });
  }

  // Barra separadora + totales (Total / A pagar): SOLO en comandas de
  // bebidas o comanda completa (ver showTotals en comandaLayout.js). La
  // comanda de cocina termina justo después de los artículos.
  if (layout.showTotals) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, layout.blackBarTop, canvas.width, layout.blackBarHeight);

    // Cada uno en su propia fila de ancho completo (marginX -> rightX): con
    // la letra al doble ya no caben lado a lado, así que "A pagar:" va una
    // fila abajo de "Total:".
    drawText(layout.totalLabel, layout.marginX, layout.totalsTop, { fontPx: TOTALS_LABEL_FONT_PX });
    drawText(layout.totalValue, layout.rightX, layout.totalsTop, { fontPx: TOTALS_AMOUNT_FONT_PX, align: 'right', bold: false });

    drawText(layout.aPagarLabel, layout.marginX, layout.aPagarTop, { fontPx: A_PAGAR_LABEL_FONT_PX });
    drawText(layout.aPagarValue, layout.rightX, layout.aPagarTop, {
      fontPx: A_PAGAR_AMOUNT_FONT_PX,
      align: 'right',
    });
  }

  // Observaciones (con salto de línea si no caben en una sola)
  if (layout.observations) {
    ctx.font = `700 ${OBSERVATIONS_FONT_PX}px Arial`;
    const maxWidth = layout.rightX - layout.marginX;
    const lines = wrapText(ctx, `Observaciones: ${layout.observations}`, maxWidth);
    lines.forEach((line, index) => {
      drawText(line, layout.marginX, layout.observationsTop + index * (OBSERVATIONS_FONT_PX + 10), {
        fontPx: OBSERVATIONS_FONT_PX,
        align: 'left',
      });
    });
  }

  return canvas;
};

/**
 * Manda el canvas ya armado a una impresora Epson por ePOS-Print, vía
 * la IP local de la impresora (no pasa por el backend en Render).
 *
 * ⚠️ Los nombres exactos de métodos del objeto `window.epson` (ePOSDevice,
 * createDevice, addImage, etc.) deben confirmarse contra el manual que
 * viene dentro del ZIP del SDK (ePOS_SDK_JavaScript_um_en_revx.pdf) una vez
 * que lo descargues — el patrón de abajo sigue la forma estándar documentada
 * por Epson, pero conviene probarlo contra una impresora real antes de
 * confiar en él en producción.
 */
// NOTA IMPORTANTE (agosto 2026): NO usar ePOSDevice.connect()/createDevice()
// aquí. Ese método del SDK asume una impresora "inteligente" (TM-i / TM-m30)
// con servidor WebSocket propio, y además fuerza HTTPS internamente para
// cualquier puerto distinto de 8008 (protocol = port===8008 ? "http" : "https").
// La TM-T20IV-SP (y la mayoría de impresoras Epson de red estándar) NO tiene
// ese servidor WebSocket: solo expone el endpoint HTTP simple de ePOS-Print
// en el puerto 80/443 (`/cgi-bin/epos/service.cgi`). Por eso usamos la clase
// CanvasPrint, que manda el ticket por un POST/XHR normal a esa URL, sin pasar
// por el socket ni por la lógica de puertos de ePOSDevice.
// Ancho máximo imprimible de la TM-T20IV-SP con papel de 80mm: 576 puntos
// (48 columnas x 12pt = 576, o 64 columnas x 9pt = 576 — confirmado por la
// hoja de especificaciones de Epson). Cualquier imagen más ancha que esto
// no cabe en el cabezal de impresión: la impresora responde success="true"
// (la petición SOAP es válida) pero no imprime nada físico, porque el
// firmware no puede colocar el raster fuera del ancho del papel.
// Epson además recomienda que el ancho sea múltiplo de 8 para impresión
// rápida — 576 ya lo es.
const PRINTER_MAX_WIDTH_PX = 576;

/**
 * Red de seguridad: si el canvas viniera más ancho que lo que la impresora
 * puede imprimir, lo reescala manteniendo proporción a PRINTER_MAX_WIDTH_PX.
 * En condiciones normales esto ya NO debería ejecutarse: `comandaLayout.js`
 * dibuja el ticket directamente a TEMPLATE_PX.width = 576 (== este mismo
 * límite), así el texto se dibuja una sola vez a su tamaño final y no se
 * reescala/difumina después de rasterizado (que era la causa de las letras
 * borrosas en el ticket impreso). Si en el futuro cambia TEMPLATE_PX.width,
 * este reescalado sigue funcionando como respaldo, pero solo como último
 * recurso: siempre es preferible que el layout ya venga al ancho correcto.
 */
const scaleCanvasForPrinter = (canvas, maxWidth = PRINTER_MAX_WIDTH_PX) => {
  if (canvas.width <= maxWidth) return canvas;

  const scale = maxWidth / canvas.width;
  const scaledWidth = maxWidth;
  // Alto también debe quedar en un entero; no hace falta que sea múltiplo de 8.
  const scaledHeight = Math.round(canvas.height * scale);

  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = scaledWidth;
  scaledCanvas.height = scaledHeight;
  const ctx = scaledCanvas.getContext('2d');
  // Suaviza el reescalado para que el texto no quede pixelado/ilegible.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);

  return scaledCanvas;
};

export const sendCanvasToPrinter = (canvas, { ip, port = 80 }) =>
  new Promise((resolve, reject) => {
    if (!ip) {
      reject(new Error('No hay IP de impresora configurada.'));
      return;
    }
    if (typeof window === 'undefined' || !window.epson) {
      reject(new Error('El SDK de Epson (epos-2.x.js) no está cargado. Revisa index.html.'));
      return;
    }

    try {
      const protocol = Number(port) === 443 ? 'https' : 'http';
      const portSuffix = (protocol === 'http' && Number(port) !== 80) || (protocol === 'https' && Number(port) !== 443)
        ? `:${port}`
        : '';
      const address = `${protocol}://${ip}${portSuffix}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;

      const printer = new window.epson.CanvasPrint(address);

      printer.onreceive = (res) => {
        if (res?.success) {
          resolve(res);
        } else {
          reject(new Error(`La impresora ${ip} respondió con error: ${JSON.stringify(res)}`));
        }
      };
      printer.onerror = (err) => {
        reject(new Error(`Error de impresión en ${ip}: ${JSON.stringify(err)}`));
      };

      // ⚠️ NO usar printer.print(canvas, cut, mode) aquí.
      // El SDK oficial de Epson (epos-2.27.0.js) tiene un bug: print() arma
      // bien el XML internamente (texto + imagen + corte) pero al final
      // llama a this.send(printjobid) con un solo argumento. Como
      // printjobid casi siempre es undefined, ePOSPrint.prototype.send()
      // interpreta eso como "mándame un ticket de estado vacío" (una rama
      // de código pensada para consultas de estado, no para imprimir) y
      // descarta todo el contenido armado, mandando un
      // <epos-print></epos-print> vacío a la impresora. La impresora
      // responde success="true" porque el XML es válido, pero no hay nada
      // que imprimir. Confirmado ejecutando el SDK real con un canvas de
      // prueba: print() manda 217 caracteres vacíos; el workaround de abajo
      // manda el XML completo (~120KB) con la imagen adentro.
      //
      // El workaround: replicamos manualmente lo que hace print() por
      // dentro, pero llamamos a send() pasándole el XML YA ARMADO como
      // string. Esto evita la rama rota, porque send() detecta que el
      // primer argumento ya empieza con "<epos" y lo manda tal cual.
      const printableCanvas = scaleCanvasForPrinter(canvas);
      printer.addTextAlign(printer.align);
      printer.addImage(
        printableCanvas.getContext('2d'),
        0,
        0,
        printableCanvas.width,
        printableCanvas.height,
        printer.color,
        printer.MODE_MONO
      );
      printer.addCut(printer.CUT_FEED);
      printer.send(printer.toString());
    } catch (err) {
      reject(err);
    }
  });

/**
 * Punto de entrada usado por Orders.jsx: arma el ticket y lo manda a la
 * impresora indicada para ese "scope" (kitchen / bebidas).
 */
export const printToEposStation = async (order, scope, printerConfig, helpers) => {
  const canvas = await buildTicketCanvas(order, scope, helpers);
  return sendCanvasToPrinter(canvas, printerConfig);
};