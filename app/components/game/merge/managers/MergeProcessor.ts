"use client"

import * as Phaser from 'phaser';
import * as planck from 'planck';
import { GameBody, SCALE } from '../utils/types';
import { BallFactory } from '../core/BallFactory';
import { PhysicsManager } from '../physics/PhysicsManager';
import { EffectsManager } from '../effects/EffectsManager';
import * as gameUtils from '../utils/utils';

export class MergeProcessor {
  private scene: Phaser.Scene;
  private ballFactory: BallFactory;
  private physicsManager: PhysicsManager;
  private effectsManager: EffectsManager;
  
  private pendingMerges: { 
    idA: string, 
    idB: string, 
    levelA: number, 
    positionA: planck.Vec2, 
    positionB: planck.Vec2 
  }[] = [];

  constructor(
    scene: Phaser.Scene, 
    ballFactory: BallFactory,
    physicsManager: PhysicsManager,
    effectsManager: EffectsManager,
  ) {
    this.scene = scene;
    this.ballFactory = ballFactory;
    this.physicsManager = physicsManager;
    this.effectsManager = effectsManager;
  }

  /**
   * Получает актуальный список тел из PhysicsManager
   */
  private getActualBodies(): { [key: string]: GameBody } {
    return this.physicsManager.getBodies();
  }

  /**
   * Планирование слияния шаров
   * @param idA ID первого шара
   * @param idB ID второго шара
   * @returns true, если слияние запланировано
   */
  public scheduleMerge(idA: string, idB: string): boolean {
    // Используем актуальный список тел
    const bodies = this.getActualBodies();
    
    const bodyA = bodies[idA];
    const bodyB = bodies[idB];
    
    if (!bodyA || !bodyB) {
      console.error(`Невозможно запланировать слияние: тело ${!bodyA ? idA : idB} не найдено`);
      return false;
    }
    
    // Проверяем сначала userData
    let levelA = -1;
    let levelB = -1;
    
    // Получаем данные из userData тела
    const userDataA = bodyA.body.getUserData() as any;
    const userDataB = bodyB.body.getUserData() as any;
    
    if (userDataA && userDataA.level !== undefined) {
      levelA = userDataA.level;
    }
    
    if (userDataB && userDataB.level !== undefined) {
      levelB = userDataB.level;
    }
    
    // Если не удалось получить уровни из userData, пробуем из данных спрайта
    if (levelA === -1 && bodyA.sprite) {
      levelA = bodyA.sprite.getData('level');
    }
    
    if (levelB === -1 && bodyB.sprite) {
      levelB = bodyB.sprite.getData('level');
    }
    
    // Проверяем, что уровни определены
    if (levelA === undefined || levelB === undefined || levelA === -1 || levelB === -1) {
      console.error(`Невозможно определить уровни шаров`);
      return false;
    }
    
    // Объединяем только шары одинакового уровня И не 12 уровня
    if (levelA === levelB && levelA < gameUtils.GAME_CONFIG.MAX_LEVEL) {
      // Получаем позиции шаров
      const positionA = bodyA.body.getPosition();
      const positionB = bodyB.body.getPosition();
      
      // Немедленно создаем слияние для гарантированного объединения
      this.processMerge(idA, idB, levelA, positionA, positionB);
      
      return true;
    }
    
    return false;
  }

  /**
   * Непосредственная обработка слияния двух шаров
   */
  private processMerge(idA: string, idB: string, level: number, positionA: planck.Vec2, positionB: planck.Vec2): void {
    const newLevel = level + 1;
    
    if (newLevel <= gameUtils.GAME_CONFIG.MAX_LEVEL) {
      // Получаем актуальный список тел
      const bodies = this.getActualBodies();
      
      // Проверяем, что оба шара все еще существуют
      if (bodies[idA] && bodies[idB]) {
        // Вычисляем среднюю позицию для нового шара
        const newX = (positionA.x + positionB.x) / 2;
        const newY = (positionA.y + positionB.y) / 2;
        
        // Сохраняем информацию для создания нового шара
        const mergeInfo = { x: newX, y: newY, level: newLevel };
        
        try {
          // Добавляем эффект слияния
          const effectX = newX * SCALE;
          const effectY = newY * SCALE;
          this.effectsManager.addMergeEffect(effectX, effectY, newLevel);
          
          // Удаляем оба шара, участвующих в слиянии
          this.physicsManager.removeBody(idA);
          this.physicsManager.removeBody(idB);
          
          // Моментально создаем новый шар более высокого уровня на месте слияния
          this.ballFactory.createMergedBall(mergeInfo.x, mergeInfo.y, mergeInfo.level);
        } catch (error) {
          console.error('Ошибка при обработке слияния шаров:', error);
        }
      }
    }
  }

