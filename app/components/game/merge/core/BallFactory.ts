// BallFactory.ts - Фабрика для создания и управления шарами
import * as Phaser from 'phaser';
import { SCALE } from '../utils/types';
import * as gameUtils from '../utils/utils';
import { PhysicsManager } from '../physics/PhysicsManager';

export class BallFactory {
  private scene: Phaser.Scene;
  private physicsManager: PhysicsManager;
  private nextBall: Phaser.GameObjects.Sprite | null = null;
  private nextBallLevel: number = 1;
  private maxLevel: number = 12;
  private maxRandomLevel: number = 6;

  constructor(scene: Phaser.Scene, physicsManager: PhysicsManager) {
    this.scene = scene;
    this.physicsManager = physicsManager;
  }

  public generateNextBallLevel(): void {
    // Генерируем случайный уровень от 1 до maxRandomLevel (обычно до 6)
    // Более редко генерируем шары выше 3 уровня
    let level = 1;
    const rand = Math.random();
    
    if (rand < 0.65) {
      // 65% для шаров 1 уровня
      level = 1;
    } else if (rand < 0.85) {
      // 20% для шаров 2 уровня
      level = 2;
    } else if (rand < 0.95) {
      // 10% для шаров 3 уровня
      level = 3;
    } else {
      // 5% для шаров 4, 5, 6 уровня
      level = 4 + Math.floor(Math.random() * (this.maxRandomLevel - 3));
    }
    
    this.nextBallLevel = level;
  }

  public createNextBall(coinKingX: number, coinKingY: number): void {
    // Если уже есть следующий шар, удаляем его
    if (this.nextBall) {
      this.nextBall.destroy();
    }
    
    // Используем позицию coinKing для размещения шара
    const ballY = coinKingY + 20; // Немного ниже CoinKing
    
    // Получаем радиус шара для текущего уровня
    const radius = gameUtils.getRadiusByLevel(this.nextBallLevel);
    // Физический размер шара (в пикселях)
    const ballSize = radius * 2 * SCALE;
    
    // Создаем спрайт шара с изображением, соответствующим уровню
    this.nextBall = this.scene.add.sprite(coinKingX, ballY, `ball${this.nextBallLevel}`);
    this.nextBall.setDisplaySize(ballSize, ballSize);
    
    // Сохраняем уровень как свойство шара
    this.nextBall.setData('level', this.nextBallLevel);
  }

  public getNextBall(): Phaser.GameObjects.Sprite | null {
    return this.nextBall;
  }

  public getNextBallLevel(): number {
    return this.nextBallLevel;
  }

  public setNextBall(ball: Phaser.GameObjects.Sprite | null): void {
    this.nextBall = ball;
  }

  public setNextBallLevel(level: number): void {
    this.nextBallLevel = level;
  }

  public createMergedBall(newX: number, newY: number, newLevel: number): void {
    try {
      // Проверяем, не превышает ли новый уровень максимальный
      if (newLevel > this.maxLevel) {
        console.error('Невозможно создать шар: превышен максимальный уровень');
        return;
      }
      
      // Проверяем, что физический менеджер существует
      if (!this.physicsManager) {
        console.error('Ошибка: PhysicsManager не инициализирован');
        return;
      }
      
      // Проверяем, что мир существует
      if (!this.physicsManager.getWorld()) {
        console.error('Ошибка: Физический мир не инициализирован');
        return;
      }
      
      // Получаем радиус для нового шара
      const radius = gameUtils.getRadiusByLevel(newLevel);
      
      // Приоритезируем создание шара
      // Использовать requestAnimationFrame для создания шара в следующем кадре рендеринга
      requestAnimationFrame(() => {
        try {
          // Создаем новый шар через PhysicsManager
          const result = this.physicsManager.createCircle(newX, newY, radius, newLevel);
          
          // Проверяем результат создания
          if (!result || !result.body) {
            console.error('Ошибка: Не удалось создать физическое тело шара');
          }
        } catch (innerError) {
          console.error('Ошибка при создании шара в requestAnimationFrame:', innerError);
        }
      });
    } catch (error) {
      console.error('Критическая ошибка при создании шара слияния:', error);
    }
  }
} 