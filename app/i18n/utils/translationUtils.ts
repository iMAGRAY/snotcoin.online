import { Language, TranslationKeys } from '../types/translationTypes';
import { ruTranslations } from '../data/ru';
import { enTranslations } from '../data/en';

let currentLanguage: Language = 'ru';

/**
 * Функция для изменения языка с оповещением всех подписчиков
 */
export function changeLanguage(lang: Language): void {
  currentLanguage = lang;
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', lang);
    
    // Создаем и запускаем событие изменения языка
    const event = new Event('languageChange');
    window.dispatchEvent(event);
  }
}

/**
 * Устанавливает текущий язык без оповещения подписчиков
 */
export function setCurrentLanguage(lang: Language): void {
  currentLanguage = lang;
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', lang);
  }
}

/**
 * Получение текущего языка
 */
export function getCurrentLanguage(): Language {
  if (typeof window !== 'undefined') {
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && (savedLanguage === 'ru' || savedLanguage === 'en')) {
      currentLanguage = savedLanguage;
    }
  }
  return currentLanguage;
}

/**
 * Функция перевода ключа
 */
export function translate(key: keyof TranslationKeys, params?: Record<string, string | number>): string {
  const translations = {
    ru: ruTranslations,
    en: enTranslations
  };
  
  const lang = getCurrentLanguage();
  let result: any = translations[lang][key];
  
  // Если ключ не найден в текущем языке, используем русский
  if (result === undefined) {
    result = translations['ru'][key];
  }
  
  // Если ключ не найден вообще, возвращаем сам ключ как строку
  if (result === undefined) {
    return String(key);
  }
  
  const translatedText = String(result);
  
  // Подстановка параметров
  if (params && translatedText) {
    let processed = translatedText;
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      const regex = new RegExp(`\\{${paramKey}\\}`, 'g');
      processed = processed.replace(regex, String(paramValue));
    });
    return processed;
  }
  
  return translatedText;
}

/**
 * Переводит ключ на текущий язык
 */
export function translateKey(key: keyof TranslationKeys, params?: Record<string, any>): string {
  const lang = getCurrentLanguage();
  const text = {
    ru: ruTranslations[key],
    en: enTranslations[key]
  }[lang] || {
    ru: ruTranslations[key],
    en: enTranslations[key]
  }['ru'] || key;
  
  if (!params) return text;
  
  return text.replace(/{([^}]+)}/g, (_: string, param: string) => {
    return params[param] !== undefined ? String(params[param]) : `{${param}}`;
  });
}

/**
 * Форматирует перевод с подстановкой значений
 * @param text Строка перевода с плейсхолдерами {0}, {1}, ...
 * @param values Значения для подстановки
 * @returns Отформатированная строка
 */
export function formatTranslation(text: string, ...values: any[]): string {
  return values.reduce((result, value, index) => {
    return result.replace(new RegExp(`\\{${index}\\}`, 'g'), String(value));
  }, text);
}

/**
 * Получает перевод для конкретного языка
 * @param key Ключ перевода
 * @param lang Язык перевода (должен быть допустимым)
 * @returns Переведенную строку или ключ, если перевод не найден
 */
export function getTranslation(key: keyof TranslationKeys, lang: Language): string {
  if (lang === 'ru' || lang === 'en') {
    return {
      ru: ruTranslations[key],
      en: enTranslations[key]
    }[lang] || {
      ru: ruTranslations[key],
      en: enTranslations[key]
    }['ru'] || key;
  }
  return ruTranslations[key] || key;
}

/**
 * Определяет предпочитаемый язык пользователя
 * @returns Предпочтительный язык на основе настроек или язык по умолчанию
 */
export function getPreferredLanguage(): Language {
  if (typeof window === 'undefined') return 'ru';
  
  const savedLang = localStorage.getItem('lang');
  if (savedLang && (savedLang === 'ru' || savedLang === 'en')) {
    return savedLang as Language;
  }
  
  // Пытаемся определить язык браузера
  const browserLang = navigator.language.split('-')[0];
  return (browserLang === 'ru' || browserLang === 'en') ? 
    browserLang as Language : 'ru';
}

/**
 * Инициализирует локализацию, загружает язык из localStorage
 */
export function initializeTranslation(): void {
  if (typeof window !== 'undefined') {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && (savedLanguage === 'ru' || savedLanguage === 'en')) {
      currentLanguage = savedLanguage as Language;
    }
  }
} 