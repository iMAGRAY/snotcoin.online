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
    
    console.log(`Создана fallback текстура для: ${key}`);
  } catch (error) {
    console.error('Ошибка при создании fallback текстуры:', error);
  }
}; 