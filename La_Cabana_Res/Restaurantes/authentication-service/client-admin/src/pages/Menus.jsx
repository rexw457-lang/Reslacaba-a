import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createMenuItemForRestaurant,
  deleteMenuItem,
  getMenuItems,
  getMenuItemsByRestaurant,
  getRestaurants,
  updateMenuItem,
} from '../services/adminApi.js';
import { Spinner } from '../features/auth/components/Spinner.jsx';
import { showError, showSuccess } from '../shared/utils/toast.js';
import { resolveCloudinaryImageUrl } from '../shared/utils/formatters.js';
import { PencilSquareIcon, PlusIcon, SparklesIcon, TrashIcon } from '@heroicons/react/24/outline';
import bebidasCalientesImg from '../assets/img/bebidascalientes.jpg';
import bebidasFriasImg from '../assets/img/BebidasFrias.png';
import bebidasStarbucksImg from '../assets/img/BebidasStarbukcs.png';
import entradasImg from '../assets/img/Entradas.png';
import platosFuertesImg from '../assets/img/PlatoFuerte.png';
import postresImg from '../assets/img/Postres.png';
import hamburguesasImg from '../assets/img/hamburguesas.png';
import extrasImg from '../assets/img/extras.jpg';

const emptyMenu = {
  name: '',
  description: '',
  category: '',
  price: '',
  available: true,
  image: null,
};

const imageMaxSize = 5 * 1024 * 1024;
const formatCurrency = (value) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value || 0));

const menuCategoryImages = {
  'bebidas calientes': bebidasCalientesImg,
  'bebidas frías': bebidasFriasImg,
  'bebidas frias': bebidasFriasImg,
  'entradas': entradasImg,
  'platos fuertes': platosFuertesImg,
  'postres': postresImg,
  'hamburguesas': hamburguesasImg,
  'especiales': extrasImg,
  'starbucks': bebidasStarbucksImg,
  general: '/placeholder-image.svg',
};

const getMenuItemImageUrl = (item) => {
  if (!item) return '/placeholder-image.svg';
  if (item.image) {
    return typeof item.image === 'string'
      ? resolveCloudinaryImageUrl(item.image)
      : '/placeholder-image.svg';
  }

  const categoryKey = (item.category || 'general').toString().trim().toLowerCase();
  return menuCategoryImages[categoryKey] || menuCategoryImages.general;
};

const getCategoryImageUrl = (category) => {
  const key = category?.toString().trim().toLowerCase() || 'general';
  return menuCategoryImages[key] || menuCategoryImages.general;
};

