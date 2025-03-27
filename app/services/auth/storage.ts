import { AuthError } from './errors';
import { AuthStep } from '@/app/utils/auth-logger';
import { encrypt, decrypt } from '@/app/utils/crypto';

/**
 * Менеджер для безопасного хранения данных авторизации
 */
export class StorageManager {
  private prefix = 'auth_';
  private encryptionKey: string;

  constructor() {
    // В реальном приложении ключ должен быть получен из безопасного источника
    this.encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default_key';
  }

  /**
   * Сохранить данные в хранилище
   */
  set(key: string, value: unknown): void {
    if (typeof window === 'undefined') return;
    try {
      const encrypted = encrypt(JSON.stringify(value), this.encryptionKey);
      localStorage.setItem(this.prefix + key, encrypted);
    } catch (error) {
      throw new AuthError(
        'Ошибка при сохранении данных',
        'STORAGE_ERROR',
        AuthStep.STORAGE_WRITE,
        { key }
      );
    }
  }

  /**
   * Получить данные из хранилища
   */
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const encrypted = localStorage.getItem(this.prefix + key);
      if (!encrypted) return null;
      const decrypted = decrypt(encrypted, this.encryptionKey);
      return JSON.parse(decrypted) as T;
    } catch (error) {
      throw new AuthError(
        'Ошибка при чтении данных',
        'STORAGE_ERROR',
        AuthStep.STORAGE_READ,
        { key }
      );
    }
  }

  /**
   * Удалить данные из хранилища
   */
  remove(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.prefix + key);
  }

  /**
   * Очистить все данные авторизации
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.prefix))
      .forEach(key => localStorage.removeItem(key));
  }
} 