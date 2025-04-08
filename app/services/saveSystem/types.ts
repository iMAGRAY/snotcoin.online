/**
 * Типы для системы сохранения
 */

import { ExtendedGameState } from '../../types/gameTypes';

/**
 * Приоритеты сохранения
 */
export enum SavePriority {
  LOW = 'low',           // Низкий приоритет
  MEDIUM = 'medium',     // Средний приоритет
  HIGH = 'high',         // Высокий приоритет
  CRITICAL = 'critical'  // Критический приоритет
}

/**
 * Тип хранилища
 */
export enum StorageType {
  LOCAL_STORAGE = 'localStorage'  // Локальное хранилище браузера
}

/**
 * Результат операции сохранения/загрузки
 */
export interface SaveResult {
  success: boolean;       // Успешность операции
  message?: string;       // Сообщение об операции
  error?: string;         // Ошибка (если есть)
  timestamp: number;      // Время операции
  data?: ExtendedGameState; // Данные (только для загрузки)
  metrics?: {
    duration: number;     // Длительность операции в мс
    dataSize?: number;    // Размер данных в байтах
  };
  
  // Дополнительные поля для совместимости
  source?: string;        // Источник данных (localStorage)
  isNewUser?: boolean;    // Флаг нового пользователя
  wasRepaired?: boolean;  // Флаг восстановленных данных
  dataSize?: number;      // Размер данных
  duration?: number;      // Длительность операции
}

/**
 * Информация о сохранении
 */
export interface SaveInfo {
  timestamp?: number;      // Время последнего сохранения
  version?: number;        // Версия сохранения
  size?: number;           // Размер данных
  backupAvailable?: boolean; // Доступна ли резервная копия
}

/**
 * Опции системы сохранения
 */
export interface SaveSystemOptions {
  enableAutoSave: boolean;       // Автоматическое сохранение
  autoSaveInterval: number;      // Интервал автосохранения в мс
}

/**
 * Результат загрузки (для совместимости)
 */
export type LoadResult = SaveResult; 