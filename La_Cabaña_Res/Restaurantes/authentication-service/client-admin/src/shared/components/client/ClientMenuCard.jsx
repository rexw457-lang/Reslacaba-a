import { useMemo } from 'react';
import useCartStore from '../../../features/cart/store/cartStore.js';
import { resolveCloudinaryImageUrl } from '../../utils/formatters.js';

export const ClientMenuCard = ({ item }) => {
  const addItem = useCartStore((s) => s.addItem);
  const open = useCartStore((s) => s.open);

  const onAdd = () => {
    addItem(item);
    open();
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
          <button onClick={onAdd} className='rounded-full bg-main-blue px-4 py-2 text-sm font-medium text-white transition hover:opacity-90'>Agregar</button>
          <span className='rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-gray-700'>Disponible</span>
        </div>
      </div>
    </article>
  );
};