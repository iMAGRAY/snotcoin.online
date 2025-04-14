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
  private processingTimeout: number = 200; // Время блокировки шара в мс
  private lastErrorTime: number = 0; // Время последней ошибки слияния
  private errorResetTimeout: number = 500; // Таймаут сброса блокировки после ошибки

  // Добавляем новый список для хранения недавних слияний
  private recentMerges: Set<string> = new Set();

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
    try {
      const currentTime = Date.now();
      
      // Создаем уникальный ключ слияния, сортируя ID для предотвращения дублирования
      const mergeKey = [idA, idB].sort().join('-');
      
      // Проверка на недавно обработанные слияния
      if (this.recentMerges.has(mergeKey)) {
        // console.log(`Пропуск слияния: недавно обработано (${mergeKey})`);
        return false;
      }
      
      // Автоматически сбрасываем блокировку, если прошло слишком много времени после ошибки
      if (this.mergeInProgress && currentTime - this.lastErrorTime > this.errorResetTimeout) {
        console.log('Сброс блокировки слияния из-за таймаута после ошибки');
        this.mergeInProgress = false;
        this.processingBalls.clear();
      }
      
      // Проверяем, не находятся ли шары уже в процессе обработки
      if (this.processingBalls.has(idA) || this.processingBalls.has(idB)) {
        // Сокращаем логирование, чтобы не переполнять консоль
        // console.log(`Пропуск слияния: шар ${this.processingBalls.has(idA) ? idA : idB} уже в процессе объединения`);
        return false;
      }
      
      // Проверяем, не идет ли уже слияние
      if (this.mergeInProgress) {
        // console.log('Пропуск слияния: другое слияние уже в процессе');
        
        // Если слияние заблокировано слишком долго, сбрасываем блокировку
        if (currentTime - this.lastMergeTime > 1000) { // 1 секунда максимальной блокировки
          console.log('Форсированный сброс блокировки слияния из-за длительного ожидания');
          this.mergeInProgress = false;
          this.processingBalls.clear();
        } else {
          return false;
        }
      }
      
      // Устанавливаем флаг, что слияние в процессе
      this.mergeInProgress = true;
      this.lastMergeTime = currentTime;
      
      // Добавляем в список недавних слияний
      this.recentMerges.add(mergeKey);
      
      // Устанавливаем таймер для удаления из списка недавних слияний
      setTimeout(() => {
        this.recentMerges.delete(mergeKey);
      }, 500); // Хранить 500 мс
      
      // Используем актуальный список тел
      const bodies = this.getActualBodies();
      
      const bodyA = bodies[idA];
      const bodyB = bodies[idB];
      
      if (!bodyA || !bodyB) {
        console.error(`Невозможно запланировать слияние: тело ${!bodyA ? idA : idB} не найдено`);
        this.mergeInProgress = false;
        return false;
      }
      
      // Проверяем, не были ли уже удалены эти шары
      if (!bodyA.body || !bodyB.body) {
        console.warn(`Тела шаров уже удалены: ${!bodyA.body ? idA : ''} ${!bodyB.body ? idB : ''}`);
        this.mergeInProgress = false;
        return false;
      }
      
      // Проверяем, что спрайты существуют
      if (!bodyA.sprite || !bodyB.sprite) {
        console.warn(`Спрайты шаров уже удалены: ${!bodyA.sprite ? idA : ''} ${!bodyB.sprite ? idB : ''}`);
        this.mergeInProgress = false;
        return false;
      }
      
      // Проверяем сначала userData
      let levelA = -1;
      let levelB = -1;
      
      // Получаем данные из userData тела
      const userDataA = bodyA.body.getUserData() as any;
      const userDataB = bodyB.body.getUserData() as any;
      
      if (!userDataA || !userDataB) {
        console.warn(`Отсутствуют userData у одного из шаров: ${!userDataA ? idA : ''} ${!userDataB ? idB : ''}`);
        this.mergeInProgress = false;
        return false;
      }
      
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
        console.error(`Невозможно определить уровни шаров: A=${levelA}, B=${levelB}`);
        this.mergeInProgress = false;
        return false;
      }
      
      // Проверяем, что шары одного типа (обычные шары, не специальные)
      if (userDataA.type !== 'ball' || userDataB.type !== 'ball') {
        console.log(`Шары разных типов, пропускаем слияние: A=${userDataA.type}, B=${userDataB.type}`);
        this.mergeInProgress = false;
        return false;
      }
      
      // Логируем отладочную информацию для диагностики
      // console.log(`Запрос на объединение шаров: ${idA}(${levelA}) и ${idB}(${levelB})`);
      
      // Объединяем только шары одинакового уровня И не 12 уровня
      if (levelA === levelB && levelA < gameUtils.GAME_CONFIG.MAX_LEVEL) {
        // Добавляем оба шара в список обрабатываемых, чтобы предотвратить дубликаты
        this.processingBalls.add(idA);
        this.processingBalls.add(idB);
        
        // Получаем позиции шаров
        const positionA = bodyA.body.getPosition();
        const positionB = bodyB.body.getPosition();
        
        // Обновляем комбо-систему
        this.updateCombo();
        
        try {
          // Немедленно создаем слияние для гарантированного объединения
          this.processMerge(idA, idB, levelA, positionA, positionB);
          
          // Увеличиваем счет в зависимости от уровня созданного шара и комбо-множителя
          // Чем выше уровень и комбо, тем больше очков
          const newLevel = levelA + 1;
          const basePoints = newLevel * 10;
          const comboPoints = Math.floor(basePoints * this.comboMultiplier);
          
          if (this.scene && (this.scene as any).increaseScore) {
            (this.scene as any).increaseScore(comboPoints, this.comboMultiplier > 1);
          }
          
          // console.log(`Успешное объединение шаров: ${idA} и ${idB}, новый уровень: ${newLevel}`);
          
          // Снимаем блокировку слияния после задержки
          setTimeout(() => {
            this.mergeInProgress = false;
            
            // Очищаем список обрабатываемых шаров после таймаута
            setTimeout(() => {
              this.processingBalls.delete(idA);
              this.processingBalls.delete(idB);
            }, this.processingTimeout);
          }, 50);
          
          return true;
        } catch (mergeError) {
          console.error('Ошибка при выполнении слияния шаров:', mergeError);
          // Сбрасываем блокировку и статус обработки при ошибке
          this.lastErrorTime = Date.now();
          setTimeout(() => {
            this.mergeInProgress = false;
            this.processingBalls.delete(idA);
            this.processingBalls.delete(idB);
          }, 100);
          return false;
        }
      } else {
        // console.log(`Шары не могут быть объединены: разные уровни или максимальный уровень: A=${levelA}, B=${levelB}`);
        this.mergeInProgress = false;
        return false;
      }
    } catch (error) {
      console.error(`Ошибка при планировании объединения шаров ${idA} и ${idB}:`, error);
      this.lastErrorTime = Date.now();
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
        
        // Проверяем, что оба шара все еще существуют
        if (!bodies[idA] || !bodies[idB]) {
          console.warn(`Один из шаров для объединения не существует: ${!bodies[idA] ? idA : ''} ${!bodies[idB] ? idB : ''}`);
          return;
        }
        
        // Проверяем, что оба тела все еще активны
        if (!bodies[idA].body || !bodies[idB].body) {
          console.warn(`Тело одного из шаров уже удалено: ${!bodies[idA].body ? idA : ''} ${!bodies[idB].body ? idB : ''}`);
          return;
        }
        
        // Проверяем, что спрайты существуют
        if (!bodies[idA].sprite || !bodies[idB].sprite) {
          console.warn(`Спрайт одного из шаров уже удален: ${!bodies[idA].sprite ? idA : ''} ${!bodies[idB].sprite ? idB : ''}`);
          return;
        }
        
        // Вычисляем среднюю позицию для нового шара
        const newX = (positionA.x + positionB.x) / 2;
        const newY = (positionA.y + positionB.y) / 2;
        
        // Сохраняем информацию для создания нового шара
        const mergeInfo = { x: newX, y: newY, level: newLevel };
        
        // Добавляем эффект слияния (если он нужен)
        const effectX = newX * SCALE;
        const effectY = newY * SCALE;
        this.effectsManager.addMergeEffect(effectX, effectY);
        
        // Показываем полученные очки с учетом комбо-множителя
        const basePoints = newLevel * 10;
        const comboPoints = Math.floor(basePoints * this.comboMultiplier);
        this.effectsManager.showScorePoints(effectX, effectY, comboPoints, this.comboMultiplier > 1);
        
        // Отложим создание нового шара с более длительной задержкой для стабильности
        let bodiesMarkedForDeletion = false;
        
        const markExistingBodiesForDeletion = () => {
          try {
            // Проверка, что тела все ещё существуют перед пометкой на удаление
            const currentBodies = this.getActualBodies();
            
            // Проверяем, что в сцене есть метод для отложенного удаления
            if (typeof (this.scene as any).markBodyForDeletion === 'function') {
              // Помечаем тела для отложенного удаления через сцену
              if (currentBodies[idA]) {
                (this.scene as any).markBodyForDeletion(idA);
                bodiesMarkedForDeletion = true;
              }
              
              if (currentBodies[idB]) {
                (this.scene as any).markBodyForDeletion(idB);
                bodiesMarkedForDeletion = true;
              }
              
              console.log(`Тела ${idA} и ${idB} помечены для отложенного удаления через сцену`);
            } else {
              // Запасной вариант: удаляем тела напрямую
              console.warn('Метод markBodyForDeletion не найден в сцене, используем прямое удаление');
              
              if (currentBodies[idA]) {
                // Сначала помечаем, что удаляем, чтобы избежать повторных слияний
                if (currentBodies[idA].body) {
                  const userData = currentBodies[idA].body.getUserData() as any;
                  if (userData) {
                    userData.markedForDeletion = true;
                  }
                }
                // Теперь удаляем шар
                this.physicsManager.removeBody(idA);
              }
              
              if (currentBodies[idB]) {
                // Сначала помечаем, что удаляем, чтобы избежать повторных слияний
                if (currentBodies[idB].body) {
                  const userData = currentBodies[idB].body.getUserData() as any;
                  if (userData) {
                    userData.markedForDeletion = true;
                  }
                }
                // Теперь удаляем шар
                this.physicsManager.removeBody(idB);
              }
              
              // Дополнительная проверка, что тела действительно удалены
              const bodiesAfterRemoval = this.getActualBodies();
              bodiesMarkedForDeletion = !bodiesAfterRemoval[idA] && !bodiesAfterRemoval[idB];
            }
          } catch (error) {
            console.error('Ошибка при пометке шаров для удаления:', error);
            bodiesMarkedForDeletion = false;
          }
        };
        
        // Помечаем старые шары для удаления
        markExistingBodiesForDeletion();
        
        // Если пометка прошла успешно, создаем новый шар
        if (bodiesMarkedForDeletion) {
          // Добавляем задержку перед созданием нового шара для большей стабильности
          setTimeout(() => {
            try {
              // Создаем новый шар с повышенным уровнем
              this.ballFactory.createMergedBall(mergeInfo.x, mergeInfo.y, mergeInfo.level);
            } catch (error) {
              console.error('Ошибка при создании нового шара после слияния:', error);
              this.lastErrorTime = Date.now();
            }
          }, 50); // Даем время для завершения текущего цикла физики
        } else {
          console.error('Не удалось пометить существующие шары для удаления');
          this.lastErrorTime = Date.now();
          
          // Дополнительная попытка очистки мира после задержки
          setTimeout(() => {
            try {
              const stillExistingBodies = this.getActualBodies();
              if (stillExistingBodies[idA] || stillExistingBodies[idB]) {
                console.log('Выполняем принудительное удаление шаров после задержки');
                
                // Пробуем использовать отложенное удаление через сцену
                if (typeof (this.scene as any).markBodyForDeletion === 'function') {
                  if (stillExistingBodies[idA]) {
                    (this.scene as any).markBodyForDeletion(idA);
                  }
                  if (stillExistingBodies[idB]) {
                    (this.scene as any).markBodyForDeletion(idB);
                  }
                } else {
                  // Запасной вариант: удаляем напрямую
                  if (stillExistingBodies[idA]) {
                    this.physicsManager.removeBody(idA);
                  }
                  if (stillExistingBodies[idB]) {
                    this.physicsManager.removeBody(idB);
                  }
                }
                
                // Создаем новый шар через дополнительную задержку
                setTimeout(() => {
                  this.ballFactory.createMergedBall(mergeInfo.x, mergeInfo.y, mergeInfo.level);
                }, 100); // Увеличиваем задержку для гарантии
              }
            } catch (finalError) {
              console.error('Финальная попытка очистки не удалась:', finalError);
            }
          }, 150); // Увеличиваем задержку для резервного удаления
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке слияния шаров:', error);
      throw error; // Пробрасываем ошибку выше для обработки в scheduleMerge
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
} 