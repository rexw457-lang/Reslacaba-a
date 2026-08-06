import { AvatarUser } from '../ui/AvatarUser.jsx';
import imgLogo from '../../../assets/img/los_rubios_rojos_logo.svg';

export const Navbar = () => {
  return (
    <nav className='sticky top-0 z-50 border-b border-[#e6be7d]/10 bg-[#141426]/95 shadow-[0_10px_35px_rgba(1,6,12,0.45)] backdrop-blur-xl'>
      <div className='mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#141426] ring-1 ring-[#e6be7d]/20'>
            <img
              src={imgLogo}
              alt='La Cabaña Logo'
              className='h-8 w-auto object-contain'
            />
          </div>
          <div className='min-w-0'>
            <p className='truncate text-sm font-black text-[#e6be7d]'>La Cabaña Admin</p>
            <p className='hidden text-xs font-semibold text-[#e6be7d] sm:block'>
              Centro de control gastronómico
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2 sm:gap-3'>
          {/* Badge 'Operación en vivo' y botón de notificaciones eliminados a petición del usuario */}
          <AvatarUser />
        </div>
      </div>
    </nav>
  );
};
