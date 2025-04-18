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
  
  // Комбо-система
  private comboCount: number = 0;
  private comboMultiplier: number = 1;
  private lastMergeTime: number = 0;
  private comboTimeWindow: number = 2000; // 2 секунды для продолжения комбо
  private comboTimer: Phaser.Time.TimerEvent | null = null;
  private maxComboMultiplier: number = 8; // Максимальный множитель комбо
  
  // Система блокировки для предотвращения дублирования слияний
  private processingBalls: Set<string> = new Set();
  private mergeInProgress: boolean = false;
  private processingTimeout: number = 0; // Время блокировки шара в мс
  private lastErrorTime: number = 0; // Время последней ошибки слияния
  private errorResetTimeout: number = 0; // Таймаут сброса блокировки после ошибки

  // Добавляем новый список для хранения недавних слияний
  private recentMerges: Set<string> = new Set();
  private recentMergesTimeout: number = 0; // Убираем задержку для недавних слияний
  private contactQueue: Array<{idA: string, idB: string, time: number}> = [];
  private maxQueueSize: number = 50; // Увеличиваем размер очереди
  private queueProcessInterval: number = 0; // Убираем задержку обработки очереди

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

    // Запускаем обработчик очереди контактов
    this.scene.time.addEvent({
      delay: 1, // Минимальная задержка
      callback: this.processContactQueue,
      callbackScope: this,
      loop: true
    });
  }

  /**
   * Получает актуальный список тел из PhysicsManager
   */
  private getActualBodies(): { [key: string]: GameBody } {
    return this.physicsManager.getBodies();
  }

  private processContactQueue(): void {
    const currentTime = Date.now();
    
    // Обрабатываем все контакты в очереди
    while (this.contactQueue.length > 0) {
      const contact = this.contactQueue.shift();
      if (!contact) continue;

      // Пробуем выполнить слияние немедленно
      this.scheduleMerge(contact.idA, contact.idB);
    }
  }

  /**
   * Планирование слияния шаров
   * @param idA ID первого шара
   * @param idB ID второго шара
   * @returns true, если слияние запланировано
   */
  public scheduleMerge(idA: string, idB: string): boolean {
    try {
      const mergeKey = [idA, idB].sort().join('-');
      
      // Проверяем только базовые условия
      if (this.recentMerges.has(mergeKey)) {
        return false;
      }

      // Получаем актуальные тела
      const bodies = this.getActualBodies();
      const bodyA = bodies[idA];
      const bodyB = bodies[idB];

      // Проверяем существование тел и их активность
      if (!bodyA || !bodyB || !bodyA.body || !bodyB.body) {
        return false;
      }

      // Проверяем уровни шаров
      const levelA = bodyA.sprite?.getData('level');
      const levelB = bodyB.sprite?.getData('level');

      if (levelA === undefined || levelB === undefined || levelA !== levelB) {
        return false;
      }

      // Устанавливаем флаги обработки
      this.mergeInProgress = true;
      this.recentMerges.add(mergeKey);

      // Обрабатываем слияние немедленно
      this.processMerge(idA, idB, levelA, bodyA.body.getPosition(), bodyB.body.getPosition());

      // Сбрасываем флаги после обработки
      setTimeout(() => {
        this.mergeInProgress = false;
        this.recentMerges.delete(mergeKey);
      }, 0);

      return true;
    } catch (error) {
      console.error('Ошибка при слиянии шаров:', error);
      this.mergeInProgress = false;
      return false;
    }
  }

  /**
   * Обновление комбо-системы при объединении шаров
   */
  private updateCombo(): void {
    const currentTime = Date.now();
    
    // Проверяем, находимся ли мы в окне комбо
    if (currentTime - this.lastMergeTime < this.comboTimeWindow) {
      // Увеличиваем счетчик комбо
      this.comboCount++;
      
      // Обновляем множитель комбо (увеличивается на 0.5 каждые 2 объединения)
      // Минимум 1x, максимум 8x
      this.comboMultiplier = Math.min(
        this.maxComboMultiplier, 
        1 + Math.floor(this.comboCount / 2) * 0.5
      );
      
      // Отменяем предыдущий таймер, если он существует
      if (this.comboTimer) {
        this.comboTimer.remove();
      }
    } else {
      // Начинаем новое комбо
      this.comboCount = 1;
      this.comboMultiplier = 1;
    }
    
    // Обновляем время последнего слияния
    this.lastMergeTime = currentTime;
    
    // Устанавливаем таймер для сброса комбо
    this.comboTimer = this.scene.time.delayedCall(
      this.comboTimeWindow, 
      this.resetCombo, 
      [], 
      this
    );
    
    // Всегда отображаем информацию о комбо, даже если множитель равен 1
    // Параметры x и y игнорируются - комбо будет отображаться у правой стены
    this.effectsManager.showComboMultiplier(
      0, 0, // Эти значения игнорируются, позиция задается в методе showComboMultiplier
      this.comboMultiplier,
      this.comboCount
    );
    
    // Отображаем бонус за комбо под счетом, если сцена содержит ScoreManager
    if (this.scene && (this.scene as any).scoreManager && 
        (this.scene as any).scoreManager.showComboBonus) {
      (this.scene as any).scoreManager.showComboBonus(this.comboMultiplier);
    }
    
    // Логируем информацию о комбо для отладки
    const exampleLevel = 5; // Средний уровень шара
    const basePoints = exampleLevel * 10;
    const comboPoints = Math.floor(basePoints * this.comboMultiplier);
    const comboBonus = comboPoints - basePoints;
    console.log(`Комбо x${this.comboMultiplier.toFixed(1)} (${this.comboCount} слияний, +${comboBonus} очков за средний шар уровня ${exampleLevel})`);
  }
  
  /**
   * Сброс комбо-множителя
   */
  private resetCombo(): void {
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = null;
    
    // Обновляем визуальное отображение сброшенного комбо
    this.effectsManager.showComboMultiplier(0, 0, this.comboMultiplier, this.comboCount);
    
    // Сбрасываем бонус за комбо в ScoreManager, если он доступен
    if (this.scene && (this.scene as any).scoreManager && 
        (this.scene as any).scoreManager.resetComboBonus) {
      (this.scene as any).scoreManager.resetComboBonus();
    }
  }

  /**
   * Непосредственная обработка слияния двух шаров
   */
  private processMerge(idA: string, idB: string, level: number, positionA: planck.Vec2, positionB: planck.Vec2): void {
    try {
      const newLevel = level + 1;
      
      if (newLevel <= gameUtils.GAME_CONFIG.MAX_LEVEL) {
        // Получаем актуальный список тел
        const bodies = this.getActualBodies();
        
        // Быстрая проверка существования шаров
        const bodyA = bodies[idA];
        const bodyB = bodies[idB];
        
        if (!bodyA?.body || !bodyA?.sprite || !bodyB?.body || !bodyB?.sprite) {
          return;
        }
        
        // Вычисляем среднюю позицию для нового шара
        const newX = (positionA.x + positionB.x) / 2;
        const newY = (positionA.y + positionB.y) / 2;
        
        // Сохраняем информацию для создания нового шара
        const mergeInfo = { x: newX, y: newY, level: newLevel };
        
        // Добавляем эффект слияния с ограничением количества частиц при большом числе шаров
        const effectX = newX * SCALE;
        const effectY = newY * SCALE;
        
        // Определяем количество шаров для оптимизации эффектов
        const bodyCount = Object.keys(bodies).length;
        const isHighLoad = bodyCount > 20;
        
        // Уменьшаем количество эффектов при большой нагрузке
        if (!isHighLoad) {
          this.effectsManager.addMergeEffect(effectX, effectY);
        } else {
          this.effectsManager.addSimpleMergeEffect(effectX, effectY);
        }
        
        // Звуковой эффект слияния
        if (typeof this.scene.sound !== 'undefined' && this.scene.sound.play) {
          try {
            // Воспроизводим звук только если не слишком много слияний
            if (!isHighLoad || Math.random() < 0.5) { // 50% шанс воспроизведения при высокой нагрузке
              this.scene.sound.play('coinMergeSound', { volume: 0.5 });
            }
          } catch (e) {
            console.warn('Не удалось воспроизвести звук слияния');
          }
        }
        
        // Пытаемся пометить оба шара на удаление
        let bodiesMarkedForDeletion = false;
        try {
          // Помечаем шары на удаление
          this.markBallsForDeletion(idA, idB);
          bodiesMarkedForDeletion = true;
          
          // Увеличиваем счет игрока, вычисляя очки на основе уровня
          this.updateComboAndScore(level, (points) => {
            try {
              if (typeof this.scene.registry !== 'undefined') {
                // Увеличиваем счет
                const currentScore = this.scene.registry.get('gameScore') || 0;
                this.scene.registry.set('gameScore', currentScore + points);
              }
              
              // Вызываем колбэк для увеличения счета
              const sceneAny = this.scene as any;
              if (sceneAny.increaseScore) {
                sceneAny.increaseScore(points);
              }
              
              // Показываем очки
              this.effectsManager.showScorePoints(effectX, effectY, points, this.comboMultiplier > 1);
            } catch (error) {
              console.warn('Ошибка при обновлении счета:', error);
            }
          });
        } catch (error) {
          console.error('Ошибка при обработке слияния шаров:', error);
        }
        
        // Если пометка прошла успешно, создаем новый шар
        if (bodiesMarkedForDeletion) {
          // Используем requestAnimationFrame вместо setTimeout для лучшей производительности
          const createBall = () => {
            try {
              this.ballFactory.createMergedBall(mergeInfo.x, mergeInfo.y, mergeInfo.level);
            } catch (error) {
              console.error('Ошибка при создании нового шара после слияния:', error);
            }
          };
          
          // Планируем создание шара в следующем кадре
          if (typeof window !== 'undefined' && window.requestAnimationFrame) {
            window.requestAnimationFrame(createBall);
          } else {
            setTimeout(createBall, 0);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке слияния шаров:', error);
    }
  }

  /**
   * Обработка отложенных слияний шаров
   * @param increaseScoreCallback Функция для увеличения счета
   * @returns Успешно выполненные слияния
   */
  public processPendingMerges(increaseScoreCallback: (points: number) => void): number {
    // Все слияния уже обработаны мгновенно в scheduleMerge
    return 0;
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
    
    // Сбрасываем комбо-систему
    this.resetCombo();
    this.lastMergeTime = 0;
    
    // Отменяем таймер комбо, если он существует
    if (this.comboTimer) {
      this.comboTimer.remove();
      this.comboTimer = null;
    }
    
    // Сбрасываем систему блокировки
    this.processingBalls.clear();
    this.recentMerges.clear(); // Очищаем список недавних слияний
    this.mergeInProgress = false;
    this.lastErrorTime = 0;
  }

  /**
   * Помечает шары на удаление после слияния
   */
  private markBallsForDeletion(idA: string, idB: string): void {
    if (typeof (this.scene as any).markBodyForDeletion === 'function') {
      const currentBodies = this.getActualBodies();
      
      if (currentBodies[idA]) {
        (this.scene as any).markBodyForDeletion(idA);
      }
      
      if (currentBodies[idB]) {
        (this.scene as any).markBodyForDeletion(idB);
      }
    }
  }
  
  /**
   * Обновляет комбо и рассчитывает очки
   */
  private updateComboAndScore(level: number, callback: (points: number) => void): void {
    // Обновляем комбо-систему
    this.updateCombo();
    
    // Рассчитываем очки с учетом комбо-множителя
    const basePoints = level * 10;
    const comboPoints = Math.floor(basePoints * this.comboMultiplier);
    
    // Вызываем колбэк с очками
    callback(comboPoints);
  }
  
  /**
   * Упрощенный эффект слияния (добавить в EffectsManager)
   */
  private addSimpleMergeEffect(x: number, y: number): void {
    // Проверяем, доступен ли метод в EffectsManager
    if (typeof this.effectsManager.addSimpleMergeEffect === 'function') {
      this.effectsManager.addSimpleMergeEffect(x, y);
    } else {
      // Если метод недоступен, используем стандартный эффект
      this.effectsManager.addMergeEffect(x, y);
    }
  }
} 