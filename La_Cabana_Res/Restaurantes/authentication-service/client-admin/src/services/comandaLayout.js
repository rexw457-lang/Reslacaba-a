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

// --- Aviso "PARA LLEVAR" (opcional) ---
// Solo ocupa espacio cuando el pedido es para llevar (order.isToGo). En un
// pedido normal este valor es 0 y todo el layout de abajo (Mesero/Fecha/
// Mesa, artículos, totales) queda EXACTAMENTE igual que antes, en las mismas
// posiciones de siempre.
const TOGO_BANNER_HEIGHT_PX = 44;
export const TOGO_FONT_PX = 26;
export const TOGO_LABEL = 'PARA LLEVAR';

// --- Datos del pedido (Mesero / No. Pedido / Fecha / Mesa) ---
const META_TOP_PX = 226;
const META_LINE_HEIGHT_PX = 34;
export const META_FONT_PX = 20; // antes 17
const META_ROWS = 4; // Mesero, No. Pedido, Fecha, Mesa

// --- Separador punteado + encabezado de columnas ---
// (Estos ya NO son constantes fijas: dependen de si el pedido lleva el
// aviso "PARA LLEVAR" o no, así que se recalculan dentro de
// buildComandaLayout. Se dejan aquí solo los tamaños de letra, que no
// cambian con el aviso.)
export const COLUMNS_HEADER_FONT_PX = 15; // antes 14

// Columnas más anchas que antes: con la letra más grande (ROW_FONT_PX=18 y
// COLUMNS_HEADER_FONT_PX=15) la columna "Cantidad" necesitaba más espacio o
// su encabezado se encimaba con el de "Precio (Q)" (bug visto en un ticket
// real: "CanPidad" pegado a "Precio"). Por eso "Cantidad" ahora usa la
// etiqueta corta "Cant." en el encabezado (ver eposPrint.js/Orders.jsx) y
// tiene más ancho.
export const COLS_PX = {
  producto: [MARGIN_X, 220],
  cantidad: [220, 300],
  precio: [300, 420],
  total: [420, RIGHT_X],
};

// --- Filas de artículos: son el dato más importante de la comanda para
// cocina/bebidas, así que llevan la letra más grande y en negrita (más
// prioridad visual que las etiquetas de encabezado o los totales). ---
// (ROWS_TOP_PX también se recalcula dentro de buildComandaLayout por la
// misma razón que dottedLineY/columnsHeaderTop: depende del aviso "PARA
// LLEVAR".)
export const ROW_HEIGHT_PX = 36; // alto de una fila de 1 sola línea (como antes)
export const ROW_LINE_HEIGHT_PX = 22; // separación entre líneas cuando el nombre ocupa 2 líneas
export const ROW_FONT_PX = 18; // antes 14

// Ancho disponible para el nombre del producto (un poco menos que el ancho
// real de la columna, para que no quede pegado a "Cant.").
const PRODUCT_TEXT_WIDTH_PX = COLS_PX.producto[1] - COLS_PX.producto[0] - 6;

/**
 * Crea una función de medición de texto (para saber si un nombre cabe en la
 * columna "Producto" o hay que partirlo en 2 líneas). Se apoya en un
 * <canvas> oculto solo para medir — no se dibuja nada en él — porque
 * `ctx.measureText` es la única forma confiable de saber el ancho real de
 * un texto con una tipografía y tamaño dados (contar caracteres no sirve:
 * "iiii" y "MMMM" no ocupan lo mismo).
 */
