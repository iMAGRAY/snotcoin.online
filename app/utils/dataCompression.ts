/**
 * Модуль для сжатия и декомпрессии игровых данных
 * Оптимизирует хранение состояний для большого количества пользователей
 */

import * as LZString from 'lz-string';
import { ExtendedGameState, Inventory, Upgrades } from '../types/gameTypes';
import { CompressedGameState, StructuredGameSave, CompressionAlgorithm, DeltaGameState, DeltaOperation } from '../types/saveTypes';

/**
 * Опции сжатия
 */
interface CompressionOptions {
  algorithm?: CompressionAlgorithm;
  removeTempData?: boolean;
  includeIntegrityInfo?: boolean;
}

/**
 * Значения по умолчанию для опций сжатия
 */
const DEFAULT_OPTIONS: CompressionOptions = {
  algorithm: CompressionAlgorithm.LZ_UTF16,
  removeTempData: true,
  includeIntegrityInfo: true
};

/**
 * Синхронно сжимает данные
 * @param data Строка для сжатия
 * @param algorithm Алгоритм сжатия
 * @returns Сжатая строка
 */
export function compressData(
  data: string,
  algorithm: CompressionAlgorithm = CompressionAlgorithm.LZ_UTF16
): string {
  if (!data) return '';
  
  try {
    switch (algorithm) {
      case CompressionAlgorithm.LZ_UTF16:
        return LZString.compressToUTF16(data);
      case CompressionAlgorithm.LZ_BASE64:
        return LZString.compressToBase64(data);
      case CompressionAlgorithm.LZ_URI:
        return LZString.compressToEncodedURIComponent(data);
      case CompressionAlgorithm.NONE:
        return data;
      default:
        return LZString.compressToUTF16(data);
    }
  } catch (error) {
    console.error('[dataCompression] Error compressing data:', error);
    return data; // При ошибке возвращаем исходные данные
  }
}

/**
 * Синхронно декомпрессирует данные
 * @param compressedData Сжатая строка
 * @param algorithm Алгоритм сжатия
 * @returns Декомпрессированная строка
 */
export function decompressData(
  compressedData: string,
  algorithm: CompressionAlgorithm = CompressionAlgorithm.LZ_UTF16
): string {
  if (!compressedData) return '';
  
  try {
    switch (algorithm) {
      case CompressionAlgorithm.LZ_UTF16:
        return LZString.decompressFromUTF16(compressedData) || '';
      case CompressionAlgorithm.LZ_BASE64:
        return LZString.decompressFromBase64(compressedData) || '';
      case CompressionAlgorithm.LZ_URI:
        return LZString.decompressFromEncodedURIComponent(compressedData) || '';
      case CompressionAlgorithm.NONE:
        return compressedData;
      default:
        return LZString.decompressFromUTF16(compressedData) || '';
    }
  } catch (error) {
    console.error('[dataCompression] Error decompressing data:', error);
    return ''; // При ошибке возвращаем пустую строку
  }
}

/**
 * Сжимает состояние игры для хранения
 * @param state Состояние игры
 * @param userId ID пользователя
 * @param options Опции сжатия
 * @returns Сжатое состояние или null при ошибке
 */
export function compressGameState(
  state: ExtendedGameState,
  userId: string,
  options: CompressionOptions = DEFAULT_OPTIONS
): CompressedGameState | null {
  if (!state || !userId) {
    console.error('[dataCompression] Invalid arguments for compressGameState');
    return null;
  }
  
  try {
    // Объединяем опции по умолчанию с переданными
    const finalOptions = { ...DEFAULT_OPTIONS, ...options };
    
    // Создаем копию состояния для безопасности
    const stateCopy = JSON.parse(JSON.stringify(state));
    
    // Удаляем временные данные, если нужно
    if (finalOptions.removeTempData) {
      delete stateCopy._tempData;
      delete stateCopy.logs;
      delete stateCopy.analytics;
    }
    
    // Преобразуем в структурированное сохранение
    const structuredSave: StructuredGameSave = createStructuredSave(stateCopy, userId);
    
    // Преобразуем в строку JSON
    const originalJson = JSON.stringify(structuredSave);
    const originalSize = originalJson.length;
    
    // Выделяем критические данные
    const criticalData = structuredSave.critical;
    const integrityData = structuredSave.integrity;
    
    // Сжимаем все данные кроме критических
    const dataToCompress = {
      regular: structuredSave.regular,
      extended: structuredSave.extended
    };
    
    // Сжимаем данные
    const jsonToCompress = JSON.stringify(dataToCompress);
    const compressedData = compressData(jsonToCompress, finalOptions.algorithm);
    const compressedSize = criticalData ? JSON.stringify(criticalData).length + compressedData.length : 0;
    
    // Создаем объект сжатого состояния
    const compressedState: CompressedGameState = {
      critical: criticalData,
      integrity: integrityData,
      _isCompressed: true,
      _compressedData: compressedData,
      _originalSize: originalSize,
      _compressedSize: compressedSize,
      _compression: finalOptions.algorithm || CompressionAlgorithm.LZ_UTF16,
      _compressedAt: new Date().toISOString()
    };
    
    // Добавляем информацию о целостности, если нужно
    if (finalOptions.includeIntegrityInfo) {
      compressedState._integrityInfo = {
        userId: userId,
        saveVersion: state._saveVersion || 1,
        criticalDataHash: generateSimpleChecksum(JSON.stringify(criticalData)),
        timestamp: Date.now()
      };
    }
    
    return compressedState;
  } catch (error) {
    console.error('[dataCompression] Error compressing game state:', error);
    return null;
  }
}

