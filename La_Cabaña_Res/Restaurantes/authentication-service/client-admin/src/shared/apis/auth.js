import { axiosAuth } from './api.js';

export const login = async ({ email, password }) => {
  return await axiosAuth.post('/auth/login', {
    email,
    password,
  });
};

export const getAllUsers = async () => {
  const { data } = await axiosAuth.get('/auth/users');
  return data;
};

export const createUser = async (data) => {
  return await axiosAuth.post('/auth/register', data);
};

export const updateUserRole = async (id, data) => {
  return await axiosAuth.patch(`/auth/users/${id}/role`, data);
};

export const promoteUserToAdmin = async (id) => {
  return await updateUserRole(id, { role: 'ADMIN' });
};

export const register = async (data) => {
  return await axiosAuth.post('/auth/register', data);
};

export const forgotPassword = async (email) => {
  return await axiosAuth.post('/auth/forgot-password', null, { params: { email } });
};

export const verifyEmail = async (token) => {
  return await axiosAuth.post('/auth/verify-email', null, { params: { token } });
};

export const resendVerification = async (email) => {
  return await axiosAuth.post('/auth/resend-verification', { email });
};
