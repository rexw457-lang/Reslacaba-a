export const ClientModal = ({ open, title, children, onClose }) => {
  if (!open) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
      <div className='w-full max-w-2xl rounded-3xl border border-white/70 bg-card shadow-2xl'>
        <div className='flex items-start justify-between gap-4 border-b border-black/5 px-6 py-5'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.2em] text-main-blue'>La Cabaña</p>
            <h3 className='mt-1 text-2xl font-bold text-gray-900'>{title}</h3>
          </div>
          <button type='button' onClick={onClose} className='rounded-full px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-surface-soft'>
            Cerrar
          </button>
        </div>
        <div className='px-6 py-6'>{children}</div>
      </div>
    </div>
  );
};