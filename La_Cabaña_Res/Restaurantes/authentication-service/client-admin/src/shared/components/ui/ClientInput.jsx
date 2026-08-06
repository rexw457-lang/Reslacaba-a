export const ClientInput = ({ label, error, className = '', ...props }) => {
  return (
    <label className='block space-y-1.5'>
      {label && <span className='text-sm font-medium text-gray-900'>{label}</span>}
      <input
        {...props}
        className={`w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-main-blue focus:ring-2 focus:ring-main-blue/20 ${className}`}
      />
      {error && <span className='text-xs font-medium text-red-600'>{error}</span>}
    </label>
  );
};