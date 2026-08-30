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
const TOGO_BANNER_HEIGHT_PX = 88; // antes 44 (doble, letra 2x)
export const TOGO_FONT_PX = 52; // antes 26 (2x)
export const TOGO_LABEL = 'PARA LLEVAR';

// --- Datos del pedido (Mesero / No. Pedido / Fecha / Mesa) ---
const META_TOP_PX = 246; // antes 226 (+20 de aire extra bajo el header, que no cambia de tamaño)
const META_LINE_HEIGHT_PX = 68; // antes 34 (2x, para que las líneas no se encimen con la letra más grande)
export const META_FONT_PX = 40; // antes 20 (2x)
const META_ROWS = 4; // Mesero, No. Pedido, Fecha, Mesa

// --- Separador punteado + encabezado de columnas ---
// (Estos ya NO son constantes fijas: dependen de si el pedido lleva el
// aviso "PARA LLEVAR" o no, así que se recalculan dentro de
// buildComandaLayout. Se dejan aquí solo los tamaños de letra, que no
// cambian con el aviso.)
export const COLUMNS_HEADER_FONT_PX = 30; // antes 15 (2x)

// Columnas más anchas que antes: con la letra más grande (ROW_FONT_PX=18 y
// COLUMNS_HEADER_FONT_PX=15) la columna "Cantidad" necesitaba más espacio.
// Por eso "Cantidad" usa la etiqueta corta "Cant." en el encabezado (ver
// eposPrint.js/Orders.jsx) y tiene más ancho.
// Ya NO se imprime "Precio (Q)" (precio unitario) en ninguna comanda —ni
// cocina ni bebidas—, solo se pidió quitarlo del ticket. El espacio que
// antes usaba esa columna se reparte entre "Producto" (nombres más largos
// caben en una sola línea) y "Total (Q)".
// El ancho total (576px) es un límite físico de la impresora térmica (no se
// puede "agrandar" el papel).
export const COLS_PX = {
  producto: [MARGIN_X, 330],
  cantidad: [330, 420],
  total: [420, RIGHT_X],
};

// --- Filas de artículos: son el dato más importante de la comanda para
// cocina/bebidas, así que llevan la letra más grande y en negrita (más
// prioridad visual que las etiquetas de encabezado o los totales). ---
// (ROWS_TOP_PX también se recalcula dentro de buildComandaLayout por la
// misma razón que dottedLineY/columnsHeaderTop: depende del aviso "PARA
// LLEVAR".)
export const ROW_HEIGHT_PX = 72; // antes 36 (2x, alto de una fila de 1 sola línea)
export const ROW_LINE_HEIGHT_PX = 44; // antes 22 (2x, separación entre líneas cuando el nombre ocupa 2 líneas)
export const ROW_FONT_PX = 36; // antes 18 (2x)
// Espacio extra ENTRE un platillo y el siguiente (además de su propia
// altura), para que la comanda no se vea apretada: cada renglón de
// artículo queda más separado del de abajo, sea de 1 o de 2 líneas.
export const ROW_GAP_PX = 26;

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
 * Reparte cualquier texto en líneas de máximo `maxWidth` px (sin límite de
 * cantidad de líneas). Es el núcleo que usan tanto `wrapProductName` (con un
 * tope de líneas) como `wrapObservationText` (sin tope, porque una
 * instrucción de cocina no se debe recortar).
 */
