/**
 * Утилиты для системы сохранений
 * Включает функции хеширования, шифрования, сжатия и другие вспомогательные функции
 */

// Вспомогательные функции для работы с данными
export const generateRandomKey = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint32Array(length);
  
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
  } else {
    // Фоллбэк для сред без crypto API
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  return result;
};

/**
 * Создает хеш строки (для проверки целостности данных)
 */
export const createHash = (str: string): string => {
  if (typeof window === 'undefined') {
    // Для серверной среды используем простой хеш
    return simpleHash(str);
  }
  
  // Для браузера используем sha-256 если доступен
  if (window.crypto && window.crypto.subtle) {
    return browserCryptoHash(str);
  }
  
  // Фоллбэк на простой хеш
  return simpleHash(str);
};

/**
 * Создает простой хеш (для сред без crypto API)
 */
const simpleHash = (str: string): string => {
  let hash = 0;
  
  if (str.length === 0) return hash.toString(16);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Конвертируем в 32-битное целое
  }
  
  return Math.abs(hash).toString(16);
};

/**
 * Создает криптографический хеш с использованием Web Crypto API
 */
const browserCryptoHash = async (str: string): Promise<string> => {
  try {
    // Конвертируем строку в ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    
    // Создаем хеш SHA-256
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    
    // Конвертируем ArrayBuffer в строку
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    // В случае ошибки используем простой хеш
    return simpleHash(str);
  }
};

/**
 * Шифрует данные с использованием простого XOR-шифрования
 * с секретным ключом, созданным на основе userId
 */
export const encryptData = (data: string, userId: string): string => {
  // Создаем ключ на основе userId и дополнительного секретного ключа
  const secretKey = 'snotcoin_game_storage_v1_' + userId;
  let key = createKeyFromString(secretKey);
  
  // Шифруем данные с использованием XOR
  let result = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ key[i % key.length];
    result += String.fromCharCode(charCode);
  }
  
  // Кодируем в base64 для безопасного хранения
  return btoa(result);
};

/**
 * Расшифровывает данные, зашифрованные с использованием encryptData
 */
export const decryptData = (encryptedData: string, userId: string): string => {
  // Создаем тот же ключ для расшифровки
  const secretKey = 'snotcoin_game_storage_v1_' + userId;
  let key = createKeyFromString(secretKey);
  
  // Декодируем из base64
  const data = atob(encryptedData);
  
  // Расшифровываем
  let result = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ key[i % key.length];
    result += String.fromCharCode(charCode);
  }
  
  return result;
};

/**
 * Создает числовой массив на основе строки для использования в шифровании
 */
const createKeyFromString = (str: string): number[] => {
  const key: number[] = [];
  
  // Усложняем ключ, используя несколько обходов строки
  for (let i = 0; i < str.length; i++) {
    key.push(str.charCodeAt(i));
  }
  
  // Расширяем ключ для большей сложности
  for (let i = 0; i < key.length; i++) {
    if (i > 0) {
      key[i] = (key[i] + key[i - 1]) % 256;
    }
  }
  
  return key;
};

/**
 * Сжимает строку в формат base64
 * В реальной реализации можно использовать библиотеки сжатия
 */
export const compressData = async (data: string): Promise<string> => {
  // В реальном приложении здесь нужно использовать библиотеку сжатия
  // Например, pako, lz-string или другие
  // Для простоты демонстрации возвращаем данные в base64
  if (typeof btoa === 'function') {
    return btoa(data);
  }
  return data;
};

/**
 * Распаковывает сжатую строку
 */
export const decompressData = async (compressedData: string): Promise<string> => {
  // В реальном приложении здесь нужно использовать библиотеку распаковки
  // Для простоты демонстрации декодируем из base64
  if (typeof atob === 'function') {
    return atob(compressedData);
  }
  return compressedData;
};

/**
 * Проверяет равенство объектов с глубоким сравнением
 */
export const isEqual = (obj1: any, obj2: any): boolean => {
  // Проверка примитивных типов
  if (obj1 === obj2) return true;
  
  // Проверка на null и undefined
  if (obj1 == null || obj2 == null) return obj1 === obj2;
  
  // Проверка типов
  const type1 = typeof obj1;
  const type2 = typeof obj2;
  
  if (type1 !== type2) return false;
  
  // Проверка массивов
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    
    for (let i = 0; i < obj1.length; i++) {
      if (!isEqual(obj1[i], obj2[i])) return false;
    }
    
    return true;
  }
  
  // Проверка объектов
  if (type1 === 'object') {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!obj2.hasOwnProperty(key)) return false;
      if (!isEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }
  
  return false;
};

/**
 * Выполняет глубокое объединение объектов
 * Предпочитает значения из первого объекта при конфликте
 */
export const deepMerge = <T extends Record<string, any>>(target: T, source: T): T => {
  const result = { ...target };
  
  // Если источник не объект или null, возвращаем целевой объект
  if (!source || typeof source !== 'object') return result;
  
  // Обходим свойства исходного объекта
  Object.keys(source).forEach(key => {
    // Проверяем существование ключа в результате
    if (key in result) {
      // Если оба значения - объекты, рекурсивно объединяем
      if (typeof result[key] === 'object' && 
          typeof source[key] === 'object' && 
          result[key] !== null && 
          source[key] !== null) {
        
        // Объединяем массивы особым образом (замещаем элементы)
        if (Array.isArray(result[key]) && Array.isArray(source[key])) {
          result[key] = [...result[key]];
          
          // Заменяем только существующие элементы
          for (let i = 0; i < source[key].length && i < result[key].length; i++) {
            if (typeof source[key][i] === 'object' && typeof result[key][i] === 'object') {
              result[key][i] = deepMerge(result[key][i], source[key][i]);
            } else if (source[key][i] !== undefined) {
              result[key][i] = source[key][i];
            }
          }
        } else {
          // Объединяем обычные объекты
          result[key] = deepMerge(result[key], source[key]);
        }
      }
    } else {
      // Если ключа нет в результате, просто копируем значение
      result[key] = source[key];
    }
  });
  
  return result;
}; 