export const createTextMeasurer = (fontPx = ROW_FONT_PX, bold = true) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${bold ? '700' : '400'} ${fontPx}px Arial`;
  return (text) => ctx.measureText(String(text ?? '')).width;
};

/**
 * Reparte el nombre de un platillo en 1 o 2 líneas si no cabe en el ancho
 * de la columna "Producto". Antes el nombre se dibujaba siempre en una sola
 * línea sin límite de ancho, así que un nombre largo ("Mojarra Frita con
 * Ensalada y Tortillas Extra") se dibujaba corrido por encima de las
 * columnas "Cant." y "Precio (Q)" en vez de recortarse o bajar de línea.
 * Si aun en 2 líneas no cabe (caso extremo), la 2da línea se corta con "…".
 */
export const wrapProductName = (name, measureTextWidth, maxWidth = PRODUCT_TEXT_WIDTH_PX, maxLines = 2) => {
  const words = String(name || '').split(' ').filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const attempt = current ? `${current} ${word}` : word;
    if (measureTextWidth(attempt) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  });
  if (current) lines.push(current);
  if (lines.length === 0) lines.push('');

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let lastLine = kept[maxLines - 1];
    // Recorta caracteres hasta que "línea…" quepa en el ancho disponible.
    while (lastLine.length > 0 && measureTextWidth(`${lastLine}…`) > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    kept[maxLines - 1] = `${lastLine}…`;
    return kept;
  }
  return lines;
};

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
// (Antes el valor de "Total:" empezaba justo debajo/encima de la propia
// etiqueta "Total:" y terminaba pegado a "A pagar:" — bug visto en un
// ticket real donde salían encimados. Ahora hay más separación de ambos
// lados.)
export const TOTAL_VALUE_LEFT_PX = MARGIN_X + 100; // 128, después de "Total:"
export const TOTAL_VALUE_WIDTH_PX = 100;
export const TOTAL_VALUE_RIGHT_PX = TOTAL_VALUE_LEFT_PX + TOTAL_VALUE_WIDTH_PX; // 228
export const A_PAGAR_LABEL_LEFT_PX = 250; // 22px / ~3mm de aire tras el valor de Total
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
export const buildComandaLayout = (order, scope, isDrinkItem, measureTextWidth) => {
  const createdAt = new Date(order.createdAt);
  const fecha = createdAt.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
  const hora = createdAt.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

  // Si el pedido es para llevar, se reserva espacio extra justo debajo del
  // header para el aviso "PARA LLEVAR" y TODO lo de abajo (Mesero/Fecha/
  // Mesa, separador, artículos, totales) se recorre hacia abajo ese mismo
  // espacio. Si NO es para llevar, toGoOffset es 0 y las posiciones quedan
  // idénticas a como estaban antes de este aviso.
  const isToGo = Boolean(order?.isToGo);
  const toGoOffset = isToGo ? TOGO_BANNER_HEIGHT_PX : 0;
  const toGoBannerTop = HEADER_HEIGHT_PX + 14;

  const metaTop = META_TOP_PX + toGoOffset;
  const dottedLineY = metaTop + META_ROWS * META_LINE_HEIGHT_PX + 14;
  const columnsHeaderTop = dottedLineY + 22;
  const rowsTop = columnsHeaderTop + 36;

  const metaRows = [
    { label: 'Mesero:', value: order.waiter || '—' },
    { label: 'No. Pedido:', value: `${order.orderNumber || order._id || ''}` },
    { label: 'Fecha:', value: `${fecha} · ${hora}` },
    { label: 'Mesa:', value: getTableLabel(order) },
  ].map((row, index) => ({ ...row, top: metaTop + index * META_LINE_HEIGHT_PX }));

  const visibleItems = getVisibleItems(order, scope, isDrinkItem);
  // measureTextWidth es opcional por compatibilidad hacia atrás; si no se
  // pasa, se crea uno con la misma tipografía/tamaño con la que se dibujan
  // los nombres de los platillos (ver drawText/.row-cell: bold, ROW_FONT_PX).
  const measure = measureTextWidth || createTextMeasurer(ROW_FONT_PX, true);

  // Cada fila avanza según cuántas líneas necesitó el nombre del platillo
  // (1 línea = mismo alto de siempre; 2 líneas = fila más alta), en vez de
  // un alto fijo para todas. Así, cuando un nombre largo se parte en 2
  // líneas, el siguiente platillo se recorre hacia abajo automáticamente y
  // nunca queda encimado con "Cant."/"Precio (Q)" ni con la fila de abajo.
  let cursorTop = rowsTop;
  const items = visibleItems.map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price || 0);
    const nameLines = wrapProductName(item.menuItem?.name || item.label || 'Platillo', measure);
    const rowHeight = Math.max(ROW_HEIGHT_PX, nameLines.length * ROW_LINE_HEIGHT_PX);
    const built = {
      name: nameLines[0],
      nameLines,
      quantity,
      unitPrice: formatCurrency(unitPrice),
      total: formatCurrency(unitPrice * quantity),
      top: cursorTop,
    };
    cursorTop += rowHeight;
    return built;
  });

  const itemsBottom = visibleItems.length === 0 ? rowsTop + ROW_HEIGHT_PX : cursorTop;
  const blackBarTop = itemsBottom + 12;
  const totalsTop = blackBarTop + BLACK_BAR_HEIGHT_PX + TOTALS_GAP_PX;

  const observations = order.observations || '';
  const observationsTop = totalsTop + TOTALS_BLOCK_HEIGHT_PX;
  const pageHeightPx = (observations ? observationsTop + 30 : observationsTop) + BOTTOM_MARGIN_PX;

  return {
    headerHeightPx: HEADER_HEIGHT_PX,
    isToGo,
    toGoBannerTop,
    metaRows,
    dottedLineY,
    columnsHeaderTop,
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