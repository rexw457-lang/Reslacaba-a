import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../../features/auth/store/authStore.js';
import defaultAvatarImg from '../../../assets/img/avatarDefault-1749508519496.png';

const isLegacyBrokenDefaultAvatar = (value) => {
  if (!value || typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return (
    normalized.includes('avatardefault-1749508519496') ||
    normalized.includes('/image/upload/v1769785926')
  );
};

export const AvatarUser = () => {
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const navigate = useNavigate();

  const toggleMenu = () => setOpen((prev) => !prev);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const avatarSrc =
    user?.profilePicture &&
    user.profilePicture.trim() !== '' &&
    !isLegacyBrokenDefaultAvatar(user.profilePicture)
      ? user.profilePicture
      : defaultAvatarImg;

  return (
    <div className='relative' ref={dropdownRef}>
      <img
        onClick={toggleMenu}
        src={avatarSrc}
        alt={user?.username}
        className='h-10 w-10 cursor-pointer rounded-full border-2 border-[#e6be7d]/70 object-cover shadow-[0_8px_20px_rgba(1,6,12,0.4)] transition hover:scale-105'
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = defaultAvatarImg;
        }}
      />

      {open && (
        <div className='animate-fadeIn absolute right-0 z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-[#e6be7d]/10 bg-[#141426] shadow-2xl'>
          <div className='border-b border-[#e6be7d]/10 bg-[#e6be7d]/14 px-4 py-3'>
            <p className='font-extrabold text-[#e6be7d]'>{user?.username}</p>
            <p className='text-sm text-[#e6be7d] truncate'>{user?.email}</p>
          </div>

          <ul className='p-2 text-sm font-semibold text-[#e0e0e0]'>
            <li>
              <Link to='/dashboard' className='block w-full rounded-xl p-2 hover:bg-[#e6be7d]/14 hover:text-[#e6be7d]'>
                Dashboard
              </Link>
            </li>
            <li>
              <Link to='/dashboard/calendario' className='block w-full rounded-xl p-2 hover:bg-[#e6be7d]/14 hover:text-[#e6be7d]'>
                Calendario
              </Link>
            </li>

            {user?.role?.toUpperCase() === 'SUPER_ADMIN' && (
              <li>
                <Link to='/dashboard/users' className='block w-full rounded-xl p-2 hover:bg-[#e6be7d]/14 hover:text-[#e6be7d]'>
                  Usuarios
                </Link>
              </li>
            )}

            <li>
              <button
                onClick={handleLogout}
                className='block w-full rounded-xl p-2 text-left text-red-600 hover:bg-red-50'
              >
                Cerrar sesión
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
