export const ClientButton = ({ children, variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: 'bg-main-blue text-white hover:opacity-90 shadow-sm',
    secondary: 'border border-main-blue text-main-blue hover:bg-surface-soft',
    ghost: 'text-main-blue hover:bg-surface-soft',
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};