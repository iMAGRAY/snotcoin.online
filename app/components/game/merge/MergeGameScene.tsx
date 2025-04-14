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
import { ShootingManager } from './managers/ShootingManager';
import { MergeProcessor } from './managers/MergeProcessor';
import { BackgroundManager } from './managers/BackgroundManager';
import { UIManager } from './managers/UIManager';
import * as gameUtils from './utils/utils';

class MergeGameScene extends Phaser.Scene implements MergeGameSceneType {
  // Физический мир и тела
  world: planck.World;
  bodies: { [key: string]: GameBody } = {};
  
  // Менеджеры для различных аспектов игры
  physicsManager!: PhysicsManager;
  effectsManager!: EffectsManager;
  abilityManager!: AbilityManager;
  inputManager!: InputManager;
  gameOverManager!: GameOverManager;
  scoreManager!: ScoreManager;
  ballFactory!: BallFactory;
  shootingManager!: ShootingManager;
  mergeProcessor!: MergeProcessor;
  backgroundManager!: BackgroundManager;
  uiManager!: UIManager;
  
  // Состояние игры
  pendingDeletions: { id: string, type: string }[] = [];
  score: number = 0;
  audioService?: { playSound: (key: string) => void };
  isPaused: boolean = false;
  
  // Необходимые свойства для MergeGameSceneType
  nextBall: Phaser.GameObjects.Sprite | null = null;
  nextBallLevel: number = 1;
  coinKing: Phaser.GameObjects.Image | null = null;

  constructor() {
    super({ key: 'MergeGameScene' });
    
    // Создаем физический мир с гравитацией
    this.world = planck.World({
      gravity: planck.Vec2(0, 45)
    });
    
    // Настраиваем обработчик контактов для обнаружения соприкосновений шаров
    this.world.on('begin-contact', this.handleContact.bind(this));
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
    // Получаем размеры игрового холста с учетом соотношения сторон 85:112
    const { width, height } = this.game.canvas;
    
    // Настраиваем физический мир и границы с учетом соотношения сторон 85:112
    this.world.setGravity(planck.Vec2(0, 45));
    
    // Инициализируем менеджеры
    this.physicsManager = new PhysicsManager(this, this.world);
    this.effectsManager = new EffectsManager(this);
    this.abilityManager = new AbilityManager(this);
    this.inputManager = new InputManager(this);
    this.gameOverManager = new GameOverManager(this);
    this.scoreManager = new ScoreManager(this);
    this.ballFactory = new BallFactory(this, this.physicsManager);
    this.backgroundManager = new BackgroundManager(this);
    this.uiManager = new UIManager(this);
    
    // Инициализируем менеджеры, зависящие от других
    this.shootingManager = new ShootingManager(
      this, 
      this.ballFactory, 
      this.physicsManager, 
      this.inputManager,
      this.uiManager
    );
    
    this.mergeProcessor = new MergeProcessor(
      this, 
      this.ballFactory, 
      this.physicsManager, 
      this.effectsManager, 
      this.bodies
    );
    
    // Настраиваем фон и получаем позицию горизонтальной линии
    const lineY = this.backgroundManager.setupBackground(width, height);
    
    // Инициализируем UI элементы с учетом соотношения сторон
    this.uiManager.setupUI(width, height);
    
    // Инициализируем счет
    this.scoreManager.setup();
    
    // Настраиваем зону для определения Game Over с учетом соотношения сторон
    this.gameOverManager.setupGameOverZone(width, lineY);
    
    // Настраиваем ShootingManager с учетом соотношения сторон
    this.shootingManager.setup(width, lineY);
    
    // Обновляем ссылки на игровые объекты для соответствия интерфейсу
    this.coinKing = this.shootingManager.getCoinKing();
    this.nextBall = this.shootingManager.getNextBall();
    this.nextBallLevel = this.ballFactory.getNextBallLevel();
    
    // Создаем границы игрового мира с учетом соотношения сторон
    this.createBoundaries(width, height);
    
    // Устанавливаем время начала игры
    this.game.registry.set('gameStartTime', Date.now());
  }

  createBoundaries(width: number, height: number) {
    // Основные границы мира с соотношением сторон 85:112
    this.physicsManager.createBoundary(0, height / SCALE, width / SCALE, height / SCALE, 'bottom');
    this.physicsManager.createBoundary(0, 0, 0, height / SCALE);
    this.physicsManager.createBoundary(width / SCALE, 0, width / SCALE, height / SCALE);
    
    // Дополнительные невидимые стены внутри игровой зоны
    // Используем процентное соотношение для сохранения пропорций
    const wallOffset = width * 0.05 / SCALE;
    
    // Левая внутренняя стена
    this.physicsManager.createBoundary(wallOffset, 0, wallOffset, height / SCALE);
    
    // Правая внутренняя стена
    this.physicsManager.createBoundary(width / SCALE - wallOffset, 0, width / SCALE - wallOffset, height / SCALE);
  }

