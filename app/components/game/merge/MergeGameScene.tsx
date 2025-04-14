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
  // Удаляем прямую инициализацию bodies, так как будем получать его из PhysicsManager
  // bodies: { [key: string]: GameBody } = {};
  
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
  
  // Система блокировки контактов для предотвращения дублирующихся слияний
  private processedContacts: Set<string> = new Set();
  private contactProcessingTimeout: number = 800; // Увеличиваем период хранения контакта для большей надежности
  private lastMergeTime: number = 0; // Добавляем отслеживание времени последнего слияния

  // Добавим новый массив для хранения тел, которые нужно удалить после обновления физики
  private pendingBodyDeletions: string[] = [];

  constructor() {
    super({ key: 'MergeGameScene' });
    
    // Создаем физический мир с гравитацией
    this.world = planck.World({
      gravity: planck.Vec2(0, 45)
    });
    
    // Настраиваем обработчик контактов для обнаружения соприкосновений шаров
    this.world.on('begin-contact', this.handleContact.bind(this));
    
    // Добавляем другие обработчики для отладки
    this.world.on('end-contact', (contact) => {
      // Событие окончания контакта
    });
    
    this.world.on('pre-solve', (contact) => {
      // Событие перед решением контакта
    });
    
    this.world.on('post-solve', (contact) => {
      // Событие после решения контакта
    });
  }

  preload() {
    // Настройка методов загрузки для улучшенного качества
    this.load.setBaseURL(window.location.origin);
    this.load.crossOrigin = 'anonymous';
    
    // Устанавливаем максимальный размер текстур
    if (this.game.renderer.type === Phaser.WEBGL) {
      try {
        const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
        const gl = renderer.gl;
        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        console.log(`Максимальный размер текстур: ${maxTextureSize}x${maxTextureSize}`);
      } catch (e) {
        console.warn('Не удалось определить максимальный размер текстур:', e);
      }
    }
    
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
    
    // Загружаем звуки
    this.load.audio('coinMergeSound', '/sounds/coins_merge/1.mp3');
    
    // Событие завершения загрузки - применяем улучшенные настройки текстур
    this.load.on('complete', () => {
      this.applyTextureSettings();
    });
  }

  // Метод для применения улучшенных настроек ко всем текстурам
  private applyTextureSettings() {
    if (this.game.renderer.type !== Phaser.WEBGL) return;
    
    // Получаем все текстуры
    const textureKeys = this.textures.getTextureKeys();
    
    textureKeys.forEach(key => {
      const texture = this.textures.get(key);
      if (texture) {
        // Установка фильтра LINEAR для всех текстур
        texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        
        // Улучшенные настройки для WebGL при наличии
        if (texture.source && texture.source[0]) {
          const source = texture.source[0];
          if (source.glTexture && this.game.renderer.type === Phaser.WEBGL) {
            try {
              const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
              const gl = renderer.gl;
              gl.bindTexture(gl.TEXTURE_2D, source.glTexture);
              
              // Линейная интерполяция для увеличения
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
              
              // Трилинейная фильтрация (с миньмапами) для уменьшения
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
              
              // Генерируем миньмапы
              gl.generateMipmap(gl.TEXTURE_2D);
              
              // Завершаем работу с текстурой
              gl.bindTexture(gl.TEXTURE_2D, null);
            } catch (e) {
              console.warn(`Не удалось настроить текстуру ${key}:`, e);
            }
          }
        }
      }
    });
  }

  create() {
    // Получаем размеры игрового холста с учетом пропорций 425:558
    const { width: originalWidth, height: originalHeight } = this.game.canvas;
    
    // Устанавливаем соотношение сторон 425:558
    const aspectRatio = 425 / 558;
    
    // Пересчитываем размеры с учетом соотношения сторон
    let width, height;
    
    if (originalWidth / originalHeight > aspectRatio) {
      // Если экран шире, чем нужно, ограничиваем по высоте
      height = originalHeight;
      width = height * aspectRatio;
    } else {
      // Если экран уже, чем нужно, ограничиваем по ширине
      width = originalWidth;
      height = width / aspectRatio;
    }
    
    // Центрируем игровую зону
    const offsetX = (originalWidth - width) / 2;
    
    // Добавляем обработчики потери и восстановления контекста WebGL
    this.game.renderer.on('contextlost', this.handleContextLost, this);
    this.game.renderer.on('contextrestored', this.handleContextRestored, this);
    
    // Настраиваем физический мир и границы с учетом пропорций 425:558
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
    
    // Задаем соотношение сторон в игровых данных для использования другими менеджерами
    this.game.registry.set('gameWidth', width);
    this.game.registry.set('gameHeight', height);
    this.game.registry.set('gameOffsetX', offsetX);
    
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
      this.effectsManager
    );
    
    // Настраиваем фон и получаем позицию горизонтальной линии
    const lineY = this.backgroundManager.setupBackground(width, height);
    
    // Инициализируем UI элементы с учетом пропорций
    this.uiManager.setupUI(width, height);
    
    // Инициализируем счет
    this.scoreManager.setup();
    
    // Настраиваем зону для определения Game Over с учетом пропорций
    this.gameOverManager.setupGameOverZone(width, lineY);
    
    // Настраиваем ShootingManager с учетом пропорций
    this.shootingManager.setup(width, lineY);
    
    // Обновляем ссылки на игровые объекты для соответствия интерфейсу
    this.coinKing = this.shootingManager.getCoinKing();
    this.nextBall = this.shootingManager.getNextBall();
    this.nextBallLevel = this.ballFactory.getNextBallLevel();
    
    // Создаем границы игрового мира с учетом пропорций
    this.createBoundaries(width, height, offsetX);
    
    // Устанавливаем время начала игры
    this.game.registry.set('gameStartTime', Date.now());
  }

  createBoundaries(width: number, height: number, offsetX: number = 0) {
    // Основные границы мира с учетом пропорций 425:558 и смещения
    // Нижняя граница
    this.physicsManager.createBoundary(
      offsetX / SCALE, 
      height / SCALE, 
      (offsetX + width) / SCALE, 
      height / SCALE, 
      'bottom'
    );
    
    // Левая граница
    this.physicsManager.createBoundary(
      offsetX / SCALE, 
      0, 
      offsetX / SCALE, 
      height / SCALE
    );
    
    // Правая граница
    this.physicsManager.createBoundary(
      (offsetX + width) / SCALE, 
      0, 
      (offsetX + width) / SCALE, 
      height / SCALE
    );
    
    // Дополнительные невидимые стены внутри игровой зоны
    // Используем процентное соотношение для сохранения пропорций
    const wallOffset = width * 0.05 / SCALE;
    
    // Левая внутренняя стена
    this.physicsManager.createBoundary(
      (offsetX / SCALE) + wallOffset, 
      0, 
      (offsetX / SCALE) + wallOffset, 
      height / SCALE
    );
    
    // Правая внутренняя стена
    this.physicsManager.createBoundary(
      (offsetX + width) / SCALE - wallOffset, 
      0, 
      (offsetX + width) / SCALE - wallOffset, 
      height / SCALE
    );
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

  // Метод для добавления тела в список на удаление
  public markBodyForDeletion(id: string): void {
    // Проверяем, существует ли тело
    if (this.bodies[id] && this.bodies[id].body) {
      // Помечаем тело для удаления в userData
      const userData = this.bodies[id].body.getUserData() as any;
      if (userData) {
        userData.markedForDeletion = true;
      }
      
      // Добавляем ID в список на удаление
      if (!this.pendingBodyDeletions.includes(id)) {
        this.pendingBodyDeletions.push(id);
        console.log(`Тело ${id} добавлено в список на удаление, текущий размер списка: ${this.pendingBodyDeletions.length}`);
      }
    }
  }

  // Обновление игры (вызывается каждый кадр)
  update(time: number, delta: number) {
    // Если игра завершена или на паузе, не обновляем
    if (this.gameOverManager.isOver() || this.isPaused) return;
    
    // Обновляем физику мира
    // Вызываем Step с включенными колбеками обработки контактов
    this.world.step(1/60, 10, 8);
    
    // Проверяем коллизии после обновления физики
    this.checkCollisions();
    
    // Обновляем позиции спрайтов на основе физики
    this.physicsManager.update();
    
    // Обрабатываем отложенные слияния и удаления
    this.mergeProcessor.processPendingMerges(this.increaseScore.bind(this));
    this.processPendingDeletions();
    
    // Обрабатываем отложенные удаления физических тел после обновления физики
    this.processBodyDeletions();
    
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

  // Новый метод для обработки отложенных удалений физических тел
  private processBodyDeletions(): void {
    if (this.pendingBodyDeletions.length === 0) return;
    
    console.log(`Обработка ${this.pendingBodyDeletions.length} отложенных удалений физических тел`);
    
    // Копируем список, чтобы избежать модификации во время итерации
    const deletionsToProcess = [...this.pendingBodyDeletions];
    // Очищаем оригинальный список
    this.pendingBodyDeletions = [];
    
    // Обрабатываем каждое удаление
    deletionsToProcess.forEach(id => {
      if (this.bodies[id]) {
        try {
          this.physicsManager.removeBody(id);
          console.log(`Физическое тело ${id} успешно удалено`);
        } catch (error) {
          console.error(`Ошибка при отложенном удалении тела ${id}:`, error);
        }
      }
    });
  }

  // Проверка коллизий вручную
  checkCollisions() {
    // Если игра на паузе - не проверяем коллизии
    if (this.isPaused) {
      return;
    }
    
    // Получаем все пары контактов из мира
    for (let contact = this.world.getContactList(); contact; contact = contact.getNext()) {
      if (contact.isTouching()) {
        // Получаем данные обоих тел
        const fixtureA = contact.getFixtureA();
        const fixtureB = contact.getFixtureB();
        
        if (!fixtureA || !fixtureB) {
          continue;
        }
        
        const bodyA = fixtureA.getBody();
        const bodyB = fixtureB.getBody();
        
        if (!bodyA || !bodyB) {
          continue;
        }
        
        const userDataA = bodyA.getUserData() as any;
        const userDataB = bodyB.getUserData() as any;
        
        // Пропускаем контакты для шаров, помеченных на удаление
        if (!userDataA || !userDataB || userDataA.markedForDeletion || userDataB.markedForDeletion) {
          continue;
        }
        
        this.handleContact(contact);
      }
    }
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

      // Получаем размеры игрового холста с учетом пропорций 425:558
      const { width, height } = this.game.canvas;
      
      // Рассчитываем позицию линии с учетом пропорций
      // Используем примерно 10% от высоты как расстояние для линии от верха
      const lineY = Math.round(height * 0.10);
      
      // Сбрасываем shooting manager, если он существует
      if (this.shootingManager) {
        this.shootingManager.reset(width, lineY);
      }
      
      // Сбрасываем счет и флаги игры
      this.score = 0;
      this.isPaused = false;
      this.nextBallLevel = 1;
      
      // Пересоздаем физический мир с сохранением пропорций 425:558
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
    
    // Очищаем все списки ожидающих удалений
    this.pendingDeletions = [];
    this.pendingBodyDeletions = [];
    this.processedContacts.clear();
    
    // Принудительно пересоздаем физический мир для полной очистки
    try {
      // Сначала удаляем все тела
      const allBodies = this.bodies;
      for (const id in allBodies) {
        if (allBodies[id] && allBodies[id].body) {
          // Удаляем спрайт
          if (allBodies[id].sprite && allBodies[id].sprite.active) {
            allBodies[id].sprite.destroy();
          }
          
          try {
            // Удаляем физическое тело
            this.world.destroyBody(allBodies[id].body);
          } catch (error) {
            console.error(`Ошибка при уничтожении тела ${id} во время cleanup:`, error);
          }
        }
      }
      
      // Создаем новый мир с теми же параметрами
      this.world = planck.World({
        gravity: planck.Vec2(0, 45)
      });
      
      // Подключаем обработчики контактов к новому миру
      this.world.on('begin-contact', this.handleContact.bind(this));
      
      // Обновляем ссылку на мир в PhysicsManager
      if (this.physicsManager && typeof this.physicsManager.setWorld === 'function') {
        this.physicsManager.setWorld(this.world);
      } else {
        // Если метод setWorld не существует, создаем новый PhysicsManager
        this.physicsManager = new PhysicsManager(this, this.world);
      }
    } catch (worldError) {
      console.error('Критическая ошибка при пересоздании физического мира:', worldError);
    }
    
    // Удаление всех физических тел через PhysicsManager
    if (this.physicsManager && 'reset' in this.physicsManager) {
      this.physicsManager.reset();
    }
    
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
    
    // Force GC
    if (typeof window !== 'undefined' && window.gc) {
      try {
        window.gc();
      } catch (e) {
        console.warn('Не удалось вызвать сборщик мусора:', e);
      }
    }
  }

  // Обработчик контактов между телами
  handleContact(contact: planck.Contact) {
    // Если игра на паузе или контекст потерян, не обрабатываем столкновения
    if (this.isPaused) {
      return;
    }
    
    const fixtureA = contact.getFixtureA();
    const fixtureB = contact.getFixtureB();
    
    if (!fixtureA || !fixtureB) {
      return;
    }
    
    const bodyA = fixtureA.getBody();
    const bodyB = fixtureB.getBody();
    
    if (!bodyA || !bodyB) {
      return;
    }
    
    const userDataA = bodyA.getUserData() as any;
    const userDataB = bodyB.getUserData() as any;
    
    // Пропускаем контакты между специальными телами или границами
    if (!userDataA || !userDataB || !userDataA.id || !userDataB.id) {
      return;
    }
    
    // Проверяем, что оба тела - шары (не спец. шары и не границы)
    if (userDataA.type === 'ball' && userDataB.type === 'ball') {
      try {
        // Пропускаем контакты для шаров, помеченных на удаление
        if (userDataA.markedForDeletion || userDataB.markedForDeletion) {
          return;
        }
        
        // Если это недавно созданные шары, пропускаем их
        const currentTime = this.time.now;
        const recentlyShot = this.shootingManager.getRecentlyShot();
        const gracePeriod = this.shootingManager.getNewBallGracePeriod();
        
        const shotTimeA = recentlyShot[userDataA.id];
        const shotTimeB = recentlyShot[userDataB.id];
        
        if (shotTimeA !== undefined && currentTime - shotTimeA < gracePeriod) {
          return;
        }
        
        if (shotTimeB !== undefined && currentTime - shotTimeB < gracePeriod) {
          return;
        }
        
        // Создаем уникальный идентификатор для этого контакта (по ID шаров)
        // Сортируем ID, чтобы контакт A-B считался тем же, что и B-A
        const contactIds = [userDataA.id, userDataB.id].sort();
        const contactKey = contactIds.join('-');
        
        // Если этот контакт уже обработан, пропускаем его
        if (this.processedContacts.has(contactKey)) {
          return;
        }
        
        // Проверяем уровни шаров напрямую
        const levelA = userDataA.level;
        const levelB = userDataB.level;
        
        // Проверяем, имеют ли шары одинаковый уровень, только в этом случае объединяем
        if (levelA !== undefined && levelB !== undefined && levelA === levelB) {
          // Проверяем, прошло ли достаточно времени с последнего слияния
          // Это предотвращает слишком частые слияния, которые могут вызвать проблемы с физикой
          const now = Date.now();
          if (now - this.lastMergeTime < 50) { // Минимальная задержка между слияниями 50 мс
            return;
          }
          this.lastMergeTime = now;
          
          // Добавляем контакт в обработанные
          this.processedContacts.add(contactKey);
          
          // Устанавливаем таймер для удаления контакта из обработанных через время
          setTimeout(() => {
            this.processedContacts.delete(contactKey);
          }, this.contactProcessingTimeout);
          
          // Проверяем существование тел перед планированием слияния
          // Дополнительная проверка на наличие обоих шаров и их компонентов
          if (this.bodies[userDataA.id]?.body && this.bodies[userDataB.id]?.body &&
              this.bodies[userDataA.id]?.sprite && this.bodies[userDataB.id]?.sprite) {
            
            // Воспроизводим звук слияния монет
            this.sound.play('coinMergeSound');
            
            // Вызываем слияние напрямую, без requestAnimationFrame для лучшей синхронизации
            this.mergeProcessor.scheduleMerge(userDataA.id, userDataB.id);
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке контакта шаров:', error);
      }
    }
  }

  /**
   * Обработка потери WebGL контекста
   */
  handleContextLost() {
    console.error('WebGL контекст потерян. Приостанавливаем физику и логику игры.');
    // Ставим игру на паузу
    this.isPaused = true;
  }

  /**
   * Обработка восстановления WebGL контекста
   */
  handleContextRestored() {
    console.error('WebGL контекст восстановлен. Возобновляем физику и логику игры.');
    
    // Восстанавливаем все объекты, которые могли быть повреждены при потере контекста
    try {
      // Проверяем и сбрасываем соединения шаров
      if (this.mergeProcessor && 'reset' in this.mergeProcessor) {
        this.mergeProcessor.reset();
      }
      
      // Возобновляем игру
      this.isPaused = false;
      
      // Принудительно обновляем все спрайты
      const bodies = this.bodies;
      for (const id in bodies) {
        const bodyData = bodies[id];
        if (bodyData && bodyData.body) {
          const position = bodyData.body.getPosition();
          bodyData.sprite.x = position.x * SCALE;
          bodyData.sprite.y = position.y * SCALE;
          const angle = bodyData.body.getAngle();
          bodyData.sprite.rotation = angle;
        }
      }
    } catch (error) {
      console.error('Ошибка при восстановлении контекста WebGL:', error);
    }
  }

  // Вспомогательный метод для доступа к телам из PhysicsManager
  get bodies(): { [key: string]: GameBody } {
    return this.physicsManager.getBodies();
  }
}

export default MergeGameScene;
