import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:8000' });

API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const login = (username, password) =>
  API.post('/auth/login', new URLSearchParams({ username, password }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

export const register = (data) => API.post('/auth/register', data);
export const getMe = () => API.get('/auth/me');

export const submitTransaction = (data) => API.post('/transactions/', data);
export const getTransactions = (params) => API.get('/transactions/', { params });
export const getDashboardStats = () => API.get('/transactions/dashboard/stats');
export const getModelMetrics = () => API.get('/transactions/model/metrics');

export default API;
