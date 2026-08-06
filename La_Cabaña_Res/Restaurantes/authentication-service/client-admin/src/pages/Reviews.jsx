import { useEffect, useMemo, useState } from 'react';
import { getRestaurants, getReviewsForRestaurant } from '../services/adminApi.js';
import { Spinner } from '../features/auth/components/Spinner.jsx';
import { showError } from '../shared/utils/toast.js';

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
};

export const Reviews = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const data = await getRestaurants();
      const items = Array.isArray(data) ? data : [];
      setRestaurants(items);
      if (items[0]?._id) {
        setSelectedRestaurantId(items[0]._id);
      }
      if (items.length === 0) {
        setReviews([]);
      }
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar los restaurantes');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async (restaurantId) => {
    if (!restaurantId) {
      setReviews([]);
      return;
    }

    try {
      setLoading(true);
      const data = await getReviewsForRestaurant(restaurantId);
      setReviews(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar las reseñas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      await loadRestaurants();
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedRestaurantId) {
      const load = async () => {
        await loadReviews(selectedRestaurantId);
      };
      load();
    }
  }, [selectedRestaurantId]);

  const filteredReviews = useMemo(
    () =>
      reviews.filter((review) => {
        const query = search.toLowerCase();
        return (
          review.comment?.toLowerCase().includes(query) ||
          review.customerName?.toLowerCase().includes(query) ||
          review.customerEmail?.toLowerCase().includes(query)
        );
      }),
    [reviews, search],
  );

  const averageRating = useMemo(() => {
    if (!reviews.length) return '0.0';
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  if (loading) return <Spinner />;

  return (
    <div className='admin-page space-y-8'>
      <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
        <div>
          <p className='admin-kicker'>Reseñas por restaurante</p>
          <h1 className='admin-title mt-2'>Reseñas</h1>
          <p className='admin-subtitle mt-2 text-sm'>Monitorea reputación, comentarios y calificaciones recientes.</p>
        </div>
        <select
          value={selectedRestaurantId}
          onChange={(event) => setSelectedRestaurantId(event.target.value)}
          className='admin-input px-4 py-3 text-sm font-semibold'
        >
          {restaurants.map((restaurant) => (
            <option key={restaurant._id} value={restaurant._id}>
              {restaurant.name}
            </option>
          ))}
        </select>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        <article className='admin-card p-6'>
          <p className='text-sm font-bold text-[#e6be7d]'>Total reseñas</p>
          <p className='mt-2 text-3xl font-black text-[#e0e0e0]'>{reviews.length}</p>
        </article>
        <article className='admin-card p-6'>
          <p className='text-sm font-bold text-[#e6be7d]'>Promedio</p>
          <p className='mt-2 text-3xl font-black text-[#e0e0e0]'>{averageRating}/5</p>
        </article>
        <input
          type='search'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder='Buscar cliente o comentario'
          className='admin-input px-4 py-3 text-sm'
        />
      </div>

      <div className='grid gap-5'>
        {filteredReviews.length === 0 ? (
          <div className='admin-panel p-8 text-center text-sm font-semibold text-[#e6be7d]'>
            No hay reseñas registradas.
          </div>
        ) : (
          filteredReviews.map((review) => (
            <article key={review._id} className='admin-card p-6'>
              <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                <div>
                  <h2 className='text-xl font-black text-[#e0e0e0]'>
                    Calificacion: {review.rating ?? 'N/A'}/5
                  </h2>
                  <p className='mt-2 text-sm text-gray-500'>
                    {review.customerName || 'Cliente'} {review.customerEmail ? `- ${review.customerEmail}` : ''}
                  </p>
                  <p className='mt-1 text-xs text-gray-500'>{formatDate(review.createdAt)}</p>
                </div>
                <span className='admin-status admin-status-warning'>
                  ID {review._id.slice(-6)}
                </span>
              </div>
              <p className='mt-4 text-sm leading-6 text-[#e6be7d]'>{review.comment || 'Sin comentario'}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
