'use client';

import * as React from 'react';
import { Language, TranslationContextType, TranslationKeys } from '../types/translationTypes';
import { getCurrentLanguage, setCurrentLanguage, translate } from '../utils/translationUtils';

/**
 * Контекст для локализации приложения
 */
export const TranslationContext = React.createContext<TranslationContextType>({
  language: 'ru',
  t: (key, params) => {
    if (typeof key === 'string') {
      return String(key);
    }
    return String(JSON.stringify(key));
  },
});

// Провайдер контекста для переводов
export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = React.useState<Language>(getCurrentLanguage());

  // Функция перевода
  const t = (key: keyof TranslationKeys, params?: Record<string, string | number>): string => {
    return translate(key, params);
  };

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

// Хук для использования контекста переводов
export function useTranslation(): TranslationContextType {
  const context = React.useContext(TranslationContext);
  
  if (!context) {
    // Возвращаем функцию-заглушку, если контекст отсутствует
    return {
      language: 'ru',
      t: (key, params) => {
        if (typeof key === 'string') {
          return String(key);
        }
        return String(JSON.stringify(key));
      }
    };
  }
  
  return context;
} 