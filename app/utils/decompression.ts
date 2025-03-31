/**
 * Утилита для декомпрессии сжатых данных
 */
import { decompress as decompressLZ } from '../libs/compression/lzString';

/**
 * Декомпрессирует строку
 * @param compressedData Сжатая строка данных
 * @returns Декомпрессированная строка
 */
export async function decompress(compressedData: string): Promise<string> {
  try {
    const result = await decompressLZ(compressedData);
    return result || '';
  } catch (error) {
    console.error('[decompression] Ошибка при декомпрессии:', error);
    return '';
  }
} 