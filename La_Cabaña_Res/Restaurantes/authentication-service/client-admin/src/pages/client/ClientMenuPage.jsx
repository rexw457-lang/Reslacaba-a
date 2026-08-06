import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMenuItemsByRestaurant, getRestaurants } from '../../services/clientApi.js';
import { ClientMenuCard } from '../../shared/components/client/ClientMenuCard.jsx';
import CartDrawer from '../../shared/components/client/CartDrawer.jsx';
import useCartStore from '../../features/cart/store/cartStore.js';
import { ClientSkeleton } from '../../shared/components/ui/ClientSkeleton.jsx';
import { ClientButton } from '../../shared/components/ui/ClientButton.jsx';

export const ClientMenuPage = () => {
  const { restaurantId } = useParams();
  const [restaurants, setRestaurants] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [restaurantsData, menuItemsData] = await Promise.all([
          getRestaurants(),
          getMenuItemsByRestaurant(restaurantId),
        ]);
        setRestaurants(Array.isArray(restaurantsData) ? restaurantsData : []);
        setMenuItems(Array.isArray(menuItemsData) ? menuItemsData : []);
      } catch {
        setError('No se pudo validar la conexión con la API de menú.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [restaurantId]);

  const restaurant = useMemo(
    () => restaurants.find((item) => item._id === restaurantId),
    [restaurants, restaurantId],
  );

  const restaurantMenu = useMemo(() => menuItems, [menuItems]);

  return (
    <div className='space-y-8'>
      <section className='rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl sm:p-8'>
        <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <div>
            <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Menú</p>
            <h1 className='mt-1 text-3xl font-black text-gray-900'>{restaurant?.name || 'Restaurante'}</h1>
            <p className='mt-2 max-w-2xl text-gray-700'>
              Vista pública del menú filtrada por restaurante. Si el backend responde, aquí ya se
              ve la validación de la API.
            </p>
          </div>
          <div className='flex flex-wrap gap-3'>
            <Link to='/cliente/restaurants'>
              <ClientButton variant='secondary'>Volver a restaurantes</ClientButton>
            </Link>
            <Link to='/cliente/reservations'>
              <ClientButton>Reservar mesa</ClientButton>
            </Link>
            <Link to='/cliente/reviews'>
              <ClientButton variant='ghost'>Dejar reseña</ClientButton>
            </Link>
          </div>
        </div>
      </section>

      <div className='flex justify-end'>
        <button onClick={() => useCartStore.getState().toggle()} className='rounded-full bg-main-blue px-4 py-2 text-sm font-semibold text-white'>Ver carrito</button>
      </div>

      {error && <div className='rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700'>{error}</div>}

      <section className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
        {loading
          ? Array.from({ length: 6 }).map((_, index) => <ClientSkeleton key={index} className='h-72' />)
          : restaurantMenu.map((item) => <ClientMenuCard key={item._id} item={item} />)}
      </section>

      <CartDrawer />

      {!loading && restaurantMenu.length === 0 && (
        <section className='rounded-3xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 shadow-sm'>
          No hay platillos para este restaurante o el campo de relación aún no viene en la API.
        </section>
      )}
    </div>
  );
};
