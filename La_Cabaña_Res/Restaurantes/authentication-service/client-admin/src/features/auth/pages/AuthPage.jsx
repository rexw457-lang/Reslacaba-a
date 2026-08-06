import { useEffect } from 'react';
import { LoginForm } from '../components/LoginForm.jsx';
import { useAuthStore } from '../store/authStore.js';
import { useNavigate } from 'react-router-dom';
import logo from '../../../assets/img/los_rubios_rojos_logo.svg';

export const AuthPage = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      const role = user?.role?.toUpperCase();
      if (role === 'ADMIN') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/dashboard/cocina', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 p-4'>
      <div className='w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-10'>
        <div className='flex justify-center mb-6'>
          <img src={logo} alt='La Cabaña Logo' className='h-20 w-auto' />
        </div>

        <div className='text-center mb-6'>
          <h1 className='text-2xl lg:text-3xl font-bold text-gray-900 mb-2'>
            La Cabaña — Gestión de Restaurante
          </h1>
          <p className='text-gray-600 text-base max-w-md mx-auto'>
            Accede con la credencial interna asignada por el restaurante.
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
};
