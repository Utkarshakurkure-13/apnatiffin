import React, { createContext, useContext, useState, useEffect } from 'react';
import { useI18n } from './I18nContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('aapna_tiffin_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('aapna_tiffin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('aapna_tiffin_profile');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const { changeLanguage } = useI18n();

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('aapna_tiffin_token');
      if (savedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${savedToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setProfile(data.profile);
            localStorage.setItem('aapna_tiffin_user', JSON.stringify(data.user));
            localStorage.setItem('aapna_tiffin_profile', JSON.stringify(data.profile));
            if (data.user?.preferred_language) {
              changeLanguage(data.user.preferred_language);
            }
          } else {
            // Token expired or invalid
            logout();
          }
        } catch (err) {
          console.error('Failed to restore session', err);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setToken(data.token);
    setUser(data.user);
    setProfile(data.profile);
    localStorage.setItem('aapna_tiffin_token', data.token);
    localStorage.setItem('aapna_tiffin_user', JSON.stringify(data.user));
    localStorage.setItem('aapna_tiffin_profile', JSON.stringify(data.profile));

    if (data.user?.preferred_language) {
      changeLanguage(data.user.preferred_language);
    }

    return data;
  };

  const registerCustomer = async (formData) => {
    const payload = {
      ...formData,
      email: (formData.email || '').trim().toLowerCase()
    };
    const res = await fetch('/api/auth/register/customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Customer registration failed');
    }

    setToken(data.token);
    setUser(data.user);
    setProfile(data.profile);
    localStorage.setItem('aapna_tiffin_token', data.token);
    localStorage.setItem('aapna_tiffin_user', JSON.stringify(data.user));
    localStorage.setItem('aapna_tiffin_profile', JSON.stringify(data.profile));

    return data;
  };

  const registerProvider = async (formData) => {
    const payload = {
      ...formData,
      email: (formData.email || '').trim().toLowerCase()
    };
    const res = await fetch('/api/auth/register/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Provider registration failed');
    }

    setToken(data.token);
    setUser(data.user);
    setProfile(data.profile);
    localStorage.setItem('aapna_tiffin_token', data.token);
    localStorage.setItem('aapna_tiffin_user', JSON.stringify(data.user));
    localStorage.setItem('aapna_tiffin_profile', JSON.stringify(data.profile));

    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setProfile(null);
    localStorage.removeItem('aapna_tiffin_token');
    localStorage.removeItem('aapna_tiffin_user');
    localStorage.removeItem('aapna_tiffin_profile');
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfile(data.profile);
        localStorage.setItem('aapna_tiffin_user', JSON.stringify(data.user));
        localStorage.setItem('aapna_tiffin_profile', JSON.stringify(data.profile));
      }
    } catch (e) {
      console.warn('Failed to refresh profile', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        profile,
        loading,
        login,
        logout,
        registerCustomer,
        registerProvider,
        refreshProfile,
        isCustomer: user?.role === 'CUSTOMER',
        isProvider: user?.role === 'PROVIDER',
        isAdmin: user?.role === 'ADMIN'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