const wrapTextLines = (text, measureTextWidth, maxWidth) => {
  const words = String(text || '').split(' ').filter(Boolean);
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
  return lines;
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
  const lines = wrapTextLines(name, measureTextWidth, maxWidth);

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

// --- Observaciones de CADA platillo (p. ej. "sin cebolla", "bien cocido") ---
// Van debajo del nombre del platillo, en letra más chica y sin negrita, para
// diferenciarlas visualmente del nombre pero sin perderse: son instrucciones
// que cocina/bebidas necesita ver sí o sí. A diferencia del nombre del
// platillo, aquí NO se recortan con "…" ni se limitan a 2 líneas: una
// instrucción de cocina incompleta es peor que un ticket un poco más largo.
export const ITEM_OBS_FONT_PX = 28;
export const ITEM_OBS_LINE_HEIGHT_PX = 34;

export const wrapObservationText = (text, measureTextWidth, maxWidth = PRODUCT_TEXT_WIDTH_PX) =>
  wrapTextLines(text, measureTextWidth, maxWidth);


// --- Barra + totales (sin "Descuento": solo Total y A pagar) ---
const BLACK_BAR_HEIGHT_PX = 16; // antes 8 (2x)
const TOTALS_GAP_PX = 68; // antes 34 (2x)
export const TOTALS_LABEL_FONT_PX = 34; // antes 17 (2x)
export const TOTALS_AMOUNT_FONT_PX = 34; // antes 17 (2x)
export const A_PAGAR_LABEL_FONT_PX = 34; // antes 17 (2x)
export const A_PAGAR_AMOUNT_FONT_PX = 68; // antes 34 (2x)

// Antes "Total:" y "A pagar:" iban lado a lado en una sola fila, repartidos
// en columnas angostas (fijas en px). Con la letra al doble esas columnas
// ya no alcanzaban para el monto grande de "A pagar:" (68px), así que ahora
// cada uno usa una fila completa (ancho completo del ticket, de marginX a
// rightX) y "A pagar:" va una fila abajo de "Total:". Esto usa más alto de
// ticket (que es justamente lo que se pidió), no más ancho: el ancho sigue
// limitado por la impresora (576px).
export const TOTALS_ROW_GAP_PX = 62; // separación entre la fila de "Total:" y la de "A pagar:"
// Alto del bloque de totales completo (fila "Total:" + fila "A pagar:" con
// su monto grande), con aire de sobra para que "Observaciones" no quede
// encimado con el monto de 68px.
const TOTALS_BLOCK_HEIGHT_PX = 170;

export const OBSERVATIONS_FONT_PX = 26; // antes 13 (2x)
const BOTTOM_MARGIN_PX = 80; // antes 40 (2x)

// Espacio entre el último artículo y "Observaciones" cuando el bloque de
// totales NO se imprime (comanda de cocina): más angosto que el espacio que
// deja el bloque de totales completo, porque aquí no hay barra ni montos.
const OBSERVATIONS_GAP_NO_TOTALS_PX = 40;

export const formatCurrency = (value) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value || 0));

// Igual que formatCurrency pero SIN el símbolo/código de moneda (algunos
// navegadores muestran "GTQ" en vez de "Q" según su versión de ICU). Se usa
// solo en el total de CADA producto dentro de la comanda: como la columna ya
// se llama "Total (Q)", repetir "GTQ"/"Q" en cada renglón es redundante y
// ensucia el ticket. El total general ("Total:"/"A pagar:") sí sigue
// llevando el símbolo de moneda completo (formatCurrency), porque ahí no
// hay un encabezado de columna que ya lo indique.
export const formatAmount = (value) =>
  new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

export const getTableLabel = (order) =>
  order?.table?.name?.trim() ? order.table.name : order?.table?.number ? `Mesa ${order.table.number}` : 'Sin mesa';

// "Extra" es un cargo genérico (Q5) que se agrega a la cuenta de la mesa
// desde los "Accesos rápidos" del POS, pero que NUNCA debe salir en la
// comanda de cocina (no es un platillo que cocina tenga que preparar). Sí
// se sigue mostrando en la comanda completa/bebidas (para que quede
// reflejado en el cobro total de la mesa).
const isExtraChargeItem = (item) => {
  const name = String(item?.menuItem?.name || item?.label || '').trim().toLowerCase();
  return name === 'extra';
};

