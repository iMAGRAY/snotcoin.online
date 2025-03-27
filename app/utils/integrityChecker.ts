/**
 * Утилиты для проверки целостности сохранений и обнаружения модификаций
 */

import { ExtendedGameState, GameStateStats } from '../types/gameTypes';
import { decryptGameSave } from './saveEncryption';
import * as crypto from 'crypto';

// Изменяем тип ValidationResult, чтобы соответствовать exactOptionalPropertyTypes
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: Record<string, any> | undefined;
}

/**
 * Вычисляет SHA-256 контрольную сумму состояния игры
 * @param gameState Состояние игры для проверки
 * @returns Контрольная сумма в виде hex-строки
 */
export function computeGameStateChecksum(gameState: ExtendedGameState): string {
  try {
    // Создаем копию состояния без служебных полей
    const { _saveVersion, ...stateToHash } = gameState;
    
    // Сортируем ключи для обеспечения стабильности хеша
    const sortedState = JSON.stringify(stateToHash, Object.keys(stateToHash).sort());
    
    // Вычисляем SHA-256 хеш
    return crypto.createHash('sha256').update(sortedState).digest('hex');
  } catch (error) {
    console.error('Error computing checksum:', error);
    return '';
  }
}

/**
 * Проверяет целостность сохранения игры
 * @param gameState Состояние игры для проверки
 * @param encryptedState Опциональное зашифрованное состояние для сравнения
 * @returns Результат проверки целостности
 */
