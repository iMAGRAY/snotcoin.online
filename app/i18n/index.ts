/**
 * Модуль для интернационализации приложения
 */

// Экспорт хуков
export { useTranslation } from './hooks/useTranslation';

// Экспорт компонентов
export { TranslationProvider } from './providers/TranslationProvider';
export { TranslationContext } from './contexts/TranslationContext';

// Экспорт утилит для локализации
export { 
  getCurrentLanguage, 
  changeLanguage, 
  translate 
} from './utils/translationUtils';

// Экспорт типов для локализации
export type {
  Language,
  TranslationKeys,
  TranslationDictionary,
  TranslationContextType
} from './types/translationTypes';

// Экспорт данных переводов
export { ruTranslations } from './data/ru';
export { enTranslations } from './data/en';