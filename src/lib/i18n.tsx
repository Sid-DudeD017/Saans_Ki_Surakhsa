'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLanguage } from '../components/ui/LanguageSwitcher';

export interface TranslationStrings {
  appName: string;
  tagline: string;
  nav: {
    home: string;
    kisan: string;
    shala: string;
    ghar: string;
    command: string;
  };
  aqi: {
    title: string;
    category: string;
    dominant: string;
  };
  report: {
    buttonLabel: string;
    title: string;
  };
  notifications: {
    title: string;
    unread: string;
  };
}

const TRANSLATIONS: Record<SupportedLanguage, TranslationStrings> = {
  en: {
    appName: 'Saans',
    tagline: 'Clean Air Intelligence & Health Platform',
    nav: {
      home: 'Overview',
      kisan: 'Kisan Saathi',
      shala: 'Saans Shala',
      ghar: 'Ghar ki Hawa',
      command: 'Command',
    },
    aqi: {
      title: 'Current AQI',
      category: 'Air Quality',
      dominant: 'Dominant Pollutant',
    },
    report: {
      buttonLabel: 'Report Smoke / Dust',
      title: 'Report Pollution Incident',
    },
    notifications: {
      title: 'Platform Notifications',
      unread: 'unread alerts',
    },
  },
  hi: {
    appName: 'सांस',
    tagline: 'स्वच्छ वायु सूचना एवं स्वास्थ्य सुरक्षा मंच',
    nav: {
      home: 'अवलोकन',
      kisan: 'किसान साथी',
      shala: 'सांस शाला',
      ghar: 'घर की हवा',
      command: 'कमांड सेंटर',
    },
    aqi: {
      title: 'वर्तमान AQI',
      category: 'वायु गुणवत्ता',
      dominant: 'मुख्य प्रदूषक',
    },
    report: {
      buttonLabel: 'धुआं / प्रदूषण रिपोर्ट करें',
      title: 'प्रदूषण की सूचना दें',
    },
    notifications: {
      title: 'प्लेटफॉर्म अलर्ट',
      unread: 'नई सूचनाएं',
    },
  },
  pa: {
    appName: 'ਸਾਂਸ',
    tagline: 'ਸਾਫ਼ ਹਵਾ ਅਤੇ ਸਿਹਤ ਸੁਰੱਖਿਆ ਪਲੇਟਫਾਰਮ',
    nav: {
      home: 'ਸੰਖੇਪ',
      kisan: 'ਕਿਸਾਨ ਸਾਥੀ',
      shala: 'ਸਾਂਸ ਸ਼ਾਲਾ',
      ghar: 'ਘਰ ਦੀ ਹਵਾ',
      command: 'ਕਮਾਂਡ ਸੈਂਟਰ',
    },
    aqi: {
      title: 'ਮੌਜੂਦਾ AQI',
      category: 'ਹਵਾ ਗੁਣਵੱਤਾ',
      dominant: 'ਮੁੱਖ ਪ੍ਰਦੂਸ਼ਕ',
    },
    report: {
      buttonLabel: 'ਧੂੰਆਂ / ਧੂੜ ਰਿਪੋਰਟ ਕਰੋ',
      title: 'ਪ੍ਰਦੂਸ਼ਣ ਰਿਪੋਰਟ ਦਰਜ ਕਰੋ',
    },
    notifications: {
      title: 'ਪਲੇਟਫਾਰਮ ਸੂਚਨਾਵਾਂ',
      unread: 'ਨਵੀਆਂ ਸੂਚਨਾਵਾਂ',
    },
  },
};

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationStrings;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

const STORAGE_KEY_LANG = 'saans_selected_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LANG);
      if (saved && ['en', 'hi', 'pa'].includes(saved)) {
        setLanguageState(saved as SupportedLanguage);
      }
    } catch {
      // LocalStorage not available or SSR
    }
  }, []);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
    } catch {
      // ignore
    }
  };

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
