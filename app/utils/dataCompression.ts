/**
 * Утилиты для сжатия и декомпрессии данных сохранения
 * Оптимизировано для минимизации объема передаваемых данных
 */

import { CompressedGameState } from "../types/saveTypes";
import { ExtendedGameState } from "../types/gameTypes";
import * as LZString from "lz-string";

/**
 * Алгоритмы сжатия, поддерживаемые системой
 */
export enum CompressionAlgorithm {
  LZ_UTF16 = "lz-string-utf16",
  LZ_BASE64 = "lz-string-base64",
  LZ_URI = "lz-string-uri"
}

/**
 * Расширенное игровое состояние с метаданными о декомпрессии
 */
interface EnhancedGameState extends ExtendedGameState {
  _decompressedAt?: string;
  _integrityWarning?: boolean;
}

/**
 * Опции для сжатия данных
 */
interface CompressionOptions {
  algorithm?: CompressionAlgorithm;
  includeIntegrityInfo?: boolean;
  removeTempData?: boolean;
  removeLogs?: boolean;
}

/**
 * Сжимает объект игрового состояния
 * @param state Объект состояния для сжатия
 * @param userId ID пользователя для интегрити-проверки
 * @param options Опции сжатия
 * @returns Сжатое представление данных
 */
export function compressGameState(
  state: ExtendedGameState,
  userId: string,
  options: CompressionOptions = {}
): CompressedGameState {
  // Устанавливаем алгоритм сжатия по умолчанию
  const algorithm = options.algorithm || CompressionAlgorithm.LZ_UTF16;
  
  // Создаем копию данных для очистки перед сжатием
  const stateForCompression = { ...state };
  
  // Удаляем временные данные, если указано
  if (options.removeTempData) {
    delete (stateForCompression as any)._tempData;
    delete (stateForCompression as any)._renderData;
    delete (stateForCompression as any)._frameData;
    delete (stateForCompression as any)._physicsObjects;
    delete (stateForCompression as any)._sceneObjects;
  }
  
  // Удаляем логи, если указано
  if (options.removeLogs) {
    delete (stateForCompression as any).logs;
    delete (stateForCompression as any).history;
    delete (stateForCompression as any).analytics;
  }
  
  // Сериализуем данные
  const serialized = JSON.stringify(stateForCompression);
  const originalSize = serialized.length;
  
  // Сжимаем данные выбранным алгоритмом
  let compressedData: string = "";
  
  switch (algorithm) {
    case CompressionAlgorithm.LZ_UTF16:
      compressedData = LZString.compressToUTF16(serialized);
      break;
    case CompressionAlgorithm.LZ_BASE64:
      compressedData = LZString.compressToBase64(serialized);
      break;
    case CompressionAlgorithm.LZ_URI:
      compressedData = LZString.compressToEncodedURIComponent(serialized);
      break;
    default:
      compressedData = LZString.compressToUTF16(serialized);
  }
  
  // Создаем объект сжатого состояния
  const compressedSize = compressedData.length;
  const compressionRatio = originalSize > 0 ? (compressedSize / originalSize) * 100 : 0;
  
  // Информация для проверки целостности
  const integrityInfo = options.includeIntegrityInfo ? {
    userId,
    saveVersion: state._saveVersion || 0,
    criticalDataHash: generateCriticalDataHash(state),
    timestamp: Date.now()
  } : {
    userId,
    saveVersion: state._saveVersion || 0,
    criticalDataHash: "",
    timestamp: Date.now()
  };
  
  // Возвращаем сжатое представление
  return {
    userId: userId,
    compressedData: compressedData,
    algorithm: algorithm,
    originalSize: originalSize,
    compressedSize: compressedSize,
    checksums: {
      criticalData: integrityInfo.criticalDataHash,
      fullData: ""
    },
    version: state._saveVersion || 1,
    timestamp: Date.now(),
    isCompressed: true,
    _isCompressed: true,
    _algorithm: algorithm,
    _compressedData: compressedData,
    _originalSize: originalSize,
    _compressedSize: compressedSize,
    _compressedAt: new Date().toISOString(),
    _integrityInfo: integrityInfo
  };
}

/**
 * Распаковывает сжатое состояние
 * @param compressed Сжатое состояние
 * @returns Распакованное состояние или null при ошибке
 */
