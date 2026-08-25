import { useMemo } from 'react';
import useCartStore from '../../../features/cart/store/cartStore.js';
import { resolveCloudinaryImageUrl } from '../../utils/formatters.js';
import { askPrompt } from '../../utils/uiPrompt.js';
import { showError, showSuccess } from '../../utils/toast.js';

export const ClientMenuCard = ({ item }) => {
  const addItem = useCartStore((s) => s.addItem);
  const open = useCartStore((s) => s.open);

  const onAdd = async () => {
    const isMojarra = String(item.name || '').toLowerCase().includes('mojarra frita');
    if (isMojarra) {
      const defaultPrice = Number(item.price || 0).toFixed(2);
      const input = await askPrompt({
        title: 'Precio de la mojarra frita',
        message: 'Ingrese el precio para este platillo (Q):',
        defaultValue: defaultPrice,
      });
      if (input === null) return; // usuario canceló
      const value = Number(String(input).replace(',', '.'));
      if (Number.isNaN(value) || value < 0) {
        showError('Precio inválido. Operación cancelada.');
        return;
      }
      const customItem = { ...item, _id: `${item._id}::${Date.now()}`, menuItem: item._id, price: value };
      addItem(customItem);
      open();
      showSuccess('Alimento agregado con éxito');
      return;
    }

    addItem(item);
    open();
    showSuccess('Alimento agregado con éxito');
  };

  const price = useMemo(() => Number(item.price || 0).toFixed(2), [item.price]);

  return (
    <article className='overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg'>
      <div className='h-40 bg-[linear-gradient(135deg,rgba(60,21,24,0.95),rgba(216,48,48,0.9),rgba(222,153,78,0.9))] p-5 text-white'>
        <p className='text-xs font-semibold uppercase tracking-[0.3em] text-white/80'>{item.category || 'General'}</p>
        <h3 className='mt-2 text-xl font-bold'>{item.name}</h3>
        <p className='mt-2 line-clamp-3 text-sm text-white/90'>{item.description || 'Descripción no disponible'}</p>
      </div>
      {item.image && (
        <img src={resolveCloudinaryImageUrl(item.image)} alt={item.name} className='h-40 w-full object-cover' />
      )}
      <div className='flex items-center justify-between gap-4 p-5'>
        <p className='text-lg font-bold text-gray-900'>Q {price}</p>
        <div className='flex items-center gap-2'>
          <button onClick={() => void onAdd()} className='rounded-full bg-main-blue px-4 py-2 text-sm font-medium text-white transition hover:opacity-90'>Agregar</button>
          <span className='rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-gray-700'>Disponible</span>
        </div>
      </div>
    </article>
  );
};