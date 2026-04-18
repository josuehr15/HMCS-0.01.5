import axios from 'axios';

// SEC-003: API base URL from env var, fallback to localhost for local dev
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    headers: { 'Content-Type': 'application/json' },
    // SEC-001: withCredentials sends httpOnly cookie on every request
    withCredentials: true,
    // BUG-01: prevent requests from hanging indefinitely (was causing Reports/Payroll freeze)
    timeout: 30000,
});

// Request interceptor — attach JWT token from localStorage as fallback
// (httpOnly cookie is preferred and sent automatically via withCredentials)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('hmcs_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('hmcs_token');
            localStorage.removeItem('hmcs_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
