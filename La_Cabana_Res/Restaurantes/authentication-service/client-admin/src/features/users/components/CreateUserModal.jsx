import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Spinner } from '../../auth/components/Spinner.jsx';

export const CreateUserModal = ({ isOpen, onClose, onCreate, loading, error }) => {
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const submit = async (values) => {
    const ok = await onCreate({
      username: values.username,
      email: values.email,
      password: values.password,
    });

    if (ok) {
      reset({ role: 'CLIENTE' });
      onClose();
    }
  };

  return (
    <div className='admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4'>
      <div className='admin-panel flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl'>
        <div className='sticky top-0 z-10 bg-gradient-to-r from-[#141426] to-[#e6be7d] p-5 text-[#e0e0e0] sm:p-6'>
          <h2 className='text-xl font-black sm:text-2xl text-[#e0e0e0]'>Nuevo usuario</h2>
          <p className='text-xs opacity-80 sm:text-sm text-[#e0e0e0]'>
            Completa la informacion para registrar un nuevo usuario
          </p>
        </div>

        <form onSubmit={handleSubmit(submit)} className='p-5 sm:p-6 space-y-5 overflow-y-auto'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-1'>
                Nombre de Usuario
              </label>
              <input
                {...register('username', {
                  required: 'El nombre de usuario es obligatorio',
                  minLength: {
                    value: 3,
                    message: 'Debe tener al menos 3 caracteres',
                  },
                })}
                type='text'
                className='admin-input w-full px-4 py-3 text-sm'
              />
              {errors.username && <p className='text-red-600 text-xs'>{errors.username.message}</p>}
            </div>

          </div>

          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-1'>Email</label>
            <input
              {...register('email', {
                required: 'El email es obligatorio',
                pattern: {
                  value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
                  message: 'Formato de email invalido',
                },
              })}
              type='email'
              className='admin-input w-full px-4 py-3 text-sm'
            />
            {errors.email && <p className='text-red-600 text-xs'>{errors.email.message}</p>}
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-1'>Contrasena</label>
              <input
                {...register('password', {
                  required: 'La contrasena es obligatoria',
                  minLength: {
                    value: 8,
                    message: 'Debe tener al menos 8 caracteres',
                  },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                    message: 'Debe incluir mayusculas, minusculas y numeros',
                  },
                })}
                type='password'
                className='admin-input w-full px-4 py-3 text-sm'
              />
              {errors.password && <p className='text-red-600 text-xs'>{errors.password.message}</p>}
            </div>

            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-1'>
                Confirmar contrasena
              </label>
              <input
                {...register('confirmPassword', {
                  required: 'Debe confirmar su contrasena',
                  validate: {
                    matchesPassword: (value) =>
                      value === getValues('password') || 'Las contrasenas no coinciden',
                  },
                })}
                type='password'
                className='admin-input w-full px-4 py-3 text-sm'
              />
              {errors.confirmPassword && (
                <p className='text-red-600 text-xs'>{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>


          {error && <p className='text-red-600 text-sm text-center'>{error}</p>}

          <div className='flex flex-col-reverse gap-3 border-t border-[#e6be7d]/10 pt-4 sm:flex-row sm:justify-end'>
            <button
              type='button'
              onClick={() => {
                reset();
                onClose();
              }}
              className='admin-button-secondary w-full px-5 py-3 text-sm sm:w-auto'
            >
              Cancelar
            </button>
            <button
              type='submit'
              disabled={loading}
              className='admin-button-primary w-full px-5 py-3 text-sm disabled:opacity-60 sm:w-auto'
            >
              {loading ? <Spinner small /> : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
