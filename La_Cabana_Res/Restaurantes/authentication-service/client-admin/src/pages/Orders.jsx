import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createOrder, getMenuItems, getOrders, getTables, updateOrderStatus, updateOrderItems, deleteOrder, getRestaurants, updateRestaurant } from '../services/adminApi.js';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { printToEposStation, buildTicketCanvas } from '../services/eposPrint.js';
import {
  TEMPLATE_PX,
  HEADER_IMAGE_URL,
  COLS_PX,
  META_FONT_PX,
  COLUMNS_HEADER_FONT_PX,
  ROW_FONT_PX,
  ROW_LINE_HEIGHT_PX,
  ITEM_OBS_FONT_PX,
  ITEM_OBS_LINE_HEIGHT_PX,
  TOTALS_LABEL_FONT_PX,
  TOTALS_AMOUNT_FONT_PX,
  A_PAGAR_LABEL_FONT_PX,
  A_PAGAR_AMOUNT_FONT_PX,
  OBSERVATIONS_FONT_PX,
  TOGO_FONT_PX,
  TOGO_LABEL,
  createTextMeasurer,
  buildComandaLayout,
} from '../services/comandaLayout.js';
import { Spinner } from '../features/auth/components/Spinner.jsx';
import { useAuthStore } from '../features/auth/store/authStore.js';
import { showError, showSuccess } from '../shared/utils/toast.js';
import { askPrompt } from '../shared/utils/uiPrompt.js';
import {
  ClipboardDocumentListIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  PlusIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import bebidasCalientesImg from '../assets/img/bebidascalientes.jpg';
import bebidasStarbucksImg from '../assets/img/BebidasStarbukcs.png';
import bebidasFriasImg from '../assets/img/BebidasFrias.png';
import entradasImg from '../assets/img/Entradas.png';
import platosFuertesImg from '../assets/img/PlatoFuerte.png';
import postresImg from '../assets/img/Postres.png';
import hamburguesasImg from '../assets/img/hamburguesas.png';
import extrasImg from '../assets/img/extras.jpg';

const formatDate = (value) => new Date(value).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
const formatDayLabel = (value) =>
  new Date(value).toLocaleDateString('es-GT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
const getDayKey = (value) => new Date(value).toLocaleDateString('es-GT');
const formatCurrency = (value) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value || 0));
const statusOptions = ['Pendiente', 'Entregado', 'Cancelado'];

const normalizeOrderStatus = (status = '') => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'pendiente') return 'Pendiente';
  if (['preparando', 'preparacion', 'preparación'].includes(value)) return 'Preparando';
  if (['entregado', 'completado', 'completada'].includes(value)) return 'Entregado';
  if (['cancelado', 'cancelada'].includes(value)) return 'Cancelado';
  return 'Pendiente';
};

// El diseño (medidas, columnas, tamaños de letra) vive en comandaLayout.js y
// lo comparten esta vista de impresión (window.print()) y la impresión
// directa a la impresora Epson (eposPrint.js), para que ambas rutas
// dibujen exactamente el mismo ticket.
// El ticket se imprime a 80mm de ancho (ancho real del papel en AON PR-350WF);
// el alto ya NO es fijo: crece según la cantidad de artículos del pedido.
const PAGE_WIDTH_MM = 80;
const PX_TO_MM = PAGE_WIDTH_MM / TEMPLATE_PX.width;
const mm = (px) => Math.round(px * PX_TO_MM * 100) / 100;

// scope controla qué artículos salen en el ticket impreso:
//  - 'full'    -> comanda completa (todo el pedido), usada en Entregas/Historial
//  - 'kitchen' -> solo lo que debe preparar cocina (impresora de cocina)
//  - 'bebidas' -> solo lo que debe preparar recepción/bebidas (impresora de bebidas)
const PRINT_SCOPE_LABELS = {
  full: 'Comanda',
  kitchen: 'Comanda · Cocina',
  bebidas: 'Comanda · Bebidas',
};

const generateOrderPrintHtml = (order, scope = 'full') => {
  // Mismo measurer (mismo font/tamaño) que usa la impresión directa a la
  // impresora térmica, así el HTML de respaldo (window.print()) parte los
  // nombres largos exactamente en el mismo punto.
  const measureTextWidth = createTextMeasurer(ROW_FONT_PX, true);
  const layout = buildComandaLayout(order, scope, isDrinkItem, measureTextWidth);
  const pageHeightMm = mm(layout.pageHeightPx);
  const colCenterMm = ([left, right]) => mm((left + right) / 2);

  const itemsHtml = layout.itemsEmpty
    ? `<div class="row-cell" style="top: ${mm(layout.items[0]?.top ?? layout.columnsHeaderTop + 42)}mm; left: ${mm(COLS_PX.producto[0])}mm; font-size: ${ROW_FONT_PX}px; font-weight: 400; text-align: left;">Sin artículos</div>`
    : layout.items
        .map((item) => {
          // El nombre puede venir en 1 o 2 líneas (wrapProductName en
          // comandaLayout.js): un div por línea, en vez de un solo div con
          // "white-space: nowrap" que antes dejaba el texto corrido por
          // encima de "Cant."/"Precio (Q)" cuando el nombre era largo.
          const nameLinesHtml = (item.nameLines || [item.name])
            .map(
              (line, lineIndex) => `
        <div class="row-cell" style="top: ${mm(item.top + lineIndex * ROW_LINE_HEIGHT_PX)}mm; left: ${mm(COLS_PX.producto[0])}mm; width: ${mm(COLS_PX.producto[1] - COLS_PX.producto[0])}mm; font-size: ${ROW_FONT_PX}px; font-weight: 700; text-align: left; white-space: normal;">${line}</div>`
            )
            .join('');
          // Observación del platillo ("sin cebolla", "bien cocido", etc.):
          // un div por línea, debajo del nombre, en letra más chica y sin
          // negrita para diferenciarla visualmente pero sin perderse.
          const obsLinesHtml = (item.obsLines || [])
            .map(
              (line, lineIndex) => `
        <div class="row-cell" style="top: ${mm(item.obsTop + lineIndex * ITEM_OBS_LINE_HEIGHT_PX)}mm; left: ${mm(COLS_PX.producto[0])}mm; width: ${mm(COLS_PX.producto[1] - COLS_PX.producto[0])}mm; font-size: ${ITEM_OBS_FONT_PX}px; font-weight: 400; text-align: left; white-space: normal;">${line}</div>`
            )
            .join('');
          return `
        <div class="row-cell" style="top: ${mm(item.top)}mm; left: ${colCenterMm(COLS_PX.cantidad) - mm(COLS_PX.cantidad[1] - COLS_PX.cantidad[0]) / 2}mm; width: ${mm(COLS_PX.cantidad[1] - COLS_PX.cantidad[0])}mm; font-size: ${ROW_FONT_PX}px; text-align: center;">${item.quantity}</div>
        ${nameLinesHtml}
        ${obsLinesHtml}
        <div class="row-cell" style="top: ${mm(item.top)}mm; right: ${mm(TEMPLATE_PX.width - COLS_PX.total[1])}mm; width: ${mm(COLS_PX.total[1] - COLS_PX.total[0])}mm; font-size: ${ROW_FONT_PX}px; text-align: right;">${item.total}</div>
      `;
        })
        .join('');

  const metaHtml = layout.metaRows
    .map(
      (row) => `
      <div class="field" style="top: ${mm(row.top)}mm; left: ${mm(layout.marginX)}mm; right: ${mm(TEMPLATE_PX.width - layout.rightX)}mm; text-align: left;">
        <span class="value" style="font-size: ${META_FONT_PX}px;">${row.label} ${row.value}</span>
      </div>`
    )
    .join('');

  const headerImageUrl = new URL(HEADER_IMAGE_URL, window.location.origin).href;

  return `
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <base href="${window.location.origin}/" />
        <title>${PRINT_SCOPE_LABELS[scope] || PRINT_SCOPE_LABELS.full} ${order.orderNumber || order._id}</title>
        <style>
          @page { margin: 0; size: ${PAGE_WIDTH_MM}mm ${pageHeightMm}mm; }
          html, body { width: ${PAGE_WIDTH_MM}mm; height: ${pageHeightMm}mm; margin: 0; padding: 0; background: #fff; }
          body { font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { position: relative; width: ${PAGE_WIDTH_MM}mm; height: ${pageHeightMm}mm; background: #fff; }
          .header-img { position: absolute; top: 0; left: 0; width: ${PAGE_WIDTH_MM}mm; height: ${mm(layout.headerHeightPx)}mm; object-fit: contain; }
          .overlay { position: absolute; inset: 0; pointer-events: none; }
          .field { position: absolute; display: flex; flex-direction: column; }
          .value { font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #000; }
          .dotted-line { position: absolute; left: ${mm(layout.marginX - 16)}mm; right: ${mm(TEMPLATE_PX.width - layout.rightX - 16)}mm; top: ${mm(layout.dottedLineY)}mm; border-top: 2px dotted #000; }
          .columns-header { position: absolute; font-weight: 700; font-size: ${COLUMNS_HEADER_FONT_PX}px; color: #000; top: ${mm(layout.columnsHeaderTop)}mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .row-cell { position: absolute; font-weight: 700; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #000; }
          .black-bar { position: absolute; left: 0; right: 0; top: ${mm(layout.blackBarTop)}mm; height: ${mm(layout.blackBarHeight)}mm; background: #000; }
          .totals-label { position: absolute; font-weight: 700; color: #000; }
          .totals-value { position: absolute; font-weight: 400; color: #000; }
          .observations { position: absolute; left: ${mm(layout.marginX)}mm; right: ${mm(TEMPLATE_PX.width - layout.rightX)}mm; top: ${mm(layout.observationsTop)}mm; font-size: ${OBSERVATIONS_FONT_PX}px; font-weight: 700; color: #000; }
          .togo-banner { position: absolute; left: 0; right: 0; top: ${mm(layout.toGoBannerTop)}mm; font-size: ${TOGO_FONT_PX}px; font-weight: 800; text-align: center; color: #000; letter-spacing: 0.04em; }
        </style>
      </head>
      <body>
        <div class="page">
          <img src="${headerImageUrl}" class="header-img" alt="La Cabaña Restaurante" />
          <div class="overlay">
            ${layout.isToGo ? `<div class="togo-banner">${TOGO_LABEL}</div>` : ''}
            ${metaHtml}
            <div class="dotted-line"></div>
            <div class="columns-header" style="left: ${mm(COLS_PX.producto[0])}mm; text-align: left;">Producto</div>
            <div class="columns-header" style="left: ${colCenterMm(COLS_PX.cantidad) - mm(COLS_PX.cantidad[1] - COLS_PX.cantidad[0]) / 2}mm; width: ${mm(COLS_PX.cantidad[1] - COLS_PX.cantidad[0])}mm; text-align: center;">Cant.</div>
            <div class="columns-header" style="right: ${mm(TEMPLATE_PX.width - COLS_PX.total[1])}mm; text-align: right;">Total (Q)</div>
            <!-- Renglones de artículos -->
            ${itemsHtml}
            ${layout.showTotals ? `
            <div class="black-bar"></div>
            <!-- Totales: "Total:" y "A pagar:" ahora van en filas de ancho
                 completo (una abajo de la otra), porque con la letra al
                 doble ya no caben lado a lado en el ancho fijo de la
                 impresora (576px). Este bloque SOLO se imprime en bebidas /
                 comanda completa (ver showTotals en comandaLayout.js); en
                 cocina no se dibuja nada de esto. -->
            <div class="totals-label" style="top: ${mm(layout.totalsTop)}mm; left: ${mm(layout.marginX)}mm; font-size: ${TOTALS_LABEL_FONT_PX}px;">${layout.totalLabel}</div>
            <div class="totals-value" style="top: ${mm(layout.totalsTop)}mm; right: ${mm(TEMPLATE_PX.width - layout.rightX)}mm; font-size: ${TOTALS_AMOUNT_FONT_PX}px; text-align: right;">${layout.totalValue}</div>
            <div class="totals-label" style="top: ${mm(layout.aPagarTop)}mm; left: ${mm(layout.marginX)}mm; font-size: ${A_PAGAR_LABEL_FONT_PX}px;">${layout.aPagarLabel}</div>
            <div class="totals-value" style="top: ${mm(layout.aPagarTop)}mm; right: ${mm(TEMPLATE_PX.width - layout.rightX)}mm; font-size: ${A_PAGAR_AMOUNT_FONT_PX}px; font-weight: 900; text-align: right;">${layout.aPagarValue}</div>
            ` : ''}
            ${order.observations ? `<div class="observations"><strong>Observaciones:</strong> ${order.observations}</div>` : ''}
          </div>
        </div>
        <script>
          window.addEventListener('load', function() {
            const images = Array.from(document.images);
            const onLoaded = function() {
              if (images.every((img) => img.complete)) {
                setTimeout(function() { window.print(); }, 100);
              }
            };
            if (images.length === 0) {
              setTimeout(function() { window.print(); }, 100);
            } else {
              images.forEach(function(img) {
                if (img.complete) return onLoaded();
                img.addEventListener('load', onLoaded);
                img.addEventListener('error', onLoaded);
              });
            }
          });
        </script>
      </body>
    </html>
  `;
};

