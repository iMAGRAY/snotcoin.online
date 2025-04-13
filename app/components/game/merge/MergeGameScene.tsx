"use client"

import * as Phaser from 'phaser';
import * as planck from "planck";
import { GameBody, SCALE, MergeGameSceneType } from './utils/types';
import { PhysicsManager } from './physics/PhysicsManager';
import { EffectsManager } from './effects/EffectsManager';
import { AbilityManager } from './abilities/AbilityManager';
import { InputManager } from './input/InputManager';
import { GameOverManager } from './core/GameOverManager';
import { ScoreManager } from './core/ScoreManager';
import { BallFactory } from './core/BallFactory';
import * as gameUtils from './utils/utils';

class MergeGameScene extends Phaser.Scene {
  // Физический мир и тела
  world: planck.World;
  bodies: { [key: string]: GameBody } = {};
  
  // Менеджеры для различных аспектов игры
  physicsManager: PhysicsManager;
  effectsManager: EffectsManager;
  abilityManager: AbilityManager;
  inputManager: InputManager;
  gameOverManager: GameOverManager;
  scoreManager: ScoreManager;
  ballFactory: BallFactory;
  
  // Игровые объекты
  coinKing: Phaser.GameObjects.Image | null = null;
  nextBall: Phaser.GameObjects.Sprite | null = null;
  aimLine: Phaser.GameObjects.Graphics | null = null;
  verticalGuideLine: Phaser.GameObjects.Graphics | null = null;
  
  // Состояние игры
  pendingMerges: { idA: string, idB: string, levelA: number, positionA: planck.Vec2, positionB: planck.Vec2 }[] = [];
  pendingDeletions: { id: string, type: string }[] = [];
  recentlyShot: Record<string, number> = {};
  newBallGracePeriod: number = 320;
  score: number = 0;

  constructor() {
    super({ key: 'MergeGameScene' });
    
    // Создаем физический мир с гравитацией
    this.world = planck.World({
      gravity: planck.Vec2(0, 45)
    });
  }

  preload() {
    // Загружаем изображения шаров для всех уровней
    for (let i = 1; i <= 12; i++) {
      this.load.image(`ball${i}`, `/images/merge/Balls/${i}.webp`);
    }
    
    // Загружаем изображения интерфейса и специальных шаров
    this.load.image('coinKing', '/images/merge/Game/ui/CoinKing.webp');
    this.load.image('background', '/images/merge/background/merge-background.webp');
    this.load.image('trees', '/images/merge/background/trees.webp');
    this.load.image('bull', '/images/merge/Balls/Bull.webp');
    this.load.image('bomb', '/images/merge/Balls/bomb.webp');
  }

  create() {
    // Инициализируем менеджеры
    this.physicsManager = new PhysicsManager(this, this.world);
    this.effectsManager = new EffectsManager(this);
    this.abilityManager = new AbilityManager(this);
    this.inputManager = new InputManager(this);
    this.gameOverManager = new GameOverManager(this);
    this.scoreManager = new ScoreManager(this);
    this.ballFactory = new BallFactory(this, this.physicsManager);
    
    // Получаем размеры игрового холста
    const { width, height } = this.game.canvas;
    
    // Добавляем фоновые изображения
    // Основной фон (нижний слой)
    const background = this.add.image(width / 2, height / 2, 'background');
    background.setDisplaySize(width, height);
    background.setDepth(-10);
    
    // Деревья (верхний слой фона)
    const trees = this.add.image(width / 2, height / 2, 'trees');
    trees.setDisplaySize(width, height);
    trees.setDepth(-5);
    
    // Добавляем пунктирную линию прицеливания
    this.aimLine = this.add.graphics();
    this.updateAimLine(width / 2, height);
    
    // Инициализируем счет
    this.scoreManager.setup();
    
    // Добавляем CoinKing в верхнюю часть игровой зоны
    this.coinKing = this.add.image(width / 2, 45, 'coinKing');
    this.coinKing.setScale(0.085);
    
    // Устанавливаем CoinKing в InputManager
    this.inputManager.setCoinKing(this.coinKing);
    
    // Добавляем горизонтальную пунктирную линию желтого цвета под CoinKing
    const horizontalLine = this.add.graphics();
    horizontalLine.lineStyle(2, 0xFFFF00, 0.8);
    
    // Рисуем горизонтальную пунктирную линию
    const lineY = 75;
    const startX = 10;
    const endX = width - 10;
    
    // Рисуем пунктирную линию сегментами
    const segmentLength = 15;
    const gapLength = 8;
    let currentX = startX;
    
    while (currentX < endX) {
      const segmentEnd = Math.min(currentX + segmentLength, endX);
      horizontalLine.beginPath();
      horizontalLine.moveTo(currentX, lineY);
      horizontalLine.lineTo(segmentEnd, lineY);
      horizontalLine.strokePath();
      currentX = segmentEnd + gapLength;
    }
    
    // Настраиваем зону для определения Game Over
    this.gameOverManager.setupGameOverZone(width, lineY);
    
    // Добавляем вертикальную направляющую линию
    this.verticalGuideLine = this.add.graphics();
    this.inputManager.setVerticalGuideX(width / 2);
    
    // Рисуем вертикальную линию от горизонтальной до самого низа экрана
    this.updateVerticalGuideLine(width / 2, lineY, height);
    
    // Генерируем уровень для следующего шара
    this.ballFactory.generateNextBallLevel();
    
    // Создаем следующий шар для броска
    this.ballFactory.createNextBall(this.coinKing.x, this.coinKing.y);
    this.nextBall = this.ballFactory.getNextBall();
    
    // Настраиваем обработчики ввода
    this.inputManager.setup(
      this.updateAimLine.bind(this),
      this.updateVerticalGuideLine.bind(this),
      this.shootFromCoinKing.bind(this)
    );
    
    // Создаем границы игрового мира
    this.createBoundaries(width, height);
    
    // Устанавливаем время начала игры
    this.game.registry.set('gameStartTime', Date.now());
  }

