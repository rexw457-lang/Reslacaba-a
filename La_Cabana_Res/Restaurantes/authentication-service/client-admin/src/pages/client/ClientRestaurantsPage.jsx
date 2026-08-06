import { useEffect, useMemo, useState } from 'react';
import { getRestaurants } from '../../services/clientApi.js';
import { ClientRestaurantCard } from '../../shared/components/client/ClientRestaurantCard.jsx';
import { ClientSkeleton } from '../../shared/components/ui/ClientSkeleton.jsx';
import { ClientInput } from '../../shared/components/ui/ClientInput.jsx';

export const ClientRestaurantsPage = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getRestaurants();
        setRestaurants(Array.isArray(data) ? data : []);
      } catch {
        setError('No se pudo validar la conexión con la API de restaurantes.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredRestaurants = useMemo(
    () =>
      restaurants.filter((restaurant) => {
        const query = search.toLowerCase();
        return (
          restaurant.name?.toLowerCase().includes(query) ||
          restaurant.city?.toLowerCase().includes(query) ||
          restaurant.address?.toLowerCase().includes(query)
        );
      }),
    [restaurants, search],
  );

  return (
    <div className='space-y-8'>
      <section className='rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl sm:p-8'>
        <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <div>
            <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Catálogo</p>
            <h1 className='mt-1 text-3xl font-black text-gray-900'>Restaurantes</h1>
            <p className='mt-2 max-w-2xl text-gray-700'>
              La vista cliente ya consulta la API y muestra una base responsive con la misma
              identidad del login.
            </p>
          </div>
          <div className='w-full md:max-w-md'>
            <ClientInput
              type='search'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Buscar por nombre, ciudad o dirección'
            />
          </div>
        </div>
      </section>

      {error && (
        <div className='rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700'>
          {error}
        </div>
      )}

      <section className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
        {loading
          ? Array.from({ length: 6 }).map((_, index) => <ClientSkeleton key={index} className='h-80' />)
          : filteredRestaurants.map((restaurant) => <ClientRestaurantCard key={restaurant._id} restaurant={restaurant} />)}
      </section>
    </div>
  );
};