/**
 * Распаковывает сжатое состояние игры
 * @param compressedState Сжатое состояние
 * @returns Распакованное структурированное сохранение или null при ошибке
 */
export function decompressGameState(compressedState: CompressedGameState): StructuredGameSave | null {
  if (!compressedState || 
      !compressedState._isCompressed || 
      !compressedState._compressedData ||
      !compressedState.integrity) {
    console.error('[dataCompression] Invalid compressed state');
    return null;
  }
  
  try {
    const now = new Date().toISOString();
    
    // Распаковываем данные
    const decompressedDataStr = decompressData(
      compressedState._compressedData, 
      compressedState._compression as CompressionAlgorithm
    );
    
    if (!decompressedDataStr) {
      console.error('[dataCompression] Failed to decompress data');
      return null;
    }
    
    // Преобразовываем данные из JSON
    const decompressedData = JSON.parse(decompressedDataStr);
    
    // Преобразовываем saveVersion в числовой тип
    const saveVersion = typeof compressedState.integrity.saveVersion === 'string'
      ? parseInt(compressedState.integrity.saveVersion, 10)
      : compressedState.integrity.saveVersion || 1;
    
    // Создаем полное состояние
    const fullState: StructuredGameSave = {
      critical: compressedState.critical,
      regular: decompressedData.regular,
      extended: decompressedData.extended,
      integrity: compressedState.integrity,
      _decompressedAt: now,
      _hasFullData: true,
      _metadata: {
        version: saveVersion, // Используем преобразованную версию
        userId: compressedState.integrity.userId,
        isCompressed: false,
        savedAt: compressedState._compressedAt,
        loadedAt: now
      }
    };
    
    return fullState;
  } catch (error) {
    console.error('[dataCompression] Error decompressing game state:', error);
    return null;
  }
}

/**
 * Создает структурированное сохранение из состояния игры
 * @param state Состояние игры
 * @param userId ID пользователя
 * @returns Структурированное сохранение
 */
function createStructuredSave(state: ExtendedGameState, userId: string): StructuredGameSave {
  const currentTime = new Date().toISOString();
  
  // Извлекаем ID пользователя из состояния или используем переданный
  const finalUserId = state._userId || userId;
  
  // Проверяем обязательные поля и используем значения по умолчанию при необходимости
  const inventory: Inventory = state.inventory || { 
    snot: 0, 
    snotCoins: 0, 
    containerSnot: 0,
    containerCapacity: 100, 
    containerCapacityLevel: 1,
    fillingSpeed: 1,
    fillingSpeedLevel: 1,
    collectionEfficiency: 1,
    Cap: 0
  };
  
  const container = state.container || { level: 1, capacity: 100, currentAmount: 0, fillRate: 1 };
  
  const upgrades: Upgrades = state.upgrades || { 
    containerLevel: 1,
    fillingSpeedLevel: 1,
    collectionEfficiencyLevel: 1,
    clickPower: { level: 1, value: 1 },
    passiveIncome: { level: 1, value: 0.1 }
  };
  
  return {
    // Критические данные
    critical: {
      inventory,
      upgrades,
      container,
      metadata: {
        version: state._saveVersion || 1,
        lastModified: state._lastModified || Date.now(),
        userId: finalUserId,
        saveCount: 0,
        lastSaved: currentTime
      }
    },
    
    // Регулярные данные
    regular: {
      items: state.items || [],
      achievements: state.achievements || { unlockedAchievements: [] },
      stats: {
        highestLevel: state.highestLevel || 1,
        clickCount: state.stats?.clickCount || 0,
        totalSnot: inventory.snot || 0,
        totalSnotCoins: inventory.snotCoins || 0,
        playTime: state.stats?.playTime || 0,
        startDate: typeof state.stats?.startDate === 'string' 
          ? state.stats.startDate 
          : currentTime,
        consecutiveLoginDays: state.consecutiveLoginDays || 0
      }
    },
    
    // Расширенные данные
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
      }
    },
    
    // Данные целостности
    integrity: {
      userId: finalUserId,
      saveVersion: (state._saveVersion || 1).toString(),
      timestamp: currentTime,
      checksum: generateSimpleChecksum(JSON.stringify(inventory) + JSON.stringify(upgrades))
    },
    
    // Метаданные
    _isCompressed: false,
    _metadata: {
      version: state._saveVersion || 1,
      userId: finalUserId,
      isCompressed: false,
      savedAt: currentTime,
      loadedAt: currentTime
    }
  };
}

/**
 * Генерирует простую контрольную сумму для строки
 * @param data Строка данных для генерации контрольной суммы
 * @returns Строковое представление контрольной суммы
 */
function generateSimpleChecksum(data: string): string {
  try {
    // Простая хеш-функция
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Преобразуем в 32-битное целое
    }
    
    // Возвращаем хеш в виде шестнадцатеричной строки
    return hash.toString(16);
  } catch (error) {
    console.error('[dataCompression] Error generating checksum:', error);
    return '0';
  }
} 