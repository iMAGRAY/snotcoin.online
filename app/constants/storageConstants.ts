/**
 * Константы для хранилища (Storage)
 * Содержит пути к изображениям и другие константные значения для модуля хранилища
 */

// Пути к изображениям сундуков
export const CHEST_IMAGES = {
  LEVEL1: '/images/merge/Chests/levels/common.webp',
  LEVEL2: '/images/merge/Chests/levels/uncommon.webp',
  LEVEL3: '/images/merge/Chests/levels/epic.webp',
  LEVEL1_OPEN: '/images/merge/Chests/levels/level1open.webp',
  LEVEL2_OPEN: '/images/merge/Chests/levels/level2open.webp',
  LEVEL3_OPEN: '/images/merge/Chests/levels/level3open.webp',
};

// Массив для использования в компоненте карусели
export const CHEST_IMAGES_ARRAY = [
  CHEST_IMAGES.LEVEL1,
  CHEST_IMAGES.LEVEL2,
  CHEST_IMAGES.LEVEL3,
];

// Константы для хранилища
export const STORAGE_CONSTANTS = {
  // Значения для уровней хранилища
  LEVELS: {
    MIN: 1,
    MAX: 3,
    DEFAULT: 1
  },
  // Параметры размеров хранилища
  CAPACITY: {
    BASE: 1000,
    GROWTH_FACTOR: 2 // Множитель роста при обновлении
  }
}; 