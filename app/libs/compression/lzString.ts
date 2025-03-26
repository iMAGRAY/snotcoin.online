/**
 * Обертка для lz-string с поддержкой ленивой загрузки
 */

// Использование динамического импорта для ленивой загрузки библиотеки
let lzStringPromise: Promise<typeof import('lz-string')> | null = null;

/**
 * Получает экземпляр библиотеки lz-string с ленивой загрузкой
 */
async function getLZString() {
  if (!lzStringPromise) {
    lzStringPromise = import('lz-string');
  }
  return lzStringPromise;
}

/**
 * Сжимает строку в UTF16
 */
export async function compressToUTF16(input: string): Promise<string> {
  const lzString = await getLZString();
  return lzString.compressToUTF16(input);
}

/**
 * Распаковывает строку из UTF16
 */
export async function decompressFromUTF16(input: string): Promise<string | null> {
  const lzString = await getLZString();
  return lzString.decompressFromUTF16(input);
}

/**
 * Сжимает строку в Base64
 */
export async function compressToBase64(input: string): Promise<string> {
  const lzString = await getLZString();
  return lzString.compressToBase64(input);
}

/**
 * Распаковывает строку из Base64
 */
export async function decompressFromBase64(input: string): Promise<string | null> {
  const lzString = await getLZString();
  return lzString.decompressFromBase64(input);
}

/**
 * Сжимает строку в формат, безопасный для URL
 */
export async function compressToEncodedURIComponent(input: string): Promise<string> {
  const lzString = await getLZString();
  return lzString.compressToEncodedURIComponent(input);
}

/**
 * Распаковывает строку из формата, безопасного для URL
 */
export async function decompressFromEncodedURIComponent(input: string): Promise<string | null> {
  const lzString = await getLZString();
  return lzString.decompressFromEncodedURIComponent(input);
}

/**
 * Простое сжатие строки (без особого кодирования)
 */
export async function compress(input: string): Promise<string> {
  const lzString = await getLZString();
  return lzString.compress(input);
}

/**
 * Распаковка сжатой строки
 */
export async function decompress(input: string): Promise<string | null> {
  const lzString = await getLZString();
  return lzString.decompress(input);
}

/**
 * Возвращает все функции библиотеки lz-string
 * Использовать только если нужен прямой доступ ко всем методам
 */
export async function getFullLZString() {
  return getLZString();
} 