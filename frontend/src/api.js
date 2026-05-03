import axios from 'axios';

const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
const API_BASE_URL = configuredBaseUrl ? `${configuredBaseUrl}/api` : '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

let lastHealthPingAt = 0;

// Add token to requests if exists
apiClient.interceptors.request.use(
  (config) => {
    const method = (config.method || 'get').toLowerCase();
    const publicPaths = ['/questions/packages', '/payment/methods'];
    const requestUrl = config.url || '';
    const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;

    if (['post', 'put', 'patch', 'delete'].includes(method) && !isFormData) {
      config.headers['Content-Type'] = 'application/json';
    } else if (config.headers?.['Content-Type']) {
      delete config.headers['Content-Type'];
    }

    const token = localStorage.getItem('token');
    const isPublicRequest = publicPaths.some((path) => requestUrl.startsWith(path));
    if (token && !isPublicRequest) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    return Promise.reject(error);
  }
);

export async function pingApiHealth({ force = false } = {}) {
  if (typeof window === 'undefined') {
    return null;
  }

  const now = Date.now();
  if (!force && now - lastHealthPingAt < 60_000) {
    return null;
  }

  lastHealthPingAt = now;

  try {
    const response = await apiClient.get('/health');
    return response.data?.data || null;
  } catch (error) {
    return null;
  }
}

export default apiClient;
