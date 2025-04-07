/**
 * Экспорт всех адаптеров хранилищ для системы сохранений
 */
import { StorageAdapter } from '../types';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { MemoryAdapter } from './MemoryAdapter';
import { SessionStorageAdapter } from './SessionStorageAdapter';
import { IndexedDBAdapter } from './IndexedDBAdapter';
// import { ServerAdapter } from './ServerAdapter'; // Будет добавлен позже

// Создаем экземпляры всех адаптеров
const memoryAdapter = new MemoryAdapter();
const localStorageAdapter = new LocalStorageAdapter();
const sessionStorageAdapter = new SessionStorageAdapter();
const indexedDBAdapter = new IndexedDBAdapter();
// const serverAdapter = new ServerAdapter(); // Будет добавлен позже

// Экспортируем массив всех доступных адаптеров
export const adapters: StorageAdapter[] = [
  memoryAdapter,
  localStorageAdapter,
  sessionStorageAdapter,
  indexedDBAdapter,
  // serverAdapter // Будет добавлен позже
];

// Экспортируем отдельные адаптеры для прямого доступа
export {
  memoryAdapter,
  localStorageAdapter,
  sessionStorageAdapter,
  indexedDBAdapter,
  // serverAdapter // Будет добавлен позже
}; 