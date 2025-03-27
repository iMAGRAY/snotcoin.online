/**
 * Модуль для шифрования и дешифрования сохранений игры
 */

import { ExtendedGameState } from '../types/gameTypes';
import * as crypto from 'crypto';

// Секретный ключ для шифрования (должен быть в переменных окружения)
const ENCRYPTION_SECRET = process.env.SAVE_ENCRYPTION_SECRET || 'your-secret-key-at-least-32-chars-long';
const IV_LENGTH = 16; // Длина вектора инициализации (в байтах)
const ALGORITHM = 'aes-256-cbc'; // Алгоритм шифрования

/**
 * Шифрует сохранение игры, создавая защищенную версию
 * @param gameState Состояние игры для шифрования
 * @param userId ID пользователя (используется как часть соли)
 * @returns Объект с зашифрованным сохранением и метаданными
 */
export function encryptGameSave(gameState: ExtendedGameState, userId: string) {
  try {
    // Создаем копию состояния для шифрования (опционально можно исключить ненужные поля)
    const stateToEncrypt = {
      ...gameState,
      _encryptionMetadata: {
        timestamp: Date.now(),
        userId: userId,
        version: gameState._saveVersion || 1
      }
    };
    
    // Генерация случайного вектора инициализации
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Создаем уникальный ключ на основе секрета и идентификатора пользователя
    const keyBuffer = Buffer.from(ENCRYPTION_SECRET + userId, 'utf-8');
    const key = crypto.createHash('sha256').update(keyBuffer).digest();
    
    // Создаем шифратор
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Преобразуем состояние игры в строку JSON и шифруем
    const jsonData = JSON.stringify(stateToEncrypt);
    const encrypted = Buffer.concat([cipher.update(jsonData, 'utf-8'), cipher.final()]);
    
    // Создаем подпись для проверки целостности
    const hmac = crypto.createHmac('sha256', key)
      .update(iv.toString('hex') + encrypted.toString('hex'))
      .digest('hex');
    
    // Формируем финальную строку в формате: iv:encrypted:hmac
    const encryptedSave = [
      iv.toString('hex'),
      encrypted.toString('hex'),
      hmac
    ].join(':');
    
    return {
      encryptedSave,
      metadata: {
        timestamp: Date.now(),
        algorithm: ALGORITHM,
        version: 1,
        hmacAlgorithm: 'sha256'
      }
    };
  } catch (error) {
    console.error('Error encrypting game save:', error);
    throw new Error('Failed to encrypt game save');
  }
}

/**
 * Дешифрует зашифрованное сохранение игры
 * @param encryptedSave Строка с зашифрованным сохранением
 * @param userId ID пользователя (нужен для восстановления ключа)
 * @returns Расшифрованное состояние игры или null при неудаче
 */
export function decryptGameSave(encryptedSave: string, userId: string): ExtendedGameState | null {
  try {
    // Разбиваем зашифрованную строку на составляющие
    const parts = encryptedSave.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted save format');
    }
    
    const [ivHex, encryptedHex, storedHmac] = parts;
    
    // Проверяем, что все части существуют
    if (!ivHex || !encryptedHex || !storedHmac) {
      throw new Error('Missing required encryption parts');
    }
    
    // Преобразуем hex-строки обратно в буферы
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    // Создаем уникальный ключ на основе секрета и идентификатора пользователя
    const keyBuffer = Buffer.from(ENCRYPTION_SECRET + userId, 'utf-8');
    const key = crypto.createHash('sha256').update(keyBuffer).digest();
    
    // Проверяем целостность с помощью HMAC
    const computedHmac = crypto.createHmac('sha256', key)
      .update(ivHex + encryptedHex)
      .digest('hex');
    
    // Если HMAC не совпадает, данные были подделаны
    if (computedHmac !== storedHmac) {
      throw new Error('Save integrity check failed: HMAC mismatch');
    }
    
    // Создаем дешифратор и получаем расшифрованные данные
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    // Преобразуем расшифрованные данные в объект
    const gameState = JSON.parse(decrypted.toString('utf-8')) as ExtendedGameState;
    
    // Проверяем метаданные шифрования
    const encryptionMetadata = gameState._encryptionMetadata as { userId: string; timestamp: number; version: number } | undefined;
    
    // Дополнительная проверка (например, что userId в сохранении соответствует переданному)
    if (encryptionMetadata && encryptionMetadata.userId !== userId) {
      throw new Error('User ID mismatch in decrypted save');
    }
    
    // Удаляем метаданные шифрования из ответа
    delete gameState._encryptionMetadata;
    
    return gameState;
  } catch (error) {
    console.error('Error decrypting game save:', error);
    return null;
  }
}

/**
 * Проверяет целостность зашифрованного сохранения без полного дешифрования
 * @param encryptedSave Строка с зашифрованным сохранением
 * @param userId ID пользователя
 * @returns Результат проверки целостности
 */
export function verifyEncryptedSaveIntegrity(encryptedSave: string, userId: string) {
  try {
    // Разбиваем зашифрованную строку на составляющие
    const parts = encryptedSave.split(':');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid encrypted save format' };
    }
    
    const [ivHex, encryptedHex, storedHmac] = parts;
    
    // Проверяем, что все части существуют
    if (!ivHex || !encryptedHex || !storedHmac) {
      return { valid: false, error: 'Missing required encryption parts' };
    }
    
    // Создаем уникальный ключ на основе секрета и идентификатора пользователя
    const keyBuffer = Buffer.from(ENCRYPTION_SECRET + userId, 'utf-8');
    const key = crypto.createHash('sha256').update(keyBuffer).digest();
    
    // Проверяем целостность с помощью HMAC
    const computedHmac = crypto.createHmac('sha256', key)
      .update(ivHex + encryptedHex)
      .digest('hex');
    
    // Если HMAC не совпадает, данные были подделаны
    if (computedHmac !== storedHmac) {
      return {
        valid: false,
        error: 'HMAC verification failed',
        details: 'The save data appears to have been tampered with'
      };
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Integrity check error',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Проверяет целостность сохранения и пытается его расшифровать
 * @param encryptedSave Строка с зашифрованным сохранением
 * @param userId ID пользователя
 * @returns Результат проверки и расшифровки
 */
export function verifySaveIntegrity(encryptedSave: string, userId: string) {
  // Сначала проверяем целостность без полного дешифрования
  const integrityResult = verifyEncryptedSaveIntegrity(encryptedSave, userId);
  
  if (!integrityResult.valid) {
    return {
      success: false,
      valid: false,
      error: integrityResult.error,
      details: integrityResult.details
    };
  }
  
  // Если целостность подтверждена, пробуем расшифровать
  try {
    const gameState = decryptGameSave(encryptedSave, userId);
    
    if (!gameState) {
      return {
        success: false,
        valid: true, // HMAC проверка прошла успешно
        error: 'Failed to decrypt game state',
        details: 'Decryption returned null'
      };
    }
    
    return {
      success: true,
      valid: true,
      gameState,
      metadata: {
        version: gameState._saveVersion || 1,
        timestamp: gameState._savedAt || new Date().toISOString(),
        userId: gameState._userId || userId
      }
    };
  } catch (error) {
    return {
      success: false,
      valid: integrityResult.valid,
      error: 'Decryption error',
      details: error instanceof Error ? error.message : String(error)
    };
  }
} 