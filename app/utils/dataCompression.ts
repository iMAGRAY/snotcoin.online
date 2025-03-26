/**
 * Модуль для сжатия и декомпрессии игровых данных
 * Оптимизирует хранение состояний для большого количества пользователей
 */

import { 
  compressToUTF16, 
  compressToBase64, 
  compressToEncodedURIComponent,
  decompressFromUTF16,
  decompressFromBase64,
  decompressFromEncodedURIComponent
} from '../libs/compression/lzString';
import { ExtendedGameState } from '../types/gameTypes';
import { 
  CompressedGameState, 
  StructuredGameSave, 
  CompressionAlgorithm, 
  CriticalGameData,
  RegularGameData,
  ExtendedGameData,
  IntegrityData
} from '../types/saveTypes';
import { createStructuredSave, generateSimpleChecksum } from './dataIntegrity';

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
 * Асинхронно сжимает данные
 * @param data Строка для сжатия
 * @param algorithm Алгоритм сжатия
 * @returns Сжатая строка
 */
export async function compressData(
  data: string,
  algorithm: CompressionAlgorithm = CompressionAlgorithm.LZ_UTF16
): Promise<string> {
  if (!data) return '';
  
  try {
    switch (algorithm) {
      case CompressionAlgorithm.LZ_UTF16:
        return await compressToUTF16(data);
      case CompressionAlgorithm.LZ_BASE64:
        return await compressToBase64(data);
      case CompressionAlgorithm.LZ_URI:
        return await compressToEncodedURIComponent(data);
      case CompressionAlgorithm.NONE:
        return data;
      default:
        return await compressToUTF16(data);
    }
  } catch (error) {
    console.error('[dataCompression] Error compressing data:', error);
    return data; // При ошибке возвращаем исходные данные
  }
}

/**
 * Асинхронно декомпрессирует данные
 * @param compressedData Сжатая строка
 * @param algorithm Алгоритм сжатия
 * @returns Декомпрессированная строка
 */
export async function decompressData(
  compressedData: string,
  algorithm: CompressionAlgorithm = CompressionAlgorithm.LZ_UTF16
): Promise<string> {
  if (!compressedData) return '';
  
  try {
    switch (algorithm) {
      case CompressionAlgorithm.LZ_UTF16:
        return (await decompressFromUTF16(compressedData)) || '';
      case CompressionAlgorithm.LZ_BASE64:
        return (await decompressFromBase64(compressedData)) || '';
      case CompressionAlgorithm.LZ_URI:
        return (await decompressFromEncodedURIComponent(compressedData)) || '';
      case CompressionAlgorithm.NONE:
        return compressedData;
      default:
        return (await decompressFromUTF16(compressedData)) || '';
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
export async function compressGameState(
  state: ExtendedGameState,
  userId: string,
  options: CompressionOptions = DEFAULT_OPTIONS
): Promise<CompressedGameState | null> {
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
    const compressedData = await compressData(jsonToCompress, finalOptions.algorithm);
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
export async function decompressGameState(compressedState: CompressedGameState): Promise<StructuredGameSave | null> {
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
    const decompressedDataStr = await decompressData(
      compressedState._compressedData, 
      compressedState._compression as CompressionAlgorithm
    );
    
    if (!decompressedDataStr) {
      console.error('[dataCompression] Failed to decompress data');
      return null;
    }
    
    // Преобразовываем данные из JSON
    const decompressedData = JSON.parse(decompressedDataStr);
    
    // Восстанавливаем структурированное сохранение
    const structuredSave: StructuredGameSave = {
      critical: compressedState.critical,
      integrity: compressedState.integrity,
      regular: decompressedData.regular,
      extended: decompressedData.extended,
      _decompressedAt: now
    };
    
    return structuredSave;
  } catch (error) {
    console.error('[dataCompression] Error decompressing game state:', error);
    return null;
  }
} 