import { axiosAdmin } from '../shared/apis/api.js';

const normalizeResponse = (data, key) => {
  if (Array.isArray(data)) return data;
  if (data?.[key]) return data[key];
  return [];
};

const formDataConfig = () => {
  // Si el payload es FormData, no mandamos config extra.
  // El interceptor `addAuthHeaders` ya quita Content-Type cuando detecta FormData.
  return undefined;
};





export const getRestaurants = async () => {
  const { data } = await axiosAdmin.get('/restaurants');
  return normalizeResponse(data, 'restaurants');
};

export const createRestaurant = async (payload) => {
  const { data } = await axiosAdmin.post('/restaurants', payload, formDataConfig(payload));
  return data;
};


export const updateRestaurant = async (id, payload) => {
  const { data } = await axiosAdmin.put(`/restaurants/${id}`, payload, formDataConfig(payload));
  return data;
};

export const deleteRestaurant = async (id) => {
  const { data } = await axiosAdmin.delete(`/restaurants/${id}`);
  return data;
};

export const getTablesForRestaurant = async (restaurantId) => {
  const { data } = await axiosAdmin.get(`/restaurants/${restaurantId}/tables`);
  return normalizeResponse(data, 'tables');
};

export const createTableForRestaurant = async (restaurantId, payload) => {
  const { data } = await axiosAdmin.post(`/restaurants/${restaurantId}/tables`, payload);
  return data;
};

export const updateTableForRestaurant = async (restaurantId, tableId, payload) => {
  const { data } = await axiosAdmin.put(`/restaurants/${restaurantId}/tables/${tableId}`, payload);
  return data;
};

export const deleteTableForRestaurant = async (restaurantId, tableId) => {
  const { data } = await axiosAdmin.delete(`/restaurants/${restaurantId}/tables/${tableId}`);
  return data;
};

export const getMenuItems = async () => {
  const { data } = await axiosAdmin.get('/menu');
  return normalizeResponse(data, 'menuItems');
};

export const getTables = async (params = {}) => {
  const { data } = await axiosAdmin.get('/tables', { params });
  return normalizeResponse(data, 'tables');
};

export const getMenuItemsByRestaurant = async (restaurantId) => {
  const { data } = await axiosAdmin.get(`/menu/restaurant/${restaurantId}`);
  return normalizeResponse(data, 'menuItems');
};

export const createMenuItemForRestaurant = async (restaurantId, payload) => {
  const finalPayload = payload instanceof FormData ? payload : { ...payload, restaurant: restaurantId };
  if (finalPayload instanceof FormData) {
    finalPayload.append('restaurant', restaurantId);
  }
  const { data } = await axiosAdmin.post('/menu', finalPayload, formDataConfig(finalPayload));
  return data;
};

export const updateMenuItem = async (id, payload) => {
  const { data } = await axiosAdmin.put(`/menu/${id}`, payload, formDataConfig(payload));
  return data;
};

export const deleteMenuItem = async (id) => {
  const { data } = await axiosAdmin.delete(`/menu/${id}`);
  return data;
};

export const getOrders = async () => {
  const { data } = await axiosAdmin.get('/orders');
  return normalizeResponse(data, 'orders');
};

export const updateOrderStatus = async (id, status) => {
  const { data } = await axiosAdmin.patch(`/orders/${id}/status`, { status });
  return data;
};

export const updateOrderSectionStatus = async (id, section, status) => {
  const { data } = await axiosAdmin.patch(`/orders/${id}/part-status`, { section, status });
  return data;
};

export const updateOrderItems = async (id, items) => {
  const { data } = await axiosAdmin.patch(`/orders/${id}/items`, { items });
  return data;
};

export const deleteOrder = async (id) => {
  const { data } = await axiosAdmin.delete(`/orders/${id}`);
  return data;
};

export const getOrderHistory = async (status = '') => {
  const { data } = await axiosAdmin.get('/orders/history', { params: status ? { status } : {} });
  return Array.isArray(data) ? data : [];
};

export const getReviewsForRestaurant = async (restaurantId) => {
  const { data } = await axiosAdmin.get(`/restaurants/${restaurantId}/reviews`);
  return normalizeResponse(data, 'reviews');
};

export const createReviewForRestaurant = async (restaurantId, payload) => {
  const { data } = await axiosAdmin.post(`/restaurants/${restaurantId}/reviews`, payload);
  return data;
};

export const getReservationsForRestaurant = async (restaurantId) => {
  const { data } = await axiosAdmin.get(`/restaurants/${restaurantId}/reservations`);
  return normalizeResponse(data, 'reservations');
};

export const createReservation = async (restaurantId, payload) => {
  const { data } = await axiosAdmin.post(`/restaurants/${restaurantId}/reservations`, payload);
  return data;
};

export const createOrder = async (payload) => {
  const { data } = await axiosAdmin.post('/orders', payload);
  return data;
};