  // Метод для обработки слияний между шарами
  increaseScore(points: number): void {
    this.scoreManager.increaseScore(points);
    this.score = this.scoreManager.getScore();
  }

  // Метод для обработки уничтожения цели бомбой
  destroyBombTarget(targetId: string, targetBall: GameBody, bombId: string, bomb: GameBody): void {
    // Получаем позицию шара
    const position = targetBall.body.getPosition();
    const x = position.x * SCALE;
    const y = position.y * SCALE;
    
    // Добавляем эффект разрушения
    this.effectsManager.addMiniExplosionEffect(x, y);
    
    // Добавляем шар в список на удаление
    this.pendingDeletions.push({ id: targetId, type: 'bomb_target' });
  }

  // Обработка отложенных удалений шаров
  processPendingDeletions() {
    if (this.pendingDeletions.length === 0) return;
    
    // Обрабатываем каждое удаление
    this.pendingDeletions.forEach(deletion => {
      const bodyToDelete = this.bodies[deletion.id];
      if (bodyToDelete && bodyToDelete.body) {
        // Получаем позицию шара для эффектов
        const position = bodyToDelete.body.getPosition();
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
          this.increaseScore(15);
        }
      }
    });
    
    // Очищаем очередь удалений
    this.pendingDeletions = [];
  }

  // Обновление игры (вызывается каждый кадр)
  update(time: number, delta: number) {
    // Если игра завершена или на паузе, не обновляем
    if (this.gameOverManager.isOver() || this.isPaused) return;
    
    // Обновляем физику мира
    this.world.step(1/60);
    
    // Обновляем позиции спрайтов на основе физики
    this.physicsManager.update();
    
    // Обрабатываем отложенные слияния и удаления
    this.mergeProcessor.processPendingMerges(this.increaseScore.bind(this));
    this.processPendingDeletions();
    
    // Проверяем условие Game Over
    this.gameOverManager.checkBallsInDangerZone(this.bodies);
    
    // Обновляем линию прицеливания при нажатии
    if (this.inputManager.getIsPointerDown()) {
      const pointer = this.input.activePointer;
      this.uiManager.updateAimLine(pointer.x, pointer.y);
    }
    
    // Обновляем вертикальную направляющую линию только если:
    // 1. Игра не окончена
    // 2. Есть сохраненная позиция X (больше 0)
    if (!this.gameOverManager.isOver()) {
      const currentX = this.inputManager.getVerticalGuideX();
      // Проверяем, что currentX больше 0, иначе не рисуем линию
      if (currentX > 0) {
        // Обновляем линию только если есть сохраненная позиция
        this.uiManager.updateVerticalGuideLine(currentX, 75, this.game.canvas.height);
      }
    }
    
    // Обновляем ссылки на объекты из менеджеров
    this.nextBall = this.shootingManager.getNextBall();
    this.coinKing = this.shootingManager.getCoinKing();
    this.nextBallLevel = this.ballFactory.getNextBallLevel();
  }

  // Метод для активации способностей (Bull, Bomb, Earthquake)
  activateAbility(ability: string) {
    if (this.abilityManager) {
      this.abilityManager.activateAbility(ability);
    }
  }

  // Метод для перезапуска игры
  restart() {
    try {
      // Очищаем ресурсы текущей игры
      this.cleanup();
      
      // Сбрасываем состояние игры, проверяя наличие менеджеров
      if (this.gameOverManager) {
        this.gameOverManager.reset();
      }
      
      if (this.mergeProcessor) {
        this.mergeProcessor.reset();
      }

      // Получаем размеры игрового холста с учетом соотношения сторон 85:112
      const { width, height } = this.game.canvas;
      
      // Рассчитываем позицию линии с учетом соотношения сторон
      // Используем примерно 9% от высоты как расстояние для линии от верха
      const lineY = Math.round(height * 0.09);
      
      // Сбрасываем shooting manager, если он существует
      if (this.shootingManager) {
        this.shootingManager.reset(width, lineY);
      }
      
      // Сбрасываем счет и флаги игры
      this.score = 0;
      this.isPaused = false;
      this.nextBallLevel = 1;
      
      // Пересоздаем физический мир с сохранением соотношения сторон
      this.world = planck.World({
        gravity: planck.Vec2(0, 45)
      });
      this.world.on('begin-contact', this.handleContact.bind(this));
      
      // Обновляем регистр игры (с проверкой)
      if (this.game && this.game.registry) {
        this.game.registry.set('gameScore', 0);
        this.game.registry.set('gameOver', false);
        this.game.registry.set('finalScore', 0);
        this.game.registry.set('gameStartTime', Date.now());
      }
      
      // Перезапускаем текущую сцену (с проверкой)
      if (this.scene) {
        this.scene.restart();
      }
    } catch (error) {
      console.error('Ошибка при перезапуске игры:', error);
    }
  }

  // Метод для постановки игры на паузу
  pause() {
    if (this.gameOverManager && !this.gameOverManager.isOver()) {
      this.isPaused = true;
      
      // Отображаем оверлей паузы (если метод существует)
      if (this.uiManager && typeof this.uiManager.showPauseOverlay === 'function') {
        try {
          this.uiManager.showPauseOverlay();
        } catch (error) {
          console.error('Ошибка при показе оверлея паузы:', error);
        }
      }
      
      // Останавливаем твины и таймеры (но не уничтожаем их)
      if (this.tweens && typeof this.tweens.pauseAll === 'function') {
        this.tweens.pauseAll();
      }
      
      // Отключаем ввод
      if (this.inputManager && typeof this.inputManager.disableInput === 'function') {
        try {
          this.inputManager.disableInput();
        } catch (error) {
          console.error('Ошибка при отключении ввода:', error);
        }
      }
      
      // Оповещаем о паузе, если есть аудио сервис
      if (this.audioService && typeof this.audioService.playSound === 'function') {
        try {
          this.audioService.playSound('pause');
        } catch (error) {
          console.error('Ошибка при воспроизведении звука паузы:', error);
        }
      }
    }
  }

  // Метод для возобновления игры
  resume() {
    if (this.gameOverManager && !this.gameOverManager.isOver() && this.isPaused) {
      this.isPaused = false;
      
      // Скрываем оверлей паузы
      if (this.uiManager && typeof this.uiManager.hidePauseOverlay === 'function') {
        try {
          this.uiManager.hidePauseOverlay();
        } catch (error) {
          console.error('Ошибка при скрытии оверлея паузы:', error);
        }
      }
      
      // Возобновляем твины и таймеры
      if (this.tweens && typeof this.tweens.resumeAll === 'function') {
        this.tweens.resumeAll();
      }
      
      // Включаем ввод
      if (this.inputManager && typeof this.inputManager.enableInput === 'function') {
        try {
          this.inputManager.enableInput();
        } catch (error) {
          console.error('Ошибка при включении ввода:', error);
        }
      }
      
      // Оповещаем о возобновлении, если есть аудио сервис
      if (this.audioService && typeof this.audioService.playSound === 'function') {
        try {
          this.audioService.playSound('resume');
        } catch (error) {
          console.error('Ошибка при воспроизведении звука возобновления:', error);
        }
      }
    }
  }

  // Метод для очистки ресурсов перед уничтожением сцены
  cleanup() {
    // Остановка всех таймеров и твинов
    if (this.tweens) {
      this.tweens.killAll();
    }
    
    if (this.time) {
      this.time.removeAllEvents();
    }
    
    // Удаление всех физических тел
    if (this.bodies && this.physicsManager) {
      Object.keys(this.bodies).forEach(id => {
        this.physicsManager.removeBody(id);
      });
    }
    
    // Очистка списка ожидающих удалений
    this.pendingDeletions = [];
    
    // Сброс счета и других игровых переменных
    this.score = 0;
    this.nextBallLevel = 1;
    this.nextBall = null;
    this.coinKing = null;
    
    // Очищаем ресурсы менеджеров (с проверкой существования)
    if (this.uiManager && 'cleanup' in this.uiManager) {
      this.uiManager.cleanup();
    }
    
    if (this.shootingManager && 'cleanup' in this.shootingManager) {
      this.shootingManager.cleanup();
    }

    // Очищаем ресурсы остальных менеджеров, если метод cleanup существует
    if (this.mergeProcessor && 'reset' in this.mergeProcessor) {
      this.mergeProcessor.reset();
    }

    if (this.gameOverManager && 'reset' in this.gameOverManager) {
      this.gameOverManager.reset();
    }

    // Очищаем и удаляем все физические тела
    this.bodies = {};
  }

  // Обработчик контактов между телами
  handleContact(contact: planck.Contact) {
    const fixtureA = contact.getFixtureA();
    const fixtureB = contact.getFixtureB();
    
    const bodyA = fixtureA.getBody();
    const bodyB = fixtureB.getBody();
    
    const userDataA = bodyA.getUserData() as any;
    const userDataB = bodyB.getUserData() as any;
    
    // Пропускаем контакты между специальными телами или границами
    if (!userDataA || !userDataB || !userDataA.id || !userDataB.id) {
      return;
    }
    
    // Проверяем, что оба тела - шары (не спец. шары и не границы)
    if (userDataA.type === 'ball' && userDataB.type === 'ball') {
      // Если это недавно созданные шары, пропускаем их
      const currentTime = this.time.now;
      const recentlyShot = this.shootingManager.getRecentlyShot();
      const gracePeriod = this.shootingManager.getNewBallGracePeriod();
      
      const shotTimeA = recentlyShot[userDataA.id];
      const shotTimeB = recentlyShot[userDataB.id];
      
      if (shotTimeA !== undefined && currentTime - shotTimeA < gracePeriod) return;
      if (shotTimeB !== undefined && currentTime - shotTimeB < gracePeriod) return;
      
      // Планируем слияние шаров
      this.mergeProcessor.scheduleMerge(userDataA.id, userDataB.id);
    }
    // Дополнительная логика для специальных типов шаров...
    // Обработка других типов контактов, если необходимо
  }
}

export default MergeGameScene;
