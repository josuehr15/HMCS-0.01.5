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
// SEC: Only redirect to /login on 401 if it's NOT the /auth/me restore-session call.
// Redirecting on /auth/me would cause a loop: restoreSession → 401 → redirect → mount → restoreSession → ...
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const url = error.config?.url || '';
        const is401 = error.response?.status === 401;
        const isAuthMe = url.includes('/auth/me');

        if (is401 && !isAuthMe) {
            localStorage.removeItem('hmcs_token');
            localStorage.removeItem('hmcs_user');
            // Only redirect if we're not already on the login page
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
