import { useEffect, useMemo, useState } from 'react';
import { createReviewForRestaurant, getRestaurants } from '../../services/adminApi.js';
import { useAuthStore } from '../../features/auth/store/authStore.js';
import { ClientButton } from '../../shared/components/ui/ClientButton.jsx';
import { ClientInput } from '../../shared/components/ui/ClientInput.jsx';
import { showError, showSuccess } from '../../shared/utils/toast.js';

const emptyForm = {
  restaurant: '',
  rating: '5',
  comment: '',
};

export const ClientReviewsPage = () => {
  const user = useAuthStore((state) => state.user);
  const [restaurants, setRestaurants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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

    loadRestaurants();
  }, []);

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant._id === form.restaurant),
    [restaurants, form.restaurant],
  );

  const validate = () => {
    const nextErrors = {};
    const rating = Number(form.rating);

    if (!form.restaurant) nextErrors.restaurant = 'Selecciona un restaurante.';
    if (!rating || rating < 1 || rating > 5) nextErrors.rating = 'La calificacion debe estar entre 1 y 5.';
    if (!form.comment.trim()) nextErrors.comment = 'El comentario es obligatorio.';
    if (form.comment.trim() && form.comment.trim().length < 10) {
      nextErrors.comment = 'Escribe al menos 10 caracteres.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      showError('Revisa la reseña antes de enviarla');
      return;
    }

    try {
      setLoading(true);
      await createReviewForRestaurant(form.restaurant, {
        rating: Number(form.rating),
        comment: form.comment.trim(),
        customerName: user?.username || user?.email || 'Cliente',
        customerEmail: user?.email || '',
      });
      showSuccess('Reseña enviada correctamente');
      setForm({ ...emptyForm, restaurant: form.restaurant });
      setErrors({});
    } catch (error) {
      console.error(error);
      showError(error?.response?.data?.message || 'No se pudo enviar la reseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='grid gap-8 lg:grid-cols-[1fr_0.85fr]'>
      <section className='rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl sm:p-8'>
        <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Reseñas</p>
        <h1 className='mt-1 text-3xl font-black text-gray-900'>Comparte tu experiencia</h1>
        <p className='mt-2 text-gray-700'>
          Tu reseña quedara visible para el administrador del restaurante seleccionado.
        </p>

        <form onSubmit={onSubmit} className='mt-8 grid gap-5'>
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
            {errors.restaurant && <p className='text-sm text-rose-600'>{errors.restaurant}</p>}
          </label>

          <div>
            <ClientInput
              label='Calificacion'
              type='number'
              min='1'
              max='5'
              step='1'
              value={form.rating}
              onChange={(event) => setForm({ ...form, rating: event.target.value })}
            />
            {errors.rating && <p className='mt-2 text-sm text-rose-600'>{errors.rating}</p>}
          </div>

          <label className='block space-y-1.5'>
            <span className='text-sm font-medium text-gray-900'>Comentario</span>
            <textarea
              rows='5'
              value={form.comment}
              onChange={(event) => setForm({ ...form, comment: event.target.value })}
              className='w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-main-blue focus:ring-2 focus:ring-main-blue/20'
              placeholder='Cuentanos como fue tu visita'
            />
            {errors.comment && <p className='text-sm text-rose-600'>{errors.comment}</p>}
          </label>

          <ClientButton type='submit' disabled={loading} className='w-full disabled:cursor-not-allowed disabled:opacity-60'>
            {loading ? 'Enviando...' : 'Enviar reseña'}
          </ClientButton>
        </form>
      </section>

      <section className='rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl sm:p-8'>
        <p className='text-sm font-semibold uppercase tracking-[0.25em] text-main-blue'>Vista previa</p>
        <h2 className='mt-1 text-2xl font-bold text-gray-900'>{selectedRestaurant?.name || 'Restaurante'}</h2>
        <div className='mt-6 rounded-3xl bg-[linear-gradient(135deg,rgba(216,48,48,0.95),rgba(222,153,78,0.92))] p-6 text-white shadow-lg'>
          <p className='text-sm uppercase tracking-[0.25em] text-white/80'>Calificacion</p>
          <p className='mt-2 text-4xl font-black'>{form.rating || 5}/5</p>
          <p className='mt-5 text-sm leading-6 text-white/90'>
            {form.comment || 'Tu comentario aparecera aqui antes de enviarlo.'}
          </p>
          <p className='mt-5 text-xs text-white/80'>{user?.username || user?.email || 'Cliente'}</p>
        </div>
      </section>
    </div>
  );
};
