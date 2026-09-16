import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../locales/en.json';
import mr from '../locales/mr.json';
import hi from '../locales/hi.json';

const dictionaries = { en, mr, hi };
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('aapna_tiffin_lang') || 'en';
  });

  const changeLanguage = async (newLang) => {
    if (!['en', 'mr', 'hi'].includes(newLang)) return;
    setLang(newLang);
    localStorage.setItem('aapna_tiffin_lang', newLang);

    // If token exists, sync with server
    const token = localStorage.getItem('aapna_tiffin_token');
    if (token) {
      try {
        await fetch('/api/auth/language', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ language: newLang })
        });
      } catch (err) {
        console.warn('Failed to sync language with server', err);
      }
    }
  };

  /**
   * Translate key with nested path support (e.g. 'customer.welcome')
   * Fallback priority: Current Language -> English -> Provided Fallback -> Clean Key Name
   */
  const t = (key, fallback = '') => {
    if (!key) return '';
    const keys = key.split('.');

    // Try current language
    let val = dictionaries[lang];
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        val = null;
        break;
      }
    }
    if (typeof val === 'string') return val;

    // Fallback to English
    let fallbackVal = dictionaries.en;
    for (const k of keys) {
      if (fallbackVal && typeof fallbackVal === 'object' && k in fallbackVal) {
        fallbackVal = fallbackVal[k];
      } else {
        fallbackVal = null;
        break;
      }
    }
    if (typeof fallbackVal === 'string') return fallbackVal;

    return fallback || key.split('.').pop().replace(/_/g, ' ');
  };

  return (
    <I18nContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
}
