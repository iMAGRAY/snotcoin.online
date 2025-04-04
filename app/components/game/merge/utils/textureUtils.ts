'use client'

import { BALL_COLORS, BULL_COLOR, BOMB_COLOR } from '../constants/gameConstants';

/**
 * Генерирует цветную текстуру-заглушку при ошибке загрузки оригинальной текстуры
 * @param scene Сцена Phaser
 * @param key Ключ текстуры (уровень шара или строковый идентификатор)
 */
export const generateColorTexture = (scene: any, key: number | string) => {
  try {
    const size = 128; // Размер текстуры
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    let color = 0xffffff; // Цвет по умолчанию - белый
    let textureKey = "fallback";
    
    if (typeof key === 'string') {
      // Для строковых ключей
      textureKey = key;
      if (key === 'bull') {
        color = BULL_COLOR; // Используем константу для Bull
      } else if (key === 'bomb') {
        color = BOMB_COLOR; // Используем константу для Bomb
      } else if (key === 'particle') {
        color = 0xffff00; // Желтый для частиц
      }
    } else if (typeof key === 'number') {
      // Для числовых ключей
      textureKey = key.toString();
      
      // Проверяем, что массив цветов существует и не пуст
      if (BALL_COLORS && BALL_COLORS.length > 0) {
        // Определяем индекс цвета, гарантируя, что он находится в пределах массива
        let index = 0; // По умолчанию используем первый цвет
        
        // Безопасно определяем значение уровня
        const safeLevel: number = key || 1;
        
        // Определяем индекс с защитой от выхода за границы массива
        if (safeLevel > 0 && safeLevel <= BALL_COLORS.length) {
          index = safeLevel - 1;
        } else if (safeLevel > BALL_COLORS.length) {
          index = BALL_COLORS.length - 1;
        }
        
        // Устанавливаем цвет
        const ballColor = BALL_COLORS[index];
        if (ballColor !== undefined) {
          color = ballColor;
        }
      }
    }
    
    // Создаем круглую текстуру с нужным цветом
    graphics.fillStyle(color, 1);
    graphics.fillCircle(size / 2, size / 2, size / 2);
    
    // Для числовых ключей добавляем контур
    if (typeof key === 'number') {
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.strokeCircle(size / 2, size / 2, size / 2 - 1);
    }
    
    // Создаем текстуру из графики
    graphics.generateTexture(textureKey, size, size);
    
    // Уничтожаем графику после создания текстуры
    graphics.destroy();
    
    // Текстура создана успешно
  } catch (error) {
    // Ошибка при создании fallback текстуры
  }
};

/**
 * Создает запасную текстуру для шара, если основная не загрузилась
 * @param scene Сцена Phaser
 * @param key Ключ текстуры
 * @param size Размер текстуры
 */
export const createFallbackBallTexture = (scene: Phaser.Scene, key: string, size: number = 100): void => {
  try {
    const graphics = scene.add.graphics();
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(size / 2, size / 2, size / 2);
    graphics.lineStyle(2, 0x000000, 1);
    graphics.strokeCircle(size / 2, size / 2, size / 2);
    const textureKey = `fallback_${key}`;
    graphics.generateTexture(textureKey, size, size);
    
    // Создана fallback текстура
    
    graphics.destroy();
  } catch (error) {
    // Ошибка при создании fallback текстуры
  }
};

/**
 * Создает запасную текстуру для шара с определенным уровнем
 * @param scene Сцена Phaser
 * @param level Уровень шара
 * @param radius Радиус текстуры
 * @param textureName Имя создаваемой текстуры
 */
export const createFallbackTexture = (
  scene: Phaser.Scene,
  level: number,
  radius: number,
  textureName: string
): void => {
  try {
    // Создаем простую цветную текстуру с номером уровня внутри
    // Рассчитываем цвет шара на основе его уровня
    
    // Палитра цветов для разных уровней (можно расширить по необходимости)
    const colors = [
      0xff0000, // красный
      0xff7f00, // оранжевый
      0xffff00, // желтый
      0x00ff00, // зеленый
      0x0000ff, // синий
      0x4b0082, // индиго
      0x9400d3, // фиолетовый
      0xff00ff, // розовый
      0x00ffff, // голубой
      0xffd700, // золотой
      0xc0c0c0, // серебряный
    ];
    
    // Выбираем цвет из палитры или используем случайный цвет для высоких уровней
    const color = colors[level % colors.length] || Math.random() * 0xffffff;
    
    // Создаем графический объект для рисования текстуры
    const graphics = scene.add.graphics();
    
    // Рисуем круг с заливкой выбранным цветом
    graphics.fillStyle(color, 1);
    graphics.fillCircle(radius, radius, radius);
    
    // Добавляем обводку
    graphics.lineStyle(2, 0x000000, 1);
    graphics.strokeCircle(radius, radius, radius);
    
    // Создаем текстуру из нарисованного графического объекта
    graphics.generateTexture(textureName, radius * 2, radius * 2);
    
    // Убираем графический объект, так как он больше не нужен
    graphics.destroy();
    
    // Запасная текстура успешно создана
  } catch (error) {
    // Ошибка при создании запасной текстуры
  }
}; 