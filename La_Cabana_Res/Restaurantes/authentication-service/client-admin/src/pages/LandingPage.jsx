import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/store/authStore.js';
import logo from '../assets/img/los_rubios_rojos_logo.svg';

export const LandingPage = () => {
  return (
    <div className='min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(230,190,125,0.12),transparent_35rem),radial-gradient(circle_at_bottom_right,rgba(225,190,125,0.12),transparent_32rem),linear-gradient(180deg,#141426_0%,#141426_45%,#1a1a2e_100%)] flex items-center justify-center p-6'>
      <div className='max-w-3xl w-full rounded-[2rem] border border-[#e6be7d]/15 bg-[#141426]/90 p-10 shadow-2xl backdrop-blur-xl'>
        <div className='flex flex-col items-center gap-6 text-center'>
          <img src={logo} alt='La Cabaña' className='h-24 w-auto rounded-2xl' />
          <div>
            <h1 className='text-4xl font-black tracking-tight text-[#e6be7d] sm:text-5xl'>La Cabaña</h1>
            <p className='mt-4 text-[#e0e0e0] text-lg sm:text-xl'>Bienvenido al sistema de reserva y gestión del restaurante.</p>
          </div>
          <div className='space-y-4'>
            <p className='text-sm text-[#e6be7d]'>
              Presiona el botón para iniciar tu experiencia y acceder a la plataforma.
            </p>
            <StartButton />
          </div>
          <p className='text-sm text-[#e6be7d]'>
            Si eres administrador, accederás al panel de administración; si eres cliente, te llevaremos a tu vista cliente.
          </p>
        </div>
      </div>
    </div>
  );
};

const StartButton = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const handleStart = () => {
    if (isAuthenticated) {
      const role = user?.role?.toUpperCase();
      if (role?.includes('ADMIN')) navigate('/dashboard');
      else navigate('/cliente');
    } else {
      navigate('/login');
    }
  };

  return (
    <button
      onClick={handleStart}
      className='inline-flex items-center justify-center rounded-full bg-[#e6be7d] px-8 py-3 text-base font-semibold text-[#141426] shadow-[0_16px_34px_rgba(230,190,125,0.25)] transition hover:bg-[#c19a6b]/95'
    >
      Inicia tu experiencia
    </button>
  );
};
