import { Link } from 'react-router-dom';
import { ClientButton } from '../ui/ClientButton.jsx';
import { resolveCloudinaryImageUrl } from '../../utils/formatters.js';

export const ClientRestaurantCard = ({ restaurant }) => {
  return (
    <article className='overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg'>
      {restaurant.image ? (
        <img
          src={resolveCloudinaryImageUrl(restaurant.image)}
          alt={restaurant.name}
          className='h-44 w-full object-cover'
          onError={(event) => {
            event.currentTarget.src = '/placeholder-image.svg';
          }}
        />
      ) : (
        <div className='h-44 bg-[linear-gradient(135deg,rgba(216,48,48,0.95),rgba(216,48,48,0.65),rgba(222,153,78,0.8))] p-6 text-white'>
          <p className='text-xs font-semibold uppercase tracking-[0.3em] text-white/80'>Restaurante</p>
          <h3 className='mt-2 text-2xl font-bold'>{restaurant.name}</h3>
          <p className='mt-2 text-sm text-white/90'>{restaurant.city || 'Ciudad no disponible'}</p>
        </div>
      )}
      <div className='space-y-4 p-5'>
        <p className='text-sm text-gray-600'>{restaurant.address || 'Sin direccion registrada'}</p>
        {restaurant.openingHours && (
          <p className='text-sm text-gray-500'>Horario: {restaurant.openingHours}</p>
        )}
        <div className='flex flex-wrap gap-2 text-xs font-semibold text-gray-700'>
          <span className='rounded-full bg-surface-soft px-3 py-1'>{restaurant.phone || 'Sin telefono'}</span>
          <span className='rounded-full bg-surface-soft px-3 py-1'>
            {restaurant.capacity ? `${restaurant.capacity} personas` : 'Capacidad flexible'}
          </span>
        </div>
        <div className='flex flex-wrap gap-3'>
          <Link to={`/cliente/menu/${restaurant._id}`}>
            <ClientButton>Ver menú</ClientButton>
          </Link>
          <Link to='/cliente/reservations'>
            <ClientButton variant='secondary'>Reservar</ClientButton>
          </Link>
          <Link to='/cliente/reviews'>
            <ClientButton variant='ghost'>Reseña</ClientButton>
          </Link>
        </div>
      </div>
    </article>
  );
};
