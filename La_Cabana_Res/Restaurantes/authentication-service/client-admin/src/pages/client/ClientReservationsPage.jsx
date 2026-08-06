import { useEffect, useMemo, useState } from 'react';
import { ClientButton } from '../../shared/components/ui/ClientButton.jsx';
import { ClientInput } from '../../shared/components/ui/ClientInput.jsx';
import { ClientModal } from '../../shared/components/ui/ClientModal.jsx';
import { createReservation, getRestaurants, getTablesForRestaurant } from '../../services/adminApi.js';
import { showError, showSuccess } from '../../shared/utils/toast.js';

const emptyForm = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  restaurant: '',
  reservationDate: '',
  reservationTime: '',
  numberOfGuests: '2',
  notes: '',
};

const minutesFromTime = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const parseOpeningHours = (openingHours = '') => {
  const [open = '', close = ''] = openingHours.split('-').map((value) => value.trim());
  return {
    open,
    close,
    openMinutes: minutesFromTime(open),
    closeMinutes: minutesFromTime(close),
  };
};

const buildReservationDateTime = (date, time) => (date && time ? `${date}T${time}` : '');

export const ClientReservationsPage = () => {
  const [form, setForm] = useState(emptyForm);
  const [restaurants, setRestaurants] = useState([]);
  const [availableTables, setAvailableTables] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assignedTable, setAssignedTable] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant._id === form.restaurant),
    [restaurants, form.restaurant],
  );

  const restaurantHours = useMemo(
    () => parseOpeningHours(selectedRestaurant?.openingHours),
    [selectedRestaurant],
  );

  const reservationDateTime = useMemo(
    () => buildReservationDateTime(form.reservationDate, form.reservationTime),
    [form.reservationDate, form.reservationTime],
  );

  const reservationDate = useMemo(() => {
    if (!reservationDateTime) return null;
    const value = new Date(reservationDateTime);
    return Number.isNaN(value.getTime()) ? null : value;
  }, [reservationDateTime]);

  const isTimeInsideRestaurantHours = useMemo(() => {
    const reservationMinutes = minutesFromTime(form.reservationTime);
    if (
      reservationMinutes === null ||
      restaurantHours.openMinutes === null ||
      restaurantHours.closeMinutes === null
    ) {
      return true;
    }

    return reservationMinutes >= restaurantHours.openMinutes && reservationMinutes < restaurantHours.closeMinutes;
  }, [form.reservationTime, restaurantHours]);

  const isReservationDateValid = reservationDate !== null && reservationDate > new Date();

  const canSubmit =
    form.customerName.trim() &&
    form.customerEmail.trim() &&
    form.customerPhone.trim() &&
    form.restaurant &&
    form.reservationDate &&
    form.reservationTime &&
    Number(form.numberOfGuests) > 0 &&
    isReservationDateValid &&
    isTimeInsideRestaurantHours;

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const items = await getRestaurants();
      const list = Array.isArray(items) ? items : [];
      setRestaurants(list);
      if (list[0]?._id) {
        setForm((prev) => ({ ...prev, restaurant: list[0]._id }));
      }
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar los restaurantes');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTables = async (restaurantId, guests) => {
    if (!restaurantId) {
      setAvailableTables([]);
      return;
    }

    try {
      const tables = await getTablesForRestaurant(restaurantId);
      const filtered = (Array.isArray(tables) ? tables : [])
        .filter((table) => table.status === 'disponible' && Number(table.capacity) >= Number(guests || 1))
        .sort((a, b) => Number(a.capacity) - Number(b.capacity) || Number(a.number) - Number(b.number));
      setAvailableTables(filtered);
    } catch (error) {
      console.error(error);
      setAvailableTables([]);
    }
  };

  useEffect(() => {
    loadRestaurants();
  }, []);

  useEffect(() => {
    loadAvailableTables(form.restaurant, form.numberOfGuests);
  }, [form.restaurant, form.numberOfGuests]);

  const validateForm = () => {
    const errors = {};
    const guests = Number(form.numberOfGuests);

    if (!form.customerName.trim()) errors.customerName = 'El nombre es obligatorio.';
    if (!form.customerEmail.trim()) errors.customerEmail = 'El correo electronico es obligatorio.';
    if (!form.customerPhone.trim()) errors.customerPhone = 'El telefono es obligatorio.';
    if (!form.restaurant) errors.restaurant = 'Selecciona un restaurante.';
    if (!form.reservationDate) errors.reservationDate = 'Selecciona una fecha.';
    if (!form.reservationTime) errors.reservationTime = 'Selecciona una hora.';
    if (reservationDateTime && reservationDate === null) errors.reservationDate = 'Fecha u hora invalida.';
    if (reservationDate !== null && reservationDate <= new Date()) errors.reservationDate = 'La fecha y hora deben ser futuras.';
    if (!isTimeInsideRestaurantHours) {
      errors.reservationTime = `La hora debe estar entre ${restaurantHours.open} y ${restaurantHours.close}.`;
    }
    if (!guests || guests < 1) errors.numberOfGuests = 'El numero de invitados debe ser al menos 1.';
    if (guests > 20) errors.numberOfGuests = 'El maximo permitido es 20 invitados.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      showError('Revisa los campos del formulario antes de enviar.');
      return;
    }

    const table = availableTables[0];
    const payload = {
      customerName: form.customerName.trim(),
      customerEmail: form.customerEmail.trim(),
      customerPhone: form.customerPhone.trim(),
      reservationDate: reservationDateTime,
      numberOfGuests: Number(form.numberOfGuests),
      restaurant: form.restaurant,
      table: table?._id,
      notes: form.notes.trim(),
    };

    try {
      setLoading(true);
      const reservation = await createReservation(form.restaurant, payload);
      setAssignedTable(reservation?.table?.number ?? table?.number ?? null);
      setSubmitted(true);
      showSuccess('Reservacion creada correctamente');
      setForm({ ...emptyForm, restaurant: form.restaurant });
      setFormErrors({});
      await loadAvailableTables(form.restaurant, form.numberOfGuests);
    } catch (error) {
      const apiMessage = error?.response?.data?.message || error?.message || 'No se pudo crear la reservacion';
      showError(apiMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='grid gap-8 lg:grid-cols-[1.1fr_0.9fr]'>
      <section className='rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl sm:p-8'>
        <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Reservas</p>
        <h1 className='mt-1 text-3xl font-black text-gray-900'>Reserva tu mesa</h1>
        <p className='mt-2 text-gray-700'>
          Selecciona fecha, hora, restaurante y numero de personas. Usamos el mismo formato que administra el restaurante.
        </p>

        <form onSubmit={onSubmit} className='mt-8 grid gap-5 sm:grid-cols-2'>
          <div>
            <ClientInput
              label='Nombre completo'
              value={form.customerName}
              onChange={(event) => setForm({ ...form, customerName: event.target.value })}
            />
            {formErrors.customerName && <p className='mt-2 text-sm text-rose-600'>{formErrors.customerName}</p>}
          </div>

          <div>
            <ClientInput
              label='Correo electronico'
              type='email'
              value={form.customerEmail}
              onChange={(event) => setForm({ ...form, customerEmail: event.target.value })}
            />
            {formErrors.customerEmail && <p className='mt-2 text-sm text-rose-600'>{formErrors.customerEmail}</p>}
          </div>

          <div>
            <ClientInput
              label='Telefono'
              value={form.customerPhone}
              onChange={(event) => setForm({ ...form, customerPhone: event.target.value })}
            />
            {formErrors.customerPhone && <p className='mt-2 text-sm text-rose-600'>{formErrors.customerPhone}</p>}
          </div>

          <label className='block space-y-1.5'>
            <span className='text-sm font-medium text-gray-900'>Restaurante</span>
            <select
              value={form.restaurant}
              onChange={(event) => setForm({ ...form, restaurant: event.target.value })}
              className='w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-main-blue focus:ring-2 focus:ring-main-blue/20'
            >
              <option value=''>Selecciona restaurante</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant._id} value={restaurant._id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
            {formErrors.restaurant && <p className='mt-2 text-sm text-rose-600'>{formErrors.restaurant}</p>}
          </label>

          <div>
            <ClientInput
              label='Fecha'
              type='date'
              value={form.reservationDate}
              onChange={(event) => setForm({ ...form, reservationDate: event.target.value })}
            />
            {formErrors.reservationDate && <p className='mt-2 text-sm text-rose-600'>{formErrors.reservationDate}</p>}
          </div>

          <div>
            <ClientInput
              label='Hora'
              type='time'
              min={restaurantHours.open || undefined}
              max={restaurantHours.close || undefined}
              value={form.reservationTime}
              onChange={(event) => setForm({ ...form, reservationTime: event.target.value })}
            />
            {formErrors.reservationTime && <p className='mt-2 text-sm text-rose-600'>{formErrors.reservationTime}</p>}
            {selectedRestaurant?.openingHours && (
              <p className='mt-2 text-xs text-gray-500'>Horario: {selectedRestaurant.openingHours}</p>
            )}
          </div>

          <div>
            <ClientInput
              label='Invitados'
              type='number'
              min='1'
              max='20'
              value={form.numberOfGuests}
              onChange={(event) => setForm({ ...form, numberOfGuests: event.target.value })}
            />
            {formErrors.numberOfGuests && <p className='mt-2 text-sm text-rose-600'>{formErrors.numberOfGuests}</p>}
          </div>

          <label className='block space-y-1.5 sm:col-span-2'>
            <span className='text-sm font-medium text-gray-900'>Notas</span>
            <textarea
              rows='4'
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className='w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-main-blue focus:ring-2 focus:ring-main-blue/20'
              placeholder='Preferencia de mesa, celebraciones, alergias o solicitudes especiales'
            />
          </label>

          <div className='sm:col-span-2'>
            <ClientButton type='submit' disabled={!canSubmit || loading} className='w-full disabled:cursor-not-allowed disabled:opacity-60'>
              {loading ? 'Enviando...' : 'Reservar ahora'}
            </ClientButton>
          </div>
        </form>

        {restaurants.length > 0 && form.restaurant && (
          <div className='mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>
            Mesa sugerida: {availableTables[0]?.number ?? 'el servidor asignara una mesa disponible al enviar'}
          </div>
        )}
      </section>

      <section className='space-y-5 rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl sm:p-8'>
        <div>
          <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Vista previa</p>
          <h2 className='mt-1 text-2xl font-bold text-gray-900'>Confirmacion visual</h2>
        </div>
        <article className='rounded-3xl bg-[linear-gradient(135deg,rgba(216,48,48,0.95),rgba(222,153,78,0.92))] p-6 text-white shadow-lg'>
          <p className='text-sm uppercase tracking-[0.25em] text-white/80'>Reserva estimada</p>
          <h3 className='mt-2 text-2xl font-bold'>{form.customerName || 'Tu nombre aqui'}</h3>
          <p className='mt-4 text-white/90'>{form.customerEmail || 'correo@ejemplo.com'}</p>
          <p className='mt-1 text-white/90'>{form.customerPhone || 'Telefono'}</p>
          <p className='mt-4 text-sm text-white/85'>{selectedRestaurant?.name || 'Selecciona restaurante'}</p>
          <p className='mt-2 text-sm text-white/85'>
            {form.reservationDate || 'Fecha'} - {form.reservationTime || 'Hora'} - {form.numberOfGuests || '2'} invitados
          </p>
          <p className='mt-2 text-sm text-white/85'>
            Mesa sugerida: {availableTables[0]?.number ?? 'por asignar'}
          </p>
        </article>
      </section>

      <ClientModal open={submitted} title='Reservacion creada' onClose={() => setSubmitted(false)}>
        <p className='text-gray-700'>Tu reservacion quedo registrada correctamente.</p>
        {assignedTable && <p className='mt-3 text-gray-700'>Mesa asignada: {assignedTable}</p>}
        <div className='mt-6 flex justify-end'>
          <ClientButton onClick={() => setSubmitted(false)}>Entendido</ClientButton>
        </div>
      </ClientModal>
    </div>
  );
};
