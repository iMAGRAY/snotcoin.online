/**
 * Модуль для проверки и сравнения локальных и серверных сохранений игры
 */

import { GameState, ExtendedGameState } from '../types/gameTypes';
import { secureLocalLoad, getLocalSaveMetadata } from './localSaveProtection';

/**
 * Результат сравнения сохранений
 */
export interface SaveComparisonResult {
  localValid: boolean;          // Локальное сохранение валидно
  serverValid: boolean;         // Серверное сохранение валидно
  useLocal: boolean;            // Нужно использовать локальное сохранение
  useServer: boolean;           // Нужно использовать серверное сохранение
  localNewer: boolean;          // Локальное сохранение новее серверного
  localTimestamp: number;       // Время локального сохранения
  serverTimestamp: number;      // Время серверного сохранения
  timeDifference: number;       // Разница во времени между сохранениями в мс
  integrityErrors: string[];    // Ошибки целостности
  mergeNeeded: boolean;         // Нужно ли объединение данных
}

/**
 * Проверяет целостность локального сохранения
 * @param gameState Локальное состояние игры
 * @param userId ID пользователя
 * @returns True если сохранение прошло проверку целостности
 */
export function verifyLocalSaveIntegrity(gameState: GameState | ExtendedGameState | null, userId: string): boolean {
  if (!gameState) return false;
  
  try {
    // Базовые проверки структуры
    if (!gameState.inventory || !gameState._userId || !gameState._saveVersion) {
      console.warn('[localSaveChecker] Локальное сохранение не прошло базовую проверку структуры');
      return false;
    }
    
    // Проверка на отрицательные значения ресурсов
    if (gameState.inventory.snot < 0 || 
        gameState.inventory.snotCoins < 0 || 
        gameState.inventory.energy < 0) {
      console.warn('[localSaveChecker] Обнаружены отрицательные значения ресурсов');
      return false;
    }
    
    // Проверка на слишком большие значения ресурсов (возможная подмена)
    const MAX_REASONABLE_VALUE = 10000000; // 10 миллионов
    if (gameState.inventory.snot > MAX_REASONABLE_VALUE || 
        gameState.inventory.snotCoins > MAX_REASONABLE_VALUE || 
        gameState.inventory.energy > 1000) {
      console.warn('[localSaveChecker] Обнаружены подозрительно большие значения ресурсов');
      return false;
    }
    
    // Проверка соответствия ID пользователя
    if (gameState._userId !== userId) {
      console.warn('[localSaveChecker] ID пользователя в сохранении не соответствует текущему');
      return false;
    }
    
    // Проверка временных меток - убедимся, что они в пределах разумного
    const now = Date.now();
    const maxTimeDiff = 365 * 24 * 60 * 60 * 1000; // 1 год
    
    // Проверка времени сохранения - должно быть в прошлом и не слишком давно
    if (gameState._lastModified) {
      if (gameState._lastModified > now) {
        console.warn('[localSaveChecker] Время модификации сохранения в будущем');
        return false;
      }
      
      if (now - gameState._lastModified > maxTimeDiff) {
        console.warn('[localSaveChecker] Сохранение слишком старое');
        return false;
      }
    }
    
    // Больше не проверяем поля энергии, так как функционал удален
    
    // Всё прошло проверку
    return true;
  } catch (error) {
    console.error('[localSaveChecker] Ошибка при проверке целостности:', error);
    return false;
  }
}

/**
 * Получает временную метку последнего сохранения игры
 * @param gameState Объект состояния игры
 * @returns Timestamp в миллисекундах
 */
