import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore.js';

export const LoginForm = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    const res = await login(data);

    if (res.success) {
      const role = res.role || user?.role || 'ADMIN';
      const normalizedRole = String(role).toUpperCase();
      const isAdmin = normalizedRole === 'ADMIN';
      navigate(isAdmin ? '/dashboard' : '/dashboard/cocina');
      toast.success(`Bienvenido ${isAdmin ? 'administrador' : normalizedRole === 'COCINA' ? 'cocina' : 'recepción'}!`, { duration: 3000 });
      return;
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-5'>
      <div>
        <label htmlFor='email' className='mb-1.5 block text-sm font-medium text-gray-900'>
          Email
        </label>
        <input
          type='email'
          id='email'
          placeholder='correo@example.com'
          className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-main-blue focus:outline-none focus:ring-2 focus:ring-main-blue'
          {...register('email', {
            required: 'Este campo es obligatorio',
          })}
        />
        {errors.email && <p className='mt-1 text-xs text-red-600'>{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor='password' className='mb-1.5 block text-sm font-medium text-gray-900'>
          Contrasena
        </label>
        <input
          type='password'
          id='password'
          placeholder='* * * * * * *'
          className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-main-blue focus:outline-none focus:ring-2 focus:ring-main-blue'
          {...register('password', {
            required: 'Este campo es obligatorio',
          })}
        />
        {errors.password && <p className='mt-1 text-xs text-red-600'>{errors.password.message}</p>}
      </div>

      {error && <p className='text-center text-sm text-red-600'>{error}</p>}

      <button
        type='submit'
        disabled={loading}
        className='w-full rounded-lg bg-main-blue px-4 py-2.5 text-sm font-medium text-[#141426] transition-colors duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70'
      >
        {loading ? 'Iniciando...' : 'Iniciar sesion'}
      </button>

      <p className='text-center text-sm text-[#e6be7d]'>
        Usa la credencial interna asignada por el restaurante.
      </p>
    </form>
  );
};
