import * as planck from 'planck';
import { GRAVITY_Y } from '../constants/gameConstants';

/**
 * Инициализирует физический мир planck.js
 * @returns {planck.World} - созданный физический мир
 */
export const initWorld = (): planck.World => {
  return createPhysicsWorld(GRAVITY_Y);
};

/**
 * Функция для создания физического мира и его границ с указанной гравитацией
 * @param {number} gravityY - значение гравитации по оси Y
 * @returns {planck.World} - созданный физический мир
 */
export const createPhysicsWorld = (gravityY: number): planck.World => {
  // Создаем новый физический мир с гравитацией
  const world = planck.World({
    gravity: planck.Vec2(0, gravityY), // Используем значение гравитации без изменений
    allowSleep: false // Отключаем "засыпание" тел для постоянного обновления физики
  });

  return world;
};

/**
 * Проверяет, существует ли мир и очищает все тела в нем перед пересозданием
 * @param {planck.World | null} world - Существующий физический мир
 * @param {number} gravityY - значение гравитации по оси Y
 * @returns {planck.World} - новый или очищенный физический мир
 */
export const resetAndCreateWorld = (world: planck.World | null, gravityY: number): planck.World => {
  // Очищаем текущий мир если он существует
  if (world) {
    let body = world.getBodyList();
    while (body) {
      const next = body.getNext();
      try {
        world.destroyBody(body);
      } catch (e) {
        console.error('Ошибка при удалении тела:', e);
      }
      body = next;
    }
  }
  
  // Создаем новый мир
  return createPhysicsWorld(gravityY);
}; 