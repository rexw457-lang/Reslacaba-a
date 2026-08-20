// Impresión automática vía Epson ePOS-Print (SDK oficial de Epson).
//
// Cómo funciona:
//   1. Dibujamos la comanda en un <canvas> oculto, con el mismo diseño y las
//      mismas coordenadas que ya usa `generateOrderPrintHtml` en Orders.jsx
//      (misma plantilla comanda-template.jpg, mismas posiciones de texto).
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

const TEMPLATE_PX = { width: 688, height: 1520 };
const COMANDA_TEMPLATE_URL = '/comanda-template.jpg';

const TABLE_ROW_LINES_PX = [593, 633, 667, 698, 728, 759, 804, 835, 879, 925, 971, 1017, 1063, 1109, 1158];
const TABLE_ROWS_PRINTED = TABLE_ROW_LINES_PX.length - 1;
const TABLE_FIRST_ROW_TOP_PX = TABLE_ROW_LINES_PX[0];
const TABLE_LAST_ROW_BOTTOM_PX = TABLE_ROW_LINES_PX[TABLE_ROW_LINES_PX.length - 1];
const TABLE_ROW_HEIGHT_PX = (TABLE_LAST_ROW_BOTTOM_PX - TABLE_FIRST_ROW_TOP_PX) / TABLE_ROWS_PRINTED;
const TABLE_COLS_PX = { cantidad: [47, 170], descripcion: [170, 502], precio: [502, 640] };

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value || 0));

let cachedTemplateImage = null;
const loadTemplateImage = () =>
  new Promise((resolve, reject) => {
    if (cachedTemplateImage) return resolve(cachedTemplateImage);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedTemplateImage = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = COMANDA_TEMPLATE_URL;
  });

/**
 * Dibuja la comanda (mismo diseño que la versión impresa por window.print())
 * en un canvas y lo devuelve listo para mandarlo a la impresora.
 */
