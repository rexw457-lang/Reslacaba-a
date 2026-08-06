import { create } from 'zustand';
import {
  createUser as createUserRequest,
  getAllUsers as getAllUsersRequest,
  promoteUserToAdmin as promoteUserToAdminRequest,
  updateUserRole as updateUserRoleRequest,
} from '../../../shared/apis';

export const useUserManagementStore = create((set, get) => ({
  users: [],
  loading: false,
  error: null,
  filters: {},

  setFilters: (filters) => set({ filters }),

  setUser: (users) => set({ users }),

  createUser: async (payload) => {
    try {
      set({ loading: true, error: null });
      await createUserRequest(payload);
      set({ loading: false });
      await get().getAllUsers(undefined, { force: true });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Error al crear usuario';
      set({ error: message, loading: false });
      return { success: false, error: message };
    }
  },

  promoteUserToAdmin: async (id) => {
    try {
      set({ loading: true, error: null });
      await promoteUserToAdminRequest(id, { role: 'ADMIN' });
      set({ loading: false });
      await get().getAllUsers(undefined, { force: true });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Error al promover usuario';
      set({ error: message, loading: false });
      return { success: false, error: message };
    }
  },

  updateUserRole: async (id, role) => {
    try {
      set({ loading: true, error: null });
      await updateUserRoleRequest(id, { role });
      set({ loading: false });
      await get().getAllUsers(undefined, { force: true });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Error al actualizar rol de usuario';
      set({ error: message, loading: false });
      return { success: false, error: message };
    }
  },

  getAllUsers: async (apiFn = getAllUsersRequest, options = {}) => {
    try {
      const { force = false } = options;
      const state = get();

      if (state.loading) return;
      if (!force && state.users.length > 0) return;

      set({ loading: true, error: null });

      const fetcher = typeof apiFn === 'function' ? apiFn : getAllUsersRequest;
      const response = await fetcher();

      const normalizedUsers = Array.isArray(response?.users)
        ? response.users
        : Array.isArray(response?.data?.users)
          ? response.data.users
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : Array.isArray(response?.data)
              ? response.data
              : Array.isArray(response)
                ? response
                : [];

      set({
        users: normalizedUsers,
        loading: false,
      });
    } catch (err) {
      console.error(err);
      set({
        error: err.response?.data?.message || 'Error al listar usuarios',
        loading: false,
      });
    }
  },
}));
