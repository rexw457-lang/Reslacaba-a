import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { login as loginRequest } from '../../../shared/apis';

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      expiresAt: null,
      loading: false,
      error: null,
      isLoadingAuth: true,
      isAuthenticated: false,

      checkAuth: () => {
        const token = get().token;
        set({
          isLoadingAuth: false,
          isAuthenticated: Boolean(token),
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          expiresAt: null,
          isAuthenticated: false,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      login: async ({ email, password }) => {
        try {
          set({ loading: true, error: null });

          const { data } = await loginRequest({ email, password });
          const token = data?.token;

          if (!token) {
            const message = data?.message || 'Error al iniciar sesion';
            set({ error: message, loading: false });
            return {
              success: false,
              error: message,
              verificationUrl: data?.verificationUrl,
            };
          }

          const claims = parseJwt(token) || {};
          const role = claims?.role || 'ADMIN';

          set({
            user: {
              id:
                claims?.sub ||
                claims?.id ||
                claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
              username:
                claims?.unique_name ||
                claims?.username ||
                claims?.name ||
                claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
                null,
              email:
                claims?.email ||
                claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
                null,
              role,
            },
            token,
            refreshToken: null,
            expiresAt: claims?.exp ? new Date(claims.exp * 1000).toISOString() : null,
            isAuthenticated: true,
            loading: false,
          });

          return { success: true, role };
        } catch (err) {
          const responseData = err?.response?.data;
          const isBadCredentials = err?.response?.status === 401 && !responseData?.verificationUrl;
          const message = isBadCredentials
            ? 'Correo o contrasena incorrectos.'
            : responseData?.message || err?.message || 'Error al iniciar sesion';
          set({ error: message, loading: false });
          return {
            success: false,
            error: message,
            verificationUrl: responseData?.verificationUrl,
          };
        }
      },
    }),
    {
      name: 'auth-KS-IN6AM-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.loading = false;
          state.error = null;
          state.isAuthenticated = Boolean(state.token);
          state.isLoadingAuth = false;
        }
      },
    },
  ),
);
