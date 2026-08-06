import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createOrder, getMenuItems, getOrders, getTables, updateOrderStatus, updateOrderSectionStatus, updateOrderItems } from '../services/adminApi.js';
import { Spinner } from '../features/auth/components/Spinner.jsx';
import { useAuthStore } from '../features/auth/store/authStore.js';
import { showError, showSuccess } from '../shared/utils/toast.js';
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
const COMANDA_TEMPLATE_URL = '/comanda-template.jpg';

const normalizeOrderStatus = (status = '') => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'pendiente') return 'Pendiente';
  if (['preparando', 'preparacion', 'preparación'].includes(value)) return 'Preparando';
  if (['entregado', 'completado', 'completada'].includes(value)) return 'Entregado';
  if (['cancelado', 'cancelada'].includes(value)) return 'Cancelado';
  return 'Pendiente';
};

// Coordenadas medidas directamente sobre comanda-template.jpg (688 x 1520 px).
// El ticket se imprime a 90mm de ancho, así que usamos ese mismo factor de escala
// para el alto en vez de forzar 210mm (lo que antes desalineaba todo).
const TEMPLATE_PX = { width: 688, height: 1520 };
const PAGE_WIDTH_MM = 90;
const PX_TO_MM = PAGE_WIDTH_MM / TEMPLATE_PX.width;
const PAGE_HEIGHT_MM = Math.round(TEMPLATE_PX.height * PX_TO_MM * 100) / 100; // ≈ 198.84mm
const mm = (px) => Math.round(px * PX_TO_MM * 100) / 100;

// Líneas horizontales reales de la tabla de artículos, medidas sobre la plantilla
// (no son perfectamente uniformes, por eso se usan las posiciones exactas en vez
// de un alto de fila promedio, que dejaba texto cruzado por una línea).
const TABLE_ROW_LINES_PX = [593, 633, 667, 698, 728, 759, 804, 835, 879, 925, 971, 1017, 1063, 1109, 1158];
const TABLE_ROWS_PRINTED = TABLE_ROW_LINES_PX.length - 1; // 14 renglones
const TABLE_FIRST_ROW_TOP_PX = TABLE_ROW_LINES_PX[0];
const TABLE_LAST_ROW_BOTTOM_PX = TABLE_ROW_LINES_PX[TABLE_ROW_LINES_PX.length - 1];
const TABLE_ROW_HEIGHT_PX = (TABLE_LAST_ROW_BOTTOM_PX - TABLE_FIRST_ROW_TOP_PX) / TABLE_ROWS_PRINTED; // ≈ 40.4px promedio (solo se usa si hay más artículos que renglones)
const TABLE_COLS_PX = { cantidad: [47, 170], descripcion: [170, 502], precio: [502, 640] };

