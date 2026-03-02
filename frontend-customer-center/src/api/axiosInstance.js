import axios from 'axios';
import config from '../config';

const axiosInstance = axios.create({
  baseURL: config.apiUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — inject auth token
axiosInstance.interceptors.request.use(
  (cfg) => {
    const token = localStorage.getItem('token');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
