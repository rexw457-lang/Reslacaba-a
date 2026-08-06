import { useEffect, useMemo, useState } from 'react';
import {
  createTableForRestaurant,
  deleteTableForRestaurant,
  getRestaurants,
  getTablesForRestaurant,
  updateTableForRestaurant,
} from '../services/adminApi.js';
import { Spinner } from '../features/auth/components/Spinner.jsx';
import { showError, showSuccess } from '../shared/utils/toast.js';

export const Tables = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', number: '', capacity: '' });
  const [formErrors, setFormErrors] = useState({});
  const [activeTable, setActiveTable] = useState(null);

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
        setTables([]);
      }
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar los restaurantes');
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async (restaurantId) => {
    if (!restaurantId) {
      setTables([]);
      return;
    }

    try {
      setLoading(true);
      const data = await getTablesForRestaurant(restaurantId);
      setTables(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar las mesas');
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
        await loadTables(selectedRestaurantId);
      };
      load();
    }
  }, [selectedRestaurantId]);

  const filteredTables = useMemo(
    () => [...tables].sort((a, b) => a.number - b.number),
    [tables],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedRestaurantId) return;

    try {
      const number = Number(form.number);
      const capacity = Number(form.capacity);
      const errors = {};

      if (!form.name || !form.name.trim()) errors.name = 'Nombre de mesa requerido.';
      if (!form.number || Number.isNaN(number) || number < 1) errors.number = 'Numero de mesa invalido.';
      if (!Number.isInteger(number)) errors.number = 'El numero de mesa debe ser entero.';
      if (!form.capacity || Number.isNaN(capacity) || capacity < 1) errors.capacity = 'Capacidad minima: 1.';
      if (!Number.isInteger(capacity)) errors.capacity = 'La capacidad debe ser entera.';
      if (capacity > 50) errors.capacity = 'Capacidad demasiado alta.';
      if (tables.some((table) => Number(table.number) === number && table._id !== activeTable?._id)) {
        errors.number = 'Ya existe una mesa con ese numero.';
      }

      setFormErrors(errors);
      if (Object.keys(errors).length > 0) {
        showError('Revisa los campos de la mesa');
        return;
      }

      const payload = {
        name: form.name.trim(),
        number,
        capacity,
      };

      if (activeTable) {
        await updateTableForRestaurant(selectedRestaurantId, activeTable._id, payload);
        showSuccess('Mesa actualizada');
      } else {
        await createTableForRestaurant(selectedRestaurantId, payload);
        showSuccess('Mesa creada');
      }

      setActiveTable(null);
      setForm({ number: '', capacity: '' });
      setFormErrors({});
      loadTables(selectedRestaurantId);
    } catch (error) {
      console.error(error);
      showError('No se pudo guardar la mesa');
    }
  };

  const handleEdit = (table) => {
    setActiveTable(table);
    setForm({ number: table.number, capacity: table.capacity });
    setFormErrors({});
  };

  const handleDelete = async (table) => {
    const confirmed = window.confirm('¿Desactivar esta mesa?');
    if (!confirmed) return;

    try {
      await deleteTableForRestaurant(selectedRestaurantId, table._id);
      showSuccess('Mesa desactivada');
      loadTables(selectedRestaurantId);
    } catch (error) {
      console.error(error);
      showError('No se pudo desactivar la mesa');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className='admin-page space-y-8'>
      <div className='flex flex-col gap-4 md:flex-row md:justify-between md:items-end'>
        <div>
          <p className='admin-kicker'>Operación de mesas</p>
          <h1 className='admin-title mt-2'>Mesas</h1>
          <p className='admin-subtitle mt-2 text-sm'>Control de capacidad y disponibilidad por restaurante.</p>
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

      <form onSubmit={handleSubmit} className='admin-panel grid gap-4 p-5 sm:grid-cols-3'>
        <input
          type='text'
          required
          placeholder='Nombre de mesa'
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          className='admin-input px-4 py-3 text-sm'
        />
        {formErrors.name && <p className='text-xs text-red-600'>{formErrors.name}</p>}
        <input
          type='number'
          required
          min='1'
          step='1'
          placeholder='Número de mesa'
          value={form.number}
          onChange={(event) => setForm({ ...form, number: event.target.value })}
          className='admin-input px-4 py-3 text-sm'
        />
        {formErrors.number && <p className='text-xs text-red-600'>{formErrors.number}</p>}
        <input
          type='number'
          required
          min='1'
          max='50'
          step='1'
          placeholder='Capacidad'
          value={form.capacity}
          onChange={(event) => setForm({ ...form, capacity: event.target.value })}
          className='admin-input px-4 py-3 text-sm'
        />
        {formErrors.capacity && <p className='text-xs text-red-600'>{formErrors.capacity}</p>}
        <button className='admin-button-primary px-6 py-3 text-sm'>
          {activeTable ? 'Actualizar mesa' : 'Agregar mesa'}
        </button>
      </form>

      <div className='admin-panel overflow-hidden'>
        <div className='overflow-x-auto'>
        <table className='admin-table min-w-full text-left'>
          <thead className='text-sm'>
            <tr>
              <th className='px-5 py-4'>#</th>
              <th className='px-5 py-4'>Capacidad</th>
              <th className='px-5 py-4'>Estado</th>
              <th className='px-5 py-4'>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredTables.map((table) => (
              <tr key={table._id} className='border-t border-[#e6be7d]/10'>
                <td className='px-5 py-4'>{table.name || `Mesa ${table.number}`}</td>
                <td className='px-5 py-4'>{table.capacity}</td>
                <td className='px-5 py-4'>
                  <span className={`admin-status ${table.status === 'disponible' ? 'admin-status-success' : 'admin-status-danger'}`}>
                    {table.status || 'desconocido'}
                  </span>
                </td>
                <td className='px-5 py-4'>
                  <div className='flex flex-wrap gap-2'>
                    <button
                      type='button'
                      onClick={() => handleEdit(table)}
                      className='admin-button-secondary px-4 py-2 text-sm'
                    >
                      Editar
                    </button>
                    <button
                      type='button'
                      onClick={() => handleDelete(table)}
                      className='admin-button-danger px-4 py-2 text-sm'
                    >
                      Desactivar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTables.length === 0 && (
              <tr>
                <td colSpan='4' className='px-5 py-8 text-center text-sm text-gray-500'>
                  No hay mesas registradas para este restaurante.
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