  /**
   * Обработка отложенных слияний шаров
   * @param increaseScoreCallback Функция для увеличения счета
   * @returns Успешно выполненные слияния
   */
  public processPendingMerges(increaseScoreCallback: (points: number) => void): number {
    if (this.pendingMerges.length === 0) return 0;
    
    let processedMerges = 0;
    
    // Получаем актуальный список тел
    const bodies = this.getActualBodies();
    
    // Обрабатываем каждое слияние
    this.pendingMerges.forEach(merge => {
      // Проверяем, что оба шара все еще существуют
      if (bodies[merge.idA] && bodies[merge.idB]) {
        // Проверяем, что уровень шара не превысит максимальный после слияния
        const newLevel = merge.levelA + 1;
        if (newLevel <= gameUtils.GAME_CONFIG.MAX_LEVEL) {
          // Вычисляем среднюю позицию для нового шара
          const newX = (merge.positionA.x + merge.positionB.x) / 2;
          const newY = (merge.positionA.y + merge.positionB.y) / 2;
          
          // Сохраняем информацию для создания нового шара
          const mergeInfo = { x: newX, y: newY, level: newLevel };
          
          try {
            // Добавляем эффект слияния
            const effectX = newX * SCALE;
            const effectY = newY * SCALE;
            this.effectsManager.addMergeEffect(effectX, effectY, newLevel);

            // Удаляем оба шара, участвующих в слиянии
            this.physicsManager.removeBody(merge.idA);
            this.physicsManager.removeBody(merge.idB);
            
            // Увеличиваем счет в зависимости от уровня созданного шара
            // Чем выше уровень, тем больше очков
            increaseScoreCallback(newLevel * 10);
            
            // Моментально создаем новый шар более высокого уровня на месте слияния
            this.ballFactory.createMergedBall(mergeInfo.x, mergeInfo.y, mergeInfo.level);
            
            processedMerges++;
          } catch (error) {
            console.error('Ошибка при обработке отложенного слияния:', error);
          }
        }
      }
    });
    
    // Очищаем очередь слияний
    this.pendingMerges = [];
    
    return processedMerges;
  }

  /**
   * Проверка, есть ли ожидающие слияния
   */
  public hasPendingMerges(): boolean {
    return this.pendingMerges.length > 0;
  }

  /**
   * Сброс состояния менеджера
   */
  public reset(): void {
    // Очищаем очередь слияний
    this.pendingMerges = [];
  }

  /**
   * Выполнение слияния двух шаров
   * @param idA ID первого шара
   * @param idB ID второго шара
   * @param level Новый уровень для результирующего шара
   * @param newX Позиция X для нового шара
   * @param newY Позиция Y для нового шара
   * @param increaseScoreCallback Функция для увеличения счета
   * @returns Успешно ли выполнено слияние
   */
  private performMerge(
    idA: number,
    idB: number,
    level: number,
    newX: number,
    newY: number,
    increaseScoreCallback: (points: number) => void
  ): boolean {
    try {
      const bodies = this.getActualBodies();
      
      // Проверяем, что оба шара существуют
      if (!bodies[idA] || !bodies[idB]) {
        console.error(`Ошибка при слиянии: один из шаров не найден (A: ${idA}, B: ${idB})`);
        return false;
      }

      // Получаем объекты шаров
      const ballA = bodies[idA].gameObject as Ball;
      const ballB = bodies[idB].gameObject as Ball;

      // ... existing code ...

      return true;
    } catch (error) {
      console.error(`Ошибка при выполнении слияния:`, error);
      return false;
    }
  }
} 