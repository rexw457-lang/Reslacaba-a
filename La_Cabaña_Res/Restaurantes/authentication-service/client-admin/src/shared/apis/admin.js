import { axiosAdmin } from './api';

export const getFields = async () => {
  return await axiosAdmin.get('/fields');
};

export const createField = async (formData) => {
  return await axiosAdmin.post('/fields', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const updateField = async (id, formData) => {
  return await axiosAdmin.put(`/fields/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const deleteField = async (id) => {
  return await axiosAdmin.put(`/fields/${id}/deactivate`);
};
