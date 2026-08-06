import { useEffect, useMemo, useState } from 'react';
import { getReservationsForRestaurant, getRestaurants } from '../services/adminApi.js';
import { Spinner } from '../features/auth/components/Spinner.jsx';
import { showError } from '../shared/utils/toast.js';

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
};

export const Reservations = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [reservations, setReservations] = useState([]);
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
        setReservations([]);
      }
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar los restaurantes');
    } finally {
      setLoading(false);
    }
  };

  const loadReservations = async (restaurantId) => {
    if (!restaurantId) {
      setReservations([]);
      return;
    }

    try {
      setLoading(true);
      const data = await getReservationsForRestaurant(restaurantId);
      setReservations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar las reservaciones');
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
        await loadReservations(selectedRestaurantId);
      };
      load();
    }
  }, [selectedRestaurantId]);

  const filteredReservations = useMemo(
    () =>
      reservations.filter((reservation) => {
        const query = search.toLowerCase();
        return (
          reservation.customerName?.toLowerCase().includes(query) ||
          reservation.customerEmail?.toLowerCase().includes(query) ||
          reservation.customerPhone?.toLowerCase().includes(query) ||
          reservation.table?.number?.toString().includes(query)
        );
      }),
    [reservations, search],
  );

  if (loading) return <Spinner />;

  return (
    <div className='admin-page space-y-8'>
      <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
        <div>
          <p className='admin-kicker'>Reservaciones del restaurante</p>
          <h1 className='admin-title mt-2'>Reservaciones</h1>
          <p className='admin-subtitle mt-2 text-sm'>Consulta clientes, mesas, horarios y estado de cada reserva.</p>
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

      <div className='admin-panel overflow-hidden'>
        <div className='p-6'>
        <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <p className='text-sm font-bold text-[#e6be7d]'>Total reservaciones</p>
            <p className='mt-2 text-3xl font-black text-[#e0e0e0]'>{reservations.length}</p>
          </div>
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Buscar cliente, mesa, correo o telefono'
            className='admin-input w-full max-w-xs px-4 py-3 text-sm'
          />
        </div>
        </div>

        <div className='overflow-x-auto'>
          <table className='admin-table min-w-full text-left'>
            <thead className='text-sm'>
              <tr>
                <th className='px-5 py-4'>Cliente</th>
                <th className='px-5 py-4'>Contacto</th>
                <th className='px-5 py-4'>Mesa</th>
                <th className='px-5 py-4'>Fecha y hora</th>
                <th className='px-5 py-4'>Invitados</th>
                <th className='px-5 py-4'>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservations.map((reservation) => (
                <tr key={reservation._id} className='border-t border-[#e6be7d]/10'>
                  <td className='px-5 py-4'>{reservation.customerName}</td>
                  <td className='px-5 py-4'>
                    <p>{reservation.customerEmail || 'Sin correo'}</p>
                    <p className='text-xs text-gray-500'>{reservation.customerPhone || 'Sin telefono'}</p>
                  </td>
                  <td className='px-5 py-4'>{reservation.table?.number ?? reservation.table ?? 'N/A'}</td>
                  <td className='px-5 py-4'>{formatDate(reservation.reservationDate)}</td>
                  <td className='px-5 py-4'>{reservation.numberOfGuests ?? 'N/A'}</td>
                  <td className='px-5 py-4'>
                    <span className='admin-status admin-status-success'>
                      {reservation.status ?? 'Confirmada'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredReservations.length === 0 && (
                <tr>
                  <td colSpan='6' className='px-5 py-8 text-center text-sm text-gray-500'>
                    No hay reservaciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