export function getLastSaveTimestamp(gameState: GameState | ExtendedGameState | null): number {
  if (!gameState) return 0;
  
  try {
    // Проверяем _lastModified (оно в миллисекундах)
    if (typeof gameState._lastModified === 'number') {
      return gameState._lastModified;
    }
    
    // Проверяем _lastSaved (оно в ISO формате)
    if (typeof gameState._lastSaved === 'string') {
      const date = new Date(gameState._lastSaved);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    
    // Проверяем _savedAt (тоже в ISO формате)
    const extendedState = gameState as ExtendedGameState;
    if (typeof extendedState._savedAt === 'string') {
      const date = new Date(extendedState._savedAt);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    
    // Если не нашли явную дату сохранения, возвращаем 0
    return 0;
  } catch (error) {
    console.error('[localSaveChecker] Ошибка при получении временной метки сохранения:', error);
    return 0;
  }
}

/**
 * Сравнивает локальное и серверное сохранения, решая какое использовать
 * @param localState Локальное сохранение из localStorage
 * @param serverState Серверное сохранение из базы данных
 * @param userId ID пользователя для проверки
 * @returns Результат сравнения с решением
 */
export function compareSaves(
  localState: GameState | ExtendedGameState | null, 
  serverState: GameState | ExtendedGameState | null, 
  userId: string
): SaveComparisonResult {
  // Инициализируем результат
  const result: SaveComparisonResult = {
    localValid: false,
    serverValid: false,
    useLocal: false,
    useServer: false,
    localNewer: false,
    localTimestamp: 0,
    serverTimestamp: 0,
    timeDifference: 0,
    integrityErrors: [],
    mergeNeeded: false
  };
  
  try {
    // Проверяем наличие сохранений
    const hasLocalState = Boolean(localState);
    const hasServerState = Boolean(serverState);
    
    // Если нет ни локального, ни серверного сохранения, возвращаем результат
    if (!hasLocalState && !hasServerState) {
      result.integrityErrors.push('Отсутствуют как локальное, так и серверное сохранение');
      return result;
    }
    
    // Проверяем целостность локального сохранения
    if (hasLocalState) {
      result.localValid = verifyLocalSaveIntegrity(localState, userId);
      if (!result.localValid) {
        result.integrityErrors.push('Локальное сохранение не прошло проверку целостности');
      }
    }
    
    // Проверяем целостность серверного сохранения (мы доверяем серверу больше)
    if (hasServerState && serverState) {
      // Серверное сохранение считаем валидным, если оно прошло базовую проверку
      result.serverValid = Boolean(
        serverState._userId === userId && 
        serverState.inventory && 
        typeof serverState._saveVersion === 'number'
      );
      
      if (!result.serverValid) {
        result.integrityErrors.push('Серверное сохранение не прошло базовую проверку');
      }
    }
    
    // Получаем временные метки сохранений
    if (hasLocalState) {
      result.localTimestamp = getLastSaveTimestamp(localState);
    }
    
    if (hasServerState) {
      result.serverTimestamp = getLastSaveTimestamp(serverState);
    }
    
    // Вычисляем разницу во времени
    result.timeDifference = result.localTimestamp - result.serverTimestamp;
    result.localNewer = result.timeDifference > 0;
    
    // Принимаем решение какое сохранение использовать
    
    // Если есть только одно валидное сохранение, используем его
    if (result.localValid && !result.serverValid) {
      result.useLocal = true;
      console.log('[localSaveChecker] Используем только локальное сохранение, так как серверное не валидно');
    } else if (!result.localValid && result.serverValid) {
      result.useServer = true;
      console.log('[localSaveChecker] Используем только серверное сохранение, так как локальное не валидно');
    } else if (result.localValid && result.serverValid) {
      // Если оба валидны, используем более новое
      if (result.localNewer) {
        // Локальное новее, проверяем насколько
        const timeDifferenceMinutes = Math.abs(result.timeDifference) / (60 * 1000);
        
        if (timeDifferenceMinutes > 30) {
          // Большая разница во времени (> 30 минут), возможно проблема с синхронизацией
          console.log(`[localSaveChecker] Локальное сохранение значительно новее (${timeDifferenceMinutes.toFixed(1)} минут), требуется проверка`);
          
          // Проверяем разумность разницы во времени
          if (result.timeDifference > 48 * 60 * 60 * 1000) { // > 48 часов
            // Слишком большая разница, используем серверное
            result.useServer = true;
            result.integrityErrors.push('Локальное сохранение слишком новое, использовано серверное');
            console.warn('[localSaveChecker] Локальное сохранение подозрительно новее, используем серверное');
          } else {
            // Разница в пределах допустимого, используем локальное
            result.useLocal = true;
            console.log('[localSaveChecker] Несмотря на большую разницу, используем более новое локальное сохранение');
          }
        } else {
          // Разница небольшая, используем локальное
          result.useLocal = true;
          console.log(`[localSaveChecker] Используем локальное сохранение, оно новее на ${timeDifferenceMinutes.toFixed(1)} минут`);
        }
      } else {
        // Серверное новее или они одинаковые, используем серверное
        result.useServer = true;
        console.log('[localSaveChecker] Используем серверное сохранение, оно новее или одинаковое с локальным');
      }
    } else {
      // Оба не валидны, пробуем использовать серверное, если оно есть
      if (hasServerState) {
        result.useServer = true;
        console.log('[localSaveChecker] Оба сохранения не валидны, используем серверное (так как ему доверяем больше)');
        result.integrityErrors.push('Оба сохранения не валидны, используем серверное');
      } else {
        console.warn('[localSaveChecker] Нет валидных сохранений, используем новое состояние');
        result.integrityErrors.push('Нет валидных сохранений, требуется новое состояние');
      }
    }
    
    // Проверка необходимости слияния данных
    if (result.localValid && result.serverValid && Math.abs(result.timeDifference) < 24 * 60 * 60 * 1000) {
      // Если разница менее 24 часов, возможно стоит объединить данные
      result.mergeNeeded = true;
      console.log('[localSaveChecker] Рекомендуется слияние данных, разница во времени невелика');
    }
    
    return result;
  } catch (error) {
    console.error('[localSaveChecker] Ошибка при сравнении сохранений:', error);
    
    // В случае ошибки предпочитаем серверное сохранение, если оно есть
    result.useServer = Boolean(serverState);
    result.integrityErrors.push(`Ошибка при сравнении: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
} 