import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

if (!API_URL) console.error('VITE_API_URL is not set — API requests will fail.');

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// ─── Shared fetch helper ─────────────────────────────────────────────────────

export const apiFetch = async (path, options = {}, token, signal) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    throw new Error('__AUTH_EXPIRED__');
  }

  if (res.status === 429) {
    const err = new Error('Too many requests, try again in a moment');
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = body;
    throw err;
  }

  return res.json();
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // ── Handle Google OAuth callback token in URL ────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      // Clean the token from URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  // ── Fetch user on mount / token change ───────────────────────────────────

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchUser = async () => {
      try {
        const res = await apiFetch('/api/auth/me', {}, token);
        if (!cancelled) setUser(res.data);
      } catch {
        if (!cancelled) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUser();
    return () => { cancelled = true; };
  }, [token]);

  // ── Login ────────────────────────────────────────────────────────────────

  const login = useCallback(async (email, password) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  }, []);

  // ── Register ─────────────────────────────────────────────────────────────

  const register = useCallback(async (username, email, password) => {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });

    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  // ── Google OAuth redirect ────────────────────────────────────────────────

  const loginWithGoogle = useCallback(() => {
    window.location.href = `${API_URL}/api/auth/google`;
  }, []);

  const updateUser = useCallback((fields) => {
    setUser(prev => {
      if (!prev) return null;
      return { ...prev, ...fields };
    });
  }, []);

  // ── Recover removed ──────────────────────────────────────────────────────

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
    loginWithGoogle,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
