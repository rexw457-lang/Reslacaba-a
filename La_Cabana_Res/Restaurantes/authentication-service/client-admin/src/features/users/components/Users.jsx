import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../auth/store/authStore.js';
import { useUserManagementStore } from '../../auth/store/useUserManagementStore.js';
import { Spinner } from '../../auth/components/Spinner.jsx';
import { CreateUserModal } from './CreateUserModal.jsx';
import { showError, showSuccess } from '../../../shared/utils/toast.js';
import {
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  UserPlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

const PAGE_SIZE = 8;

const roleBadgeClass = (role = '') => {
  const normalized = role.toUpperCase();
  if (normalized === 'SUPER_ADMIN') return 'admin-status-warning';
  if (normalized === 'ADMIN') return 'admin-status-danger';
  return 'admin-status-neutral';
};

export const Users = () => {
  const { users, loading, error, getAllUsers, createUser, updateUserRole } = useUserManagementStore();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role?.toUpperCase() === 'SUPER_ADMIN';
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [openCreateModal, setOpenCreateModal] = useState(false);

  useEffect(() => {
    getAllUsers();
  }, [getAllUsers]);

  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((u) => {
      const username = (u.username || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const role = (u.role || '').toUpperCase();
      const matchesSearch =
        !normalizedSearch ||
        username.includes(normalizedSearch) ||
        email.includes(normalizedSearch);
      const matchesRole = roleFilter === 'ALL' ? true : role === roleFilter.toUpperCase();

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage]);

  const stats = useMemo(() => {
    const admins = users.filter((u) => ['ADMIN', 'SUPER_ADMIN'].includes((u.role || '').toUpperCase())).length;
    const active = users.filter((u) => Boolean(u.verified ?? u.emailConfirmed)).length;
    return { active, admins, pending: users.length - active, total: users.length };
  }, [users]);

  const handleCreate = async (payload) => {
    const res = await createUser(payload);
    if (res.success) {
      showSuccess('Usuario creado correctamente. Debe verificar su correo.');
      return true;
    }

    showError(res.error || 'No se pudo crear el usuario');
    return false;
  };

  const handleUpdateUserRole = async (user, nextRole) => {
    const currentRole = (user.role || 'USER').toUpperCase();
    if (currentRole === nextRole) return;

    if (!user.verified && !user.emailConfirmed) {
      showError('El usuario debe verificar su correo antes de cambiar su rol');
      return;
    }

    const ok = window.confirm(`Cambiar el rol de ${user.email} de ${currentRole} a ${nextRole}?`);
    if (!ok) return;

    const res = await updateUserRole(user._id || user.id, nextRole);
    if (res.success) {
      showSuccess(`Rol actualizado a ${nextRole}.`);
      return;
    }

    showError(res.error || 'No se pudo actualizar el rol del usuario');
  };

  if (loading && users.length === 0) return <Spinner />;

  return (
    <div className='admin-page space-y-8'>
      <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
        <div>
          <p className='admin-kicker'>SuperAdministrador</p>
          <h1 className='admin-title mt-2'>Usuarios y permisos</h1>
          <p className='admin-subtitle mt-2 text-sm'>Control de accesos, roles administrativos y estado de verificación.</p>
        </div>
        <button
          type='button'
          className='admin-button-primary px-5 py-3 text-sm'
          onClick={() => setOpenCreateModal(true)}
        >
          <UserPlusIcon className='h-5 w-5' />
          Agregar usuario
        </button>
      </div>

      <section className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <article className='admin-card p-5'>
          <UsersIcon className='h-7 w-7 text-[#e6be7d]' />
          <p className='mt-3 text-sm font-bold text-[#e6be7d]'>Usuarios registrados</p>
          <p className='mt-2 text-3xl font-black text-[#e0e0e0]'>{stats.total}</p>
        </article>
        <article className='admin-card p-5'>
          <ShieldCheckIcon className='h-7 w-7 text-[#e6be7d]' />
          <p className='mt-3 text-sm font-bold text-[#e6be7d]'>Usuarios activos</p>
          <p className='mt-2 text-3xl font-black text-[#e0e0e0]'>{stats.active}</p>
        </article>
        <article className='admin-card p-5'>
          <UserGroupIcon className='h-7 w-7 text-[#e6be7d]' />
          <p className='mt-3 text-sm font-bold text-[#e6be7d]'>Administradores</p>
          <p className='mt-2 text-3xl font-black text-[#e0e0e0]'>{stats.admins}</p>
        </article>
        <article className='admin-card p-5'>
          <p className='text-sm font-bold text-[#e6be7d]'>Pendientes</p>
          <p className='mt-2 text-3xl font-black text-[#e0e0e0]'>{stats.pending}</p>
          <div className='mt-3 admin-progress'>
            <span style={{ width: `${stats.total ? (stats.active / stats.total) * 100 : 0}%` }} />
          </div>
        </article>
      </section>

      <section className='admin-panel overflow-hidden'>
        <div className='border-b border-[#e6be7d]/10 p-5'>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]'>
            <label className='relative block'>
              <MagnifyingGlassIcon className='pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#e6be7d]' />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder='Buscar por username o email'
                className='admin-input w-full px-11 py-3 text-sm'
              />
            </label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className='admin-input w-full px-4 py-3 text-sm font-semibold'
            >
              <option value='ALL'>Todos los roles</option>
              <option value='ADMIN'>ADMIN</option>
              <option value='USER'>USER</option>
              <option value='SUPER_ADMIN'>SUPER_ADMIN</option>
            </select>
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table className='admin-table min-w-full text-sm'>
            <thead>
              <tr>
                <th className='px-5 py-4 text-left'>Email</th>
                <th className='px-5 py-4 text-left'>Username</th>
                <th className='px-5 py-4 text-left'>Rol</th>
                <th className='px-5 py-4 text-left'>Estado</th>
                <th className='px-5 py-4 text-left'>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td className='px-5 py-10 text-center text-[#e6be7d]' colSpan={5}>
                    No hay usuarios para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const isVerified = Boolean(u.verified ?? u.emailConfirmed);

                  return (
                    <tr key={u._id || u.id || u.email} className='border-t border-[#e6be7d]/10'>
                      <td className='px-5 py-4 font-extrabold text-[#e0e0e0]'>{u.email || '-'}</td>
                      <td className='px-5 py-4 text-[#e6be7d]'>@{u.username}</td>
                      <td className='px-5 py-4'>
                        {isSuperAdmin && u.role?.toUpperCase() !== 'SUPER_ADMIN' ? (
                          <select
                            value={(u.role || 'USER').toUpperCase()}
                            onChange={(e) => handleUpdateUserRole(u, e.target.value)}
                            disabled={loading}
                            className='admin-input px-3 py-2 text-sm font-semibold'
                          >
                            <option value='USER'>USER</option>
                            <option value='ADMIN'>ADMIN</option>
                          </select>
                        ) : (
                          <span className={`admin-status ${roleBadgeClass(u.role)}`}>
                            {u.role?.toUpperCase() || 'USER'}
                          </span>
                        )}
                      </td>
                      <td className='px-5 py-4'>
                        <span className={`admin-status ${isVerified ? 'admin-status-success' : 'admin-status-warning'}`}>
                          {isVerified ? 'Activo' : 'Pendiente'}
                        </span>
                      </td>
                      <td className='px-5 py-4'>
                        {u.role?.toUpperCase() === 'SUPER_ADMIN' ? (
                          <span className='admin-status admin-status-warning'>Protegido</span>
                        ) : isSuperAdmin ? (
                          <span className='text-xs font-bold text-[#e6be7d]'>Editar rol</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className='flex flex-col gap-3 border-t border-[#e6be7d]/10 bg-[#e6be7d]/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-xs font-bold text-[#e6be7d]'>
            Mostrando {(currentPage - 1) * PAGE_SIZE + (paginatedUsers.length ? 1 : 0)}
            {' - '}
            {(currentPage - 1) * PAGE_SIZE + paginatedUsers.length} de {filteredUsers.length}
          </p>
          <div className='flex gap-2'>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className='admin-button-secondary px-4 py-2 text-sm disabled:opacity-50'
            >
              Anterior
            </button>
            <span className='rounded-full bg-white px-3 py-2 text-sm font-black text-[#141426] ring-1 ring-[#e6be7d]/10'>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className='admin-button-secondary px-4 py-2 text-sm disabled:opacity-50'
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      <CreateUserModal
        isOpen={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        onCreate={handleCreate}
        loading={loading}
        error={error}
      />
    </div>
  );
};
