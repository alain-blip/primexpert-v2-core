import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'fr' | 'en';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (fr: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

/**
 * Langue par défaut : français (Canada), conformément à la Loi 101 / usage en milieu de travail québécois.
 * L’anglais reste disponible à la demande (égalité d’accès).
 */
function getInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'fr';
  }

  return localStorage.getItem('primexpert-language') === 'en' ? 'en' : 'fr';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
  };

  useEffect(() => {
    localStorage.setItem('primexpert-language', language);
    document.documentElement.lang = language === 'fr' ? 'fr-CA' : 'en-CA';
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (fr, en) => language === 'fr' ? fr : en,
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
}
