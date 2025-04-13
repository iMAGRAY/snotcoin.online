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
  private bodies: { [key: string]: GameBody };
  
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
    bodies: { [key: string]: GameBody }
  ) {
    this.scene = scene;
    this.ballFactory = ballFactory;
    this.physicsManager = physicsManager;
    this.effectsManager = effectsManager;
    this.bodies = bodies;
  }

  /**
   * Планирование слияния шаров
   * @param idA ID первого шара
   * @param idB ID второго шара
   * @returns true, если слияние запланировано
   */
  public scheduleMerge(idA: string, idB: string): boolean {
    const bodyA = this.bodies[idA];
    const bodyB = this.bodies[idB];
    
    if (!bodyA || !bodyB) return false;
    
    const levelA = bodyA.sprite.getData('level');
    const levelB = bodyB.sprite.getData('level');
    
    // Объединяем только шары одинакового уровня И не 12 уровня
    if (levelA === levelB && levelA < gameUtils.GAME_CONFIG.MAX_LEVEL) {
      // Получаем позиции шаров
      const positionA = bodyA.body.getPosition();
      const positionB = bodyB.body.getPosition();
      
      // Добавляем слияние в очередь для обработки
      this.pendingMerges.push({
        idA,
        idB,
        levelA,
        positionA,
        positionB
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Обработка отложенных слияний шаров
   * @param increaseScoreCallback Функция для увеличения счета
   * @returns Успешно выполненные слияния
   */
  public processPendingMerges(increaseScoreCallback: (points: number) => void): number {
    if (this.pendingMerges.length === 0) return 0;
    
    let processedMerges = 0;
    
    // Обрабатываем каждое слияние
    this.pendingMerges.forEach(merge => {
      // Проверяем, что оба шара все еще существуют
      if (this.bodies[merge.idA] && this.bodies[merge.idB]) {
        // Проверяем, что уровень шара не превысит максимальный после слияния
        const newLevel = merge.levelA + 1;
        if (newLevel <= gameUtils.GAME_CONFIG.MAX_LEVEL) {
          // Вычисляем среднюю позицию для нового шара
          const newX = (merge.positionA.x + merge.positionB.x) / 2;
          const newY = (merge.positionA.y + merge.positionB.y) / 2;
          
          // Добавляем эффект слияния
          const effectX = newX * SCALE;
          const effectY = newY * SCALE;
          this.effectsManager.addMergeEffect(effectX, effectY, newLevel);
          
          // Удаляем оба шара, участвующих в слиянии
          this.physicsManager.removeBody(merge.idA);
          this.physicsManager.removeBody(merge.idB);
          
          // Создаем новый шар более высокого уровня на месте слияния
          this.ballFactory.createMergedBall(newX, newY, newLevel);
          
          // Увеличиваем счет в зависимости от уровня созданного шара
          // Чем выше уровень, тем больше очков
          increaseScoreCallback(newLevel * 10);
          
          processedMerges++;
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
} 