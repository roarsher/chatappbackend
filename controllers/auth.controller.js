 import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setMemoryToken, clearMemoryToken } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── Verify session on mount ───────────────────────────────────────────────
  // Works via cookie OR in-memory Bearer token (set after login)
  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
      clearMemoryToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // ─── Register ──────────────────────────────────────────────────────────────
  const register = async (username, email, password) => {
    setError(null);
    const { data } = await api.post('/auth/register', { username, email, password });
    // Store token in memory as fallback for cross-domain cookie issues
    if (data.token) setMemoryToken(data.token);
    setUser(data.user);
    return data;
  };

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    setError(null);
    const { data } = await api.post('/auth/login', { email, password });
    if (data.token) setMemoryToken(data.token);
    setUser(data.user);
    return data;
  };

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearMemoryToken();
      setUser(null);
    }
  };

  const updateUser = (updates) => setUser((prev) => ({ ...prev, ...updates }));

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, updateUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};