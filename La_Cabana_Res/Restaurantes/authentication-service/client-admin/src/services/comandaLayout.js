// Plantilla de comanda "limpia": header de marca (imagen fija) + todo lo demás
// (datos del pedido, artículos, totales) dibujado en código con tipografía
// grande y jerarquía clara. A diferencia de la plantilla anterior (una foto
// de una comanda preimpresa con casillas pequeñas), aquí SOLO el encabezado
// (logo + "LA CABAÑA RESTAURANTE") es una imagen; todo el resto se calcula
// en `buildComandaLayout` para que el ticket:
//   - use letras más grandes y con más aire (más legible en el rollo térmico)
//   - le dé prioridad visual a los datos del pedido (Mesero, No. Pedido,
//     Fecha, Mesa) en vez de a casillas y líneas de una comanda de papel
//   - crezca en alto según la cantidad de artículos, en vez de recortar o
//     apretar filas para caber en una imagen de tamaño fijo.
//
// Este módulo solo calcula POSICIONES (en px, sobre un ticket de ancho fijo
// TEMPLATE_PX.width). `eposPrint.js` las usa para dibujar en un <canvas>;
// `Orders.jsx` las usa para generar el HTML que imprime window.print().
// Mantener el layout en un solo lugar evita que las dos rutas de impresión
// se desalineen entre sí.

// IMPORTANTE — por qué el ancho es 576 y no 688:
// La impresora térmica (TM-T20IV-SP, papel de 80mm) solo puede imprimir
// 576 puntos de ancho como máximo (ver PRINTER_MAX_WIDTH_PX en eposPrint.js).
// Antes este archivo dibujaba a 688px y `eposPrint.js` reducía ese lienzo
// YA CON EL TEXTO DIBUJADO a 576px antes de mandarlo a la impresora. Ese
// paso de reducción usa interpolación ("alisado") que convierte los bordes
// nítidos de las letras en pixeles grises; como la impresora térmica solo
// puede imprimir blanco o negro puro, esos grises se convierten en un
// patrón de puntos difuso (de ahí las letras borrosas en el ticket
// impreso, aunque el encabezado con el logo se vea bien: una fotografía
// tolera ese difuminado mucho mejor que un trazo fino de texto).
// Al dibujar directamente a 576px (el tamaño real de impresión) evitamos
// ese doble reescalado: el texto se ve nítido porque se dibuja una sola
// vez, ya al tamaño final.
export const TEMPLATE_PX = { width: 576 };
export const HEADER_IMAGE_URL = '/comanda-header.jpg';
// La imagen original (comanda-header.jpg) mide 688x250px; al dibujarse en
// un lienzo de 576px de ancho hay que reducir también su alto en la misma
// proporción (576/688) para que el logo no salga achatado/deformado.
export const HEADER_HEIGHT_PX = 210;

const MARGIN_X = 28;
const RIGHT_X = TEMPLATE_PX.width - MARGIN_X; // 548

// --- Datos del pedido (Mesero / No. Pedido / Fecha / Mesa) ---
const META_TOP_PX = 226;
const META_LINE_HEIGHT_PX = 34;
export const META_FONT_PX = 20; // antes 17
const META_ROWS = 4; // Mesero, No. Pedido, Fecha, Mesa

// --- Separador punteado + encabezado de columnas ---
const DOTTED_LINE_Y_PX = META_TOP_PX + META_ROWS * META_LINE_HEIGHT_PX + 14;
const COLUMNS_HEADER_TOP_PX = DOTTED_LINE_Y_PX + 22;
export const COLUMNS_HEADER_FONT_PX = 15; // antes 14

export const COLS_PX = {
  producto: [MARGIN_X, 236],
  cantidad: [236, 304],
  precio: [304, 424],
  total: [424, RIGHT_X],
};

// --- Filas de artículos: son el dato más importante de la comanda para
// cocina/bebidas, así que llevan la letra más grande y en negrita (más
// prioridad visual que las etiquetas de encabezado o los totales). ---
const ROWS_TOP_PX = COLUMNS_HEADER_TOP_PX + 36;
export const ROW_HEIGHT_PX = 36;
export const ROW_FONT_PX = 18; // antes 14

