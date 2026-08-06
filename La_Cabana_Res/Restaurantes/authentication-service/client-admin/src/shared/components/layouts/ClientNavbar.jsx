import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import imgLogo from '../../../assets/img/los_rubios_rojos_logo.svg';
import { useAuthStore } from '../../../features/auth/store/authStore.js';

const navItems = [
  { label: 'Restaurantes', to: '/cliente/restaurants' },
  { label: 'Reservas', to: '/cliente/reservations' },
  { label: 'Reseñas', to: '/cliente/reviews' },
  { label: 'Ordenes', to: '/cliente/orders' },
];

export const ClientNavbar = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const onDoc = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className='sticky top-0 z-50 border-b border-[#e6be7d]/12 bg-[#141426]/92 backdrop-blur-xl'>
      <div className='mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8'>
        <Link to='/cliente' className='flex items-center gap-3'>
          <img src={imgLogo} alt='La Cabaña' className='h-10 w-auto' />
          <div className='hidden sm:block'>
            <p className='text-sm font-semibold text-main-blue'>La Cabaña</p>
            <p className='text-xs text-[#e6be7d]'>Experiencia cliente</p>
          </div>
        </Link>

        <nav className='hidden gap-2 md:flex'>
          <NavLink
            to='/cliente'
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className={({ isActive }) =>
              `rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive ? 'bg-main-blue text-white shadow-sm' : 'text-[#e6be7d] hover:bg-surface-soft hover:text-main-blue'
              }`
            }
          >
            Dashboard
          </NavLink>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-main-blue text-white shadow-sm' : 'text-[#e6be7d] hover:bg-surface-soft hover:text-main-blue'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className='relative' ref={ref}>
          {user ? (
            <button
              type='button'
              onClick={() => setOpen((state) => !state)}
              className='inline-flex items-center gap-3 rounded-full border border-main-blue bg-white px-4 py-2 text-sm font-semibold text-main-blue'
            >
              <span className='hidden sm:inline'>{user.username || user.email || 'Usuario'}</span>
              <svg className='h-4 w-4' viewBox='0 0 20 20' fill='currentColor' aria-hidden>
                <path fillRule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z' clipRule='evenodd' />
              </svg>
            </button>
          ) : null}

          {open && (
            <div className='absolute right-0 mt-2 w-48 rounded-md bg-[#141426] shadow-lg ring-1 ring-[#e6be7d]/15'>
              <div className='py-1'>
                <button
                  type='button'
                  onClick={handleLogout}
                  className='w-full px-4 py-2 text-left text-sm text-[#e6be7d] hover:bg-[#e6be7d]/10'
                >
                  Cerrar sesion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
