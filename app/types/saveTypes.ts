/**
 * Типы для оптимизированной системы сохранения
 * Предназначены для миллиона пользователей
 */

import { ExtendedGameState, GameState } from "./gameTypes";
import { CompressionAlgorithm } from "../utils/dataCompression";

/**
 * Структурированное сохранение игры
 * Разделяет данные на критические, обычные и расширенные
 * для оптимизации размера и частоты синхронизации
 */
export interface StructuredGameSave {
  /**
   * Критические данные (синхронизируются часто)
   * Включают валюту, уровни и метаданные
   */
  critical: {
    // Состояние инвентаря с валютой и ресурсами
    inventory: {
      snot: number;
      snotCoins: number;
      containerCapacity: number;
      containerCapacityLevel: number;
      fillingSpeed: number;
      fillingSpeedLevel: number;
      collectionEfficiency: number;
      containerSnot: number;
      Cap: number;
      lastUpdateTimestamp?: number;
    };
    
    // Улучшения и уровни
    upgrades: {
      containerLevel: number;
      fillingSpeedLevel: number; 
      collectionEfficiencyLevel: number;
      clickPower?: { level: number, value: number };
      passiveIncome?: { level: number, value: number };
    };
    
    // Состояние контейнера
    container?: {
      level: number;
      capacity: number;
      currentAmount: number;
      fillRate: number;
      currentFill?: number;
    };
    
    // Метаданные сохранения
    metadata: {
      version: number;
      lastModified: number;
      userId: string;
      saveCount?: number;
      checksum?: string;
    };
  };
  
  /**
   * Обычные данные (синхронизируются периодически)
   * Включают достижения, предметы и другие некритические данные
   */
  regular?: {
    // Предметы и инвентарь
    items?: Array<any>;
    
    // Достижения
    achievements?: {
      unlockedAchievements: string[];
    };
    
    // Исследования или другие некритические данные
    research?: Record<string, any>;
    
    // Статистика игры
    stats?: Record<string, number>;
  };
  
  /**
   * Расширенные данные (синхронизируются редко)
   * Включают настройки, логи и другие необязательные данные
   */
  extended?: {
    // Настройки пользователя
    settings?: {
      language: string;
      theme: string;
      notifications: boolean;
      tutorialCompleted: boolean;
    };
    
    // Настройки звука
    soundSettings?: {
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
  };
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
  
  // Опциональные метаданные
  _timestamp?: number;
  _changeCount?: number;
  _previousDelta?: string;
}

/**
 * Сжатое представление игрового состояния
 */
export interface CompressedGameState {
  // Флаг сжатого состояния
  _isCompressed: boolean;
  
  // Алгоритм сжатия
  _algorithm: CompressionAlgorithm;
  
  // Сжатые данные
  _compressedData: string;
  
  // Размер данных до сжатия
  _originalSize: number;
  
  // Размер сжатых данных
  _compressedSize: number;
  
  // Время сжатия
  _compressedAt: string;
  
  // Информация для проверки целостности
  _integrityInfo: {
    userId: string;
    saveVersion: number;
    criticalDataHash: string;
    timestamp: number;
  };
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
 * Преобразует полное игровое состояние в структурированное сохранение
 * @param state Игровое состояние
 * @returns Структурированное сохранение
 */
export function gameStateToStructured(state: GameState): StructuredGameSave {
  const structuredSave: StructuredGameSave = {
    // Критические данные
    critical: {
      inventory: {
        snot: state.inventory?.snot || 0,
        snotCoins: state.inventory?.snotCoins || 0,
        containerCapacity: state.inventory?.containerCapacity || 100,
        containerCapacityLevel: state.inventory?.containerCapacityLevel || 1,
        fillingSpeed: state.inventory?.fillingSpeed || 1,
        fillingSpeedLevel: state.inventory?.fillingSpeedLevel || 1,
        collectionEfficiency: state.inventory?.collectionEfficiency || 1,
        containerSnot: state.inventory?.containerSnot || 0,
        Cap: state.inventory?.Cap || 0,
        lastUpdateTimestamp: state.inventory?.lastUpdateTimestamp
      },
      upgrades: {
        containerLevel: state.upgrades?.containerLevel || 1,
        fillingSpeedLevel: state.upgrades?.fillingSpeedLevel || 1,
        collectionEfficiencyLevel: state.upgrades?.collectionEfficiencyLevel || 1,
        clickPower: state.upgrades?.clickPower,
        passiveIncome: state.upgrades?.passiveIncome
      },
      container: state.container ? {
        level: state.container.level,
        capacity: state.container.capacity,
        currentAmount: state.container.currentAmount,
        fillRate: state.container.fillRate,
        currentFill: state.container.currentFill
      } : undefined,
      metadata: {
        version: (state as ExtendedGameState)._saveVersion || 1,
        lastModified: (state as ExtendedGameState)._lastModified || Date.now(),
        userId: (state as ExtendedGameState)._userId || '',
        saveCount: 0
      }
    },
    
    // Обычные данные
    regular: {
      items: state.items || [],
      achievements: state.achievements || { unlockedAchievements: [] },
      stats: state.stats || {}
    },
    
    // Расширенные данные
    extended: {
      settings: state.settings,
      soundSettings: state.soundSettings,
      logs: (state as ExtendedGameState).logs || [],
      analytics: (state as ExtendedGameState).analytics || {}
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
  const gameState: ExtendedGameState = {
    // Критические данные
    inventory: save.critical.inventory,
    upgrades: save.critical.upgrades,
    container: save.critical.container || {
      level: 1,
      capacity: 100,
      currentAmount: 0,
      fillRate: 1,
      currentFill: 0
    },
    
    // Обычные данные
    items: save.regular?.items || [],
    achievements: save.regular?.achievements || { unlockedAchievements: [] },
    stats: save.regular?.stats || {},
    
    // Настройки
    settings: save.extended?.settings || {
      language: 'en',
      theme: 'light',
      notifications: true,
      tutorialCompleted: false
    },
    
    soundSettings: save.extended?.soundSettings || {
      clickVolume: 0.5,
      effectsVolume: 0.5,
      backgroundMusicVolume: 0.3,
      isMuted: false,
      isEffectsMuted: false,
      isBackgroundMusicMuted: false
    },
    
    // Базовые поля состояния
    activeTab: 'main',
    user: null,
    validationStatus: "pending",
    hideInterface: false,
    isPlaying: false,
    isLoading: false,
    containerLevel: save.critical.upgrades.containerLevel || 1,
    fillingSpeed: save.critical.inventory.fillingSpeed || 1,
    containerSnot: save.critical.inventory.containerSnot || 0,
    gameStarted: true,
    highestLevel: save.regular?.stats?.highestLevel || 1,
    consecutiveLoginDays: save.regular?.stats?.consecutiveLoginDays || 0,
    
    // Метаданные
    _saveVersion: save.critical.metadata.version,
    _lastModified: save.critical.metadata.lastModified,
    _userId: save.critical.metadata.userId,
    
    // Расширенные данные
    logs: save.extended?.logs || [],
    analytics: save.extended?.analytics || {}
  };
  
  return gameState;
}

export interface GameStateDelta {
  userId: string;
  baseVersion: number;
  newVersion: number; 
  delta: Record<string, any>;
  timestamp: number;
  size?: number;
}

export interface DeltaOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}

export interface CompressedGameState {
  userId: string;
  compressedData: string;
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  checksums?: {
    criticalData?: string;
    fullData?: string;
  };
  version: number;
  timestamp: number;
  isCompressed: boolean;
} 