// --- Barra + totales (sin "Descuento": solo Total y A pagar) ---
const BLACK_BAR_HEIGHT_PX = 8;
const TOTALS_GAP_PX = 34;
export const TOTALS_LABEL_FONT_PX = 17; // antes 15
export const TOTALS_AMOUNT_FONT_PX = 17; // antes 15
export const A_PAGAR_LABEL_FONT_PX = 17; // antes 15
export const A_PAGAR_AMOUNT_FONT_PX = 34; // antes 28
// Alto del bloque de totales (una sola fila: "Total:" a la izquierda y
// "A pagar:" + monto grande a la derecha).
const TOTALS_BLOCK_HEIGHT_PX = 96;

// Posiciones X de la fila de totales, en un solo lugar para que
// eposPrint.js (canvas) y Orders.jsx (HTML) no se desalineen entre sí.
export const TOTAL_VALUE_LEFT_PX = MARGIN_X + 60; // 88
export const TOTAL_VALUE_WIDTH_PX = 140;
export const TOTAL_VALUE_RIGHT_PX = TOTAL_VALUE_LEFT_PX + TOTAL_VALUE_WIDTH_PX; // 228
export const A_PAGAR_LABEL_LEFT_PX = 250;
export const A_PAGAR_VALUE_WIDTH_PX = 180;

export const OBSERVATIONS_FONT_PX = 13; // antes 11
const BOTTOM_MARGIN_PX = 40;

export const formatCurrency = (value) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value || 0));

export const getTableLabel = (order) =>
  order?.table?.name?.trim() ? order.table.name : order?.table?.number ? `Mesa ${order.table.number}` : 'Sin mesa';

export const getVisibleItems = (order, scope, isDrinkItem) => {
  const baseVisibleItems = (order.items || []).filter((item) => !item.isIncluded);
  if (scope === 'kitchen') return baseVisibleItems.filter((item) => !isDrinkItem(item) && !item.delivered);
  if (scope === 'bebidas') return baseVisibleItems.filter((item) => isDrinkItem(item) && !item.delivered);
  return baseVisibleItems;
};

/**
 * Calcula todas las posiciones (en px) del ticket para un pedido dado.
 * No dibuja nada: devuelve un objeto plano que ambas rutas de impresión
 * (canvas y HTML) consumen para pintar exactamente lo mismo.
 */
export const buildComandaLayout = (order, scope, isDrinkItem) => {
  const createdAt = new Date(order.createdAt);
  const fecha = createdAt.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
  const hora = createdAt.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

  const metaRows = [
    { label: 'Mesero:', value: order.waiter || '—' },
    { label: 'No. Pedido:', value: `${order.orderNumber || order._id || ''}` },
    { label: 'Fecha:', value: `${fecha} · ${hora}` },
    { label: 'Mesa:', value: getTableLabel(order) },
  ].map((row, index) => ({ ...row, top: META_TOP_PX + index * META_LINE_HEIGHT_PX }));

  const visibleItems = getVisibleItems(order, scope, isDrinkItem);
  const rowCount = Math.max(visibleItems.length, 1);

  const items = visibleItems.map((item, index) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price || 0);
    return {
      name: item.menuItem?.name || item.label || 'Platillo',
      quantity,
      unitPrice: formatCurrency(unitPrice),
      total: formatCurrency(unitPrice * quantity),
      top: ROWS_TOP_PX + index * ROW_HEIGHT_PX,
    };
  });

  const itemsBottom = ROWS_TOP_PX + rowCount * ROW_HEIGHT_PX;
  const blackBarTop = itemsBottom + 12;
  const totalsTop = blackBarTop + BLACK_BAR_HEIGHT_PX + TOTALS_GAP_PX;

  const observations = order.observations || '';
  const observationsTop = totalsTop + TOTALS_BLOCK_HEIGHT_PX;
  const pageHeightPx = (observations ? observationsTop + 30 : observationsTop) + BOTTOM_MARGIN_PX;

  return {
    headerHeightPx: HEADER_HEIGHT_PX,
    metaRows,
    dottedLineY: DOTTED_LINE_Y_PX,
    columnsHeaderTop: COLUMNS_HEADER_TOP_PX,
    items,
    itemsEmpty: visibleItems.length === 0,
    blackBarTop,
    blackBarHeight: BLACK_BAR_HEIGHT_PX,
    totalsTop,
    totalLabel: 'Total:',
    totalValue: formatCurrency(order.total),
    aPagarLabel: 'A pagar:',
    aPagarValue: formatCurrency(order.total),
    observations,
    observationsTop,
    pageHeightPx: Math.round(pageHeightPx),
    marginX: MARGIN_X,
    rightX: RIGHT_X,
  };
};