export function verifyGameStateIntegrity(
  gameState: ExtendedGameState, 
  encryptedState?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, any> = {};
  
  // Проверка базовой структуры
  if (!gameState) {
    errors.push('Game state is null or undefined');
    return { valid: false, errors, warnings, details };
  }
  
  // Проверка версии сохранения
  if (!gameState._saveVersion) {
    warnings.push('Missing save version metadata');
  }
  
  // Проверка пользователя и ID
  if (!gameState._userId) {
    errors.push('Missing userId in game state');
  }
  
  // Проверка инвентаря
  if (gameState.inventory) {
    let invalidItems = 0;
    
    // Проверяем поля инвентаря напрямую
    if (gameState.inventory.snot < 0) {
      invalidItems++;
      errors.push(`Negative quantity for snot: ${gameState.inventory.snot}`);
    }
    
    if (gameState.inventory.snotCoins < 0) {
      invalidItems++;
      errors.push(`Negative quantity for snotCoins: ${gameState.inventory.snotCoins}`);
    }
    
    // Проверка на слишком большие значения
    if (gameState.inventory.snot > 9999999) {
      invalidItems++;
      warnings.push(`Suspiciously large quantity for snot: ${gameState.inventory.snot}`);
    }
    
    if (gameState.inventory.snotCoins > 9999999) {
      invalidItems++;
      warnings.push(`Suspiciously large quantity for snotCoins: ${gameState.inventory.snotCoins}`);
    }
    
    if (invalidItems > 0) {
      details.invalidItems = invalidItems;
    }
  } else {
    warnings.push('No inventory data found');
  }
  
  // Если есть зашифрованное состояние, проверяем его соответствие
  if (encryptedState && gameState._userId) {
    try {
      const decryptedState = decryptGameSave(encryptedState, gameState._userId);
      
      if (!decryptedState) {
        errors.push('Failed to decrypt encrypted state');
      } else {
        // Проверяем основные поля
        const decryptedChecksum = computeGameStateChecksum(decryptedState);
        const currentChecksum = computeGameStateChecksum(gameState);
        
        if (decryptedChecksum !== currentChecksum) {
          errors.push('Current state does not match encrypted state (checksum mismatch)');
          details.encryptedStateChecksum = decryptedChecksum;
          details.currentStateChecksum = currentChecksum;
        }
      }
    } catch (error) {
      errors.push(`Error verifying encrypted state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Дополнительные проверки игровой логики
  const validationErrors = detectSuspiciousModifications(gameState);
  errors.push(...validationErrors);
  
  // Возвращаем undefined для details, если они пустые
  const hasDetails = Object.keys(details).length > 0;
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    details: hasDetails ? details : undefined
  };
}

/**
 * Обнаруживает подозрительные модификации в сохранении
 * @param gameState Состояние игры для проверки
 * @returns Массив обнаруженных ошибок
 */
export function detectSuspiciousModifications(gameState: ExtendedGameState): string[] {
  const errors: string[] = [];
  
  // Проверка на отрицательные и слишком большие значения в инвентаре
  if (gameState.inventory) {
    // Проверка snot на нереальные значения
    if (gameState.inventory.snot < 0) {
      errors.push(`Negative value for snot: ${gameState.inventory.snot}`);
    }
    
    if (gameState.inventory.snot > 1000000000) {
      errors.push(`Suspiciously high value for snot: ${gameState.inventory.snot} (max expected: 1000000000)`);
    }
    
    // Проверка snotCoins на нереальные значения
    if (gameState.inventory.snotCoins < 0) {
      errors.push(`Negative value for snotCoins: ${gameState.inventory.snotCoins}`);
    }
    
    if (gameState.inventory.snotCoins > 100000) {
      errors.push(`Suspiciously high value for snotCoins: ${gameState.inventory.snotCoins} (max expected: 100000)`);
    }
  }
  
  // Проверка скорости прогресса
  if (gameState.stats?.playTime && gameState.stats?.highestLevel) {
    const playtimeHours = gameState.stats.playTime / 3600; // предполагаем, что время в секундах
    const level = gameState.stats.highestLevel;
    
    // Проверка слишком быстрого прогресса
    // Например, достижение 50 уровня за 1 час игры
    if (level > 50 && playtimeHours < 1) {
      errors.push(`Suspicious progress: level ${level} reached in only ${playtimeHours.toFixed(2)} hours`);
    }
  }
  
  // Проверка достижений
  if (gameState.achievements) {
    const achievementCount = Object.values(gameState.achievements.unlockedAchievements).length;
    const playtimeHours = gameState.stats?.playTime ? gameState.stats.playTime / 3600 : 0;
    
    // Проверка слишком быстрого получения большого количества достижений
    if (achievementCount > 30 && playtimeHours < 2) {
      errors.push(`Suspicious achievement rate: ${achievementCount} achievements in ${playtimeHours.toFixed(2)} hours`);
    }
  }
  
  return errors;
}

/**
 * Исправляет проблемы с сохранением, если это возможно
 * @param gameState Состояние игры для исправления
 * @returns Исправленное состояние и список примененных исправлений
 */
export function repairGameState(gameState: ExtendedGameState): { 
  repairedState: ExtendedGameState; 
  appliedFixes: string[];
} {
  const appliedFixes: string[] = [];
  
  // Создаем глубокую копию исходного состояния
  const repairedState: ExtendedGameState = JSON.parse(JSON.stringify(gameState));
  
  // Обновляем версию сохранения
  if (!repairedState._saveVersion) {
    repairedState._saveVersion = 1;
    appliedFixes.push('Added missing save version');
  }
  
  // Исправляем инвентарь
  if (repairedState.inventory) {
    // Исправляем отрицательные значения
    if (repairedState.inventory.snot < 0) {
      repairedState.inventory.snot = 0;
      appliedFixes.push(`Fixed negative snot: from ${gameState.inventory.snot} to 0`);
    }
    
    if (repairedState.inventory.snotCoins < 0) {
      repairedState.inventory.snotCoins = 0;
      appliedFixes.push(`Fixed negative snotCoins: from ${gameState.inventory.snotCoins} to 0`);
    }
    
    // Ограничиваем чрезмерные значения
    const maxSnot = 9999999;
    if (repairedState.inventory.snot > maxSnot) {
      repairedState.inventory.snot = maxSnot;
      appliedFixes.push(`Capped excessive snot: from ${gameState.inventory.snot} to ${maxSnot}`);
    }
    
    const maxCoins = 9999999;
    if (repairedState.inventory.snotCoins > maxCoins) {
      repairedState.inventory.snotCoins = maxCoins;
      appliedFixes.push(`Capped excessive snotCoins: from ${gameState.inventory.snotCoins} to ${maxCoins}`);
    }
  }
  
  // Исправляем контейнер, если он переполнен
  if (repairedState.container && 
      typeof repairedState.container.currentAmount === 'number' && 
      typeof repairedState.container.capacity === 'number' &&
      repairedState.container.currentAmount > repairedState.container.capacity) {
    repairedState.container.currentAmount = repairedState.container.capacity;
    appliedFixes.push(`Fixed container overflow: capped at ${repairedState.container.capacity}`);
  }
  
  // Расчет контрольной суммы для измененного состояния
  const checksum = computeGameStateChecksum(repairedState);
  // Сохраняем в объекте метку проверки
  repairedState._integrityVerified = true;
  
  return { repairedState, appliedFixes };
} 