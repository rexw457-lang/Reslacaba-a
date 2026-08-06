import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../features/auth/store/authStore.js';
import { useState } from 'react';
import {
  Bars3Icon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ClipboardDocumentListIcon,
  RectangleGroupIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

export const Sidebar = () => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const currentRole = String(user?.role || '').toUpperCase();
  const isAdmin = currentRole === 'ADMIN';
  const [collapsed, setCollapsed] = useState(false);

  const items = [
    { label: 'Dashboard', to: '/dashboard', icon: Squares2X2Icon },
    { label: 'Nuevo Pedido', to: '/dashboard/nuevo-pedido', icon: ClipboardDocumentListIcon },
    { label: 'Bebidas', to: '/dashboard/bebidas', icon: ClipboardDocumentListIcon },
    { label: 'Cocina', to: '/dashboard/cocina', icon: ClipboardDocumentListIcon },
    { label: 'Entregas', to: '/dashboard/entregas', icon: ClipboardDocumentListIcon },
    { label: 'Historial', to: '/dashboard/historial', icon: ClipboardDocumentListIcon },
    ...(isAdmin ? [{ label: 'Gestión del Menú', to: '/dashboard/menus', icon: RectangleGroupIcon }] : []),
    ...(isAdmin ? [{ label: 'Usuarios', to: '/dashboard/users', icon: UserGroupIcon }] : []),
  ];

  const isActive = (itemTo) => {
    if (itemTo === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname === itemTo || location.pathname.startsWith(`${itemTo}/`);
  };

  return (
    <aside
      className={`shrink-0 border-r border-white/10 bg-[#1a1a2e] text-white shadow-2xl transition-[width] duration-250 md:min-h-[calc(100vh-4rem)] ${collapsed ? 'md:w-24' : 'md:w-72'}`}
    >
      <div className='flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 md:px-5'>
        <div className={`hidden min-w-0 md:block ${collapsed ? 'md:hidden' : ''}`}>
          <p className='text-xs font-black uppercase tracking-[0.16em] text-[#e6be7d]'>Control gastronómico</p>
          <h2 className='truncate text-lg font-black text-[#e0e0e0]'>La Cabaña</h2>
        </div>
        <Bars3Icon className='h-6 w-6 text-[#e6be7d] md:hidden' />
        <button
          type='button'
          onClick={() => setCollapsed((value) => !value)}
          className='hidden rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/15 md:inline-flex'
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronDoubleRightIcon className='h-4 w-4' /> : <ChevronDoubleLeftIcon className='h-4 w-4' />}
        </button>
      </div>

      <ul className='flex gap-2 overflow-x-auto px-4 py-3 md:flex-col md:overflow-visible md:px-3 md:py-5'>
        {items.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to} className='shrink-0'>
              <Link
                to={item.to}
                className={`admin-nav-item px-4 py-3 text-sm font-extrabold md:justify-start ${active ? 'active' : ''} ${collapsed ? 'md:justify-center md:px-3' : ''}`}
                title={item.label}
              >
                <Icon className='h-5 w-5 shrink-0' />
                <span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={`mx-4 mb-5 hidden rounded-2xl border border-white/10 bg-[#141426]/70 p-4 md:block ${collapsed ? 'md:hidden' : ''}`}>
        <p className='text-xs font-bold uppercase tracking-[0.14em] text-[#e6be7d]'>Rol activo</p>
        <p className='mt-1 truncate text-sm font-semibold text-[#e0e0e0]'>{currentRole === 'ADMIN' ? 'Administrador' : currentRole === 'COCINA' ? 'Cocina' : currentRole === 'RECEPCION' ? 'Recepción' : 'Interno'}</p>
        <div className='mt-3 admin-progress bg-[#e6be7d]/15'>
          <span style={{ width: isAdmin ? '92%' : '76%' }} />
        </div>
      </div>
    </aside>
  );
};