const generateOrderPrintHtml = (order) => {
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
  const waiter = order.waiter || '';
  const guests = order.guests || '';

  const visibleItems = (order.items || []).filter((item) => !(item.isIncluded && item.hideInBebidas));

  // Si hay más artículos que renglones impresos (14), encogemos el alto de fila
  // para que sigan cabiendo antes de la fila de "Total a pagar" (en vez de
  // desbordarse encima de ella). Con 14 o menos, usamos las líneas reales
  // medidas sobre la plantilla (no perfectamente uniformes) para que el texto
  // nunca quede cruzado por una línea divisoria.
  const useRealLines = visibleItems.length <= TABLE_ROWS_PRINTED;
  const rowHeightPx = Math.min(
    TABLE_ROW_HEIGHT_PX,
    visibleItems.length > 0 ? (TABLE_LAST_ROW_BOTTOM_PX - TABLE_FIRST_ROW_TOP_PX) / visibleItems.length : TABLE_ROW_HEIGHT_PX
  );
  const rowFontPx = rowHeightPx < 30 ? 7 : 8;

  // Top y alto disponible (en px de plantilla) para el renglón "index".
  const getRowGeometry = (index) => {
    if (useRealLines) {
      const top = TABLE_ROW_LINES_PX[index];
      const bottom = TABLE_ROW_LINES_PX[index + 1];
      return { top, height: bottom - top };
    }
    const top = TABLE_FIRST_ROW_TOP_PX + index * rowHeightPx;
    return { top, height: rowHeightPx };
  };

  const itemsHtml = visibleItems
    .map((item, index) => {
      const itemName = item.menuItem?.name || item.label || 'Platillo';
      const itemTotal = formatCurrency(Number(item.price || 0) * Number(item.quantity || 0));
      const { top, height } = getRowGeometry(index);
      const rowTop = mm(top) + Math.min(1.3, mm(height) / 3);
      return `
        <div class="row-cell" style="top: ${rowTop}mm; left: ${mm(TABLE_COLS_PX.cantidad[0])}mm; width: ${mm(TABLE_COLS_PX.cantidad[1] - TABLE_COLS_PX.cantidad[0])}mm; font-size: ${rowFontPx}px; text-align: center;">${item.quantity}</div>
        <div class="row-cell" style="top: ${rowTop}mm; left: ${mm(TABLE_COLS_PX.descripcion[0] + 4)}mm; width: ${mm(TABLE_COLS_PX.descripcion[1] - TABLE_COLS_PX.descripcion[0] - 6)}mm; font-size: ${rowFontPx}px; text-align: left;">${itemName}</div>
        <div class="row-cell" style="top: ${rowTop}mm; left: ${mm(TABLE_COLS_PX.precio[0])}mm; width: ${mm(TABLE_COLS_PX.precio[1] - TABLE_COLS_PX.precio[0] - 3)}mm; font-size: ${rowFontPx}px; text-align: right;">${itemTotal}</div>
      `;
    })
    .join('');

  const templateImageUrl = new URL(COMANDA_TEMPLATE_URL, window.location.origin).href;

  return `
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <base href="${window.location.origin}/" />
        <title>Comanda ${order.orderNumber || order._id}</title>
        <style>
          @page { margin: 0; size: ${PAGE_WIDTH_MM}mm ${PAGE_HEIGHT_MM}mm; }
          html, body { width: ${PAGE_WIDTH_MM}mm; height: ${PAGE_HEIGHT_MM}mm; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; }
          .page { position: relative; width: ${PAGE_WIDTH_MM}mm; height: ${PAGE_HEIGHT_MM}mm; }
          .template { position: absolute; inset: 0; width: ${PAGE_WIDTH_MM}mm; height: ${PAGE_HEIGHT_MM}mm; object-fit: fill; }
          .overlay { position: absolute; inset: 0; pointer-events: none; }
          .field { position: absolute; display: flex; flex-direction: column; }
          .value { font-size: 10px; font-weight: 700; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .value.big { font-size: 12px; color: #c00; }
          .value.mask { background: #fff; padding: 2px 1px; }
          .mask-box { position: absolute; background: #fff; }
          .row-cell { position: absolute; font-weight: 600; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .totals-value { position: absolute; font-size: 11px; font-weight: 700; }
          .observations { position: absolute; left: ${mm(47)}mm; top: ${mm(1240)}mm; width: ${mm(593)}mm; font-size: 8px; }
        </style>
      </head>
      <body>
        <div class="page">
          <img src="${templateImageUrl}" class="template" alt="Comanda plantilla" />
          <div class="overlay">
            <!-- Día / Mes / Año (debajo del encabezado impreso, dentro de su misma celda) -->
            <div class="field" style="top: ${mm(433)}mm; left: ${mm(48)}mm; width: ${mm(119 - 48)}mm; text-align: center;">
              <span class="value">${day}</span>
            </div>
            <div class="field" style="top: ${mm(433)}mm; left: ${mm(119)}mm; width: ${mm(194 - 119)}mm; text-align: center;">
              <span class="value">${month}</span>
            </div>
            <div class="field" style="top: ${mm(433)}mm; left: ${mm(194)}mm; width: ${mm(257 - 194)}mm; text-align: center;">
              <span class="value">${year}</span>
            </div>
            <!-- Hora: se escribe sobre la línea impresa "Hora:____" -->
            <div class="field" style="top: ${mm(444)}mm; left: ${mm(257)}mm; width: ${mm(435 - 257)}mm; text-align: center;">
              <span class="value">${time}</span>
            </div>
            <!-- No. de comanda: primero tapamos el placeholder impreso "No.1592" con un rectángulo blanco, luego escribimos el número real encima -->
            <div class="mask-box" style="top: ${mm(434)}mm; left: ${mm(437)}mm; width: ${mm(640 - 437 - 2)}mm; height: ${mm(483 - 434)}mm;"></div>
            <div class="field" style="top: ${mm(438)}mm; left: ${mm(435)}mm; width: ${mm(640 - 435)}mm; text-align: center;">
              <span class="value big">No.${order.orderNumber || order._id}</span>
            </div>
            <!-- Mesa / Mesero / Personas: debajo de la etiqueta impresa, dentro de la misma barra gris (484mm-557mm) -->
            <div class="field" style="top: ${mm(520)}mm; left: ${mm(48 + 4)}mm; width: ${mm(170 - 48 - 6)}mm; text-align: center;">
              <span class="value" style="font-size: 9px;">${tableLabel}</span>
            </div>
            <div class="field" style="top: ${mm(520)}mm; left: ${mm(170 + 4)}mm; width: ${mm(502 - 170 - 8)}mm; text-align: center;">
              <span class="value" style="font-size: 9px;">${waiter || ''}</span>
            </div>
            <div class="field" style="top: ${mm(520)}mm; left: ${mm(502 + 4)}mm; width: ${mm(640 - 502 - 6)}mm; text-align: center;">
              <span class="value" style="font-size: 9px;">${guests || ''}</span>
            </div>
            <!-- Renglones de artículos, alineados con la cuadrícula ya impresa -->
            ${itemsHtml}
            <!-- Total: sobre la línea impresa junto a "Total a pagar Q." -->
            <div class="totals-value" style="top: ${mm(1170)}mm; left: ${mm(502)}mm; width: ${mm(640 - 502 - 3)}mm; text-align: right;">${formatCurrency(order.total)}</div>
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

const printOrder = (order) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(generateOrderPrintHtml(order));
  printWindow.document.close();
  printWindow.focus();
};
const partStatusOptions = ['Pendiente', 'Entregado'];
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

export const Orders = () => {
  const location = useLocation();
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
  const [selectedCategory, setSelectedCategory] = useState('');

  const view = useMemo(() => {
    if (location.pathname.includes('bebidas')) return 'bebidas';
    if (location.pathname.includes('cocina')) return 'kitchen';
    if (location.pathname.includes('entregas')) return 'entregas';
    if (location.pathname.includes('historial')) return 'history';
    return 'pos';
  }, [location.pathname]);

  const userRole = useAuthStore((state) => state.user?.role);
  const canEditOrderItems = useMemo(
    () => ['ADMIN', 'RECEPCION', 'COCINA'].includes(userRole),
    [userRole],
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [menuData, ordersData, tablesData] = await Promise.all([getMenuItems(), getOrders(), getTables()]);
        setMenuItems(Array.isArray(menuData) ? menuData : menuData?.menuItems || []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setTables(Array.isArray(tablesData) ? tablesData : []);
        if (!selectedTableId && Array.isArray(tablesData) && tablesData.length > 0) {
          setSelectedTableId(tablesData[0]._id);
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

  const addToCart = (menuItem) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.menuItem === menuItem._id);
      if (existing) {
        return current.map((entry) => (entry.menuItem === menuItem._id ? { ...entry, quantity: entry.quantity + 1 } : entry));
      }
      return [...current, { menuItem: menuItem._id, name: menuItem.name, price: menuItem.price, quantity: 1, observations: '' }];
    });
  };

  const updateCartQuantity = (menuItemId, delta) => {
    setCart((current) => current.flatMap((entry) => {
      if (entry.menuItem !== menuItemId) return [entry];
      const nextQuantity = entry.quantity + delta;
      return nextQuantity > 0 ? [{ ...entry, quantity: nextQuantity }] : [];
    }));
  };

  const updateCartNotes = (menuItemId, observations) => {
    setCart((current) => current.map((entry) => (entry.menuItem === menuItemId ? { ...entry, observations } : entry)));
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

  const handlePartStatusChange = async (orderId, section, status) => {
    try {
      const updated = await updateOrderSectionStatus(orderId, section, status);
      setOrders((current) => current.map((order) => (order._id === updated._id ? updated : order)));
      showSuccess('Estado de sección actualizado correctamente');
    } catch (error) {
      console.error(error);
      showError(error?.response?.data?.error || 'No se pudo actualizar el estado de la sección');
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
      const preservedHiddenIncludedItems = (existing.items || []).filter((it) => {
        if (!it.delivered || !it.isIncluded || !it.hideInBebidas) return false;
        const editMatch = editingItems.some((edit) => {
          const editMenuItem = edit.menuItem ? String(edit.menuItem) : '';
          const existingMenuItem = String(it.menuItem?._id || it.menuItem || '');
          const editLabel = String(edit.label || '').trim();
          const existingLabel = String(it.label || '').trim();
          return editMenuItem && editMenuItem === existingMenuItem && editLabel === existingLabel;
        });
        return !editMatch;
      }).map((it) => ({
        menuItem: it.menuItem?._id || it.menuItem,
        label: it.label || '',
        quantity: it.quantity,
        observations: it.observations || '',
        delivered: true,
        isIncluded: true,
        price: it.price,
        hideInBebidas: Boolean(it.hideInBebidas),
      }));
      const payloadItems = [
        ...preservedHiddenIncludedItems,
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
      const updated = await updateOrderItems(editingOrderId, payloadItems);
      setOrders((current) => current.map((o) => (o._id === updated._id ? updated : o)));
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

    try {
      const payload = {
        table: selectedTableId,
        items: cart.map((entry) => ({ menuItem: entry.menuItem, quantity: entry.quantity, observations: entry.observations })),
        observations: orderObservations,
      };

      const created = await createOrder(payload);
      setCart([]);
      setOrderObservations('');
      setOrders((current) => [created, ...current]);
      showSuccess(`Pedido ${created.orderNumber || created._id?.slice(-6)} registrado`);
    } catch (error) {
      console.error(error);
      showError(error?.response?.data?.error || 'No se pudo registrar el pedido');
    }
  };

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
                    ? 'Muestra todos los pedidos pendientes para entrega, incluso si no están listos ambos lados.'
                    : 'Consulta el historial completo del restaurante con filtros por estado.'}
          </p>
        </div>
        {/* Contador de platillos eliminado según petición del usuario */}
      </div>

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
                        <span className='inline-flex rounded-full bg-[#0b1d41]/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#a39bff]'>
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
                {tables.map((table) => (
                  <option key={table._id} value={table._id}>
                    {table.name?.trim() ? table.name : `Mesa ${table.number}`}
                  </option>
                ))}
              </select>
            </label>

            <div className='mt-4 space-y-3'>
              {cart.length === 0 && <p className='rounded-2xl border border-dashed border-[#e6be7d]/20 p-4 text-sm text-[#e6be7d]'>No hay platillos añadidos.</p>}
              {cart.map((entry) => (
                <div key={entry.menuItem} className='rounded-2xl border border-[#e6be7d]/10 p-3'>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <p className='font-extrabold text-[#e0e0e0]'>{entry.name}</p>
                      <p className='text-xs text-[#e6be7d]'>{formatCurrency(entry.price)} c/u</p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button type='button' onClick={() => updateCartQuantity(entry.menuItem, -1)} className='rounded-full bg-[#e6be7d]/14 p-2 text-[#141426]'><MinusIcon className='h-4 w-4' /></button>
                      <span className='min-w-8 text-center font-black text-[#e0e0e0]'>{entry.quantity}</span>
                      <button type='button' onClick={() => updateCartQuantity(entry.menuItem, 1)} className='rounded-full bg-[#e6be7d]/14 p-2 text-[#141426]'><PlusIcon className='h-4 w-4' /></button>
                    </div>
                  </div>
                  <textarea
                    value={entry.observations}
                    onChange={(event) => updateCartNotes(entry.menuItem, event.target.value)}
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

            <button type='button' onClick={handleCreateOrder} className='admin-button-primary mt-5 w-full py-3 font-black'>Confirmar pedido</button>
          </aside>
        </div>
      )}

      {['bebidas', 'kitchen', 'entregas'].includes(view) && (
        <section className='grid gap-4 xl:grid-cols-2'>
          {filteredOrders.map((order) => (
            <article key={order._id} className='admin-panel p-5'>
              <div className='flex items-center justify-between gap-3'>
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
                <div className='flex flex-col gap-2'>
                  {view === 'bebidas' && (
                    <select value={order.drinkStatus} onChange={(event) => handlePartStatusChange(order._id, 'drink', event.target.value)} className='admin-input px-3 py-2 text-sm font-semibold'>
                      {partStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  )}
                  {view === 'kitchen' && (
                    <select value={order.kitchenStatus} onChange={(event) => handlePartStatusChange(order._id, 'kitchen', event.target.value)} className='admin-input px-3 py-2 text-sm font-semibold'>
                      {partStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  )}
                  {view === 'entregas' && (
                    <>
                      <select value={normalizeOrderStatus(order.status)} onChange={(event) => handleStatusChange(order._id, event.target.value)} className='admin-input px-3 py-2 text-sm font-semibold'>
                        {deliveryStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <button type='button' onClick={() => printOrder(order)} className='admin-button-secondary px-3 py-2 text-sm'>Imprimir comanda</button>
                    </>
                  )}
                  {canEditOrderItems && (
                    <button type='button' onClick={() => openEditor(order)} className='admin-button-secondary px-3 py-2 text-sm'>Editar</button>
                  )}
                </div>
              </div>
              <div className='mt-4 space-y-2'>
                {order.items?.filter((item) => {
                  // Exclude included items explicitly hidden (tostadas) everywhere
                  if (item.isIncluded && item.hideInBebidas) return false;
                  // In 'bebidas' and 'kitchen' we show only pending items.
                  // In 'entregas' we must show all items (delivered and pending), except hidden ones.
                  if (view === 'bebidas') return isDrinkItem(item) && !item.delivered;
                  if (view === 'kitchen') return !isDrinkItem(item) && !item.delivered;
                  if (view === 'entregas') return true;
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
          ))}
          {filteredOrders.length === 0 && (
            <div className='admin-panel p-8 text-sm text-[#e6be7d]'>{
              view === 'bebidas'
                ? 'No hay bebidas ni postres pendientes.'
                : view === 'kitchen'
                  ? 'No hay pedidos pendientes en cocina.'
                  : 'No hay pedidos listos para entrega.'
            }</div>
          )}
        </section>
      )}

      {view === 'history' && (
        <section className='admin-panel overflow-hidden'>
          <div className='border-b border-[#e6be7d]/10 p-5'>
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
                        <button type='button' onClick={() => printOrder(order)} className='admin-button-secondary mt-3 px-3 py-2 text-sm'>Imprimir comanda</button>
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
