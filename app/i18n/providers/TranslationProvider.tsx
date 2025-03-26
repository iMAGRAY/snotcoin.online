"use client"

import * as React from 'react';
import { TranslationContext } from '../contexts/TranslationContext';
import { Language } from '../types/translationTypes';
import { getCurrentLanguage, setCurrentLanguage, translate } from '../utils/translationUtils';

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [language, setLanguage] = React.useState<Language>(getCurrentLanguage());

  // Функция перевода
  const t = React.useCallback((key: any, params?: Record<string, string | number>): string => {
    return translate(key, params);
  }, [language]);

  // Подписка на изменение языка
  React.useEffect(() => {
    const handleLanguageChange = () => {
      setLanguage(getCurrentLanguage());
    };

    // Регистрация обработчика события смены языка
    window.addEventListener('languageChange', handleLanguageChange);

    // Отменяем подписку при размонтировании
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange);
    };
  }, []);

  // Обновление языка в утилитах при изменении состояния
  React.useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);

  return (
    <TranslationContext.Provider value={{ language, t }}>
      {children}
    </TranslationContext.Provider>
  );
}; 