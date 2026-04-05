import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_BASE_URL = configuredBaseUrl ? `${configuredBaseUrl}/api` : '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests if exists
apiClient.interceptors.request.use(
  (config) => {
    const method = (config.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      config.headers['Content-Type'] = 'application/json';
    } else if (config.headers?.['Content-Type']) {
      delete config.headers['Content-Type'];
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
