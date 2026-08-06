import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMenuItems, getRestaurants } from '../../services/clientApi.js';
// ClientButton removed — action buttons were removed from the hero
import { ClientRestaurantCard } from '../../shared/components/client/ClientRestaurantCard.jsx';
import { ClientMenuCard } from '../../shared/components/client/ClientMenuCard.jsx';
import { ClientSkeleton } from '../../shared/components/ui/ClientSkeleton.jsx';

export const ClientPage = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [restaurantsData, menuItemsData] = await Promise.all([getRestaurants(), getMenuItems()]);
        setRestaurants(Array.isArray(restaurantsData) ? restaurantsData : []);
        setMenuItems(Array.isArray(menuItemsData) ? menuItemsData : []);
      } catch (err) {
      console.error(err);
      setError('No se pudo validar la conexión con la API.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const featuredRestaurants = useMemo(() => restaurants.slice(0, 3), [restaurants]);
  const featuredMenu = useMemo(() => menuItems.slice(0, 4), [menuItems]);
  return (
    <div className='space-y-10'>
      <section className='grid items-center gap-8 overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10'>
        <div className='space-y-6'>
          <p className='inline-flex rounded-full border border-main-blue/20 bg-surface-soft px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-main-blue'>
            Portal cliente
          </p>
          <div className='space-y-4'>
            <h1 className='max-w-2xl text-4xl font-black tracking-tight text-gray-900 sm:text-5xl'>
              Una experiencia de restaurante con la misma identidad visual del sistema.
            </h1>
            <p className='max-w-2xl text-base text-gray-700 sm:text-lg'>
              Explora restaurantes, revisa sus menús y navega por reservas u órdenes con una base
              responsive lista para que el equipo continúe.
            </p>
          </div>
          {/* Action buttons removed as requested */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <article className='rounded-3xl border border-gray-200 bg-card p-4 shadow-sm'>
              <p className='text-xs font-semibold uppercase tracking-[0.2em] text-main-blue'>Restaurantes</p>
              <p className='mt-3 text-3xl font-black text-gray-900'>{restaurants.length}</p>
            </article>
            <article className='rounded-3xl border border-gray-200 bg-card p-4 shadow-sm'>
              <p className='text-xs font-semibold uppercase tracking-[0.2em] text-main-blue'>Platillos</p>
              <p className='mt-3 text-3xl font-black text-gray-900'>{menuItems.length}</p>
            </article>
          </div>
        </div>
        <div className='grid gap-4'>
          {loading ? (
            <>
              <ClientSkeleton className='h-44' />
              <ClientSkeleton className='h-32' />
            </>
          ) : (
            <>
              {featuredRestaurants[0] ? <ClientRestaurantCard restaurant={featuredRestaurants[0]} /> : null}
              {featuredMenu[0] ? <ClientMenuCard item={featuredMenu[0]} /> : null}
            </>
          )}
        </div>
      </section>

      {error && (
        <section className='rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700'>
          {error}
        </section>
      )}

      <section className='space-y-5'>
        <div className='flex items-end justify-between gap-4'>
          <div>
            <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Destacados</p>
            <h2 className='mt-1 text-2xl font-bold text-gray-900'>Restaurantes para comenzar</h2>
          </div>
          <Link to='/cliente/restaurants' className='text-sm font-semibold text-main-blue hover:underline'>
            Ver todos
          </Link>
        </div>
        <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
          {(loading ? Array.from({ length: 3 }) : featuredRestaurants).map((restaurant, index) =>
            loading ? (
              <ClientSkeleton key={index} className='h-80' />
            ) : (
              <ClientRestaurantCard key={restaurant._id} restaurant={restaurant} />
            ),
          )}
        </div>
      </section>
    </div>
  );
};
