/**
 * Типы для оптимизированной системы сохранения
 * Предназначены для миллиона пользователей
 */

import { ExtendedGameState, GameState } from "./gameTypes";
import { Inventory, Container, Upgrades } from './gameTypes';

/**
 * Алгоритмы сжатия, поддерживаемые системой
 */
export enum CompressionAlgorithm {
  LZ_UTF16 = "lz-string-utf16",
  LZ_BASE64 = "lz-string-base64",
  LZ_URI = "lz-string-uri",
  NONE = "none"
}

/**
 * Интерфейс для операции в дельта-компрессии
 * Основан на JSON Patch (RFC 6902)
 */
export interface DeltaOperation {
  // Тип операции: add, remove, replace, move, copy, test
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  
  // Путь к свойству в формате JSON Pointer (RFC 6901)
  path: string;
  
  // Значение для операций add, replace, test
  value?: any;
  
  // Исходный путь для операций move и copy
  from?: string;
}

/**
 * Интерфейс для критически важных игровых данных
 */
export interface CriticalGameData {
  // Состояние инвентаря с валютой и ресурсами
  inventory: Inventory;
  
  // Улучшения и уровни
  upgrades: Upgrades;
  
  // Состояние контейнера
  container: Container;
  
  // Метаданные сохранения
  metadata: {
    version: number;
    lastModified: number;
    userId: string;
    saveCount?: number;
    checksum?: string;
    lastSaved?: string;
  };
}

/**
 * Интерфейс для регулярных игровых данных
 */
export interface RegularGameData {
  // Предметы и инвентарь
  items: Array<any>;
  
  // Достижения
  achievements: {
    unlockedAchievements: string[];
  };
  
  // Исследования или другие некритические данные
  research?: Record<string, any>;
  
  // Статистика игры
  stats: {
    highestLevel: number;
    clickCount: number;
    totalSnot: number;
    totalSnotCoins: number;
    playTime: number;
    startDate: string;
    consecutiveLoginDays?: number;
    [key: string]: any;
  };
}

/**
 * Интерфейс для расширенных игровых данных
 */
export interface ExtendedGameData {
  // Настройки пользователя
  settings: {
    language: string;
    theme: string;
    notifications: boolean;
    tutorialCompleted: boolean;
    musicEnabled: boolean;
    soundEnabled: boolean;
    notificationsEnabled: boolean;
  };
  
  // Настройки звука
  soundSettings: {
    musicVolume: number;
    soundVolume: number;
    notificationVolume: number;
    clickVolume: number;
    effectsVolume: number;
    backgroundMusicVolume: number;
    isMuted: boolean;
    isEffectsMuted: boolean;
    isBackgroundMusicMuted: boolean;
  };
  
  // Лог действий
  logs?: Array<any>;
  
  // Кэшированные данные
  cachedData?: Record<string, any>;
  
  // Аналитические данные
  analytics?: Record<string, any>;
}

/**
 * Интерфейс для целостности данных
 */
export interface IntegrityData {
  userId: string;
  saveVersion: number | string;
  timestamp: string;
  checksum?: string;
}

/**
 * Интерфейс для структурированного сохранения игры
 */
export interface StructuredGameSave {
  critical: CriticalGameData;
  regular?: RegularGameData;
  extended?: ExtendedGameData;
  integrity: IntegrityData;
  _isCompressed?: boolean;
  _metadata?: {
    version: number;
    userId: string;
    isCompressed: boolean;
    savedAt: string;
    loadedAt: string;
    isNewUser?: boolean;
  };
  _hasFullData?: boolean;
  _decompressedAt?: string;
}

/**
 * Информация о состоянии сохранения
 */
export interface SaveStateInfo {
  // ID пользователя
  userId: string;
  
  // Существует ли сохранение
  saveExists: boolean;
  
  // Время последнего изменения
  lastModified: number;
  
  // Версия сохранения
  version: number;
  
  // Размер данных в байтах
  size: number;
}

/**
 * Дельта изменений между двумя состояниями
 */
export interface DeltaGameState {
  // Идентификатор дельты
  _id: string;
  
