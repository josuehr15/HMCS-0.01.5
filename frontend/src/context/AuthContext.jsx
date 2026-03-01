import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem('hmcs_token');
        const savedUser = localStorage.getItem('hmcs_user');
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
        setIsLoading(false);
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const { token: newToken, user: newUser } = res.data.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('hmcs_token', newToken);
        localStorage.setItem('hmcs_user', JSON.stringify(newUser));
        return newUser;
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('hmcs_token');
        localStorage.removeItem('hmcs_user');
    };

    return (
        <AuthContext.Provider value={{
            user, token, isLoading,
            isAuthenticated: !!token,
            login, logout,
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
