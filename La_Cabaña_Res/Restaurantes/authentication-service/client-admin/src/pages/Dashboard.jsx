import { useEffect, useMemo, useState } from 'react';
import { getMenuItems, getOrders } from '../services/adminApi.js';
import { Spinner } from '../features/auth/components/Spinner.jsx';
import {
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  FireIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value || 0));

const isSameDay = (value, date) => {
  if (!value) return false;
  const current = new Date(value);
  return (
    current.getFullYear() === date.getFullYear() &&
    current.getMonth() === date.getMonth() &&
    current.getDate() === date.getDate()
  );
};

const normalizeStatus = (status = '') => status.toString().toLowerCase();

export const Dashboard = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [menuItemsData, ordersData] = await Promise.all([getMenuItems(), getOrders()]);
        setMenuItems(Array.isArray(menuItemsData) ? menuItemsData : menuItemsData?.menuItems || []);
        setOrders(Array.isArray(ordersData) ? ordersData : ordersData?.orders || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const analytics = useMemo(() => {
    const today = new Date();
    const dailySales = orders
      .filter((order) => isSameDay(order.createdAt, today))
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pendingOrders = orders.filter((order) => ['pendiente', 'preparando', 'preparación'].includes(normalizeStatus(order.status))).length;
    const deliveredOrders = orders.filter((order) => ['entregado', 'entregada', 'completado', 'completada'].includes(normalizeStatus(order.status))).length;
    const soldMap = new Map();
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        // Excluir items incluidos (p. ej. tortillas gratis) del ranking interno
        if (item.isIncluded) return;
        const name = item.menuItem?.name || item.label || 'Producto sin nombre';
        soldMap.set(name, (soldMap.get(name) || 0) + Number(item.quantity || 0));
      });
    });
    const topProducts = [...soldMap.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return { pendingOrders, deliveredOrders, dailySales, topProducts };
  }, [orders]);

  if (loading) return <Spinner />;

  return (
    <div className='admin-page space-y-8'>
      <section className='admin-panel overflow-hidden p-6 lg:p-8'>
        <div className='grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center'>
          <div>
            <p className='admin-kicker'>Sistema interno</p>
            <h1 className='admin-title mt-2'>Resumen operativo del restaurante</h1>
            <p className='admin-subtitle mt-4 max-w-2xl text-sm leading-6'>
              El flujo está centrado en ventas internas, cocina y control del historial de pedidos.
            </p>
          </div>
          <div className='rounded-3xl bg-gradient-to-br from-[#141426] via-[#e6be7d] to-[#141426] p-5 text-white shadow-2xl'>
            <div className='flex items-center gap-3'>
              <FireIcon className='h-9 w-9 text-[#e6be7d]' />
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.16em] text-[#e0e0e0]/80'>Ritmo del día</p>
                <p className='text-2xl font-black text-[#ffffff]'>{analytics.pendingOrders} pedidos activos</p>
              </div>
            </div>
            <div className='mt-5 admin-progress bg-[#e0e0e0]/12'><span style={{ width: `${Math.min(100, analytics.pendingOrders * 18 + 10)}%` }} /></div>
            <p className='mt-3 text-sm text-[#e0e0e0]/80'>{formatCurrency(analytics.dailySales)} en ventas registradas hoy</p>
          </div>
        </div>
      </section>

      <section className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <article className='admin-card admin-metric p-5'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-sm font-bold text-[#e6be7d]'>Ventas del día</p>
              <p className='mt-4 text-3xl font-black text-[#e0e0e0]'>{formatCurrency(analytics.dailySales)}</p>
              <p className='mt-2 text-xs font-semibold text-[#e6be7d]'>Pedidos facturados hoy</p>
            </div>
            <div className='rounded-2xl bg-[#e6be7d]/14 p-3 text-[#e0e0e0] ring-1 ring-[#e6be7d]/10'><BanknotesIcon className='h-6 w-6' /></div>
          </div>
        </article>
        <article className='admin-card admin-metric p-5'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-sm font-bold text-[#e6be7d]'>Pedidos activos</p>
              <p className='mt-4 text-3xl font-black text-[#e0e0e0]'>{analytics.pendingOrders}</p>
              <p className='mt-2 text-xs font-semibold text-[#e6be7d]'>Pendientes o en preparación</p>
            </div>
            <div className='rounded-2xl bg-[#e6be7d]/14 p-3 text-[#e0e0e0] ring-1 ring-[#e6be7d]/10'><ShoppingBagIcon className='h-6 w-6' /></div>
          </div>
        </article>
        <article className='admin-card admin-metric p-5'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-sm font-bold text-[#e6be7d]'>Pedidos entregados</p>
              <p className='mt-4 text-3xl font-black text-[#e0e0e0]'>{analytics.deliveredOrders}</p>
              <p className='mt-2 text-xs font-semibold text-[#e6be7d]'>Órdenes cerradas</p>
            </div>
            <div className='rounded-2xl bg-[#e6be7d]/14 p-3 text-[#e0e0e0] ring-1 ring-[#e6be7d]/10'><ClipboardDocumentCheckIcon className='h-6 w-6' /></div>
          </div>
        </article>
        <article className='admin-card admin-metric p-5'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-sm font-bold text-[#e6be7d]'>Catálogo disponible</p>
              <p className='mt-4 text-3xl font-black text-[#e0e0e0]'>{menuItems.length}</p>
              <p className='mt-2 text-xs font-semibold text-[#e6be7d]'>Platillos activos</p>
            </div>
            <div className='rounded-2xl bg-[#e6be7d]/14 p-3 text-[#e0e0e0] ring-1 ring-[#e6be7d]/10'><ShoppingBagIcon className='h-6 w-6' /></div>
          </div>
        </article>
      </section>
      <section className='grid gap-6 xl:grid-cols-[1.05fr_0.95fr]'>
        <div className='admin-panel p-6'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <p className='admin-kicker'>Productos más vendidos</p>
              <h2 className='mt-1 text-xl font-black text-[#e0e0e0]'>Ranking interno</h2>
            </div>
            <span className='admin-status admin-status-warning'>{menuItems.length} productos</span>
          </div>
          <div className='mt-6 space-y-4'>
            {analytics.topProducts.length === 0 && <p className='rounded-2xl border border-dashed border-[#e6be7d]/20 p-6 text-center text-sm text-[#e6be7d]'>Aún no hay ventas registradas.</p>}
            {analytics.topProducts.map((item, index) => {
              const maxQuantity = Math.max(...analytics.topProducts.map((product) => product.quantity), 1);
              const width = Math.max(14, (item.quantity / maxQuantity) * 100);
              return (
                <div key={`${item.name}-${index}`} className='rounded-2xl border border-[#e6be7d]/10 bg-[#e6be7d]/18 p-4'>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <p className='font-extrabold text-[#e0e0e0]'>{index + 1}. {item.name}</p>
                      <p className='text-xs font-semibold text-[#e6be7d]'>{item.quantity} unidades registradas</p>
                    </div>
                    <span className='admin-status admin-status-neutral'>{Math.round(width)}%</span>
                  </div>
                  <div className='mt-3 admin-progress'><span style={{ width: `${width}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className='admin-panel p-6'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <p className='admin-kicker'>Estado del servicio</p>
              <h2 className='mt-1 text-xl font-black text-[#e0e0e0]'>Operación del restaurante</h2>
            </div>
            <span className='admin-status admin-status-success'>Online</span>
          </div>
          <div className='mt-6 space-y-4'>
            <div className='rounded-2xl border border-[#e6be7d]/10 bg-[#141426]/75 p-4'>
              <p className='font-extrabold text-[#e0e0e0]'>1. Punto de venta</p>
              <p className='text-sm text-[#e6be7d]'>Creación rápida de pedidos internos y cálculo de totales.</p>
            </div>
            <div className='rounded-2xl border border-[#e6be7d]/10 bg-[#141426]/75 p-4'>
              <p className='font-extrabold text-[#e0e0e0]'>2. Cocina</p>
              <p className='text-sm text-[#e6be7d]'>Actualización del estado de pedidos en tiempo real.</p>
            </div>
            <div className='rounded-2xl border border-[#e6be7d]/10 bg-[#141426]/75 p-4'>
              <p className='font-extrabold text-[#e0e0e0]'>3. Historial</p>
              <p className='text-sm text-[#e6be7d]'>Todos los pedidos quedan registrados con observaciones y estado.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