  // Версия исходного состояния
  _baseVersion: number;
  
  // Версия нового состояния
  _newVersion: number;
  
  // Время создания дельты
  _createdAt: number;
  
  // ID клиента, создавшего дельту
  _clientId: string;
  
  // Представляет ли дельта полное состояние
  _isFullState: boolean;
  
  // Изменения между состояниями (ключ - путь к свойству)
  changes: Record<string, any>;
  
  // Операции дельта-патча
  delta: DeltaOperation[];
  
  // Опциональные метаданные
  _timestamp?: number;
  _changeCount?: number;
  _previousDelta?: string;
}

/**
 * Информация о синхронизации
 */
export interface SyncInfo {
  // Последнее время синхронизации
  lastSyncTimestamp: number;
  
  // Метод синхронизации (полная или дельта)
  syncMethod: 'full' | 'delta';
  
  // Статус синхронизации
  syncStatus: 'success' | 'partial' | 'failed';
  
  // Дополнительная информация
  userData?: {
    id: string;
    clientId?: string;
  };
}

/**
 * Интерфейс для сжатого состояния игры
 */
export interface CompressedGameState {
  critical: CriticalGameData;
  integrity: IntegrityData;
  _isCompressed: boolean;
  _compressedData: string;
  _originalSize: number;
  _compressedSize: number;
  _compression: CompressionAlgorithm | 'lz-string' | 'lz-string-utf16' | 'none';
  _compressedAt: string;
  _integrityInfo?: {
    userId: string;
    saveVersion: number;
    criticalDataHash: string;
    timestamp: number;
  };
}

/**
 * Интерфейс для ответа API при сохранении
 */
export interface SaveProgressResponse {
  success: boolean;
  message: string;
  progress?: {
    id: string;
    version: number;
    user_id: string;
    updated_at: string;
    is_compressed: boolean;
  };
  error?: string;
  details?: string;
  versionConflict?: boolean;
  serverVersion?: number;
}

/**
 * Интерфейс для ответа API при загрузке
 */
export interface LoadProgressResponse {
  success: boolean;
  gameState: StructuredGameSave | any;
  isNewUser?: boolean;
  metadata?: {
    version: number;
    userId: string;
    isCompressed: boolean;
    savedAt: string;
    loadedAt: string;
    isNewUser?: boolean;
  };
  message?: string;
  error?: string;
}

/**
 * Типы причин сохранения
 */
export type SaveReason = 'level_up' | 'achievement' | 'purchase' | 'gameplay' | 'settings' | 'regular' | 'auto' | 'manual' | 'unmount' | 'beforeunload';

/**
 * Интерфейс для метрик сохранения
 */
export interface SaveMetrics {
  attempts: number;
  successes: number;
  failures: number;
  lastAttempt: string;
  lastSuccess: string;
  lastFailure?: string;
  averageSaveTime: number;
  averageCompressedSize: number;
  averageOriginalSize: number;
  compressionRatio: number;
}

/**
 * Преобразует полное игровое состояние в структурированное сохранение
 * @param state Игровое состояние
 * @returns Структурированное сохранение
 */
