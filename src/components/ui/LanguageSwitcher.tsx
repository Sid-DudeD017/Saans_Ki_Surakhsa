'use client';

import React from 'react';

export type SupportedLanguage = 'en' | 'hi' | 'pa';

export interface LanguageSwitcherProps {
  currentLang: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  size?: 'sm' | 'md';
}

const LANGUAGES: { code: SupportedLanguage; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'EN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
];

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  currentLang,
  onLanguageChange,
  size = 'md',
}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f1f5f9',
        padding: '2px',
      }}
    >
      {LANGUAGES.map((item) => {
        const isSelected = currentLang === item.code;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => onLanguageChange(item.code)}
            style={{
              border: 'none',
              padding: size === 'sm' ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              fontSize: size === 'sm' ? '0.75rem' : '0.8125rem',
              fontWeight: isSelected ? 700 : 500,
              cursor: 'pointer',
              backgroundColor: isSelected ? '#ffffff' : 'transparent',
              color: isSelected ? '#0369a1' : '#475569',
              boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
              lineHeight: 1.2,
            }}
          >
            {item.native}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
