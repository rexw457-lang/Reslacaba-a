import { useNavigate } from 'react-router-dom';
import useCartStore from '../../../features/cart/store/cartStore.js';
import { resolveCloudinaryImageUrl } from '../../utils/formatters.js';

export const CartDrawer = () => {
  const { items, isOpen, close, removeItem, updateQuantity, subtotal, clear } = useCartStore();
  const navigate = useNavigate();

  const goToCheckout = () => {
    close();
    navigate('/cliente/orders');
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-x-4 top-20 z-50 ml-auto w-auto max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl sm:right-6 sm:left-auto sm:w-full'>
      <div className='flex items-center justify-between px-4 py-3 border-b'>
        <div>
          <h3 className='text-lg font-semibold text-slate-900'>Carrito</h3>
          <p className='text-xs text-gray-500'>{items.length} producto(s) seleccionados</p>
        </div>
        <div className='flex items-center gap-2'>
          {items.length > 0 && <button onClick={clear} className='text-sm text-red-600 hover:underline'>Limpiar</button>}
          <button onClick={close} className='rounded-full bg-slate-100 px-3 py-1 text-sm'>Cerrar</button>
        </div>
      </div>
      <div className='max-h-96 overflow-y-auto p-4 space-y-4'>
        {items.length === 0 ? (
          <div className='text-sm text-gray-600'>Tu carrito está vacío.</div>
        ) : (
          items.map((it) => (
            <div key={it._id} className='flex items-center gap-3'>
              {it.image && (
                <img src={resolveCloudinaryImageUrl(it.image)} alt={it.name} className='h-14 w-14 rounded-md object-cover' />
              )}
              <div className='flex-1'>
                <div className='flex items-center justify-between'>
                  <p className='font-medium text-slate-900'>{it.name}</p>
                  <p className='text-sm font-semibold'>Q {Number(it.price || 0).toFixed(2)}</p>
                </div>
                <p className='text-xs text-gray-500'>{it.category || 'General'}</p>
                <div className='mt-2 flex items-center gap-2'>
                  <button onClick={() => updateQuantity(it._id, (it.qty || 1) - 1)} className='px-2 py-1 rounded-md border'>-</button>
                  <span className='px-3 py-1 rounded-md border bg-slate-50'>{it.qty}</span>
                  <button onClick={() => updateQuantity(it._id, (it.qty || 1) + 1)} className='px-2 py-1 rounded-md border'>+</button>
                  <button onClick={() => removeItem(it._id)} className='ml-auto text-sm text-red-600'>Quitar</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className='p-4 border-t'>
        <div className='flex items-center justify-between'>
          <span className='font-semibold'>Subtotal</span>
          <span className='font-bold'>Q {Number(subtotal()).toFixed(2)}</span>
        </div>
        <div className='mt-4 flex gap-3'>
          <button
            onClick={goToCheckout}
            disabled={items.length === 0}
            className='flex-1 rounded-full bg-main-blue px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50'
          >
            Confirmar pedido
          </button>
          <button onClick={close} className='rounded-full border border-gray-200 px-4 py-2 text-sm'>Seguir comprando</button>
        </div>
      </div>
    </div>
  );
};

export default CartDrawer;