export const buildTicketCanvas = async (order, scope, { isDrinkItem }) => {
  const template = await loadTemplateImage();

  const canvas = document.createElement('canvas');
  canvas.width = TEMPLATE_PX.width;
  canvas.height = TEMPLATE_PX.height;
  const ctx = canvas.getContext('2d');

  // Fondo blanco + plantilla de la comanda
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  const drawCentered = (text, left, width, top, fontPx = 10, bold = true) => {
    ctx.font = `${bold ? '700' : '400'} ${fontPx}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(String(text ?? ''), left + width / 2, top, width);
  };
  const drawLeft = (text, left, width, top, fontPx = 8, bold = true) => {
    ctx.font = `${bold ? '600' : '400'} ${fontPx}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(String(text ?? ''), left, top, width);
  };
  const drawRight = (text, left, width, top, fontPx = 8, bold = true) => {
    ctx.font = `${bold ? '600' : '400'} ${fontPx}px Arial`;
    ctx.textAlign = 'right';
    ctx.fillText(String(text ?? ''), left + width, top, width);
  };

  const createdAt = new Date(order.createdAt);
  const day = createdAt.getDate();
  const month = createdAt.toLocaleDateString('es-GT', { month: 'long' });
  const year = createdAt.getFullYear();
  const time = createdAt.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  const tableLabel = order?.table?.name?.trim()
    ? order.table.name
    : order?.table?.number
      ? `Mesa ${order.table.number}`
      : 'Sin mesa';

  // Día / Mes / Año / Hora
  drawCentered(day, 48, 119 - 48, 433);
  drawCentered(month, 119, 194 - 119, 433);
  drawCentered(year, 194, 257 - 194, 433);
  drawCentered(time, 257, 435 - 257, 444);

  // No. de comanda (tapamos el placeholder impreso con un rectángulo blanco)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(437, 434, 640 - 437 - 2, 483 - 434);
  ctx.fillStyle = '#000000';
  drawCentered(`No.${order.orderNumber || order._id}`, 435, 640 - 435, 438, 13, true);

  // Mesa / Mesero / Personas
  drawCentered(tableLabel, 48 + 4, 170 - 48 - 6, 520, 9);
  drawCentered(order.waiter || '', 170 + 4, 502 - 170 - 8, 520, 9);
  drawCentered(order.guests || '', 502 + 4, 640 - 502 - 6, 520, 9);

  // Artículos (filtrados según la estación: cocina o bebidas)
  const baseVisibleItems = (order.items || []).filter((item) => !item.isIncluded);
  const visibleItems =
    scope === 'kitchen'
      ? baseVisibleItems.filter((item) => !isDrinkItem(item) && !item.delivered)
      : scope === 'bebidas'
        ? baseVisibleItems.filter((item) => isDrinkItem(item) && !item.delivered)
        : baseVisibleItems;

  const useRealLines = visibleItems.length <= TABLE_ROWS_PRINTED;
  const rowHeightPx = Math.min(
    TABLE_ROW_HEIGHT_PX,
    visibleItems.length > 0 ? (TABLE_LAST_ROW_BOTTOM_PX - TABLE_FIRST_ROW_TOP_PX) / visibleItems.length : TABLE_ROW_HEIGHT_PX
  );
  const rowFontPx = rowHeightPx < 30 ? 7 : 8;

  const getRowGeometry = (index) => {
    if (useRealLines) {
      const top = TABLE_ROW_LINES_PX[index];
      const bottom = TABLE_ROW_LINES_PX[index + 1];
      return { top, height: bottom - top };
    }
    const top = TABLE_FIRST_ROW_TOP_PX + index * rowHeightPx;
    return { top, height: rowHeightPx };
  };

  visibleItems.forEach((item, index) => {
    const itemName = item.menuItem?.name || item.label || 'Platillo';
    const itemTotal = formatCurrency(Number(item.price || 0) * Number(item.quantity || 0));
    const { top, height } = getRowGeometry(index);
    const rowTop = top + Math.min(11, height / 3);

    drawCentered(item.quantity, TABLE_COLS_PX.cantidad[0], TABLE_COLS_PX.cantidad[1] - TABLE_COLS_PX.cantidad[0], rowTop, rowFontPx);
    drawLeft(
      itemName,
      TABLE_COLS_PX.descripcion[0] + 4,
      TABLE_COLS_PX.descripcion[1] - TABLE_COLS_PX.descripcion[0] - 6,
      rowTop,
      rowFontPx
    );
    drawRight(itemTotal, TABLE_COLS_PX.precio[0], TABLE_COLS_PX.precio[1] - TABLE_COLS_PX.precio[0] - 3, rowTop, rowFontPx);
  });

  // Total
  drawRight(formatCurrency(order.total), 502, 640 - 502 - 3, 1170, 11);

  // Observaciones
  if (order.observations) {
    drawLeft(`Observaciones: ${order.observations}`, 47, 593, 1240, 8);
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
      const ePosDev = new window.epson.ePOSDevice();

      ePosDev.connect(ip, port, (connectResult) => {
        if (connectResult !== 'OK' && connectResult !== 'SSL_CONNECT_OK') {
          reject(new Error(`No se pudo conectar a la impresora ${ip}:${port} (${connectResult})`));
          return;
        }

        ePosDev.createDevice(
          'local_printer',
          ePosDev.DEVICE_TYPE_PRINTER,
          { crypto: false, buffer: false },
          (printer, createResult) => {
            if (createResult !== 'OK') {
              reject(new Error(`No se pudo inicializar la impresora ${ip} (${createResult})`));
              return;
            }

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

            const ctx = canvas.getContext('2d');
            printer.addImage(ctx, 0, 0, canvas.width, canvas.height, printer.COLOR_1, printer.MODE_MONO);
            printer.addCut(printer.CUT_FEED);
            printer.send();
          }
        );
      });
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