export const Menus = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [category, setCategory] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyMenu);
  const [formErrors, setFormErrors] = useState({});
  const [activeMenuItem, setActiveMenuItem] = useState(null);
  const [menuModalOpen, setMenuModalOpen] = useState(false);

  const validateMenuItem = () => {
    const errors = {};
    const price = Number(form.price);

    if (!form.name.trim()) errors.name = 'El nombre es obligatorio.';
    if (form.name.trim() && form.name.trim().length < 3) errors.name = 'Minimo 3 caracteres.';
    if (!form.description.trim()) errors.description = 'La descripcion es obligatoria.';
    if (form.description.trim() && form.description.trim().length < 10) errors.description = 'Minimo 10 caracteres.';
    if (!form.category.trim()) errors.category = 'La categoria es obligatoria.';
    if (!form.price || Number.isNaN(price)) errors.price = 'El precio debe ser un numero válido.';

    if (form.image instanceof File) {
      if (!form.image.type.startsWith('image/')) errors.image = 'Selecciona un archivo de imagen.';
      if (form.image.size > imageMaxSize) errors.image = 'La imagen no debe superar 5 MB.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const data = await getRestaurants();
      const items = Array.isArray(data) ? data : [];
      setRestaurants(items);
      if (items[0]?._id) {
        setSelectedRestaurantId(items[0]._id);
      }
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar los restaurantes');
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async (restaurantId) => {
    try {
      setLoading(true);
      if (restaurantId) {
        const data = await getMenuItemsByRestaurant(restaurantId);
        setMenuItems(Array.isArray(data) ? data : []);
      } else {
        const data = await getMenuItems();
        setMenuItems(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar los menús');
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
        await loadMenuItems(selectedRestaurantId);
      };
      load();
    }
  }, [selectedRestaurantId]);

  const defaultCategories = ['Entradas', 'Platos Principales', 'Bebidas', 'Postres', 'Especiales'];

  const categories = useMemo(
    () => {
      const existingCategories = new Set(menuItems.map((item) => item.category || 'General'));
      const allCategories = new Set([...defaultCategories, ...existingCategories]);
      return ['Todos', ...allCategories];
    },
    [menuItems],
  );

  const menuCategoryCounts = useMemo(() => {
    return menuItems.reduce((acc, item) => {
      const key = (item.category || 'General').toString().trim();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [menuItems]);

  const categoryCards = useMemo(
    () =>
      Object.entries(menuCategoryCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([categoryName, count]) => ({
          category: categoryName,
          count,
          imageUrl: getCategoryImageUrl(categoryName),
        })),
    [menuCategoryCounts],
  );

  const filteredMenu = useMemo(
    () =>
      menuItems.filter((item) =>
        category === 'Todos' || (item.category || 'General') === category,
      ),
    [category, menuItems],
  );

  const openMenuItemForm = (item = null) => {
    setActiveMenuItem(item);
    setFormErrors({});
    setForm(
      item
        ? {
            name: item.name || '',
            description: item.description || '',
            category: item.category || '',
            price: item.price ?? '',
            available: item.available ?? true,
            image: item.image || null,
          }
        : emptyMenu,
    );
    setMenuModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedRestaurantId) return;
    if (!validateMenuItem()) {
      showError('Revisa los campos del platillo');
      return;
    }

    try {
      let payload;
      
      if (form.image instanceof File) {
        // Nueva imagen - usar FormData
        payload = new FormData();
        payload.append('name', form.name.trim());
        payload.append('description', form.description.trim());
        payload.append('category', form.category.trim());
        payload.append('price', Number(form.price));
        payload.append('available', String(Boolean(form.available)));
        payload.append('image', form.image);
      } else {
        // Imagen existente o sin imagen - usar JSON
        payload = {
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          price: Number(form.price),
          available: Boolean(form.available),
        };
        if (form.image && typeof form.image === 'string') {
          payload.image = form.image;
        }
      }

      if (activeMenuItem) {
        await updateMenuItem(activeMenuItem._id, payload);
        showSuccess('Menú actualizado');
      } else {
        await createMenuItemForRestaurant(selectedRestaurantId, payload);
        showSuccess('Menú creado');
      }

      setActiveMenuItem(null);
      setForm(emptyMenu);
      setMenuModalOpen(false);
      loadMenuItems(selectedRestaurantId);
    } catch (error) {
      console.error(error);
      showError(error.response?.data?.message || 'No se pudo guardar el elemento de menú');
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm('¿Desactivar este platillo?');
    if (!confirmed) return;

    try {
      await deleteMenuItem(item._id);
      showSuccess('Platillo desactivado');
      loadMenuItems(selectedRestaurantId);
    } catch (error) {
      console.error(error);
      showError('No se pudo desactivar el platillo');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className='admin-page space-y-8'>
      <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
        <div>
          <p className='admin-kicker'>Catálogo gastronómico</p>
          <h1 className='admin-title mt-2'>Gestión de productos</h1>
          <p className='admin-subtitle mt-2 text-sm'>Tarjetas visuales con precios, categorías, disponibilidad y acciones rápidas.</p>
        </div>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
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
          <button
            type='button'
            onClick={() => openMenuItemForm(null)}
            className='admin-button-primary px-5 py-3 text-sm'
          >
            <PlusIcon className='h-5 w-5' />
            Nuevo platillo
          </button>
        </div>
      </div>

      <section className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <article className='admin-card p-5'>
          <p className='text-sm font-bold text-[#e6be7d]'>Platos totales</p>
          <p className='mt-2 text-3xl font-black text-[#e0e0e0]'>{menuItems.length}</p>
        </article>
        <article className='admin-card p-5'>
          <p className='text-sm font-bold text-[#e6be7d]'>Categorías</p>
          <p className='mt-2 text-3xl font-black text-[#e0e0e0]'>{Math.max(0, categories.length - 1)}</p>
        </article>
        <article className='admin-card p-5 sm:col-span-2'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <p className='text-sm font-bold text-[#e6be7d]'>Filtrado avanzado</p>
              <p className='mt-1 text-xl font-black text-[#e0e0e0]'>{category}</p>
            </div>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className='admin-input px-4 py-3 text-sm font-semibold'
            >
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </article>
      </section>

      <section className='grid gap-5 sm:grid-cols-2 xl:grid-cols-3'>
        {categoryCards.map(({ category: categoryName, count, imageUrl }) => (
          <article
            key={categoryName}
            className='relative overflow-hidden rounded-[2rem] shadow-2xl'
          >
            <div className='relative h-52 overflow-hidden'>
              <img
                src={imageUrl}
                alt={categoryName}
                className='absolute inset-0 h-full w-full object-cover transition duration-300 hover:scale-105 blur-sm brightness-75'
                onError={(event) => {
                  event.currentTarget.src = '/placeholder-image.svg';
                }}
              />
              <div className='absolute inset-0 bg-[#141426]/55' />
              <div className='absolute inset-x-0 bottom-0 p-5'>
                <span className='inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#e6be7d]'>
                  {categoryName}
                </span>
                <h3 className='mt-3 text-2xl font-black text-[#e0e0e0]'>{categoryName}</h3>
                <p className='mt-2 text-sm text-[#c19a6b]'>{count} elementos</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
        {filteredMenu.map((item, index) => {
          const available = item.available ?? item.isAvailable ?? item.status !== 'inactive';
          return (
            <article
              key={item._id}
              className='admin-card overflow-hidden rounded-[2rem] bg-[#141426]/30 shadow-2xl'
              style={{ animation: `adminRise 360ms ease ${index * 45}ms both` }}
            >
              <div className='relative h-60 overflow-hidden'>
                <img
                  src={getMenuItemImageUrl(item)}
                  alt={item.name}
                  className='absolute inset-0 h-full w-full object-cover transition duration-300 hover:scale-105 blur-sm brightness-75'
                  onError={(event) => {
                    event.currentTarget.src = '/placeholder-image.svg';
                  }}
                />
                <div className='absolute inset-0 bg-[#141426]/55' />
                <div className='absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4'>
                  <span className='rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#e6be7d]'>
                    {item.category || 'General'}
                  </span>
                  <span className={`admin-status ${available ? 'admin-status-success' : 'admin-status-danger'}`}>
                    {available ? 'Disponible' : 'No disponible'}
                  </span>
                </div>
              </div>
              <div className='relative p-5'>
                {item.restaurant?.name && (
                  <div className='mb-3 flex items-center gap-2 text-xs font-bold text-[#e6be7d]'>
                    {item.restaurant?.image && (
                      <img
                        src={resolveCloudinaryImageUrl(item.restaurant.image)}
                        alt={item.restaurant.name}
                        className='h-7 w-7 rounded-full object-cover ring-2 ring-[#e6be7d]/40'
                        onError={(event) => {
                          event.currentTarget.src = '/placeholder-image.svg';
                        }}
                      />
                    )}
                    {item.restaurant.name}
                  </div>
                )}
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <h2 className='text-xl font-black text-[#e0e0e0]'>{item.name}</h2>
                    <p className='mt-2 line-clamp-2 text-sm leading-6 text-[#e0e0e0]/75'>{item.description || 'Sin descripción'}</p>
                  </div>
                  <span className='shrink-0 rounded-2xl bg-[#e6be7d]/14 px-3 py-2 text-base font-black text-[#e0e0e0] ring-1 ring-[#e6be7d]/10'>
                    {formatCurrency(item.price)}
                  </span>
                </div>
                <div className='mt-5 flex flex-wrap gap-2'>
                  <button
                    type='button'
                    onClick={() => openMenuItemForm(item)}
                    className='admin-button-secondary px-4 py-2 text-sm'
                  >
                    <PencilSquareIcon className='h-4 w-4' />
                    Editar
                  </button>
                  <button
                    type='button'
                    onClick={() => handleDelete(item)}
                    className='admin-button-danger px-4 py-2 text-sm'
                  >
                    <TrashIcon className='h-4 w-4' />
                    Desactivar
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {filteredMenu.length === 0 && (
          <div className='admin-panel p-8 text-center text-sm font-semibold text-[#e6be7d] md:col-span-2 xl:col-span-3'>
            No hay elementos de menú registrados.
          </div>
        )}
      </div>

      {menuModalOpen && createPortal(
        <div className='admin-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4'>
          <div className='admin-panel max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto p-6 shadow-2xl'>
            <div className='flex items-center justify-between gap-4'>
              <div>
                <p className='admin-kicker'>Formulario de platillo</p>
                <h2 className='mt-1 text-2xl font-black text-[#e0e0e0]'>
                  {activeMenuItem ? 'Editar platillo' : 'Nuevo platillo'}
                </h2>
              </div>
              <button
                type='button'
                onClick={() => {
                  setActiveMenuItem(null);
                  setForm(emptyMenu);
                  setMenuModalOpen(false);
                }}
                className='admin-button-secondary px-4 py-2 text-sm'
              >
                Cerrar
              </button>
            </div>
            <form onSubmit={handleSubmit} className='mt-6 grid gap-4 sm:grid-cols-2'>
              <label className='block'>
                <span className='text-sm font-bold text-[#e0e0e0]'>Nombre</span>
                <input
                  type='text'
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className='admin-input mt-2 w-full px-4 py-3 text-sm'
                />
                {formErrors.name && <p className='mt-1 text-xs font-bold text-red-600'>{formErrors.name}</p>}
              </label>
              <label className='block'>
                <span className='text-sm font-bold text-[#e0e0e0]'>Categoría</span>
                <select
                  required
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  className='admin-input mt-2 w-full px-4 py-3 text-sm'
                >
                  <option value=''>Selecciona una categoría</option>
                  {categories.filter((cat) => cat !== 'Todos').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {formErrors.category && <p className='mt-1 text-xs font-bold text-red-600'>{formErrors.category}</p>}
              </label>
              <label className='block sm:col-span-2'>
                <span className='text-sm font-bold text-[#e0e0e0]'>Descripción</span>
                <textarea
                  value={form.description}
                  required
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className='admin-input mt-2 w-full px-4 py-3 text-sm'
                  rows='4'
                />
                {formErrors.description && <p className='mt-1 text-xs font-bold text-red-600'>{formErrors.description}</p>}
              </label>
              <label className='block'>
                <span className='text-sm font-bold text-[#e0e0e0]'>Precio</span>
                <input
                  type='number'
                  step='0.01'
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                  className='admin-input mt-2 w-full px-4 py-3 text-sm'
                />
                {formErrors.price && <p className='mt-1 text-xs font-bold text-red-600'>{formErrors.price}</p>}
              </label>
              <label className='block'>
                <span className='text-sm font-bold text-[#e0e0e0]'>Disponibilidad</span>
                <select
                  value={form.available ? 'true' : 'false'}
                  onChange={(event) => setForm({ ...form, available: event.target.value === 'true' })}
                  className='admin-input mt-2 w-full px-4 py-3 text-sm'
                >
                  <option value='true'>Disponible</option>
                  <option value='false'>No disponible</option>
                </select>
              </label>
              <label className='block sm:col-span-2'>
                <span className='text-sm font-bold text-[#e0e0e0]'>Imagen del platillo</span>
                <input
                  type='file'
                  accept='image/*'
                  onChange={(event) => setForm({ ...form, image: event.target.files?.[0] ?? null })}
                  className='admin-input mt-2 w-full px-4 py-3 text-sm'
                />
                {form.image && (
                  <div className='mt-3 space-y-2'>
                    <img
                      src={
                        form.image instanceof File
                          ? URL.createObjectURL(form.image)
                          : resolveCloudinaryImageUrl(form.image)
                      }
                      alt='Vista previa del platillo'
                      className='h-44 w-full rounded-2xl object-cover'
                      onError={(event) => {
                        event.currentTarget.src = '/placeholder-image.svg';
                      }}
                    />
                    <p className='text-xs font-semibold text-[#e6be7d]'>
                      {typeof form.image === 'string' ? 'Imagen actual guardada' : form.image.name}
                    </p>
                  </div>
                )}
                {formErrors.image && <p className='mt-1 text-xs font-bold text-red-600'>{formErrors.image}</p>}
              </label>
              <div className='flex flex-col-reverse justify-end gap-3 pt-4 sm:flex-row sm:col-span-2'>
                <button
                  type='button'
                  onClick={() => {
                    setActiveMenuItem(null);
                    setForm(emptyMenu);
                    setMenuModalOpen(false);
                  }}
                  className='admin-button-secondary w-full px-5 py-3 text-sm sm:w-auto'
                >
                  Cancelar
                </button>
                <button 
                  type='submit' 
                  className='group relative w-full overflow-hidden rounded-full bg-gradient-to-r from-[#141426] via-[#141426] to-[#e6be7d] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#e6be7d]/30 transition-all duration-300 hover:shadow-xl hover:shadow-[#e6be7d]/50 hover:-translate-y-0.5 sm:w-auto flex items-center justify-center gap-2'
                >
                  <SparklesIcon className='h-5 w-5 transition-transform group-hover:scale-110' />
                  <span>Guardar platillo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
};
