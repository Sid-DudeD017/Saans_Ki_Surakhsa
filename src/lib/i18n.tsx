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
  ghar: {
    title: string;
    subtitle: string;
    apiError: string;
    exampleAir: string;
    howItWorks: string;
    rightNow: string;
    outsideNow: string;
    roomNow: string;
    aqi: string;
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
    ghar: {
      title: 'Ghar ki Hawa',
      subtitle: 'How much of the air outside gets into your room, what it will be hour by hour, and what to do about it today.',
      apiError: "Couldn't get the outside air for your home. Showing the last reading, from {{time}}.",
      exampleAir: 'Example air',
      howItWorks: 'How we work this out',
      rightNow: 'right now',
      outsideNow: 'Outside now, µg/m³',
      roomNow: 'This room now',
      aqi: 'AQI',
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
    ghar: {
      title: 'घर की हवा',
      subtitle: 'बाहर की कितनी हवा आपके कमरे में आती है, घंटे-दर-घंटे यह कैसी होगी, और आज इसके लिए क्या करें।',
      apiError: 'आपके घर के लिए बाहर की हवा का डेटा नहीं मिल सका। {{time}} की पिछली रीडिंग दिखा रहे हैं।',
      exampleAir: 'उदाहरण हवा',
      howItWorks: 'हम इसकी गणना कैसे करते हैं',
      rightNow: 'अभी',
      outsideNow: 'बाहर अभी, µg/m³',
      roomNow: 'यह कमरा अभी',
      aqi: 'AQI',
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
    ghar: {
      title: 'ਘਰ ਦੀ ਹਵਾ',
      subtitle: 'ਬਾਹਰ ਦੀ ਕਿੰਨੀ ਹਵਾ ਤੁਹਾਡੇ ਕਮਰੇ ਵਿਚ ਆਉਂਦੀ ਹੈ, ਘੰਟੇ-ਦਰ-ਘੰਟੇ ਇਹ ਕਿਵੇਂ ਹੋਵੇਗੀ, ਅਤੇ ਅੱਜ ਇਸਦੇ ਲਈ ਕੀ ਕਰਨਾ ਹੈ।',
      apiError: 'ਤੁਹਾਡੇ ਘਰ ਲਈ ਬਾਹਰਲੀ ਹਵਾ ਦਾ ਡਾਟਾ ਨਹੀਂ ਮਿਲ ਸਕਿਆ। {{time}} ਦੀ ਪਿਛਲੀ ਰੀਡਿੰਗ ਦਿਖਾ ਰਹੇ ਹਾਂ।',
      exampleAir: 'ਉਦਾਹਰਣ ਹਵਾ',
      howItWorks: 'ਅਸੀਂ ਇਸਦੀ ਗਣਨਾ ਕਿਵੇਂ ਕਰਦੇ ਹਾਂ',
      rightNow: 'ਹੁਣ',
      outsideNow: 'ਬਾਹਰ ਹੁਣ, µg/m³',
      roomNow: 'ਇਹ ਕਮਰਾ ਹੁਣ',
      aqi: 'AQI',
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
const VALID_LANGS: SupportedLanguage[] = ['en', 'hi', 'pa'];

const langListeners = new Set<() => void>();

function subscribeLang(callback: () => void) {
  langListeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_LANG) callback();
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    langListeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

function getLangSnapshot(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LANG);
    if (saved && VALID_LANGS.includes(saved as SupportedLanguage)) {
      return saved as SupportedLanguage;
    }
  } catch {
    // LocalStorage not available
  }
  return 'en';
}

function getServerLangSnapshot(): SupportedLanguage {
  return 'en';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const language = React.useSyncExternalStore(
    subscribeLang,
    getLangSnapshot,
    getServerLangSnapshot
  );

  const setLanguage = (lang: SupportedLanguage) => {
    try {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
    } catch {
      // ignore
    }
    langListeners.forEach((l) => l());
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
