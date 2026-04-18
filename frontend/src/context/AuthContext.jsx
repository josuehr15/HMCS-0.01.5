import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // SEC-001: On mount, restore session by calling /auth/me (reads httpOnly cookie).
    // We also keep hmcs_user in localStorage as a non-auth cache for instant UI render.
    useEffect(() => {
        const restoreSession = async () => {
            // Optimistic render from cached user object (no security risk — cookie validates)
            const cachedUser = localStorage.getItem('hmcs_user');
            if (cachedUser) {
                try { setUser(JSON.parse(cachedUser)); } catch { /* ignore */ }
            }

            try {
                const res = await api.get('/auth/me');
                const freshUser = res.data?.data?.user;
                if (freshUser) {
                    setUser(freshUser);
                    localStorage.setItem('hmcs_user', JSON.stringify(freshUser));
                } else {
                    // Cookie invalid/expired
                    setUser(null);
                    localStorage.removeItem('hmcs_user');
                    localStorage.removeItem('hmcs_token');
                }
            } catch {
                // /auth/me returned 401 — session expired or no cookie
                setUser(null);
                localStorage.removeItem('hmcs_user');
                localStorage.removeItem('hmcs_token');
            } finally {
                setIsLoading(false);
            }
        };
        restoreSession();
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const { token: newToken, user: newUser } = res.data.data;
        setUser(newUser);
        // SEC-001: backend sets httpOnly cookie; we store token in localStorage only as
        // Authorization header fallback (needed while transitioning to full cookie-only auth).
        // The token in localStorage is NOT used for session restore — /auth/me handles that.
        localStorage.setItem('hmcs_token', newToken);
        localStorage.setItem('hmcs_user', JSON.stringify(newUser));
        return newUser;
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout'); // clears httpOnly cookie on server
        } catch { /* ignore network errors on logout */ }
        setUser(null);
        localStorage.removeItem('hmcs_token');
        localStorage.removeItem('hmcs_user');
    };

    return (
        <AuthContext.Provider value={{
            user,
            token: localStorage.getItem('hmcs_token'), // kept for backward compat
            isLoading,
            isAuthenticated: !!user,
            login,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