const printOrder = (order, scope = 'full') => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showError('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para esta página.');
    return;
  }
  printWindow.document.write(generateOrderPrintHtml(order, scope));
  printWindow.document.close();
  printWindow.focus();
};

// Configuración de impresión automática (ePOS-Print) leída del restaurante.
// Se llena desde el panel "Configurar impresoras" una vez que las impresoras
// físicas (Epson TM-T20IV-SP u otra compatible con ePOS-Print) estén
// conectadas a la red del restaurante con IP fija.
const isEposReady = (restaurant, station) => {
  if (!restaurant?.printerEnabled) return false;
  if (station === 'kitchen') return Boolean(restaurant.printerKitchenIp);
  if (station === 'bebidas') return Boolean(restaurant.printerDrinksIp);
  return false;
};

const getStationConfig = (restaurant, station) =>
  station === 'kitchen'
    ? { ip: restaurant?.printerKitchenIp, port: restaurant?.printerKitchenPort || 80 }
    : { ip: restaurant?.printerDrinksIp, port: restaurant?.printerDrinksPort || 80 };

// Imprime en una estación (cocina o bebidas) A PETICIÓN DEL USUARIO (botón
// "Reimprimir cocina/bebidas" o "Imprimir comanda completa"): si hay una
// impresora ePOS configurada para esa estación, manda el ticket directo por
// WiFi/Ethernet sin diálogos. Si no hay impresora configurada para esa
// estación (o la impresión ePOS falla), cae de vuelta al método anterior
// (window.print()), para que SIEMPRE se pueda reimprimir manualmente aunque
// esa impresora en particular todavía no esté conectada.
const printToStation = async (order, scope, restaurant) => {
  if (isEposReady(restaurant, scope)) {
    try {
      await printToEposStation(order, scope, getStationConfig(restaurant, scope), { isDrinkItem });
      return;
    } catch (err) {
      showError(`No se pudo imprimir en la impresora de ${scope === 'kitchen' ? 'cocina' : 'bebidas'}: ${err.message}`);
      // Si falla la impresora de red (apagada, IP incorrecta, etc.), seguimos
      // con el respaldo de window.print() para no perder la comanda.
    }
  }
  printOrder(order, scope);
};

// Imprime en una estación de forma AUTOMÁTICA (al confirmar un pedido nuevo,
// o al mandar parte de un pedido). A diferencia de `printToStation`, esta
// versión NUNCA abre el respaldo window.print() por su cuenta: cada estación
// (cocina / bebidas) es 100% independiente de la otra, así que...
//   - si esa estación SÍ tiene impresora ePOS configurada, imprime sola, sin
//     que le importe si la otra estación tiene o no impresora;
//   - si esa estación NO tiene impresora configurada todavía, simplemente no
//     imprime nada automáticamente (no se abre ningún ticket/ventana). Esa
//     comanda se sigue pudiendo sacar en cualquier momento a mano con el
//     botón "Reimprimir cocina/bebidas", que sí usa el respaldo si hace falta.
// Esto evita que, por ejemplo, quitar la IP de la impresora de bebidas haga
// que se abra sola una ventana de impresión de bebidas en cada pedido nuevo,
// y evita que un problema con la impresora de bebidas afecte a la de cocina.
const autoPrintToStation = async (order, scope, restaurant) => {
  if (!isEposReady(restaurant, scope)) return;
  try {
    await printToEposStation(order, scope, getStationConfig(restaurant, scope), { isDrinkItem });
  } catch (err) {
    showError(`No se pudo imprimir en la impresora de ${scope === 'kitchen' ? 'cocina' : 'bebidas'}: ${err.message}`);
  }
};

// "Imprimir comanda completa" (Entregas / Historial) SIEMPRE sale por la
// impresora de bebidas cuando está configurada -- es la que está junto al
// mostrador/caja, y es la comanda de referencia para reclamos o revisiones.
// Esto SOLO ocurre cuando el usuario presiona el botón "Imprimir comanda
// completa" a mano; esta función nunca se llama sola/automáticamente. Si la
// impresora de bebidas no está configurada o falla, cae al respaldo de
// siempre (window.print()), desde donde también se puede elegir "Guardar
// como PDF" como destino de impresión.
const printFullOrderToKitchen = async (order, restaurant) => {
  if (isEposReady(restaurant, 'bebidas')) {
    try {
      await printToEposStation(order, 'full', getStationConfig(restaurant, 'bebidas'), { isDrinkItem });
      showSuccess('Comanda completa enviada a la impresora de bebidas.');
      return;
    } catch (err) {
      showError(`No se pudo imprimir en la impresora de bebidas: ${err.message}`);
      // Igual que en printToStation: si la impresora de red falla, seguimos
      // con el respaldo para no perder la comanda.
    }
  }
  printOrder(order, 'full');
};

