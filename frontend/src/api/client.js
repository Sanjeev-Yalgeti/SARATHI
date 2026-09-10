import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization Bearer token to every request if available
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sarathi_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// If response returns 401 Unauthorized, handle token expiration gracefully
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Don't auto-clear for login endpoint itself so caller can display invalid credentials
      if (!error.config?.url?.includes('/api/auth/login')) {
        localStorage.removeItem('sarathi_token');
        localStorage.removeItem('sarathi_user');
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
