import { useState, useCallback } from 'react';
import api from '../utils/api';

const useApi = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const request = useCallback(async (method, url, data = null) => {
        setLoading(true);
        setError(null);
        try {
            const config = { method, url };
            if (data) config.data = data;
            const res = await api(config);
            return res.data;
        } catch (err) {
            const msg = err.response?.data?.message || 'Error de conexión';
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const get = useCallback((url) => request('GET', url), [request]);
    const post = useCallback((url, data) => request('POST', url, data), [request]);
    const put = useCallback((url, data) => request('PUT', url, data), [request]);
    const del = useCallback((url) => request('DELETE', url), [request]);

    return { get, post, put, del, loading, error };
};

export default useApi;
