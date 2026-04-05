import React, { createContext, useState, useCallback } from 'react';
import apiClient from './api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const storedToken = localStorage.getItem('token');
  const storedUserId = localStorage.getItem('userId');
  const storedEmail = localStorage.getItem('userEmail');
  const storedFullName = localStorage.getItem('fullName');
  const storedRole = localStorage.getItem('userRole');

  const [user, setUser] = useState(
    storedToken && storedUserId
      ? {
          userId: storedUserId,
          email: storedEmail,
          full_name: storedFullName,
          role: storedRole || 'user',
        }
      : null
  );
  const [token, setToken] = useState(storedToken || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const persistSession = useCallback(({ token: nextToken, userId, email, full_name, role }) => {
    if (nextToken) {
      localStorage.setItem('token', nextToken);
      setToken(nextToken);
    }

    localStorage.setItem('userId', userId);
    if (email) {
      localStorage.setItem('userEmail', email);
    }
    if (full_name) {
      localStorage.setItem('fullName', full_name);
    }
    localStorage.setItem('userRole', role || 'user');

    setUser({ userId, email: email || null, full_name: full_name || null, role: role || 'user' });
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('fullName');
    localStorage.removeItem('userRole');
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });
      const { token, userId, full_name, role } = response.data.data;
      persistSession({ token, userId, email, full_name, role });
      return {
        success: true,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (err) {
      if (err.response?.status === 401) {
        clearSession();
      }
      const message = err.response?.data?.message || 'Login gagal';
      setError(message);
      return {
        success: false,
        status: err.response?.status || 0,
        message,
        data: err.response?.data?.data || null,
      };
    } finally {
      setLoading(false);
    }
  }, [clearSession, persistSession]);

  const register = useCallback(async (email, password, full_name) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/register', {
        email,
        password,
        full_name,
      });
      return {
        success: true,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (err) {
      const message = err.response?.data?.message || 'Registrasi gagal';
      setError(message);
      return {
        success: false,
        status: err.response?.status || 0,
        message,
        data: err.response?.data?.data || null,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async (email) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/resend-verification', { email });
      return {
        success: true,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (err) {
      const message = err.response?.data?.message || 'Gagal mengirim ulang email verifikasi';
      setError(message);
      return {
        success: false,
        status: err.response?.status || 0,
        message,
        data: err.response?.data?.data || null,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      return null;
    }

    try {
      const response = await apiClient.get('/auth/profile');
      const profile = response.data.data;
      persistSession({
        token: localStorage.getItem('token'),
        userId: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role || 'user',
      });

      return profile;
    } catch (err) {
      if (err.response?.status === 401) {
        clearSession();
      }
      throw err;
    }
  }, [clearSession, persistSession]);

  const logout = clearSession;

  const isAuthenticated = !!token;
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{ user, token, loading, error, login, register, resendVerification, refreshProfile, logout, isAuthenticated, isAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan dalam AuthProvider');
  }
  return context;
};
