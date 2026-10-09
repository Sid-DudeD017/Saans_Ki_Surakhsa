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
  gharPlan: {
    windows_shut_now: string;
    windows_always_open: string;
    windows_open_time: string;
    windows_shut_always: string;
    purifier_not_needed: string;
    purifier_run: string;
    purifier_buy: string;
    source_cooking: string;
    source_smoking: string;
    source_incense: string;
    source_mosquito_coil: string;
    mask_outside: string;
    fallback: string;
  };
  gharSummary: {
    title: string;
    outsidePeak: string;
    worstRoom: string;
    cleanestRoom: string;
    biggestChange: string;
    noData: string;
    titlePlan: string;
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
    gharPlan: {
      windows_shut_now: "Shut the windows now: it's {{pm25}} µg/m³ outside.",
      windows_always_open: "The air outside stays clean: open the windows whenever you like.",
      windows_open_time: "Open the windows {{from}}–{{to}}, when the air outside is cleanest (about {{pm25}} µg/m³), and keep them shut the rest of the day.",
      windows_shut_always: "Keep the windows shut. If the room needs air, open them {{from}}–{{to}}, when it's least bad (about {{pm25}} µg/m³).",
      purifier_not_needed: "The room stays clean without the purifier today (about {{pm25}} µg/m³).",
      purifier_run: "Run the purifier with the windows shut: the room stays near {{pm25}} µg/m³.",
      purifier_buy: "A purifier with a CADR of about {{purifierCadr}} m³/h would bring this room to {{pm25}} µg/m³.",
      source_cooking: "Cooking on {{sourceType}} adds up to {{pm25}} µg/m³. Open a window or run the chimney.",
      source_smoking: "Smoking indoors adds up to {{pm25}} µg/m³. Smoke outside.",
      source_incense: "Incense adds up to {{pm25}} µg/m³. Light it by an open window.",
      source_mosquito_coil: "A mosquito coil adds up to {{pm25}} µg/m³ overnight. Use a net or a plug-in instead.",
      mask_outside: "Wear an N95 outside, most of all {{from}}–{{to}} (about {{pm25}} µg/m³).",
      fallback: "{{text}} (Translation limited)",
    },
    gharSummary: {
      title: 'Your home today',
      outsidePeak: 'Outside peaks at {{pm25}} µg/m³ around {{time}}.',
      worstRoom: 'Highest PM2.5 is in {{room}} ({{pm25}} µg/m³){{source}}.',
      cleanestRoom: 'Cleanest room is {{room}} ({{pm25}} µg/m³).',
      biggestChange: 'Biggest reduction: {{action}} drops it by {{reduction}} µg/m³.',
      noData: 'Waiting for estimates...',
      titlePlan: 'Plan for today',
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
    gharPlan: {
      windows_shut_now: "खिड़कियां अभी बंद कर लें: बाहर {{pm25}} µg/m³ है।",
      windows_always_open: "बाहर की हवा साफ रहेगी: जब चाहें खिड़कियां खोलें।",
      windows_open_time: "खिड़कियां {{from}}–{{to}} खोलें, जब बाहर हवा सबसे साफ हो (लगभग {{pm25}} µg/m³), बाकी दिन बंद रखें।",
      windows_shut_always: "खिड़कियां बंद रखें। जरूरत हो तो {{from}}–{{to}} खोलें, जब हवा थोड़ी बेहतर हो (लगभग {{pm25}} µg/m³)।",
      purifier_not_needed: "प्यूरीफायर के बिना कमरा साफ रहेगा (लगभग {{pm25}} µg/m³)।",
      purifier_run: "खिड़कियां बंद करके प्यूरीफायर चलाएं: कमरा लगभग {{pm25}} µg/m³ पर रहेगा।",
      purifier_buy: "लगभग {{purifierCadr}} m³/h CADR वाला प्यूरीफायर इस कमरे को {{pm25}} µg/m³ तक ला सकता है।",
      source_cooking: "{{sourceType}} पर खाना बनाने से {{pm25}} µg/m³ बढ़ता है। खिड़की या चिमनी खोलें।",
      source_smoking: "अंदर धूम्रपान करने से {{pm25}} µg/m³ बढ़ता है। बाहर धूम्रपान करें।",
      source_incense: "अगरबत्ती से {{pm25}} µg/m³ बढ़ता है। इसे खुली खिड़की के पास जलाएं।",
      source_mosquito_coil: "कछुआ छाप से रात में {{pm25}} µg/m³ बढ़ता है। मच्छरदानी या प्लग-इन का इस्तेमाल करें।",
      mask_outside: "बाहर N95 पहनें, खासकर {{from}}–{{to}} (लगभग {{pm25}} µg/m³)।",
      fallback: "{{text}} (अनुवाद सीमित)",
    },
    gharSummary: {
      title: 'आज आपका घर',
      outsidePeak: 'बाहर प्रदूषण {{pm25}} µg/m³ तक पहुंचेगा, लगभग {{time}} बजे।',
      worstRoom: 'सबसे ज्यादा PM2.5 {{room}} में है ({{pm25}} µg/m³){{source}}।',
      cleanestRoom: 'सबसे साफ कमरा {{room}} है ({{pm25}} µg/m³)।',
      biggestChange: 'सबसे बड़ा बदलाव: {{action}} से {{reduction}} µg/m³ की कमी होगी।',
      noData: 'आंकड़ों का इंतजार कर रहे हैं...',
      titlePlan: 'आज की योजना',
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
    gharPlan: {
      windows_shut_now: "ਖਿੜਕੀਆਂ ਹੁਣੇ ਬੰਦ ਕਰੋ: ਬਾਹਰ {{pm25}} µg/m³ ਹੈ।",
      windows_always_open: "ਬਾਹਰ ਦੀ ਹਵਾ ਸਾਫ਼ ਰਹੇਗੀ: ਜਦੋਂ ਮਰਜ਼ੀ ਖਿੜਕੀਆਂ ਖੋਲ੍ਹੋ।",
      windows_open_time: "ਖਿੜਕੀਆਂ {{from}}–{{to}} ਖੋਲ੍ਹੋ, ਜਦੋਂ ਬਾਹਰ ਹਵਾ ਸਭ ਤੋਂ ਸਾਫ਼ ਹੋਵੇ (ਲਗਭਗ {{pm25}} µg/m³), ਬਾਕੀ ਦਿਨ ਬੰਦ ਰੱਖੋ।",
      windows_shut_always: "ਖਿੜਕੀਆਂ ਬੰਦ ਰੱਖੋ। ਜੇਕਰ ਲੋੜ ਹੋਵੇ ਤਾਂ {{from}}–{{to}} ਖੋਲ੍ਹੋ, ਜਦੋਂ ਹਵਾ ਥੋੜ੍ਹੀ ਬਿਹਤਰ ਹੋਵੇ (ਲਗਭਗ {{pm25}} µg/m³)।",
      purifier_not_needed: "ਪਿਊਰੀਫਾਇਰ ਤੋਂ ਬਿਨਾਂ ਕਮਰਾ ਸਾਫ਼ ਰਹੇਗਾ (ਲਗਭਗ {{pm25}} µg/m³)।",
      purifier_run: "ਖਿੜਕੀਆਂ ਬੰਦ ਕਰਕੇ ਪਿਊਰੀਫਾਇਰ ਚਲਾਓ: ਕਮਰਾ ਲਗਭਗ {{pm25}} µg/m³ 'ਤੇ ਰਹੇਗਾ।",
      purifier_buy: "ਲਗਭਗ {{purifierCadr}} m³/h CADR ਵਾਲਾ ਪਿਊਰੀਫਾਇਰ ਇਸ ਕਮਰੇ ਨੂੰ {{pm25}} µg/m³ ਤੱਕ ਲਿਆ ਸਕਦਾ ਹੈ।",
      source_cooking: "{{sourceType}} 'ਤੇ ਖਾਣਾ ਬਣਾਉਣ ਨਾਲ {{pm25}} µg/m³ ਵਧਦਾ ਹੈ। ਖਿੜਕੀ ਜਾਂ ਚਿਮਨੀ ਖੋਲ੍ਹੋ।",
      source_smoking: "ਅੰਦਰ ਸਿਗਰਟ ਪੀਣ ਨਾਲ {{pm25}} µg/m³ ਵਧਦਾ ਹੈ। ਬਾਹਰ ਜਾ ਕੇ ਪੀਓ।",
      source_incense: "ਅਗਰਬੱਤੀ ਨਾਲ {{pm25}} µg/m³ ਵਧਦਾ ਹੈ। ਇਸ ਨੂੰ ਖੁੱਲ੍ਹੀ ਖਿੜਕੀ ਕੋਲ ਜਲਾਓ।",
      source_mosquito_coil: "ਮੱਛਰ ਮਾਰਨ ਵਾਲੀ ਕੋਇਲ ਨਾਲ ਰਾਤ ਨੂੰ {{pm25}} µg/m³ ਵਧਦਾ ਹੈ। ਮੱਛਰਦਾਨੀ ਜਾਂ ਪਲੱਗ-ਇਨ ਵਰਤੋ।",
      mask_outside: "ਬਾਹਰ N95 ਪਹਿਨੋ, ਖਾਸ ਕਰਕੇ {{from}}–{{to}} (ਲਗਭਗ {{pm25}} µg/m³)।",
      fallback: "{{text}} (ਅਨੁਵਾਦ ਸੀਮਿਤ)",
    },
    gharSummary: {
      title: 'ਅੱਜ ਤੁਹਾਡਾ ਘਰ',
      outsidePeak: 'ਬਾਹਰ ਪ੍ਰਦੂਸ਼ਣ {{pm25}} µg/m³ ਤੱਕ ਪਹੁੰਚੇਗਾ, ਲਗਭਗ {{time}} ਵਜੇ।',
      worstRoom: 'ਸਭ ਤੋਂ ਵੱਧ PM2.5 {{room}} ਵਿੱਚ ਹੈ ({{pm25}} µg/m³){{source}}।',
      cleanestRoom: 'ਸਭ ਤੋਂ ਸਾਫ਼ ਕਮਰਾ {{room}} ਹੈ ({{pm25}} µg/m³)।',
      biggestChange: 'ਸਭ ਤੋਂ ਵੱਡਾ ਬਦਲਾਅ: {{action}} ਨਾਲ {{reduction}} µg/m³ ਦੀ ਕਮੀ ਆਵੇਗੀ।',
      noData: 'ਅੰਕੜਿਆਂ ਦੀ ਉਡੀਕ ਕਰ ਰਹੇ ਹਾਂ...',
      titlePlan: 'ਅੱਜ ਦੀ ਯੋਜਨਾ',
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
