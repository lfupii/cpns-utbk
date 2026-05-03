"use client";
import React, { createContext, useState, useCallback, useEffect } from 'react';
import apiClient from './api';
import { clearAllActiveAssessmentSessions } from './utils/activeAssessmentSession';

export const AuthContext = createContext();

function readStoredSession() {
  if (typeof window === 'undefined') {
    return {
      token: null,
      user: null,
    };
  }

  const storedToken = window.localStorage.getItem('token');
  const storedUserId = window.localStorage.getItem('userId');
  const storedEmail = window.localStorage.getItem('userEmail');
  const storedFullName = window.localStorage.getItem('fullName');
  const storedRole = window.localStorage.getItem('userRole');

  return {
    token: storedToken || null,
    user: storedToken && storedUserId
      ? {
          userId: storedUserId,
          email: storedEmail,
          full_name: storedFullName,
          role: storedRole || 'user',
        }
      : null,
  };
}

export const AuthProvider = ({ children }) => {
  const initialSession = readStoredSession();

  const [user, setUser] = useState(initialSession.user);
  const [token, setToken] = useState(initialSession.token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authReady, setAuthReady] = useState(!initialSession.token);

  const persistSession = useCallback(({ token: nextToken, userId, email, full_name, role }) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (nextToken) {
      window.localStorage.setItem('token', nextToken);
      setToken(nextToken);
    }

    window.localStorage.setItem('userId', userId);
    if (email) {
      window.localStorage.setItem('userEmail', email);
    }
    if (full_name) {
      window.localStorage.setItem('fullName', full_name);
    }
    window.localStorage.setItem('userRole', role || 'user');

    setUser({ userId, email: email || null, full_name: full_name || null, role: role || 'user' });
  }, []);

  const clearSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('token');
      window.localStorage.removeItem('userId');
      window.localStorage.removeItem('userEmail');
      window.localStorage.removeItem('fullName');
      window.localStorage.removeItem('userRole');
    }
    clearAllActiveAssessmentSessions();
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

  const loginWithGoogle = useCallback(async (credential) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/google', {
        credential,
        intent: 'login',
      });
      const { token, userId, email, full_name, role } = response.data.data;
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
      const message = err.response?.data?.message || 'Login Google gagal';
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

  const registerWithGoogle = useCallback(async (credential) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/google', {
        credential,
        intent: 'register',
      });
      const { token, userId, email, full_name, role } = response.data.data;
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
      const message = err.response?.data?.message || 'Daftar Google gagal';
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

  const getVerificationStatus = useCallback(async (tokenValue) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/auth/verify-email-status?token=${encodeURIComponent(tokenValue)}`);
      return {
        success: true,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (err) {
      const message = err.response?.data?.message || 'Status verifikasi tidak dapat diperiksa';
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

  const verifyEmail = useCallback(async (tokenValue) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/verify-email', { token: tokenValue });
      return {
        success: true,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (err) {
      const message = err.response?.data?.message || 'Verifikasi email gagal';
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
    const activeToken = typeof window === 'undefined' ? null : window.localStorage.getItem('token');
    if (!activeToken) {
      return null;
    }

    try {
      const response = await apiClient.get('/auth/profile');
      const profile = response.data.data;
      persistSession({
        token: activeToken,
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

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
      setAuthReady(true);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [clearSession]);

  useEffect(() => {
    let ignore = false;

    if (!token) {
      return undefined;
    }

    const hydrateSession = async () => {
      try {
        await refreshProfile();
      } catch (err) {
        // refreshProfile already clears invalid sessions on 401
      } finally {
        if (!ignore) {
          setAuthReady(true);
        }
      }
    };

    hydrateSession();

    return () => {
      ignore = true;
    };
  }, [refreshProfile, token]);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, error, authReady, login, register, loginWithGoogle, registerWithGoogle, resendVerification, getVerificationStatus, verifyEmail, refreshProfile, logout, isAuthenticated, isAdmin }}
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
