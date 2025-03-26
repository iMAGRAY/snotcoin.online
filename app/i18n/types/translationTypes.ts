/**
 * Типы для локализации
 */

// Поддерживаемые языки
export type Language = 'ru' | 'en';

/**
 * Интерфейс контекста локализации
 */
export interface TranslationContextType {
  language: Language;
  t: (key: keyof TranslationKeys, params?: Record<string, string | number>) => string;
}

/**
 * Интерфейс словаря переводов
 */
export interface TranslationDictionary {
  [key: string]: string;
}

/**
 * Интерфейс для навигации
 */
export interface NavigationTranslations {
  home: string;
  game: string;
  shop: string;
  faq: string;
  about: string;
}

/**
 * Интерфейс для лаборатории
 */
export interface LaboratoryTranslations {
  title: string;
  upgrades: string;
  research: string;
}

/**
 * Интерфейс для улучшений
 */
export interface UpgradesTranslations {
  title: string;
  buy: string;
  level: string;
  maxLevel: string;
  cost: string;
}

/**
 * Интерфейс для общих элементов
 */
export interface CommonTranslations {
  loading: string;
  save: string;
  cancel: string;
  confirm: string;
  back: string;
  next: string;
  close: string;
  yes: string;
  no: string;
  success: string;
  error: string;
  warning: string;
  info: string;
}

/**
 * Интерфейс для настроек
 */
export interface SettingsTranslations {
  title: string;
  language: string;
  sound: string;
  music: string;
  notifications: string;
  darkMode: string;
  reset: string;
  resetConfirm: string;
}

/**
 * Интерфейс для игры
 */
export interface GameTranslations {
  start: string;
  pause: string;
  resume: string;
  restart: string;
  quit: string;
  score: string;
  level: string;
  time: string;
  gameOver: string;
  victory: string;
  newHighScore: string;
}

/**
 * Ключи переводов для типизации
 */
export interface TranslationKeys {
  mainNavigation: NavigationTranslations;
  laboratory: LaboratoryTranslations;
  upgrades: UpgradesTranslations;
  common: CommonTranslations;
  settings: SettingsTranslations;
  game: GameTranslations;
  
  // Дополнительные строковые ключи для обратной совместимости
  [key: string]: any;
} 