export const getVisibleItems = (order, scope, isDrinkItem) => {
  const baseVisibleItems = (order.items || []).filter((item) => !item.isIncluded);
  if (scope === 'kitchen') return baseVisibleItems.filter((item) => !isDrinkItem(item) && !item.delivered && !isExtraChargeItem(item));
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
  const dottedLineY = metaTop + META_ROWS * META_LINE_HEIGHT_PX + 28; // antes +14 (2x)
  const columnsHeaderTop = dottedLineY + 44; // antes +22 (2x)
  const rowsTop = columnsHeaderTop + 72; // antes +36 (2x)

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
  // Medidor aparte para las observaciones de cada platillo: van en una
  // tipografía distinta (más chica, sin negrita) a la del nombre, así que
  // necesitan su propio measureText para que el "corte de línea" sea exacto.
  const obsMeasure = createTextMeasurer(ITEM_OBS_FONT_PX, false);

  // Cada fila avanza según cuántas líneas necesitó el nombre del platillo
  // (1 línea = mismo alto de siempre; 2 líneas = fila más alta) MÁS las
  // líneas que ocupe su observación (si tiene), en vez de un alto fijo para
  // todas. Así, cuando un nombre largo se parte en 2 líneas o el platillo
  // lleva una observación ("sin cebolla", "bien cocido", etc.), el siguiente
  // platillo se recorre hacia abajo automáticamente y nunca queda encimado.
  let cursorTop = rowsTop;
  const items = visibleItems.map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price || 0);
    const nameLines = wrapProductName(item.menuItem?.name || item.label || 'Platillo', measure);
    const nameBlockHeight = Math.max(ROW_HEIGHT_PX, nameLines.length * ROW_LINE_HEIGHT_PX);

    const observationText = String(item.observations || '').trim();
    const obsLines = observationText ? wrapObservationText(`Obs: ${observationText}`, obsMeasure) : [];
    const obsBlockHeight = obsLines.length ? obsLines.length * ITEM_OBS_LINE_HEIGHT_PX + 6 : 0;

    const rowHeight = nameBlockHeight + obsBlockHeight;
    const built = {
      name: nameLines[0],
      nameLines,
      quantity,
      unitPrice: formatCurrency(unitPrice),
      total: formatAmount(unitPrice * quantity),
      top: cursorTop,
      obsLines,
      obsTop: cursorTop + nameBlockHeight + 6,
    };
    cursorTop += rowHeight + ROW_GAP_PX;
    return built;
  });

  const itemsBottom = visibleItems.length === 0 ? rowsTop + ROW_HEIGHT_PX : cursorTop;

  // El bloque de totales (barra negra + "Total:" + "A pagar:") SOLO se
  // imprime cuando el ticket va a la impresora/estación de bebidas (scope
  // 'bebidas') o cuando es la comanda completa (scope 'full', que es la que
  // se usa para "reimprimir toda la cuenta" y siempre sale por bebidas). En
  // la comanda de cocina (scope 'kitchen') NUNCA se imprime ese bloque: cada
  // artículo sigue mostrando su "Total (Q)" individual, pero el total de la
  // cuenta completa no le corresponde a cocina.
  const showTotals = scope !== 'kitchen';
  // Columna "Total (Q)" de CADA platillo: solo se imprime en bebidas/comanda
  // completa. En cocina ya no se muestra ningún precio (ni por platillo ni
  // el total de la cuenta), porque a cocina no le corresponde ver montos.
  const showItemTotals = scope !== 'kitchen';

  const blackBarTop = itemsBottom + 24; // antes +12 (2x)
  const totalsTop = blackBarTop + BLACK_BAR_HEIGHT_PX + TOTALS_GAP_PX;
  // Fila de "A pagar:" (label + monto grande), una fila completa abajo de
  // "Total:" — ver comentario junto a TOTALS_ROW_GAP_PX más arriba.
  const aPagarTop = totalsTop + TOTALS_ROW_GAP_PX;

  const observations = order.observations || '';
  const observationsTop = showTotals
    ? totalsTop + TOTALS_BLOCK_HEIGHT_PX
    : itemsBottom + OBSERVATIONS_GAP_NO_TOTALS_PX;
  const pageHeightPx = (observations ? observationsTop + 60 : observationsTop) + BOTTOM_MARGIN_PX; // antes +30 (2x)

  return {
    headerHeightPx: HEADER_HEIGHT_PX,
    isToGo,
    toGoBannerTop,
    metaRows,
    dottedLineY,
    columnsHeaderTop,
    items,
    itemsEmpty: visibleItems.length === 0,
    showTotals,
    showItemTotals,
    blackBarTop,
    blackBarHeight: BLACK_BAR_HEIGHT_PX,
    totalsTop,
    aPagarTop,
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