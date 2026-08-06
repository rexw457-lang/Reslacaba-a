import { useEffect, useMemo, useState } from 'react';
import useCartStore from '../../features/cart/store/cartStore.js';
import { ClientButton } from '../../shared/components/ui/ClientButton.jsx';
import { createOrder, getTablesForRestaurant } from '../../services/adminApi.js';
import { showError, showSuccess } from '../../shared/utils/toast.js';

const ORDER_STEPS = [
  { key: 'pendiente', title: 'Pendiente', description: 'Tu pedido fue recibido y se confirmará en breve.' },
  { key: 'preparacion', title: 'En preparación', description: 'El restaurante ya está trabajando tu pedido.' },
  { key: 'entregado', title: 'Entregado', description: 'Tu pedido ha sido completado y entregado correctamente.' },
];

const formatPrice = (value) => `Q ${Number(value || 0).toFixed(2)}`;
const formatOrderCode = (id) => (id ? `ORD-${String(id).slice(-6).toUpperCase()}` : 'PENDIENTE');

export const ClientOrdersPage = () => {
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal());
  const clearCart = useCartStore((state) => state.clear);

  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState('');
  const [selectedTableNumber, setSelectedTableNumber] = useState(null);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('pendiente');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');

  const restaurantId = useMemo(() => {
    if (!items.length) return '';
    return items[0]?.restaurant?._id || items[0]?.restaurant || items[0]?.restaurantId || '';
  }, [items]);

  const sameRestaurant = useMemo(
    () => items.length === 0 || items.every((item) => String(item.restaurant?._id || item.restaurant || item.restaurantId) === String(restaurantId)),
    [items, restaurantId],
  );

  const canSubmitOrder = Boolean(items.length && tableId && sameRestaurant && !loading && tables.length > 0);

  useEffect(() => {
    const loadTables = async () => {
      if (!restaurantId) {
        setTables([]);
        return;
      }
      try {
        setLoading(true);
        const fetchedTables = await getTablesForRestaurant(restaurantId);
        setTables(Array.isArray(fetchedTables) ? fetchedTables : []);
        if (Array.isArray(fetchedTables) && fetchedTables.length > 0) {
          setTableId((prev) => prev || fetchedTables[0]._id);
          setSelectedTableNumber((prev) => prev || fetchedTables[0].number);
        }
      } catch (error) {
      console.error(error);
      showError('No se pudieron cargar las mesas disponibles');
      } finally {
        setLoading(false);
      }
    };

    loadTables();
  }, [restaurantId]);

  useEffect(() => {
    const selected = tables.find((tableItem) => String(tableItem._id) === String(tableId));
    setSelectedTableNumber(selected?.number ?? null);
  }, [tableId, tables]);

  useEffect(() => {
    if (formError) {
      setFormError('');
    }
  }, [items.length, tableId, sameRestaurant, tables.length, formError]);

  const getValidationMessage = () => {
    if (!items.length) return 'El carrito está vacío. Agrega productos antes de confirmar el pedido.';
    if (!sameRestaurant) return 'Los productos deben pertenecer al mismo restaurante para confirmar el pedido.';
    if (!tableId) return 'Selecciona una mesa para el pedido.';
    if (tables.length === 0) return 'No hay mesas disponibles en este restaurante.';
    return '';
  };

  const onConfirmOrder = async () => {
    const validationMessage = getValidationMessage();
    if (validationMessage) {
      setFormError(validationMessage);
      showError(validationMessage);
      return;
    }

    const payload = {
      table: tableId,
      items: items.map((item) => ({ menuItem: item._id, quantity: item.qty || 1 })),
    };

    try {
      setLoading(true);
      const createdOrder = await createOrder(payload);
      setOrder(createdOrder);
      setStatus(createdOrder.status || 'pendiente');
      setMessage('Tu pedido fue confirmado correctamente.');
      showSuccess('Pedido confirmado');
      clearCart();
      setFormError('');
    } catch (error) {
      const apiMessage = error?.response?.data?.error || error?.message || 'No se pudo crear el pedido.';
      setFormError(apiMessage);
      showError(apiMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='grid gap-8 lg:grid-cols-[1.05fr_0.95fr]'>
      <section className='rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl sm:p-8'>
        <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Confirmación de pedido</p>
        <h1 className='mt-1 text-3xl font-black text-gray-900'>Finaliza tu orden</h1>
        <p className='mt-2 text-gray-700'>
          Revisa tu carrito, selecciona mesa y confirma el pedido. Aquí tienes el resumen antes de enviarlo al restaurante.
        </p>

        {!items.length && (
          <div className='mt-8 rounded-3xl border border-dashed border-gray-300 bg-slate-50 p-6 text-gray-700'>
            No tienes productos en el carrito. Agrega platillos desde el menú para continuar.
          </div>
        )}

        {items.length > 0 && (
          <div className='mt-8 space-y-6'>
            <div className='rounded-3xl border border-gray-200 bg-slate-50 p-5'>
              <h2 className='text-lg font-semibold text-gray-900'>Resumen del pedido</h2>
              <div className='mt-4 space-y-4'>
                {items.map((item) => (
                  <div key={item._id} className='flex items-center justify-between gap-4 rounded-3xl border border-gray-200 bg-white p-4'>
                    <div>
                      <p className='font-semibold text-gray-900'>{item.name}</p>
                      <p className='text-sm text-gray-600'>Cantidad: {item.qty}</p>
                    </div>
                    <p className='font-semibold text-main-blue'>{formatPrice(Number(item.price) * (item.qty || 1))}</p>
                  </div>
                ))}
              </div>
              <div className='mt-6 flex items-center justify-between border-t border-gray-200 pt-4'>
                <span className='font-semibold text-gray-900'>Total</span>
                <span className='text-lg font-bold text-gray-900'>{formatPrice(subtotal)}</span>
              </div>
            </div>

            {!sameRestaurant && (
              <div className='rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
                El carrito contiene productos de más de un restaurante. Mantén una sola selección para confirmar el pedido.
              </div>
            )}

            <div className='grid gap-5 sm:grid-cols-2'>
              <label className='block space-y-2'>
                <span className='text-sm font-medium text-gray-900'>Mesa</span>
                <select
                  value={tableId}
                  onChange={(event) => setTableId(event.target.value)}
                  className='w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-main-blue focus:ring-2 focus:ring-main-blue/20'
                >
                  <option value=''>Elige una mesa</option>
                  {tables.map((table) => (
                    <option key={table._id} value={table._id}>
                      Mesa {table.number} • Capacidad {table.capacity}
                    </option>
                  ))}
                </select>
              </label>

              <div className='rounded-3xl border border-gray-200 bg-white p-5'>
                <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Detalles del pedido</p>
                <div className='mt-4 space-y-2 text-sm text-gray-700'>
                  <p>Mesa seleccionada: {selectedTableNumber ?? 'No seleccionada'}</p>
                  <p>Artículos en carrito: {items.length}</p>
                  <p>Subtotal: {formatPrice(subtotal)}</p>
                </div>
              </div>
            </div>

            {formError && (
              <div className='rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
                {formError}
              </div>
            )}

            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='text-sm text-gray-600'>
                {order ? 'Pedido registrado. Revisa el estado del pedido en la columna derecha.' : 'Confirma tu pedido para obtener el código de orden y empezar el seguimiento.'}
              </div>
              <ClientButton className='w-full sm:w-auto' onClick={onConfirmOrder} disabled={!canSubmitOrder}>
                {loading ? 'Confirmando pedido...' : 'Confirmar pedido'}
              </ClientButton>
            </div>
          </div>
        )}

        {message && (
          <div className='mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700'>
            {message}
          </div>
        )}
      </section>

      <section className='rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl sm:p-8'>
        <div className='flex flex-col gap-2'>
          <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Estado del pedido</p>
          <h2 className='text-3xl font-black text-gray-900'>Seguimiento</h2>
        </div>

        <div className='mt-8 space-y-5'>
          <div className='rounded-3xl border border-gray-200 bg-slate-50 p-6'>
            <p className='text-sm text-gray-600'>Código de pedido</p>
            <p className='mt-2 text-xl font-bold text-gray-900'>{formatOrderCode(order?._id)}</p>
            <p className='mt-1 text-sm text-gray-500'>
              {order ? `Generado el ${new Date(order.createdAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Aún no has confirmado un pedido.'}
            </p>
          </div>

          <div className='rounded-3xl border border-gray-200 bg-white p-6'>
            <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Progreso del pedido</p>
            <div className='mt-4 space-y-4'>
              {ORDER_STEPS.map((step) => {
                const active = step.key === status;
                const completed = ORDER_STEPS.findIndex((item) => item.key === step.key) <= ORDER_STEPS.findIndex((item) => item.key === status);
                return (
                  <div key={step.key} className={`rounded-3xl border p-4 ${active ? 'border-main-blue bg-main-blue/5' : 'border-gray-200 bg-slate-50'}`}>
                    <div className='flex items-center justify-between gap-4'>
                      <div>
                        <p className='font-semibold text-gray-900'>{step.title}</p>
                        <p className='mt-1 text-sm text-gray-600'>{step.description}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-main-blue text-white' : completed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>
                        {active ? 'Actual' : completed ? 'Completo' : 'Próximo'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className='rounded-3xl border border-gray-200 bg-slate-50 p-6'>
            <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Detalles finales</p>
            <div className='mt-4 grid gap-3 text-sm text-gray-700'>
              <p>Total solicitado: {formatPrice(order?.total || subtotal)}</p>
              <p>Mesa: {selectedTableNumber ?? 'No seleccionada'}</p>
              <p>Productos en el pedido: {items.length}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
