/**
 * Сервис для компрессии и декомпрессии данных
 * Обеспечивает сжатие и распаковку игрового состояния для оптимизации передачи и хранения
 */
import type { ExtendedGameState } from '../../types/gameTypes';
import { isCompressedGameState } from '../../types/saveTypes';

// Тип данных с алгоритмом сжатия
interface CompressedData {
  _isCompressed: boolean;
  _compressedData: string;
  _originalSize: number;
  _compressedSize: number;
  _compression: 'lz-string' | 'lz-string-utf16' | 'none';
  _compressedAt: string;
  [key: string]: any;
}

/**
 * Сжимает состояние игры
 * @param gameState Состояние игры
 * @returns Сжатое состояние игры
 */
export const compressGameState = async (
  gameState: ExtendedGameState
): Promise<any> => {
  try {
    // Создаем копию объекта, чтобы не изменять исходный
    const stateCopy = { ...gameState };
    
    // Проверяем, что данные не были сжаты ранее
    if (isCompressedGameState(stateCopy)) {
      console.log('[CompressionService] Данные уже сжаты, пропускаем сжатие');
      return stateCopy;
    }
    
    // Если включаем модуль для сжатия, убедитесь, что lz-string импортирован
    const LZString = await import('lz-string');
    
    // Извлекаем критические данные перед сжатием
    const criticalData = extractCriticalData(stateCopy);
    
    // Преобразуем состояние в строку JSON
    const jsonString = JSON.stringify(stateCopy);
    const originalSize = jsonString.length;
    
    // Сжимаем данные
    const compressedData = LZString.compressToUTF16(jsonString);
    const compressedSize = compressedData.length;
    
    // Создаем объект сжатых данных
    const compressedState: CompressedData = {
      ...criticalData,
      _isCompressed: true,
      _compressedData: compressedData,
      _originalSize: originalSize,
      _compressedSize: compressedSize,
      _compression: 'lz-string-utf16',
      _compressedAt: new Date().toISOString()
    };
    
    // Проверяем степень сжатия
    const compressionRatio = (1 - (compressedSize / originalSize)) * 100;
    console.log(`[CompressionService] Сжатие выполнено: ${originalSize} -> ${compressedSize} байт (${compressionRatio.toFixed(2)}%)`);
    
    return compressedState;
  } catch (error) {
    console.error('[CompressionService] Ошибка при сжатии данных:', error);
    
    // Возвращаем исходные данные при ошибке
    return gameState;
  }
};

/**
 * Распаковывает сжатое состояние игры
 * @param compressedState Сжатое состояние игры
 * @returns Распакованное состояние игры
 */
export const decompressGameState = (compressedState: any): ExtendedGameState => {
  try {
    // Проверяем, что данные сжаты
    if (!isCompressedGameState(compressedState)) {
      console.log('[CompressionService] Данные не сжаты, возвращаем исходные');
      return compressedState as unknown as ExtendedGameState;
    }
    
    // Получаем алгоритм сжатия
    const compressionAlgorithm = compressedState._compression || 'lz-string-utf16';
    
    // Распаковываем данные в зависимости от алгоритма
    let jsonString: string;
    
    if (compressionAlgorithm === 'lz-string-utf16') {
      const LZString = require('lz-string');
      jsonString = LZString.decompressFromUTF16(compressedState._compressedData);
    } else if (compressionAlgorithm === 'lz-string') {
      const LZString = require('lz-string');
      jsonString = LZString.decompress(compressedState._compressedData);
    } else {
      // Если алгоритм неизвестен, возвращаем исходные данные
      console.warn('[CompressionService] Неизвестный алгоритм сжатия:', compressionAlgorithm);
      return compressedState as unknown as ExtendedGameState;
    }
    
    // Проверяем, что распаковка прошла успешно
    if (!jsonString) {
      console.error('[CompressionService] Ошибка распаковки данных: пустая строка');
      return compressedState as unknown as ExtendedGameState;
    }
    
    // Парсим JSON
    const decompressedState = JSON.parse(jsonString) as ExtendedGameState;
    
    // Добавляем метаданные распаковки
    decompressedState._decompressedAt = new Date().toISOString();
    
    console.log(`[CompressionService] Распаковка выполнена: ${compressedState._compressedSize} -> ${compressedState._originalSize} байт`);
    
    return decompressedState;
  } catch (error) {
    console.error('[CompressionService] Ошибка при распаковке данных:', error);
    
    // При ошибке возвращаем исходные данные 
    // Это позволит использовать хотя бы критические данные
    return compressedState as unknown as ExtendedGameState;
  }
};

/**
 * Извлекает критические данные из состояния игры
 * @param gameState Состояние игры
 * @returns Объект с критическими данными
 */
export const extractCriticalData = (gameState: ExtendedGameState): any => {
  try {
    // Создаем объект с самыми важными данными, которые должны 
    // быть доступны даже без распаковки полного состояния
    return {
      // Метаданные
      critical: {
        userId: gameState._userId,
        version: gameState._saveVersion,
        timestamp: gameState._lastModified || Date.now(),
        
        // Базовые игровые данные
        inventory: {
          snot: gameState.inventory.snot,
          snotCoins: gameState.inventory.snotCoins,
          containerCapacity: gameState.inventory.containerCapacity,
          fillingSpeed: gameState.inventory.fillingSpeed
        },
        
        container: {
          level: gameState.container.level,
          capacity: gameState.container.capacity
        },
        
        upgrades: {
          containerLevel: gameState.upgrades.containerLevel,
          fillingSpeedLevel: gameState.upgrades.fillingSpeedLevel
        }
      },
      
      // Информация для проверки целостности
      integrity: {
        userId: gameState._userId,
        saveVersion: gameState._saveVersion,
        timestamp: Date.now(),
        checksum: generateChecksum(gameState)
      }
    };
  } catch (error) {
    console.error('[CompressionService] Ошибка при извлечении критических данных:', error);
    
    // Возвращаем минимальный объект с метаданными при ошибке
    return {
      critical: {
        userId: gameState._userId,
        version: gameState._saveVersion || 1,
        timestamp: Date.now()
      },
      integrity: {
        timestamp: Date.now()
      }
    };
  }
};

/**
 * Генерирует контрольную сумму для проверки целостности данных
 * @param data Данные для проверки
 * @returns Контрольная сумма
 */
export const generateChecksum = (data: any): string => {
  try {
    const jsonString = JSON.stringify({
      userId: data._userId,
      saveVersion: data._saveVersion,
      inventory: data.inventory?.snot,
      containerLevel: data.container?.level
    });
    
    // Простая хеш-функция для генерации контрольной суммы
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Конвертируем в 32-битное целое
    }
    
    return hash.toString(16);
  } catch (error) {
    console.error('[CompressionService] Ошибка при генерации контрольной суммы:', error);
    return '0';
  }
}; 