  createBoundaries(width: number, height: number) {
    // Основные границы мира
    this.physicsManager.createBoundary(0, height / SCALE, width / SCALE, height / SCALE, 'bottom');
    this.physicsManager.createBoundary(0, 0, 0, height / SCALE);
    this.physicsManager.createBoundary(width / SCALE, 0, width / SCALE, height / SCALE);
    
    // Дополнительные невидимые стены внутри игровой зоны
    const wallOffset = width * 0.05 / SCALE;
    
    // Левая внутренняя стена
    this.physicsManager.createBoundary(wallOffset, 0, wallOffset, height / SCALE);
    
    // Правая внутренняя стена
    this.physicsManager.createBoundary(width / SCALE - wallOffset, 0, width / SCALE - wallOffset, height / SCALE);
  }

  // Обновление линии прицеливания
  updateAimLine(x: number, height: number) {
    if (!this.aimLine) return;
    
    this.aimLine.clear();
    this.aimLine.lineStyle(2, 0xFFFFFF, 0.5);
    
    // Рисуем пунктирную линию сегментами от CoinKing до нижней части экрана
    const segmentLength = 10;
    const gapLength = 10;
    let currentY = 80; // Начинаем от линии под CoinKing
    
    while (currentY < height) {
      const segmentEnd = Math.min(currentY + segmentLength, height);
      this.aimLine.beginPath();
      this.aimLine.moveTo(x, currentY);
      this.aimLine.lineTo(x, segmentEnd);
      this.aimLine.strokePath();
      currentY = segmentEnd + gapLength;
    }
  }

  // Обновление вертикальной направляющей линии
  updateVerticalGuideLine(x: number, startY: number, endY: number) {
    if (!this.verticalGuideLine) return;
    
    this.verticalGuideLine.clear();
    this.verticalGuideLine.lineStyle(2, 0xFFFFFF, 0.2);
    
    // Рисуем пунктирную вертикальную линию сегментами
    const segmentLength = 10;
    const gapLength = 10;
    let currentY = startY;
    
    while (currentY < endY) {
      const segmentEnd = Math.min(currentY + segmentLength, endY);
      this.verticalGuideLine.beginPath();
      this.verticalGuideLine.moveTo(x, currentY);
      this.verticalGuideLine.lineTo(x, segmentEnd);
      this.verticalGuideLine.strokePath();
      currentY = segmentEnd + gapLength;
    }
  }

  // Метод выстрела из CoinKing
  shootFromCoinKing() {
    const time = this.time.now;
    
    // Проверяем, прошло ли достаточно времени с последнего выстрела
    if (!this.coinKing || !this.nextBall) return;
    
    // Запоминаем текущую позицию направляющей линии
    const currentGuideX = this.inputManager.getVerticalGuideX();
    
    // Получаем данные шара для стрельбы
    const nextBallLevel = this.ballFactory.getNextBallLevel();
    const isSpecial = this.nextBall.getData('special');
    
    // Создаем шар в физическом мире
    const radius = gameUtils.getRadiusByLevel(nextBallLevel);
    const x = this.coinKing.x / SCALE;
    const y = (this.coinKing.y + 20) / SCALE;
    
    // Создаем физическое тело шара
    let id = '';
    let newBall = null;
    
    if (isSpecial) {
      // Создаем специальный шар (Bull, Bomb и т.д.)
      const result = this.physicsManager.createSpecialCircle(x, y, radius, isSpecial);
      id = String(result.id);
      newBall = result;
    } else {
      // Создаем обычный шар соответствующего уровня
      const result = this.physicsManager.createCircle(x, y, radius, nextBallLevel);
      id = String(result.id);
      newBall = result;
    }
    
    // Добавляем созданный шар в список недавних с отметкой времени
    this.recentlyShot[id] = time;
    
    // Генерируем новый шар для следующего выстрела
    this.ballFactory.generateNextBallLevel();
    this.ballFactory.createNextBall(this.coinKing.x, this.coinKing.y);
    this.nextBall = this.ballFactory.getNextBall();
    
    // Обновляем фиксированную направляющую линию от CoinKing 
    // до самого низа экрана, чтобы она не исчезала при выстреле
    if (this.verticalGuideLine) {
      this.updateVerticalGuideLine(currentGuideX, 75, this.game.canvas.height);
    }
  }

