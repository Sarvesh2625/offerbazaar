import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './authContextInstance';

export function AuthProvider({ children }) {
  // In-memory state only - no localStorage used for sensitive auth tokens
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Refresh user profile on page load using httpOnly cookie or active token
   */
  const refreshUser = useCallback(async (activeToken) => {
    try {
      setLoading(true);
      setError(null);

      const headers = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers,
        credentials: 'include', // Transmits httpOnly cookie
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return data.user;
      } else {
        setUser(null);
        setToken(null);
        return null;
      }
    } catch (err) {
      setUser(null);
      setToken(null);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Hydrate session on app mount
   */
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  /**
   * Log in user with email & password
   */
  const login = async (email, password) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store in memory only
      setUser(data.user);
      setToken(data.token);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Register new user (Customer or Vendor)
   */
  const signup = async (formData) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      // Store in memory only
      setUser(data.user);
      setToken(data.token);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Log out user
   */
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.warn('Logout request warning:', err.message);
    } finally {
      setUser(null);
      setToken(null);
      setError(null);
      try {
        localStorage.removeItem('offerbazaar_token');
        sessionStorage.removeItem('offerbazaar_token');
      } catch {
        // Ignore storage access errors if in restricted environment
      }
    }
  };

  /**
   * Helper for authenticated API calls
   */
  const authFetch = async (url, options = {}) => {
    const headers = { ...options.headers };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  const value = {
    user,
    token,
    loading,
    error,
    login,
    signup,
    logout,
    refreshUser,
    authFetch,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