// Genera un PDF de la comanda completa reutilizando exactamente el mismo
// dibujo (buildTicketCanvas) que ya usan el ticket térmico y la vista de
// impresión, para que el PDF se vea igual. Se descarga directo desde el
// navegador (pdf.save), sin depender del diálogo de impresión del sistema
// (que en el WebView del APK no siempre está disponible / no muestra
// "Guardar como PDF" como sí hace un navegador de escritorio).
const downloadOrderPdf = async (order) => {
  try {
    const canvas = await buildTicketCanvas(order, 'full', { isDrinkItem });
    const widthMm = PAGE_WIDTH_MM;
    const heightMm = mm(canvas.height);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [widthMm, heightMm],
    });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, heightMm);
    const fileName = `comanda-${order.orderNumber || order._id}.pdf`;

    // Dentro del APK, el WebView de Android no sabe manejar la descarga
    // "blob:" que genera pdf.save() (igual que no maneja window.prompt/
    // alert/confirm sin ayuda extra): el enlace invisible se crea, pero no
    // pasa nada. Por eso, si detectamos el puente nativo que expone
    // MainActivity.kt (AndroidPdfSaver), le mandamos el PDF en base64 para
    // que lo guarde él directamente en el almacenamiento del dispositivo.
    if (window.AndroidPdfSaver?.savePdf) {
      const base64 = pdf.output('datauristring').split(',')[1];
      window.AndroidPdfSaver.savePdf(base64, fileName);
      showSuccess('PDF de la comanda guardado en Descargas.');
      return;
    }

    // En un navegador normal (web), esto sí dispara la descarga nativa.
    pdf.save(fileName);
    showSuccess('PDF de la comanda descargado.');
  } catch (err) {
    showError(`No se pudo generar el PDF: ${err.message}`);
  }
};


// físicas: la de cocina (solo platillos de comida) y la de recepción/bebidas
// (solo bebidas, postres y extras incluidos que correspondan). Cada una se
// imprime solo si tiene su propia impresora ePOS configurada (ver
// `autoPrintToStation`); si a una estación todavía no le has conectado
// impresora, esa comanda no sale sola, pero la puedes sacar a mano con
// "Reimprimir cocina/bebidas" cuando quieras.
const printOrderToStations = (order, restaurant) => {
  const hasKitchenItems = getOrderHasKitchen(order);
  const hasDrinkItems = getOrderHasDrink(order);

  if (hasKitchenItems) {
    autoPrintToStation(order, 'kitchen', restaurant);
  }
  if (hasDrinkItems) {
    autoPrintToStation(order, 'bebidas', restaurant);
  }
};

const printPartialOrder = (order, items, restaurant) => {
  if (!Array.isArray(items) || items.length === 0) return;

  const partialOrder = {
    ...order,
    items,
    total: items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0),
  };

  const hasKitchenItems = items.some((item) => !isDrinkItem(item));
  const hasDrinkItems = items.some(isDrinkItem);

  if (hasKitchenItems) {
    autoPrintToStation(partialOrder, 'kitchen', restaurant);
  }
  if (hasDrinkItems) {
    autoPrintToStation(partialOrder, 'bebidas', restaurant);
  }
};

const deliveryStatusOptions = ['Pendiente', 'Entregado'];
const PAGE_SIZE = 8;

const getStatusClass = (status = '') => {
  const normalized = String(status).toLowerCase();
  if (normalized.includes('entregado')) return 'admin-status-success';
  if (normalized.includes('prepar')) return 'admin-status-warning';
  if (normalized.includes('cancel')) return 'admin-status-danger';
  return 'admin-status-neutral';
};

const menuCategoryImages = {
  'bebidas calientes': bebidasCalientesImg,
  'bebidas calientes (starbucks)': bebidasStarbucksImg,
  'bebidas frías': bebidasFriasImg,
  'bebidas frias': bebidasFriasImg,
  entradas: entradasImg,
  'platos fuertes': platosFuertesImg,
  postres: postresImg,
  hamburguesas: hamburguesasImg,
  extras: extrasImg,
  especiales: extrasImg,
  general: '/placeholder-image.svg',
};

const getCategoryImageUrl = (category) => {
  const key = category?.toString().trim().toLowerCase() || 'general';
  return menuCategoryImages[key] || menuCategoryImages.general;
};

const isDrinkItem = (item) => {
  // Items incluidos (isIncluded) se muestran en Bebidas solo si no están marcados como ocultos
  if (item?.isIncluded) return !Boolean(item.hideInBebidas);
  const category = String(item?.menuItem?.category || '').toLowerCase();
  const name = String(item?.menuItem?.name || '').toLowerCase();

  if (category.includes('bebidas') || category.includes('postres')) return true;
  if (!item?.menuItem) return false;

  return (
    name.includes('tortilla') ||
    name.includes('tortillas') ||
    name.includes('tostada') ||
    name.includes('tostadas')
  );
};

const getOrderHasDrink = (order) => order.items?.some(isDrinkItem);
const getOrderHasKitchen = (order) => order.items?.some((item) => !isDrinkItem(item));
const isOrderActive = (order) => String(order.status) !== 'Entregado' && String(order.status) !== 'Cancelado';
// El pedido puede venir con "table" ya populado (objeto) o solo con el ID
// (string), según el endpoint. Esta función normaliza ambos casos para
// poder comparar mesas de forma consistente.
const getOrderTableId = (order) => {
  const table = order?.table;
  if (!table) return null;
  return typeof table === 'object' ? table._id : table;
};
const getTableLabel = (table) => (table?.name?.trim() ? table.name : `Mesa ${table?.number ?? ''}`.trim());

