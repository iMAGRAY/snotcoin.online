/**
 * Утилиты для криптографических операций
 */

/**
 * Генерирует простой хеш строки
 * Для продакшена рекомендуется использовать более надежные алгоритмы хеширования
 */
export function generateHash(str: string): string {
  // Простая хеш-функция для демонстрации
  // В реальном приложении рекомендуется использовать crypto.subtle или внешние библиотеки
  let hash = 0;
  if (str.length === 0) return hash.toString(36);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const positiveHash = Math.abs(hash).toString(36) + Date.now().toString(36);
  return positiveHash;
}

/**
 * Создает уникальный идентификатор
 */
export function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomStr}`;
}

/**
 * Вычисляет хеш-сумму объекта
 */
export function calculateObjectHash(obj: Record<string, any>): string {
  try {
    // Сортируем ключи для обеспечения консистентности
    const sortedObj = sortObjectKeys(obj);
    const jsonStr = JSON.stringify(sortedObj);
    return generateHash(jsonStr);
  } catch (error) {
    console.error('Ошибка при вычислении хеша объекта:', error);
    return generateUniqueId(); // Fallback в случае ошибки
  }
}

/**
 * Сортирует ключи объекта для получения предсказуемого JSON
 */
function sortObjectKeys(obj: Record<string, any>): Record<string, any> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return obj;
  }

  const sortedObj: Record<string, any> = {};
  const sortedKeys = Object.keys(obj).sort();

  for (const key of sortedKeys) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      sortedObj[key] = sortObjectKeys(obj[key]);
    } else {
      sortedObj[key] = obj[key];
    }
  }

  return sortedObj;
}

/**
 * Простое шифрование строки
 * В реальном приложении следует использовать более надежные алгоритмы
 */
export function encrypt(data: string, key: string): string {
  const textToChars = (text: string) => text.split('').map(c => c.charCodeAt(0));
  const byteHex = (n: number) => ("0" + Number(n).toString(16)).substr(-2);
  const applySaltToChar = (code: number) => textToChars(key).reduce((a, b) => a ^ b, code);

  return data
    .split('')
    .map(c => textToChars(c)[0])
    .map(code => typeof code === 'number' ? applySaltToChar(code) : 0)
    .map(byteHex)
    .join('');
}

/**
 * Дешифрование строки
 * В реальном приложении следует использовать более надежные алгоритмы
 */
export function decrypt(encoded: string, key: string): string {
  const textToChars = (text: string) => text.split('').map(c => c.charCodeAt(0));
  const applySaltToChar = (code: number) => textToChars(key).reduce((a, b) => a ^ b, code);
  
  return encoded
    .match(/.{1,2}/g)!
    .map(hex => parseInt(hex, 16))
    .map(applySaltToChar)
    .map(charCode => String.fromCharCode(charCode))
    .join('');
} 