export function decompressGameState(
  compressed: CompressedGameState
): EnhancedGameState | null {
  try {
    // Проверяем, что это действительно сжатое состояние
    if (!compressed._isCompressed || !compressed._compressedData) {
      console.error('Объект не является сжатым состоянием');
      return null;
    }
    
    // Выбираем алгоритм декомпрессии
    const algorithm = compressed._algorithm || CompressionAlgorithm.LZ_UTF16;
    let decompressed: string | null = null;
    
    switch (algorithm) {
      case CompressionAlgorithm.LZ_UTF16:
        decompressed = LZString.decompressFromUTF16(compressed._compressedData);
        break;
      case CompressionAlgorithm.LZ_BASE64:
        decompressed = LZString.decompressFromBase64(compressed._compressedData);
        break;
      case CompressionAlgorithm.LZ_URI:
        decompressed = LZString.decompressFromEncodedURIComponent(compressed._compressedData);
        break;
      default:
        decompressed = LZString.decompressFromUTF16(compressed._compressedData);
    }
    
    // Проверяем успешность декомпрессии
    if (!decompressed) {
      console.error('Ошибка декомпрессии данных');
      return null;
    }
    
    // Парсим JSON
    try {
      const state = JSON.parse(decompressed) as EnhancedGameState;
      
      // Добавляем метаданные о декомпрессии
      state._decompressedAt = new Date().toISOString();
      
      // Проверяем целостность данных, если есть информация
      if (compressed._integrityInfo && compressed._integrityInfo.criticalDataHash) {
        const currentHash = generateCriticalDataHash(state);
        const expectedHash = compressed._integrityInfo.criticalDataHash;
        
        if (currentHash !== expectedHash) {
          console.warn('Предупреждение: хеш критических данных не совпадает');
          state._integrityWarning = true;
        }
      }
      
      return state;
    } catch (parseError) {
      console.error('Ошибка при парсинге декомпрессированных данных:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Ошибка при декомпрессии данных:', error);
    return null;
  }
}

/**
 * Генерирует хеш критической информации для проверки целостности
 * @param state Состояние игры
 * @returns Хеш критических данных
 */
function generateCriticalDataHash(state: ExtendedGameState): string {
  // Для простоты используем строковое представление
  const criticalDataStr = JSON.stringify({
    inventory: {
      snot: state.inventory?.snot,
      snotCoins: state.inventory?.snotCoins,
      containerCapacity: state.inventory?.containerCapacity,
      containerCapacityLevel: state.inventory?.containerCapacityLevel,
      fillingSpeed: state.inventory?.fillingSpeed,
      fillingSpeedLevel: state.inventory?.fillingSpeedLevel
    },
    upgrades: state.upgrades,
    container: {
      level: state.container?.level
    },
    version: state._saveVersion
  });
  
  // Генерируем хеш (простая реализация)
  let hash = 0;
  
  for (let i = 0; i < criticalDataStr.length; i++) {
    const char = criticalDataStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Оценивает эффективность сжатия для текущего состояния
 * @param state Состояние игры
 * @returns Информация о потенциальном сжатии
 */
export function estimateCompression(
  state: ExtendedGameState
): { originalSize: number; compressedSizes: Record<CompressionAlgorithm, number>; bestAlgorithm: CompressionAlgorithm } {
  // Сериализуем состояние
  const serialized = JSON.stringify(state);
  const originalSize = serialized.length;
  
  // Сжимаем различными алгоритмами
  const compressedSizes: Record<CompressionAlgorithm, number> = {} as Record<CompressionAlgorithm, number>;
  
  // LZ-String UTF16
  const utf16Compressed = LZString.compressToUTF16(serialized);
  compressedSizes[CompressionAlgorithm.LZ_UTF16] = utf16Compressed.length;
  
  // LZ-String Base64
  const base64Compressed = LZString.compressToBase64(serialized);
  compressedSizes[CompressionAlgorithm.LZ_BASE64] = base64Compressed.length;
  
  // LZ-String URI
  const uriCompressed = LZString.compressToEncodedURIComponent(serialized);
  compressedSizes[CompressionAlgorithm.LZ_URI] = uriCompressed.length;
  
  // Находим лучший алгоритм
  let bestAlgorithm = CompressionAlgorithm.LZ_UTF16;
  let minSize = compressedSizes[CompressionAlgorithm.LZ_UTF16];
  
  for (const algorithm in compressedSizes) {
    const typedAlgorithm = algorithm as CompressionAlgorithm;
    if (compressedSizes[typedAlgorithm] < minSize) {
      minSize = compressedSizes[typedAlgorithm];
      bestAlgorithm = typedAlgorithm;
    }
  }
  
  return {
    originalSize,
    compressedSizes,
    bestAlgorithm
  };
} 