  // Метод обработки слияния шаров
  scheduleMerge(idA: string, idB: string) {
    const bodyA = this.bodies[idA];
    const bodyB = this.bodies[idB];
    
    if (!bodyA || !bodyB) return;
    
    const levelA = bodyA.sprite.getData('level');
    const levelB = bodyB.sprite.getData('level');
    
    // Объединяем только шары одинакового уровня
    if (levelA === levelB) {
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
    }
  }

  // Обработка отложенных слияний шаров
  processPendingMerges() {
    if (this.pendingMerges.length === 0) return;
    
    // Обрабатываем каждое слияние
    this.pendingMerges.forEach(merge => {
      // Проверяем, что оба шара все еще существуют
      if (this.bodies[merge.idA] && this.bodies[merge.idB]) {
        // Вычисляем среднюю позицию для нового шара
        const newX = (merge.positionA.x + merge.positionB.x) / 2;
        const newY = (merge.positionA.y + merge.positionB.y) / 2;
        
        // Новый уровень шара
        const newLevel = merge.levelA + 1;
        
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
        this.scoreManager.increaseScore(newLevel * 10);
      }
    });
    
    // Очищаем очередь слияний
    this.pendingMerges = [];
  }

  // Обработка отложенных удалений шаров
  processPendingDeletions() {
    if (this.pendingDeletions.length === 0) return;
    
    // Обрабатываем каждое удаление
    this.pendingDeletions.forEach(deletion => {
      if (this.bodies[deletion.id]) {
        // Получаем позицию шара для эффектов
        const position = this.bodies[deletion.id].body.getPosition();
        const x = position.x * SCALE;
        const y = position.y * SCALE;
        
        // Применяем различные эффекты в зависимости от типа удаления
        switch (deletion.type) {
          case 'bull_target':
            this.effectsManager.addDestructionEffect(x, y);
            break;
          case 'bull_self':
            this.effectsManager.addBullDestructionEffect(x, y);
            break;
          case 'bomb_target':
            this.effectsManager.addMiniExplosionEffect(x, y);
            break;
          case 'bomb_self':
            // Эффект уже добавлен в bombAreaEffect
            break;
          default:
            this.effectsManager.addSimpleDestructionEffect(x, y);
        }
        
        // Удаляем шар
        this.physicsManager.removeBody(deletion.id);
        
        // Даем очки за уничтожение, если это специальный шар
        if (deletion.type.includes('target')) {
          this.scoreManager.increaseScore(15);
        }
      }
    });
    
    // Очищаем очередь удалений
    this.pendingDeletions = [];
  }

  // Обновление игры (вызывается каждый кадр)
  update(time: number, delta: number) {
    // Если игра завершена, не обновляем
    if (this.gameOverManager.isOver()) return;
    
    // Обновляем физику мира
    this.world.step(1/60);
    
    // Обновляем позиции спрайтов на основе физики
    this.physicsManager.update();
    
    // Обрабатываем отложенные слияния и удаления
    this.processPendingMerges();
    this.processPendingDeletions();
    
    // Проверяем условие Game Over
    this.gameOverManager.checkBallsInDangerZone(this.bodies);
    
    // Обновляем линию прицеливания при нажатии
    if (this.coinKing && this.aimLine && this.inputManager.getIsPointerDown()) {
      const pointer = this.input.activePointer;
      this.updateAimLine(pointer.x, pointer.y);
    }
    
    // Обновляем вертикальную направляющую линию
    if (this.verticalGuideLine && !this.gameOverManager.isOver()) {
      const currentX = this.inputManager.getVerticalGuideX();
      if (currentX > 0) {
        this.updateVerticalGuideLine(currentX, 75, this.game.canvas.height);
      }
    }
  }

  // Метод для активации способностей (Bull, Bomb, Earthquake)
  activateAbility(ability: string) {
    if (this.abilityManager) {
      this.abilityManager.activateAbility(ability);
    }
  }

  // Метод для очистки ресурсов перед уничтожением сцены
  cleanup() {
    // Остановка всех таймеров и твинов
    this.tweens.killAll();
    this.time.removeAllEvents();
    
    // Удаление всех физических тел
    Object.keys(this.bodies).forEach(id => {
      this.physicsManager.removeBody(id);
    });
    
    // Очистка списков ожидающих слияний и удалений
    this.pendingMerges = [];
    this.pendingDeletions = [];
    
    // Сброс счета и других игровых переменных
    this.score = 0;
    this.recentlyShot = {};
    
    // Удаление игровых объектов
    if (this.aimLine) this.aimLine.destroy();
    if (this.verticalGuideLine) this.verticalGuideLine.destroy();
    if (this.nextBall) this.nextBall.destroy();
    if (this.coinKing) this.coinKing.destroy();
    
    // Обнуление ссылок
    this.aimLine = null;
    this.verticalGuideLine = null;
    this.nextBall = null;
    this.coinKing = null;
  }
}

export default MergeGameScene;
