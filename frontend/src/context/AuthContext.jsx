/**
 * AuthContext — auth state, login, logout.
 * FIX: validates token with backend on mount instead of blindly trusting localStorage.
 * This prevents the "login page skip" when an old/expired token is stored.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL ?? 'http://127.0.0.1:8000';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('soc_token');
    const saved = localStorage.getItem('soc_user');

    if (!token || !saved) {
      setLoading(false);
      return;
    }

    // Validate token with backend — don't trust localStorage blindly
    axios.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then(() => {
      try { setUser(JSON.parse(saved)); } catch { _clearSession(); }
    })
    .catch(() => {
      // Token expired or invalid — clear and force re-login
      _clearSession();
    })
    .finally(() => setLoading(false));
  }, []);

  const _clearSession = () => {
    localStorage.removeItem('soc_token');
    localStorage.removeItem('soc_user');
    setUser(null);
  };

  const login = async (username, password) => {
    const r = await axios.post(`${BASE_URL}/api/auth/login`, { username, password });
    const { access_token, ...userInfo } = r.data;
    localStorage.setItem('soc_token', access_token);
    localStorage.setItem('soc_user', JSON.stringify(userInfo));
    setUser(userInfo);
    return userInfo;
  };

  const logout = () => { _clearSession(); };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
