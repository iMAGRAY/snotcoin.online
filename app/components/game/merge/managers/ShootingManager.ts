"use client"

import * as Phaser from 'phaser';
import * as planck from 'planck';
import { SCALE, GameBody } from '../utils/types';
import { BallFactory } from '../core/BallFactory';
import { PhysicsManager } from '../physics/PhysicsManager';
import { InputManager } from '../input/InputManager';
import { UIManager } from './UIManager';
import * as gameUtils from '../utils/utils';

export class ShootingManager {
  private scene: Phaser.Scene;
  private ballFactory: BallFactory;
  private physicsManager: PhysicsManager;
  private inputManager: InputManager;
  private uiManager: UIManager;
  
  private coinKing: Phaser.GameObjects.Image | null = null;
  private nextBall: Phaser.GameObjects.Sprite | null = null;
  private recentlyShot: Record<string, number> = {};
  private newBallGracePeriod: number = 320;

  constructor(
    scene: Phaser.Scene, 
    ballFactory: BallFactory, 
    physicsManager: PhysicsManager,
    inputManager: InputManager,
    uiManager: UIManager
  ) {
    this.scene = scene;
    this.ballFactory = ballFactory;
    this.physicsManager = physicsManager;
    this.inputManager = inputManager;
    this.uiManager = uiManager;
  }

  /**
   * Инициализация CoinKing и следующего шара
   * @param width Ширина игрового холста
   * @param lineY Позиция Y горизонтальной линии
   */
  public setup(width: number, lineY: number): void {
    // Добавляем CoinKing в верхнюю часть игровой зоны
    // Позиционируем ниже линии 
    this.coinKing = this.scene.add.image(width / 2, lineY + 45, 'coinKing');
    this.coinKing.setScale(0.8);
    
    // Устанавливаем CoinKing в InputManager
    this.inputManager.setCoinKing(this.coinKing);
    
    // Генерируем уровень для следующего шара
    this.ballFactory.generateNextBallLevel();
    
    // Создаем следующий шар для броска
    this.ballFactory.createNextBall(this.coinKing.x, this.coinKing.y);
    this.nextBall = this.ballFactory.getNextBall();
    
    // Настраиваем обработчики ввода
    this.inputManager.setup(
      this.uiManager.updateAimLine.bind(this.uiManager),
      this.uiManager.updateVerticalGuideLine.bind(this.uiManager),
      this.shootFromCoinKing.bind(this)
    );
    
    // Устанавливаем начальную вертикальную направляющую линию,
    // но не рисуем её сразу, это будет делать update() в MergeGameScene
    this.inputManager.setVerticalGuideX(width / 2);
    
    // Больше не вызываем здесь updateVerticalGuideLine напрямую
    // this.uiManager.updateVerticalGuideLine(width / 2, coinKingBottomY, this.scene.game.canvas.height);
  }

  /**
   * Метод выстрела из CoinKing
   */
  public shootFromCoinKing(): void {
    const time = this.scene.time.now;
    
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
    const y = (this.coinKing.y + this.coinKing.displayHeight / 2) / SCALE;
    
    // Создаем физическое тело шара
    let id = '';
    
    if (isSpecial) {
      // Создаем специальный шар (Bull, Bomb и т.д.)
      const result = this.physicsManager.createSpecialCircle(x, y, radius, isSpecial);
      id = result ? String(result.id) : '';
    } else {
      // Создаем обычный шар соответствующего уровня
      // Радиус для шаров 1-го уровня уже уменьшается в методе createCircle,
      // поэтому нам не нужно здесь явно уменьшать радиус
      const result = this.physicsManager.createCircle(x, y, radius, nextBallLevel);
      id = result ? String(result.id) : '';
    }
    
    // Добавляем созданный шар в список недавних с отметкой времени
    this.recentlyShot[id] = time;
    
    // Генерируем новый шар для следующего выстрела
    this.ballFactory.generateNextBallLevel();
    this.ballFactory.createNextBall(this.coinKing.x, this.coinKing.y);
    this.nextBall = this.ballFactory.getNextBall();
    
    // Сохраняем позицию вертикальной линии
    this.inputManager.setVerticalGuideX(this.coinKing.x);
  }

  /**
   * Получение списка недавно выстрелянных шаров
   * @returns Запись с ID шаров и временем выстрела
   */
  public getRecentlyShot(): Record<string, number> {
    return this.recentlyShot;
  }

  /**
   * Получение периода игнорирования для новых шаров
   */
  public getNewBallGracePeriod(): number {
    return this.newBallGracePeriod;
  }

  /**
   * Получение CoinKing
   */
  public getCoinKing(): Phaser.GameObjects.Image | null {
    return this.coinKing;
  }

  /**
   * Получение следующего шара
   */
  public getNextBall(): Phaser.GameObjects.Sprite | null {
    return this.nextBall;
  }

  /**
   * Очистка ресурсов
   */
  public cleanup(): void {
    this.recentlyShot = {};
    
    if (this.nextBall) {
      this.nextBall.destroy();
      this.nextBall = null;
    }
    
    if (this.coinKing) {
      this.coinKing.destroy();
      this.coinKing = null;
    }
  }

  /**
   * Сброс состояния менеджера
   * @param width Ширина игрового холста
   * @param lineY Позиция Y горизонтальной линии
   */
  public reset(width: number, lineY: number): void {
    // Очищаем старые данные
    this.cleanup();
    
    // Сбрасываем список недавно выстрелянных шаров
    this.recentlyShot = {};
    
    // Заново инициализируем CoinKing и следующий шар
    this.setup(width, lineY);
  }
} 