export const Orders = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState([]);
  const [orderObservations, setOrderObservations] = useState('');
  const [isToGoOrder, setIsToGoOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [restaurant, setRestaurant] = useState(null);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [printerForm, setPrinterForm] = useState({
    printerEnabled: false,
    printerKitchenIp: '',
    printerKitchenPort: 80,
    printerDrinksIp: '',
    printerDrinksPort: 80,
  });
  const [savingPrinterSettings, setSavingPrinterSettings] = useState(false);
  // Mesa elegida dentro de la pantalla de Entregas (null = mostrar el tablero
  // de mesas; con valor = mostrar los pedidos de esa mesa).
  const [selectedDeliveryTableId, setSelectedDeliveryTableId] = useState(null);

  const view = useMemo(() => {
    if (location.pathname.includes('bebidas')) return 'bebidas';
    if (location.pathname.includes('cocina')) return 'kitchen';
    if (location.pathname.includes('entregas')) return 'entregas';
    if (location.pathname.includes('historial')) return 'history';
    return 'pos';
  }, [location.pathname]);

  // Al cambiar de pantalla, siempre volvemos a mostrar el tablero de mesas
  // en Entregas (que no se quede "pegado" en una mesa de una visita anterior).
  useEffect(() => {
    setSelectedDeliveryTableId(null);
  }, [view]);

  const userRole = useAuthStore((state) => state.user?.role);
  const canEditOrderItems = useMemo(
    () => ['ADMIN', 'RECEPCION', 'COCINA'].includes(userRole),
    [userRole],
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [menuData, ordersData, tablesData, restaurantsData] = await Promise.all([
          getMenuItems(),
          getOrders(),
          getTables(),
          getRestaurants(),
        ]);
        setMenuItems(Array.isArray(menuData) ? menuData : menuData?.menuItems || []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setTables(Array.isArray(tablesData) ? tablesData : []);
        if (!selectedTableId && Array.isArray(tablesData) && tablesData.length > 0) {
          // Preferimos preseleccionar una mesa que esté disponible; si todas
          // están ocupadas, dejamos la primera (el usuario deberá elegir
          // otra manualmente, ya que las ocupadas aparecen deshabilitadas).
          const occupiedIds = new Set(
            (Array.isArray(ordersData) ? ordersData : [])
              .filter(isOrderActive)
              .map((order) => String(getOrderTableId(order)))
          );
          const firstAvailableTable = tablesData.find((table) => !occupiedIds.has(String(table._id)));
          setSelectedTableId((firstAvailableTable || tablesData[0])._id);
        }
        // Este panel administra un solo restaurante (La Cabaña), por eso
        // tomamos el primero. Aquí viven las IPs de las impresoras.
        const currentRestaurant = Array.isArray(restaurantsData) ? restaurantsData[0] : null;
        if (currentRestaurant) {
          setRestaurant(currentRestaurant);
          setPrinterForm({
            printerEnabled: Boolean(currentRestaurant.printerEnabled),
            printerKitchenIp: currentRestaurant.printerKitchenIp || '',
            printerKitchenPort: currentRestaurant.printerKitchenPort || 80,
            printerDrinksIp: currentRestaurant.printerDrinksIp || '',
            printerDrinksPort: currentRestaurant.printerDrinksPort || 80,
          });
        }
      } catch (error) {
        console.error(error);
        showError('No se pudieron cargar el catálogo, los pedidos o las mesas');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * Number(item.price || 0), 0), [cart]);

  const categories = useMemo(() => {
    const groups = menuItems.reduce((acc, item) => {
      const category = item.category || 'Sin categoría';
      acc[category] = acc[category] ? acc[category] + 1 : 1;
      return acc;
    }, {});
    return Object.entries(groups)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [menuItems]);

  const selectedMenuItems = useMemo(
    () => menuItems.filter((item) => item.category === selectedCategory),
    [menuItems, selectedCategory],
  );

  const addToCart = async (menuItem) => {
    // Nota: window.prompt()/window.alert() no se muestran dentro del
    // WebView de Android que empaqueta el APK (se resuelven como null en
    // silencio), así que el precio de la mojarra se pide con un modal
    // propio de React (askPrompt), que sí funciona igual en web y en APK.
    // Aplica a los 3 platillos de mojarra (Frita, Empanizada, al Vapor):
    // el precio varía según el tamaño del pescado del día, sin importar
    // cómo se prepare.
    const isMojarra = String(menuItem.name || '').toLowerCase().includes('mojarra');

    if (isMojarra) {
      const defaultPrice = menuItem.price ?? 110;
      const input = await askPrompt({
        title: 'Precio de la mojarra frita',
        message: 'Ingrese el costo para este platillo (Q):',
        defaultValue: Number(defaultPrice).toFixed(2),
      });
      if (input === null) return; // usuario canceló
      const value = Number(String(input).replace(',', '.'));
      if (Number.isNaN(value) || value < 0) {
        showError('Precio inválido. Operación cancelada.');
        return;
      }
      const id = `${menuItem._id}::${Date.now()}`;
      setCart((current) => [
        ...current,
        { id, menuItem: menuItem._id, name: menuItem.name, price: value, quantity: 1, observations: '' },
      ]);
      showSuccess('Elemento seleccionado con éxito');
      return;
    }

    setCart((current) => {
      const existing = current.find((entry) => entry.id === menuItem._id);
      if (existing) {
        return current.map((entry) => (entry.id === menuItem._id ? { ...entry, quantity: entry.quantity + 1 } : entry));
      }
      return [...current, { id: menuItem._id, menuItem: menuItem._id, name: menuItem.name, price: menuItem.price, quantity: 1, observations: '' }];
    });
    showSuccess('Elemento seleccionado con éxito');
  };

  const updateCartQuantity = (id, delta) => {
    setCart((current) => current.flatMap((entry) => {
      if (entry.id !== id) return [entry];
      const nextQuantity = entry.quantity + delta;
      return nextQuantity > 0 ? [{ ...entry, quantity: nextQuantity }] : [];
    }));
  };

  // Accesos rápidos: agregan de una vez un ítem que ya existe en el menú
  // (sin tener que entrar a su categoría y buscarlo), para pedidos que casi
  // siempre llevan "una tortilla/papas extra" además del platillo principal.
  const quickAddToCart = (matcher, label) => {
    const menuItem = menuItems.find(matcher);
    if (!menuItem) {
      showError(`No se encontró "${label}" en el menú.`);
      return;
    }
    addToCart(menuItem);
  };

  const updateCartNotes = (id, observations) => {
    setCart((current) => current.map((entry) => (entry.id === id ? { ...entry, observations } : entry)));
  };

  const filteredOrders = useMemo(() => {
    const query = search.toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'Todos' || String(order.status) === statusFilter;
      const matchesSearch =
        String(order.orderNumber || order._id || '').toLowerCase().includes(query) ||
        order.items?.some((item) => (item.menuItem?.name || '').toLowerCase().includes(query));

      const hasDrink = getOrderHasDrink(order);
      const hasKitchen = getOrderHasKitchen(order);
      const drinkReady = order.drinkStatus === 'Entregado';
      const kitchenReady = order.kitchenStatus === 'Entregado';

      if (view === 'bebidas') {
        return matchesSearch && hasDrink && isOrderActive(order) && order.drinkStatus !== 'Entregado';
      }

      if (view === 'kitchen') {
        return matchesSearch && hasKitchen && isOrderActive(order) && order.kitchenStatus !== 'Entregado';
      }

      if (view === 'entregas') {
        return matchesSearch && isOrderActive(order);
      }

      if (view === 'history') {
        return matchesStatus && matchesSearch;
      }

      if (view === 'pos') {
        return matchesSearch && isOrderActive(order);
      }

      return false;
    });
  }, [orders, search, statusFilter, view]);

  // Mesas que tienen ahora mismo un pedido activo (Pendiente/Preparando):
  // mientras ese pedido siga activo, esa mesa no puede recibir otro pedido
  // nuevo. Se recalcula cada vez que cambian los pedidos.
  const occupiedTableIds = useMemo(() => {
    const set = new Set();
    orders.forEach((order) => {
      if (!isOrderActive(order)) return;
      const tableId = getOrderTableId(order);
      if (tableId) set.add(String(tableId));
    });
    return set;
  }, [orders]);

  const isTableOccupied = (tableId) => occupiedTableIds.has(String(tableId));

  // Mesas ordenadas por número, para pintar el tablero de Entregas siempre
  // en el mismo orden.
  const sortedTables = useMemo(
    () => [...tables].sort((a, b) => Number(a.number || 0) - Number(b.number || 0)),
    [tables],
  );

  const selectedDeliveryTable = useMemo(
    () => tables.find((table) => table._id === selectedDeliveryTableId) || null,
    [tables, selectedDeliveryTableId],
  );

  // Pedidos activos de la mesa seleccionada en Entregas (reutiliza
  // filteredOrders, que en la vista "entregas" ya trae solo pedidos
  // activos y que cumplen con la búsqueda).
  const deliveryOrdersForSelectedTable = useMemo(() => {
    if (!selectedDeliveryTableId) return [];
    return filteredOrders.filter((order) => String(getOrderTableId(order)) === String(selectedDeliveryTableId));
  }, [filteredOrders, selectedDeliveryTableId]);

  // Al hacer clic en una mesa del tablero de Entregas:
  //  - si está ocupada, mostramos sus pedidos pendientes (como hasta ahora).
  //  - si está disponible, no tiene sentido "ver sus entregas" (no hay
  //    pedido todavía), así que la seleccionamos automáticamente y saltamos
  //    directo a "Crear pedido" para empezar a agregar platillos en esa mesa.
  const handleDeliveryTableClick = (table) => {
    if (isTableOccupied(table._id)) {
      setSelectedDeliveryTableId(table._id);
      return;
    }
    setSelectedTableId(table._id);
    navigate('/dashboard/nuevo-pedido');
  };

  const historyGroups = useMemo(() => {
    const groups = new Map();

    filteredOrders.forEach((order) => {
      const key = getDayKey(order.createdAt);
      const group = groups.get(key) ?? { day: formatDayLabel(order.createdAt), orders: [], total: 0 };
      group.orders.push(order);
      group.total += Number(order.total || 0);
      groups.set(key, group);
    });

    return [...groups.values()].sort((a, b) => new Date(b.orders[0].createdAt) - new Date(a.orders[0].createdAt));
  }, [filteredOrders]);

  // Reporte descargable (Excel) del historial COMPLETO acumulado hasta hoy:
  // se arma siempre a partir de TODOS los pedidos guardados en el sistema
  // (no de `filteredOrders`, que respeta los filtros de búsqueda/estado de
  // la pantalla), así que sin importar cuándo se presione el botón, siempre
  // sale con todos los días registrados hasta el momento — no hace falta
  // fusionar archivos a mano ni llevar un Excel aparte.
  const getOrderItemName = (item) => item.menuItem?.name || item.label || 'Platillo';
  const getOrderTableLabel = (order) =>
    order?.table?.name?.trim() ? `Mesa ${order.table.name}` : order?.table?.number ? `Mesa ${order.table.number}` : 'Sin mesa';

  const buildDailyReportWorkbook = (allOrders) => {
    // Hoja "Resumen diario": una fila por día con cantidad de pedidos y
    // total vendido, más una fila de total general al final.
    const dayGroups = new Map();
    allOrders.forEach((order) => {
      const key = getDayKey(order.createdAt);
      const group = dayGroups.get(key) ?? { day: formatDayLabel(order.createdAt), date: new Date(order.createdAt), orders: 0, total: 0 };
      group.orders += 1;
      group.total += Number(order.total || 0);
      dayGroups.set(key, group);
    });
    const days = [...dayGroups.values()].sort((a, b) => b.date - a.date);

    const resumenRows = days.map((group) => ({
      Fecha: group.day,
      Pedidos: group.orders,
      'Total vendido (Q)': Number(group.total.toFixed(2)),
    }));
    resumenRows.push({
      Fecha: 'TOTAL GENERAL',
      Pedidos: days.reduce((sum, group) => sum + group.orders, 0),
      'Total vendido (Q)': Number(days.reduce((sum, group) => sum + group.total, 0).toFixed(2)),
    });

    // Hoja "Platillos vendidos": agregado de TODOS los días (no solo hoy),
    // cuántas unidades se vendieron de cada platillo y cuánto generaron.
    // Se excluyen los ítems incluidos/gratis (p. ej. tortillas de cortesía)
    // para no inflar el conteo con cosas que no se cobraron.
    const platilloMap = new Map();
    allOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (item.isIncluded) return;
        const name = getOrderItemName(item);
        const quantity = Number(item.quantity || 0);
        const lineTotal = Number(item.price || 0) * quantity;
        const entry = platilloMap.get(name) ?? { name, quantity: 0, total: 0 };
        entry.quantity += quantity;
        entry.total += lineTotal;
        platilloMap.set(name, entry);
      });
    });
    const platillosRows = [...platilloMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .map((entry) => ({
        Platillo: entry.name,
        'Cantidad vendida': entry.quantity,
        'Total generado (Q)': Number(entry.total.toFixed(2)),
      }));

    // Hoja "Detalle de pedidos": una fila por pedido (fecha, mesa, mesero,
    // estado, total y los platillos que llevó), para poder revisar o
    // auditar cualquier pedido puntual dentro del acumulado.
    const detalleRows = [...allOrders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((order) => ({
        Fecha: formatDate(order.createdAt),
        'N° Pedido': order.orderNumber || order._id,
        Mesa: getOrderTableLabel(order),
        Mesero: order.waiter || '—',
        Estado: order.status,
        'Total (Q)': Number(order.total || 0).toFixed(2),
        Platillos: (order.items || [])
          .filter((item) => !item.isIncluded)
          .map((item) => `${item.quantity}x ${getOrderItemName(item)}`)
          .join(', '),
        Observaciones: order.observations || '',
      }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resumenRows), 'Resumen diario');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(platillosRows), 'Platillos vendidos');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detalleRows), 'Detalle de pedidos');
    return workbook;
  };

  const downloadDailyReport = () => {
    if (!orders.length) {
      showError('Todavía no hay pedidos registrados para generar un reporte.');
      return;
    }
    const workbook = buildDailyReportWorkbook(orders);
    const todayLabel = new Date().toLocaleDateString('es-GT').replace(/\//g, '-');
    XLSX.writeFile(workbook, `Reporte_La_Cabana_${todayLabel}.xlsx`);
  };

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredOrders]);

  const totals = useMemo(() => ({
    pending: orders.filter((order) => String(order.status) === 'Pendiente').length,
    preparing: orders.filter((order) => String(order.status) === 'Preparando').length,
    delivered: orders.filter((order) => String(order.status) === 'Entregado').length,
    bebidasPending: orders.filter((order) => getOrderHasDrink(order) && isOrderActive(order) && order.drinkStatus !== 'Entregado').length,
    cocinaPending: orders.filter((order) => getOrderHasKitchen(order) && isOrderActive(order) && order.kitchenStatus !== 'Entregado').length,
    entregasPending: orders.filter((order) => isOrderActive(order)).length,
  }), [orders]);

  const handleStatusChange = async (orderId, status) => {
    try {
      const updated = await updateOrderStatus(orderId, status);
      setOrders((current) => current.map((order) => (order._id === updated._id ? updated : order)));
      showSuccess('Estado actualizado correctamente');
    } catch (error) {
      console.error(error);
      showError(error?.response?.data?.error || 'No se pudo actualizar el estado del pedido');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await deleteOrder(orderId);
      setOrders((current) => current.filter((order) => order._id !== orderId));
      showSuccess('Pedido cancelado y eliminado correctamente');
    } catch (error) {
      console.error(error);
      showError(error?.response?.data?.error || 'No se pudo cancelar el pedido');
    }
  };

  // Edit order items
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingItems, setEditingItems] = useState([]);
  const [editingLoading, setEditingLoading] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');

  const openEditor = (order) => {
    setEditingOrderId(order._id);
    setSelectedMenuItemId('');
    setEditingItems([]);
  };

  const closeEditor = () => {
    setEditingOrderId(null);
    setEditingItems([]);
  };

  const changeEditingQuantity = (index, delta) => {
    setEditingItems((current) => current.flatMap((it, i) => i !== index ? [it] : [{ ...it, quantity: Math.max(1, it.quantity + delta) }]));
  };

  const changeEditingObservations = (index, text) => {
    setEditingItems((current) => current.map((it, i) => i !== index ? it : { ...it, observations: text }));
  };

  const removeEditingItem = (index) => {
    setEditingItems((current) => current.filter((_, i) => i !== index));
  };

  const addMenuItemToEditing = (menuItemId) => {
    const found = menuItems.find((m) => m._id === menuItemId);
    if (!found) return;
    setEditingItems((current) => {
      const existingIndex = current.findIndex((it) => String(it.menuItem) === String(menuItemId));
      if (existingIndex >= 0) {
        return current.map((it, i) => i === existingIndex ? { ...it, quantity: it.quantity + 1 } : it);
      }
      return [...current, { menuItem: found._id, name: found.name, price: found.price, quantity: 1, observations: '' }];
    });
  };

  const submitEditedOrder = async () => {
    if (!editingOrderId) return;
    if (!editingItems.length) {
      showError('El pedido debe tener al menos un platillo.');
      return;
    }

    try {
      setEditingLoading(true);
      const existing = orders.find((o) => o._id === editingOrderId) || { items: [] };
      const preservedIncludedItems = (existing.items || []).filter((it) => it.isIncluded).map((it) => ({
        menuItem: it.menuItem?._id || it.menuItem,
        label: it.label || '',
        quantity: it.quantity,
        observations: it.observations || '',
        delivered: Boolean(it.delivered),
        isIncluded: true,
        price: it.price,
        hideInBebidas: Boolean(it.hideInBebidas),
      }));
      const preservedOriginalItems = (existing.items || []).filter((it) => !it.isIncluded).map((it) => ({
        menuItem: it.menuItem?._id || it.menuItem,
        quantity: it.quantity,
        observations: it.observations || '',
        delivered: Boolean(it.delivered),
      }));
      const payloadItems = [
        ...preservedIncludedItems,
        ...preservedOriginalItems,
        ...editingItems.map((it) => ({
          menuItem: it.isIncluded ? undefined : it.menuItem,
          label: it.isIncluded ? it.label || it.name : undefined,
          quantity: it.quantity,
          observations: it.observations,
          isIncluded: it.isIncluded,
          price: it.isIncluded ? 0 : undefined,
          delivered: it.delivered,
        })),
      ];
      if (!payloadItems.length) {
        throw new Error('El pedido debe tener al menos un platillo.');
      }
      const updated = await updateOrderItems(editingOrderId, payloadItems);
      setOrders((current) => current.map((o) => (o._id === updated._id ? updated : o)));
      if (editingItems.length) {
        printPartialOrder(updated, editingItems, restaurant);
      }
      showSuccess('Pedido actualizado correctamente');
      closeEditor();
    } catch (error) {
      console.error(error);
      showError(error?.response?.data?.error || 'No se pudo actualizar el pedido');
    } finally {
      setEditingLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!cart.length) {
      showError('Agrega al menos un platillo para confirmar el pedido');
      return;
    }

    if (!selectedTableId) {
      showError('Selecciona una mesa para el pedido');
      return;
    }

    if (isTableOccupied(selectedTableId)) {
      showError('Esa mesa ya tiene un pedido activo. Debe entregarse o cancelarse antes de agregar uno nuevo.');
      return;
    }

    try {
      const payload = {
        table: selectedTableId,
        items: cart.map((entry) => ({ menuItem: entry.menuItem, quantity: entry.quantity, observations: entry.observations, price: entry.price })),
        observations: orderObservations,
        isToGo: isToGoOrder,
      };

      const created = await createOrder(payload);
      setCart([]);
      setOrderObservations('');
      setIsToGoOrder(false);
      setOrders((current) => [created, ...current]);
      showSuccess(`Pedido ${created.orderNumber || created._id?.slice(-6)} registrado`);
      // Pedido confirmado: se imprime automáticamente en las impresoras de cocina y bebidas.
      printOrderToStations(created, restaurant);
    } catch (error) {
      console.error(error);
      showError(error?.response?.data?.error || 'No se pudo registrar el pedido');
    }
  };

  const handleSavePrinterSettings = async () => {
    if (!restaurant?._id) return;
    try {
      setSavingPrinterSettings(true);
      const payload = {
        printerEnabled: printerForm.printerEnabled,
        printerKitchenIp: printerForm.printerKitchenIp,
        printerKitchenPort: printerForm.printerKitchenPort,
        printerDrinksIp: printerForm.printerDrinksIp,
        printerDrinksPort: printerForm.printerDrinksPort,
      };
      const response = await updateRestaurant(restaurant._id, payload);
      const updatedRestaurant = response?.restaurant || { ...restaurant, ...payload };
      setRestaurant(updatedRestaurant);
      showSuccess('Configuración de impresoras guardada');
      setShowPrinterSettings(false);
    } catch (error) {
      console.error(error);
      showError(error?.response?.data?.message || 'No se pudo guardar la configuración de impresoras');
    } finally {
      setSavingPrinterSettings(false);
    }
  };

  // Tarjeta de un pedido dentro de "Entregas" (una vez elegida la mesa).
  // Vive fuera del JSX principal para no repetir este bloque grande, pero
  // sigue usando el closure del componente (estado de edición, handlers,
  // etc.), por eso se define aquí adentro en vez de como componente aparte.
  const renderDeliveryOrderCard = (order) => (
    <article key={order._id} className='admin-panel p-5'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex flex-col gap-3'>
          {canEditOrderItems && (
            <button type='button' onClick={() => handleDeleteOrder(order._id)} className='admin-button-danger w-fit px-3 py-2 text-sm'>Cancelar pedido</button>
          )}
          <div>
            <p className='admin-kicker'>Pedido {order.orderNumber || `#${order._id?.slice(-6)}`}</p>
            <h3 className='mt-1 text-xl font-black text-[#e0e0e0]'>{formatDate(order.createdAt)}</h3>
            <p className='mt-1 text-base font-semibold text-[#e0e0e0]'>{
              order?.table?.name?.trim()
                ? `Mesa: ${order.table.name}`
                : order?.table?.number
                  ? `Mesa: ${order.table.number}`
                  : 'Sin mesa'
            }</p>
          </div>
        </div>
        <div className='flex flex-col gap-2'>
          <select value={normalizeOrderStatus(order.status)} onChange={(event) => handleStatusChange(order._id, event.target.value)} className='admin-input px-3 py-2 text-sm font-semibold'>
            {deliveryStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button type='button' onClick={() => printFullOrderToKitchen(order, restaurant)} className='admin-button-secondary px-3 py-2 text-sm'>Imprimir comanda completa</button>
          <button type='button' onClick={() => downloadOrderPdf(order)} className='admin-button-secondary px-3 py-2 text-sm'>Guardar PDF</button>
          {canEditOrderItems && (
            <button type='button' onClick={() => openEditor(order)} className='admin-button-secondary px-3 py-2 text-sm'>Editar</button>
          )}
        </div>
      </div>
      <div className='mt-4 space-y-2'>
        {order.items?.filter((item) => !(item.isIncluded && item.hideInBebidas)).map((item) => (
          <div key={`${order._id}-${item.menuItem?._id || item.label || item.menuItem}`} className='rounded-2xl border border-[#e6be7d]/10 bg-[#e6be7d]/20 p-3'>
            <div className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-2'>
                  <span className='font-extrabold text-[#e0e0e0]'>{item.quantity}× {item.menuItem?.name || item.label || 'Platillo'}</span>
                  {item.delivered && (
                    <span className='inline-block rounded-full bg-[#ECFDF5] px-2 py-0.5 text-xs font-semibold text-[#065F46]'>Entregado</span>
                  )}
                </div>
                <span className='text-sm font-bold text-[#e0e0e0]'>{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</span>
              </div>
            {item.observations && <p className='mt-2 text-xs text-[#e0e0e0]'>Obs.: {item.observations}</p>}
          </div>
        ))}
        {order.observations && <p className='rounded-2xl bg-[#e6be7d]/14 px-3 py-2 text-sm text-[#e0e0e0]'>Observaciones: {order.observations}</p>}
        {editingOrderId === order._id && (
          <div className='mt-4 rounded-2xl border border-dashed border-[#e6be7d]/20 bg-[#141426]/95 p-4'>
            <h4 className='mb-3 font-bold text-[#e0e0e0]'>Editar pedido</h4>
            {editingItems.map((it, idx) => (
              <div key={`${order._id}-edit-${idx}`} className='mb-3 flex items-center justify-between gap-3'>
                <div>
                  <div className='font-bold'>{it.name}</div>
                  <input value={it.observations} onChange={(e) => changeEditingObservations(idx, e.target.value)} placeholder='Obs. del platillo' className='admin-input mt-1 w-full px-2 py-1 text-sm' />
                </div>
                <div className='flex items-center gap-2'>
                  <button type='button' onClick={() => changeEditingQuantity(idx, -1)} className='admin-button-secondary px-2 py-1'>-</button>
                  <div className='px-3 font-black'>{it.quantity}</div>
                  <button type='button' onClick={() => changeEditingQuantity(idx, 1)} className='admin-button-secondary px-2 py-1'>+</button>
                  <button type='button' onClick={() => removeEditingItem(idx)} className='admin-button-secondary px-2 py-1 text-xs'>Quitar</button>
                </div>
              </div>
            ))}

            <div className='mt-2'>
              <label className='block text-sm text-[#e6be7d] mb-2'>Agregar platillo</label>
              <select value={selectedMenuItemId} onChange={(e) => {
                const selectedValue = e.target.value;
                if (!selectedValue) {
                  setSelectedMenuItemId('');
                  return;
                }
                addMenuItemToEditing(selectedValue);
                setSelectedMenuItemId('');
              }} className='admin-input w-full px-3 py-2 text-sm relative z-20'>
                <option value='' disabled hidden>Elige un platillo</option>
                {menuItems.map((m) => <option key={m._id} value={m._id}>{m.name} — {formatCurrency(m.price)}</option>)}
              </select>
            </div>

            <div className='mt-4 flex items-center gap-2'>
              <button type='button' onClick={submitEditedOrder} disabled={editingLoading} className='admin-button-primary px-4 py-2'>{editingLoading ? 'Guardando...' : 'Guardar cambios'}</button>
              <button type='button' onClick={closeEditor} disabled={editingLoading} className='admin-button-secondary px-4 py-2'>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </article>
  );

  if (loading) return <Spinner />;

  return (
    <div className='admin-page space-y-8'>
      <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
        <div>
          <p className='admin-kicker'>Operación interna</p>
          <h1 className='admin-title mt-2'>
            {view === 'pos'
              ? 'Punto de toma de pedidos'
              : view === 'bebidas'
                ? 'Pantalla de bebidas'
                : view === 'kitchen'
                  ? 'Pantalla de cocina'
                  : view === 'entregas'
                    ? 'Pantalla de entregas'
                    : 'Historial de pedidos'}
          </h1>
          <p className='admin-subtitle mt-2 text-sm'>
            {view === 'pos'
              ? 'Creación rápida de pedidos, cálculo automático del total y confirmación directa.'
              : view === 'bebidas'
                ? 'Gestiona las bebidas y postres pendientes para el servicio.'
                : view === 'kitchen'
                  ? 'Visualiza los pedidos de cocina pendientes y cambia su estado en tiempo real.'
                  : view === 'entregas'
                    ? (selectedDeliveryTableId
                        ? 'Pedidos pendientes de entrega para esta mesa.'
                        : 'Toca una mesa disponible para crear un pedido, o una ocupada para ver sus pedidos pendientes.')
                    : 'Consulta el historial completo del restaurante con filtros por estado.'}
          </p>
        </div>
        {view === 'pos' && (
          <button
            type='button'
            onClick={() => setShowPrinterSettings(true)}
            className='admin-button-secondary px-3 py-2 text-sm self-start md:self-auto'
          >
            🖨️ Configurar impresoras
          </button>
        )}
        {/* Contador de platillos eliminado según petición del usuario */}
      </div>

      {showPrinterSettings && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
          <div className='admin-panel w-full max-w-md p-5 space-y-4'>
            <div>
              <h2 className='text-lg font-semibold text-[#e0e0e0]'>Configurar impresoras</h2>
              <p className='text-sm text-[#a0a0a0] mt-1'>
                Ingresa la IP local de cada impresora Epson (ePOS-Print) una vez que estén conectadas a la red del
                restaurante. Mientras no las actives aquí, la app sigue usando el diálogo de impresión normal.
              </p>
            </div>

            <label className='flex items-center gap-2 text-sm text-[#e0e0e0]'>
              <input
                type='checkbox'
                checked={printerForm.printerEnabled}
                onChange={(e) => setPrinterForm((prev) => ({ ...prev, printerEnabled: e.target.checked }))}
              />
              Activar impresión automática (ePOS-Print)
            </label>

            <div className='grid grid-cols-2 gap-3'>
              <div className='col-span-2 text-xs uppercase tracking-wide text-[#a0a0a0]'>Impresora de cocina</div>
              <input
                type='text'
                placeholder='IP, ej. 192.168.1.50'
                value={printerForm.printerKitchenIp}
                onChange={(e) => setPrinterForm((prev) => ({ ...prev, printerKitchenIp: e.target.value }))}
                className='admin-input'
              />
              <input
                type='number'
                placeholder='Puerto (80)'
                value={printerForm.printerKitchenPort}
                onChange={(e) => setPrinterForm((prev) => ({ ...prev, printerKitchenPort: Number(e.target.value) }))}
                className='admin-input'
              />

              <div className='col-span-2 text-xs uppercase tracking-wide text-[#a0a0a0] mt-2'>Impresora de bebidas</div>
              <input
                type='text'
                placeholder='IP, ej. 192.168.1.51'
                value={printerForm.printerDrinksIp}
                onChange={(e) => setPrinterForm((prev) => ({ ...prev, printerDrinksIp: e.target.value }))}
                className='admin-input'
              />
              <input
                type='number'
                placeholder='Puerto (80)'
                value={printerForm.printerDrinksPort}
                onChange={(e) => setPrinterForm((prev) => ({ ...prev, printerDrinksPort: Number(e.target.value) }))}
                className='admin-input'
              />
            </div>

            <div className='flex justify-end gap-2 pt-2'>
              <button
                type='button'
                onClick={() => setShowPrinterSettings(false)}
                className='admin-button-secondary px-3 py-2 text-sm'
              >
                Cancelar
              </button>
              <button
                type='button'
                onClick={handleSavePrinterSettings}
                disabled={savingPrinterSettings}
                className='admin-button-primary px-3 py-2 text-sm'
              >
                {savingPrinterSettings ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'pos' && (
        <div className='grid gap-6 xl:grid-cols-[1.15fr_0.85fr]'>
          <section className='admin-panel p-5'>
            {!selectedCategory ? (
              <div>
                <div className='grid gap-4 md:grid-cols-2'>
                  {categories.map((group) => (
                    <button
                      key={group.category}
                      type='button'
                      onClick={() => setSelectedCategory(group.category)}
                      className='group relative overflow-hidden rounded-3xl border border-[#e6be7d]/10 shadow-sm transition duration-300 hover:border-[#e6be7d]/30 hover:shadow-xl'
                    >
                      <div className='absolute inset-y-0 left-0 h-full w-1/2 bg-[#0f1a34]/95' />
                      <img
                        src={getCategoryImageUrl(group.category)}
                        alt={group.category}
                        className='absolute right-0 top-0 h-full w-1/2 object-cover blur-sm brightness-90 transition duration-500 group-hover:scale-105'
                        onError={(event) => {
                          event.currentTarget.src = '/placeholder-image.svg';
                        }}
                      />
                      <div className='absolute inset-y-0 right-0 h-full w-1/2 bg-gradient-to-l from-[#0f1a34]/90 via-[#0f1a34]/20 to-transparent' />
                      <div className='relative h-full w-1/2 flex flex-col justify-center gap-2 p-6 text-left'>
                        <span className='inline-flex rounded-full bg-[#0b1d41]/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#a39bff]'>
                          {group.category}
                        </span>
                        <h3 className='text-2xl font-black text-[#e0e0e0]'>{group.category}</h3>
                        <p className='text-sm text-[#a1c5ff]'>{group.count} elementos</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className='mb-5 flex items-center justify-between gap-3'>
                  <button type='button' onClick={() => setSelectedCategory('')} className='admin-button-secondary px-4 py-2 text-sm'>← Volver a categorías</button>
                  <div>
                    <h2 className='text-xl font-black text-[#e0e0e0]'>{selectedCategory}</h2>
                    <p className='mt-1 text-sm text-[#e6be7d]'>{selectedMenuItems.length} platillo(s) disponibles</p>
                  </div>
                </div>
                <div className='grid gap-3 md:grid-cols-2'>
                  {selectedMenuItems.map((item) => (
                    <article key={item._id} className='rounded-2xl border border-[#e6be7d]/10 bg-[#e6be7d]/20 p-4'>
                      <div className='flex items-start justify-between gap-3'>
                        <div>
                          <h3 className='font-black text-[#e0e0e0]'>{item.name}</h3>
                          <p className='mt-1 text-sm text-[#e0e0e0]/75'>{item.description}</p>
                          <p className='mt-2 text-sm font-bold text-[#e0e0e0]'>{formatCurrency(item.price)}</p>
                        </div>
                        <button type='button' onClick={() => addToCart(item)} className='admin-button-primary px-3 py-2 text-xs'>Agregar</button>
                      </div>
                    </article>
                  ))}
                  {selectedMenuItems.length === 0 && (
                    <div className='rounded-2xl border border-dashed border-[#e6be7d]/20 p-6 text-center text-sm text-[#e6be7d]'>No hay platillos en esta categoría.</div>
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className='admin-panel p-5'>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <h2 className='text-xl font-black text-[#e0e0e0]'>Pedido actual</h2>
                <p className='mt-2 text-sm text-[#e6be7d]'>{
                  tables.find((table) => table._id === selectedTableId)?.name?.trim()
                    ? `Mesa ${tables.find((table) => table._id === selectedTableId)?.name}`
                    : tables.find((table) => table._id === selectedTableId)?.number
                      ? `Mesa ${tables.find((table) => table._id === selectedTableId)?.number}`
                      : 'No seleccionada'
                }</p>
              </div>
              <span className='admin-status admin-status-neutral'>{formatCurrency(total)}</span>
            </div>
            <label className='mt-4 block'>
              <span className='mb-2 block text-sm font-bold text-[#e0e0e0]'>Selecciona mesa</span>
              <select
                value={selectedTableId}
                onChange={(event) => setSelectedTableId(event.target.value)}
                className='admin-input w-full px-3 py-3 text-sm'
              >
                <option value=''>Elige una mesa</option>
                {sortedTables.map((table) => {
                  const occupied = isTableOccupied(table._id);
                  return (
                    <option key={table._id} value={table._id} disabled={occupied}>
                      {getTableLabel(table)}{occupied ? ' (Ocupada)' : ''}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className='mt-4'>
              <span className='mb-2 block text-sm font-bold text-[#e6be7d]'>Accesos rápidos</span>
              <div className='flex flex-wrap gap-2'>
                <button
                  type='button'
                  onClick={() => quickAddToCart((item) => /tortilla/i.test(item.name || ''), 'Tortillas extra')}
                  className='admin-button-secondary px-3 py-2 text-xs'
                >
                  + Tortillas extra
                </button>
                <button
                  type='button'
                  onClick={() => quickAddToCart((item) => /papas\s*fritas/i.test(item.name || ''), 'Papas extra')}
                  className='admin-button-secondary px-3 py-2 text-xs'
                >
                  + Papas extra
                </button>
              </div>
            </div>

            <div className='mt-4 space-y-3'>
              {cart.length === 0 && <p className='rounded-2xl border border-dashed border-[#e6be7d]/20 p-4 text-sm text-[#e6be7d]'>No hay platillos añadidos.</p>}
              {cart.map((entry) => (
                <div key={entry.id} className='rounded-2xl border border-[#e6be7d]/10 p-3'>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <p className='font-extrabold text-[#e0e0e0]'>{entry.name}</p>
                      <p className='text-xs text-[#e6be7d]'>{formatCurrency(entry.price)} c/u</p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button type='button' onClick={() => updateCartQuantity(entry.id, -1)} className='rounded-full bg-[#e6be7d]/14 p-2 text-[#141426]'><MinusIcon className='h-4 w-4' /></button>
                      <span className='min-w-8 text-center font-black text-[#e0e0e0]'>{entry.quantity}</span>
                      <button type='button' onClick={() => updateCartQuantity(entry.id, 1)} className='rounded-full bg-[#e6be7d]/14 p-2 text-[#141426]'><PlusIcon className='h-4 w-4' /></button>
                    </div>
                  </div>
                  <textarea
                    value={entry.observations}
                    onChange={(event) => updateCartNotes(entry.id, event.target.value)}
                    rows='2'
                    placeholder='Observaciones del platillo'
                    className='admin-input mt-3 w-full px-3 py-2 text-sm'
                  />
                </div>
              ))}
            </div>

            <label className='mt-4 block'>
              <span className='mb-2 block text-sm font-bold text-[#e6be7d]'>Observaciones generales</span>
              <textarea value={orderObservations} onChange={(event) => setOrderObservations(event.target.value)} rows='3' placeholder='Instrucciones generales del pedido' className='admin-input w-full px-3 py-2 text-sm' />
            </label>

            <button
              type='button'
              onClick={() => setIsToGoOrder((current) => !current)}
              className={`mt-4 w-full rounded-2xl border px-4 py-3 text-sm font-black transition ${
                isToGoOrder
                  ? 'border-[#e6be7d] bg-[#e6be7d] text-[#141426]'
                  : 'border-[#e6be7d]/30 bg-transparent text-[#e6be7d]'
              }`}
            >
              {isToGoOrder ? '✓ Para llevar' : 'Marcar como para llevar'}
            </button>

            <button type='button' onClick={handleCreateOrder} className='admin-button-primary mt-5 w-full py-3 font-black'>Confirmar pedido</button>
          </aside>
        </div>
      )}

      {['bebidas', 'kitchen'].includes(view) && (
        <section className='grid gap-4 xl:grid-cols-2'>
          {filteredOrders.map((order) => (
            <article key={order._id} className='admin-panel p-5'>
              <div className='flex items-start justify-between gap-3'>
                <div className='flex flex-col gap-3'>
                  {canEditOrderItems && (
                    <button type='button' onClick={() => handleDeleteOrder(order._id)} className='admin-button-danger w-fit px-3 py-2 text-sm'>Cancelar pedido</button>
                  )}
                  <div>
                    <p className='admin-kicker'>Pedido {order.orderNumber || `#${order._id?.slice(-6)}`}</p>
                    <h3 className='mt-1 text-xl font-black text-[#e0e0e0]'>{formatDate(order.createdAt)}</h3>
                    <p className='mt-1 text-base font-semibold text-[#e0e0e0]'>{
                      order?.table?.name?.trim()
                        ? `Mesa: ${order.table.name}`
                        : order?.table?.number
                          ? `Mesa: ${order.table.number}`
                          : 'Sin mesa'
                    }</p>
                  </div>
                </div>
                <div className='flex flex-col gap-2'>
                  {view === 'bebidas' && (
                    <>
                      <div className='admin-input px-3 py-2 text-sm font-semibold text-[#e0e0e0] bg-[#111827] border border-[#374151] rounded-2xl'>Preparando</div>
                      <button type='button' onClick={() => printToStation(order, 'bebidas', restaurant)} className='admin-button-secondary px-3 py-2 text-sm'>Reimprimir bebidas</button>
                    </>
                  )}
                  {view === 'kitchen' && (
                    <>
                      <div className='admin-input px-3 py-2 text-sm font-semibold text-[#e0e0e0] bg-[#111827] border border-[#374151] rounded-2xl'>Preparando</div>
                      <button type='button' onClick={() => printToStation(order, 'kitchen', restaurant)} className='admin-button-secondary px-3 py-2 text-sm'>Reimprimir cocina</button>
                    </>
                  )}
                </div>
              </div>
              <div className='mt-4 space-y-2'>
                {order.items?.filter((item) => {
                  // Exclude included items explicitly hidden (tostadas) everywhere
                  if (item.isIncluded && item.hideInBebidas) return false;
                  // In 'bebidas' and 'kitchen' we show only pending items.
                  if (view === 'bebidas') return isDrinkItem(item) && !item.delivered;
                  if (view === 'kitchen') return !isDrinkItem(item) && !item.delivered;
                  return true;
                }).map((item) => (
                  <div key={`${order._id}-${item.menuItem?._id || item.label || item.menuItem}`} className='rounded-2xl border border-[#e6be7d]/10 bg-[#e6be7d]/20 p-3'>
                    <div className='flex items-center justify-between gap-4'>
                        <div className='flex items-center gap-2'>
                          <span className='font-extrabold text-[#e0e0e0]'>{item.quantity}× {item.menuItem?.name || item.label || 'Platillo'}</span>
                          {item.delivered && (
                            <span className='inline-block rounded-full bg-[#ECFDF5] px-2 py-0.5 text-xs font-semibold text-[#065F46]'>Entregado</span>
                          )}
                        </div>
                        <span className='text-sm font-bold text-[#e0e0e0]'>{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</span>
                      </div>
                    {item.observations && <p className='mt-2 text-xs text-[#e0e0e0]'>Obs.: {item.observations}</p>}
                  </div>
                ))}
                {order.observations && <p className='rounded-2xl bg-[#e6be7d]/14 px-3 py-2 text-sm text-[#e0e0e0]'>Observaciones: {order.observations}</p>}
              </div>
            </article>
          ))}
          {filteredOrders.length === 0 && (
            <div className='admin-panel p-8 text-sm text-[#e6be7d]'>{
              view === 'bebidas'
                ? 'No hay bebidas ni postres pendientes.'
                : 'No hay pedidos pendientes en cocina.'
            }</div>
          )}
        </section>
      )}

      {view === 'entregas' && !selectedDeliveryTableId && (
        <section>
          <div className='mb-5 flex flex-wrap items-center gap-4'>
            <span className='flex items-center gap-2 text-sm font-semibold text-[#e0e0e0]'>
              <span className='inline-block h-3.5 w-3.5 rounded-full bg-[#22c55e]'></span> Mesa disponible · toca para crear un pedido
            </span>
            <span className='flex items-center gap-2 text-sm font-semibold text-[#e0e0e0]'>
              <span className='inline-block h-3.5 w-3.5 rounded-full bg-[#ef4444]'></span> Mesa ocupada · toca para ver sus pedidos
            </span>
          </div>
          <div
            className='grid gap-4'
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {sortedTables.map((table) => {
              const occupied = isTableOccupied(table._id);
              return (
                <button
                  key={table._id}
                  type='button'
                  onClick={() => handleDeliveryTableClick(table)}
                  className={`flex items-center justify-between gap-3 rounded-3xl border-2 px-6 py-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                    occupied
                      ? 'border-[#ef4444]/60 bg-[#ef4444]/15 text-[#fecaca]'
                      : 'border-[#22c55e]/60 bg-[#22c55e]/15 text-[#bbf7d0]'
                  }`}
                >
                  <span className='text-lg font-black whitespace-nowrap'>{getTableLabel(table)}</span>
                  <span className='shrink-0 whitespace-nowrap rounded-full bg-black/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wide'>
                    {occupied ? 'Ocupada' : 'Disponible'}
                  </span>
                </button>
              );
            })}
          </div>
          {sortedTables.length === 0 && (
            <div className='admin-panel p-8 text-sm text-[#e6be7d]'>No hay mesas registradas todavía. Agrégalas en la sección de Mesas.</div>
          )}
        </section>
      )}

      {view === 'entregas' && selectedDeliveryTableId && (
        <section>
          <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
            <button type='button' onClick={() => setSelectedDeliveryTableId(null)} className='admin-button-secondary px-4 py-2 text-sm'>← Volver a mesas</button>
            <h2 className='text-xl font-black text-[#e0e0e0]'>
              {selectedDeliveryTable ? getTableLabel(selectedDeliveryTable) : 'Mesa'}
            </h2>
          </div>
          <div className='grid gap-4 xl:grid-cols-2'>
            {deliveryOrdersForSelectedTable.map(renderDeliveryOrderCard)}
            {deliveryOrdersForSelectedTable.length === 0 && (
              <div className='admin-panel p-8 text-sm text-[#e6be7d]'>Esta mesa no tiene pedidos pendientes de entrega.</div>
            )}
          </div>
        </section>
      )}

      {view === 'history' && (
        <section className='admin-panel overflow-hidden'>
          <div className='border-b border-[#e6be7d]/10 p-5'>
            <div className='mb-3 flex justify-end'>
              <button type='button' onClick={downloadDailyReport} className='admin-button-primary px-4 py-2 text-sm'>
                Descargar reporte (Excel)
              </button>
            </div>
            <div className='grid gap-3 md:grid-cols-[1fr_220px]'>
              <label className='relative block'>
                <MagnifyingGlassIcon className='pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#e6be7d]' />
                <input type='search' value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder='Buscar pedido o platillo' className='admin-input w-full px-11 py-3 text-sm' />
              </label>
              <label className='relative block'>
                <FunnelIcon className='pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#e6be7d]' />
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className='admin-input w-full px-11 py-3 text-sm font-semibold'>
                  <option value='Todos'>Todos</option>
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className='space-y-6 p-5'>
            {historyGroups.map((group) => (
              <div key={group.day} className='rounded-[2rem] border border-[#e6be7d]/10 bg-[#141426]/95 p-5 shadow-sm'>
                <div className='mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
                  <div>
                    <p className='text-sm uppercase tracking-[0.24em] text-[#e6be7d]'>Historial diario</p>
                    <h2 className='mt-2 text-2xl font-black text-[#e0e0e0]'>{group.day}</h2>
                  </div>
                  <div className='rounded-3xl bg-[#0b1d41]/95 px-4 py-3 text-right'>
                    <p className='text-xs uppercase tracking-[0.24em] text-[#a1c5ff]'>Total ganado</p>
                    <p className='mt-1 text-xl font-black text-[#e0e0e0]'>{formatCurrency(group.total)}</p>
                  </div>
                </div>
                <div className='space-y-4'>
                  {group.orders.map((order) => (
                    <article key={order._id} className='rounded-3xl border border-[#e6be7d]/10 bg-[#0f172f]/80 p-4'>
                      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                        <div>
                          <p className='text-sm font-bold uppercase tracking-[0.18em] text-[#e6be7d]'>Pedido {order.orderNumber || `#${order._id.slice(-6)}`}</p>
                          <p className='mt-1 text-sm text-[#e0e0e0]'>{formatDate(order.createdAt)}</p>
                          <p className='mt-1 text-sm text-[#c19a6b]'>{
                            order?.table?.name?.trim()
                              ? `Mesa ${order.table.name}`
                              : order?.table?.number
                                ? `Mesa ${order.table.number}`
                                : 'Sin mesa'
                          }</p>
                        </div>
                        <div className='flex flex-col items-start gap-2 sm:items-end'>
                          <span className='text-lg font-black text-[#e0e0e0]'>{formatCurrency(order.total)}</span>
                          <span className={`admin-status ${getStatusClass(order.status)}`}>{order.status}</span>
                        </div>
                        <div className='mt-3 flex flex-wrap gap-2'>
                          <button type='button' onClick={() => printFullOrderToKitchen(order, restaurant)} className='admin-button-secondary px-3 py-2 text-sm'>Imprimir comanda completa</button>
                          <button type='button' onClick={() => downloadOrderPdf(order)} className='admin-button-secondary px-3 py-2 text-sm'>Guardar PDF</button>
                        </div>
                      </div>
                      <p className='mt-4 text-sm text-[#e0e0e0]'>
                        {order.items?.filter((it) => !(it.isIncluded && it.hideInBebidas)).map((item) => `${item.quantity}× ${item.menuItem?.name || item.label || 'Platillo'}`).join(', ')}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ))}

            {historyGroups.length === 0 && (
              <div className='admin-panel p-8 text-sm text-[#e6be7d]'>No hay pedidos registrados en el historial.</div>
            )}
          </div>
        </section>
      )}

    </div>
  );
};