export function gameStateToStructured(state: GameState): StructuredGameSave {
  const currentTime = new Date().toISOString();
  const structuredSave: StructuredGameSave = {
    // Критические данные
    critical: {
      inventory: state.inventory,
      upgrades: state.upgrades,
      container: state.container || {
        level: 1,
        capacity: 100,
        currentAmount: 0,
        fillRate: 1
      },
      metadata: {
        version: (state as ExtendedGameState)._saveVersion || 1,
        lastModified: (state as ExtendedGameState)._lastModified || Date.now(),
        userId: (state as ExtendedGameState)._userId || '',
        saveCount: 0,
        lastSaved: currentTime
      }
    },
    
    // Обычные данные
    regular: {
      items: state.items || [],
      achievements: state.achievements || { unlockedAchievements: [] },
      stats: {
        highestLevel: state.highestLevel || 1,
        clickCount: 0,
        totalSnot: state.inventory?.snot || 0,
        totalSnotCoins: state.inventory?.snotCoins || 0,
        playTime: 0,
        startDate: currentTime,
        consecutiveLoginDays: state.consecutiveLoginDays || 0
      }
    },
    
    // Расширенные данные (не требующие высокой скорости загрузки)
    extended: {
      settings: state.settings || {
        language: 'en',
        theme: 'light',
        notifications: true,
        tutorialCompleted: false,
        musicEnabled: true,
        soundEnabled: true,
        notificationsEnabled: true
      },
      soundSettings: state.soundSettings || {
        musicVolume: 0.5,
        soundVolume: 0.5,
        notificationVolume: 0.5,
        clickVolume: 0.5,
        effectsVolume: 0.5,
        backgroundMusicVolume: 0.3,
        isMuted: false,
        isEffectsMuted: false,
        isBackgroundMusicMuted: false
      },
      logs: (state as ExtendedGameState).logs || [],
      analytics: (state as ExtendedGameState).analytics || {}
    },
    
    // Информация целостности
    integrity: {
      userId: (state as ExtendedGameState)._userId || '',
      saveVersion: (state as ExtendedGameState)._saveVersion || 1,
      timestamp: currentTime
    }
  };
  
  return structuredSave;
}

/**
 * Преобразует структурированное сохранение в игровое состояние
 * @param save Структурированное сохранение
 * @returns Игровое состояние
 */
export function structuredToGameState(save: StructuredGameSave): ExtendedGameState {
  // Создаем базовую структуру
  return {
    // Критические данные
    inventory: save.critical.inventory,
    container: save.critical.container,
    upgrades: save.critical.upgrades,
    
    // Метаданные
    _userId: save.integrity.userId,
    _saveVersion: typeof save.integrity.saveVersion === 'string' ? 
      parseInt(save.integrity.saveVersion, 10) : save.integrity.saveVersion,
    _lastModified: save.critical.metadata.lastModified,
    _lastSaved: save.critical.metadata.lastSaved || new Date().toISOString(),
    
    // Регулярные данные
    items: save.regular?.items || [],
    achievements: save.regular?.achievements || { unlockedAchievements: [] },
    stats: save.regular?.stats || {
      clickCount: 0,
      playTime: 0,
      startDate: new Date().toISOString(),
      highestLevel: 1,
      totalSnot: 0, 
      totalSnotCoins: 0
    },
    
    // Расширенные данные
    settings: save.extended?.settings || {
      language: 'en',
      theme: 'light',
      notifications: true,
      tutorialCompleted: false,
      musicEnabled: true,
      soundEnabled: true,
      notificationsEnabled: true
    },
    
    soundSettings: save.extended?.soundSettings || {
      musicVolume: 0.5,
      soundVolume: 0.5,
      notificationVolume: 0.5,
      clickVolume: 0.5,
      effectsVolume: 0.5,
      backgroundMusicVolume: 0.5,
      isMuted: false,
      isEffectsMuted: false,
      isBackgroundMusicMuted: false
    },
    
    // Базовые игровые параметры
    activeTab: 'main',
    hideInterface: false,
    isPlaying: false,
    isLoading: false,
    containerLevel: save.critical.container.level || 1,
    fillingSpeed: save.critical.inventory.fillingSpeed || 1,
    
    // Дополнительно устанавливаем поля из статов
    highestLevel: save.regular?.stats?.highestLevel || 1,
    consecutiveLoginDays: save.regular?.stats?.consecutiveLoginDays || 0,
    gameStarted: true
  } as ExtendedGameState;
}

/**
 * Описание дельта-изменений для инкрементальных обновлений
 */
export interface GameStateDelta {
  userId: string;
  baseVersion: number;
  newVersion: number; 
  delta: Record<string, any>;
  timestamp: number;
  size?: number;
}

/**
 * Проверяет, является ли объект сжатым состоянием игры
 */
export function isCompressedGameState(state: any): state is CompressedGameState {
  return state && 
         typeof state === 'object' && 
         state._isCompressed === true &&
         state.critical && 
         state.integrity;
} 