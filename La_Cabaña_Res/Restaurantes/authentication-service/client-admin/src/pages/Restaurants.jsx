import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRestaurant, deleteRestaurant, getRestaurants, updateRestaurant } from '../services/adminApi.js';
import { Spinner } from '../features/auth/components/Spinner.jsx';
import { showError, showSuccess } from '../shared/utils/toast.js';
import { resolveCloudinaryImageUrl } from '../shared/utils/formatters.js';
import {
  BuildingStorefrontIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

const emptyRestaurant = {
  name: '',
  address: '',
  phone: '',
  email: '',
  city: '',
  manager: '',
  capacity: '',
  openingTime: '',
  closingTime: '',
  image: null,
};

const parseHours = (openingHours = '') => {
  const [openingTime = '', closingTime = ''] = openingHours.split('-').map((value) => value.trim());
  return { openingTime, closingTime };
};

const isImageFileValid = (file) => !file || (file.type?.startsWith('image/') && file.size <= 5 * 1024 * 1024);

export const Restaurants = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeRestaurant, setActiveRestaurant] = useState(null);
  const [form, setForm] = useState(emptyRestaurant);
  const [errors, setErrors] = useState({});

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const data = await getRestaurants();
      setRestaurants(Array.isArray(data) ? data : data?.restaurants ?? []);
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar los restaurantes');
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

  const validate = () => {
    const nextErrors = {};
    const capacity = Number(form.capacity);

    if (!form.name.trim()) nextErrors.name = 'El nombre es obligatorio.';
    if (!form.address.trim()) nextErrors.address = 'La direccion es obligatoria.';
    if (!form.city.trim()) nextErrors.city = 'La ciudad es obligatoria.';
    if (!form.phone.trim()) nextErrors.phone = 'El telefono es obligatorio.';
    if (!form.email.trim()) nextErrors.email = 'El correo es obligatorio.';
    if (!form.manager.trim()) nextErrors.manager = 'El encargado es obligatorio.';
    if (!form.capacity || Number.isNaN(capacity) || capacity < 1) nextErrors.capacity = 'Capacidad minima: 1.';
    if (!form.openingTime) nextErrors.openingTime = 'La hora de apertura es obligatoria.';
    if (!form.closingTime) nextErrors.closingTime = 'La hora de cierre es obligatoria.';
    if (form.openingTime && form.closingTime && form.openingTime >= form.closingTime) {
      nextErrors.closingTime = 'La hora de cierre debe ser posterior a la apertura.';
    }
    if (!activeRestaurant && !form.image) nextErrors.image = 'La imagen es obligatoria.';
    if (form.image instanceof File && !isImageFileValid(form.image)) {
      nextErrors.image = 'La imagen debe ser valida y pesar maximo 5 MB.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleOpenModal = (restaurant = null) => {
    const hours = parseHours(restaurant?.openingHours);
    setActiveRestaurant(restaurant);
    setErrors({});
    setForm(
      restaurant
        ? {
            name: restaurant.name || '',
            address: restaurant.address || '',
            phone: restaurant.phone || '',
            email: restaurant.email || '',
            city: restaurant.city || '',
            manager: restaurant.manager || '',
            capacity: restaurant.capacity ?? '',
            openingTime: hours.openingTime,
            closingTime: hours.closingTime,
            image: restaurant.image || null,
          }
        : emptyRestaurant,
    );
    setModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      showError('Revisa los campos del restaurante');
      return;
    }

    try {
      const payloadData = {
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        manager: form.manager.trim(),
        capacity: Number(form.capacity),
        openingHours: `${form.openingTime} - ${form.closingTime}`,
      };

      // Usar FormData solo si hay una nueva imagen (File)
      let payload = payloadData;
      if (form.image instanceof File) {
        payload = new FormData();
        Object.entries(payloadData).forEach(([key, value]) => payload.append(key, value));
        payload.append('image', form.image);
      }

      if (activeRestaurant) {
        await updateRestaurant(activeRestaurant._id, payload);
        showSuccess('Restaurante actualizado correctamente');
      } else {
        await createRestaurant(payload);
        showSuccess('Restaurante creado correctamente');
      }

      setModalOpen(false);
      setForm(emptyRestaurant);
      await loadRestaurants();
    } catch (error) {
      console.error('Error al guardar restaurante:', error);
      const errorMessage = error.response?.data?.message || error.message || 'No se pudo guardar el restaurante';
      console.error('Status:', error.response?.status);
      console.error('Error completo:', error.response?.data);
      showError(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Desactivar este restaurante?')) return;
    try {
      await deleteRestaurant(id);
      showSuccess('Restaurante desactivado');
      await loadRestaurants();
    } catch (error) {
      console.error(error);
      showError('No se pudo desactivar el restaurante');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className='admin-page space-y-8'>
      <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
        <div>
          <p className='admin-kicker'>Gestión operativa</p>
          <h1 className='admin-title mt-2'>Restaurantes</h1>
          <p className='admin-subtitle mt-2 text-sm'>Administra ubicaciones, capacidad, horarios y responsables por local.</p>
        </div>
        <button
          type='button'
          onClick={() => handleOpenModal(null)}
          className='admin-button-primary px-5 py-3 text-sm'
        >
          <PlusIcon className='h-5 w-5' />
          Nuevo restaurante
        </button>
      </div>

      <section className='admin-panel p-5'>
        <label className='relative block max-w-2xl'>
          <MagnifyingGlassIcon className='pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#e6be7d]' />
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Buscar restaurante, ciudad o dirección'
            className='admin-input w-full px-11 py-3 text-sm'
          />
        </label>
      </section>

      <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
        {filteredRestaurants.map((restaurant, index) => (
          <article
            key={restaurant._id}
            className='admin-card overflow-hidden'
            style={{ animation: `adminRise 360ms ease ${index * 50}ms both` }}
          >
            <div className='relative h-56 overflow-hidden bg-[#e6be7d]/14'>
              <img
                src={restaurant.image ? resolveCloudinaryImageUrl(restaurant.image) : '/placeholder-image.svg'}
                alt={restaurant.name}
                className='h-full w-full object-cover transition duration-300 hover:scale-105'
                onError={(event) => {
                  event.currentTarget.src = '/placeholder-image.svg';
                }}
              />
              <div className='absolute left-4 top-4 rounded-full bg-[#141426]/95 px-3 py-1 text-xs font-black text-[#e0e0e0] shadow'>
                {restaurant.city || 'N/A'}
              </div>
            </div>
            <div className='p-5'>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <h2 className='text-xl font-black text-[#e0e0e0]'>{restaurant.name}</h2>
                  <p className='mt-2 text-sm leading-6 text-[#e6be7d]'>{restaurant.address || 'Sin direccion'}</p>
                </div>
                <BuildingStorefrontIcon className='h-7 w-7 shrink-0 text-[#e0e0e0]' />
              </div>
              <div className='mt-5 grid gap-3 text-sm text-[#e6be7d]'>
                <div className='flex items-center gap-2 rounded-2xl bg-[#e6be7d]/14 p-3'>
                  <UserIcon className='h-5 w-5 text-[#e6be7d]' />
                  <span><strong className='text-[#e0e0e0]'>Encargado:</strong> {restaurant.manager || 'N/A'}</span>
                </div>
                <div className='flex items-center gap-2 rounded-2xl bg-[#e6be7d]/14 p-3'>
                  <ClockIcon className='h-5 w-5 text-[#e6be7d]' />
                  <span><strong className='text-[#e0e0e0]'>Horario:</strong> {restaurant.openingHours || 'N/A'}</span>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <span className='admin-status admin-status-neutral'>{restaurant.phone || 'Sin teléfono'}</span>
                  <span className='admin-status admin-status-warning'>{restaurant.capacity ?? 'N/A'} personas</span>
                </div>
              </div>
              <div className='mt-5 flex flex-wrap gap-2'>
                <button
                  type='button'
                  onClick={() => handleOpenModal(restaurant)}
                  className='admin-button-secondary px-4 py-2 text-sm'
                >
                  <PencilSquareIcon className='h-4 w-4' />
                  Editar
                </button>
                <button
                  type='button'
                  onClick={() => handleDelete(restaurant._id)}
                  className='admin-button-danger px-4 py-2 text-sm'
                >
                  <TrashIcon className='h-4 w-4' />
                  Desactivar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {modalOpen && createPortal(
        <div className='admin-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4'>
          <div className='admin-panel max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto p-6 shadow-2xl sm:p-8'>
            <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
              <div>
                <p className='admin-kicker'>Formulario</p>
                <h2 className='mt-1 text-2xl font-black text-[#e0e0e0]'>
                  {activeRestaurant ? 'Editar restaurante' : 'Nueva ubicación'}
                </h2>
              </div>
              <button type='button' onClick={() => setModalOpen(false)} className='admin-button-secondary px-4 py-2 text-sm whitespace-nowrap'>
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSubmit} className='mt-8 grid gap-5 lg:grid-cols-2'>
              {[
                ['name', 'Nombre', 'text'],
                ['city', 'Ciudad', 'text'],
                ['address', 'Dirección', 'text'],
                ['manager', 'Encargado', 'text'],
                ['phone', 'Teléfono', 'text'],
                ['email', 'Correo electrónico', 'email'],
                ['capacity', 'Capacidad', 'number'],
              ].map(([key, label, type]) => (
                <label key={key} className='block'>
                  <span className='text-sm font-bold text-[#e0e0e0]'>{label}</span>
                  <input
                    type={type}
                    required
                    min={key === 'capacity' ? '1' : undefined}
                    value={form[key] ?? ''}
                    onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                    className='admin-input mt-2 w-full px-4 py-3 text-sm'
                  />
                  {errors[key] && <p className='mt-1 text-xs font-bold text-red-600'>{errors[key]}</p>}
                </label>
              ))}

              <label className='block'>
                <span className='text-sm font-bold text-[#e0e0e0]'>Hora de apertura</span>
                <input
                  type='time'
                  required
                  value={form.openingTime}
                  onChange={(event) => setForm({ ...form, openingTime: event.target.value })}
                  className='admin-input mt-2 w-full px-4 py-3 text-sm'
                />
                {errors.openingTime && <p className='mt-1 text-xs font-bold text-red-600'>{errors.openingTime}</p>}
              </label>

              <label className='block'>
                <span className='text-sm font-bold text-[#e0e0e0]'>Hora de cierre</span>
                <input
                  type='time'
                  required
                  value={form.closingTime}
                  onChange={(event) => setForm({ ...form, closingTime: event.target.value })}
                  className='admin-input mt-2 w-full px-4 py-3 text-sm'
                />
                {errors.closingTime && <p className='mt-1 text-xs font-bold text-red-600'>{errors.closingTime}</p>}
              </label>

              <label className='block lg:col-span-2'>
                <span className='text-sm font-bold text-[#e0e0e0]'>Imagen del restaurante</span>
                <input
                  type='file'
                  accept='image/*'
                  onChange={(event) => setForm({ ...form, image: event.target.files?.[0] ?? null })}
                  className='admin-input mt-2 w-full px-4 py-3 text-sm'
                />
                {errors.image && <p className='mt-1 text-xs font-bold text-red-600'>{errors.image}</p>}
                {form.image && (
                  <div className='mt-4 space-y-2'>
                    <img
                      src={form.image instanceof File ? URL.createObjectURL(form.image) : resolveCloudinaryImageUrl(form.image)}
                      alt='Vista previa del restaurante'
                      className='h-48 w-full rounded-xl object-cover shadow-md'
                    />
                    <p className='text-xs font-semibold text-[#e6be7d]'>
                      {typeof form.image === 'string' ? 'Imagen actual guardada' : form.image.name}
                    </p>
                  </div>
                )}
              </label>

              <div className='flex flex-col-reverse justify-end gap-3 pt-4 sm:flex-row lg:col-span-2'>
                <button type='button' onClick={() => setModalOpen(false)} className='admin-button-secondary w-full px-5 py-3 text-sm sm:w-auto'>
                  Cancelar
                </button>
                <button type='submit' className='group relative w-full overflow-hidden rounded-full bg-gradient-to-r from-[#141426] via-[#141426] to-[#e6be7d] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#e6be7d]/30 transition-all duration-300 hover:shadow-xl hover:shadow-[#e6be7d]/50 hover:-translate-y-0.5 sm:w-auto flex items-center justify-center gap-2'>
                  <CheckIcon className='h-5 w-5 transition-transform group-hover:scale-110' />
                  <span>Guardar cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
};
