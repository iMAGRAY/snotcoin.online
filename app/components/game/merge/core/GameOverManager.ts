// GameOverManager.ts - Управление окончанием игры
import * as Phaser from 'phaser';
import { GameBody, MergeGameSceneType } from '../utils/types';

export class GameOverManager {
  private scene: MergeGameSceneType;
  private dangerZoneY: number = 0;
  private gameOver: boolean = false;
  private gameOverZone: Phaser.GameObjects.Rectangle | null = null;
  private ballsInDangerZone: Record<string, number> = {};
  private dangerTime: number = 2000; // Время в мс, которое шар должен провести выше линии для Game Over
  private dangerZone: Phaser.GameObjects.Rectangle | null = null;
  private isGameOver: boolean = false;
  private dangerZoneEnabled: boolean = true;
  private gameOverTime: number = 0;
  private readonly DANGER_DURATION: number = 5000;

  constructor(scene: MergeGameSceneType) {
    this.scene = scene;
  }

  // Настройка зоны опасности (Game Over)
  public setupGameOverZone(width: number, lineY: number): void {
    // Устанавливаем зону опасности прямо над горизонтальной линией
    this.dangerZoneY = lineY - 5; // Устанавливаем зону чуть выше линии
    
    // Создаем невидимую зону для определения Game Over
    this.gameOverZone = this.scene.add.rectangle(
      width / 2, 
      lineY / 2 - 5, // Поднимаем зону выше
      width, 
      lineY - 10, // Уменьшаем высоту зоны
      0xFF0000, 
      0 // Полностью прозрачная
    );
  }

  // Проверка шаров в опасной зоне
  public checkBallsInDangerZone(bodies: { [key: string]: GameBody }): void {
    if (this.gameOver) return;
    
    const currentTime = this.scene.time.now;
    let anyBallInDanger = false;
    
    // Проверяем каждый шар
    for (const id in bodies) {
      const bodyData = bodies[id];
      if (bodyData && bodyData.body) {
        // Получаем текущую позицию шара
        const position = bodyData.body.getPosition();
        const yPos = position.y * 120; // 120 - масштаб для перевода физических единиц в пиксели (обновлено с 30)
        
        // Если шар выше опасной линии
        if (yPos < this.dangerZoneY) {
          anyBallInDanger = true;
          
          // Если шар еще не отслеживается в опасной зоне
          if (!this.ballsInDangerZone[id]) {
            this.ballsInDangerZone[id] = currentTime;
            
            // Добавляем визуальное предупреждение
            this.addDangerWarning(bodyData.sprite.x, bodyData.sprite.y);
          } 
          // Если шар уже в опасной зоне, проверяем, как долго он там находится
          else {
            const timeInDanger = currentTime - this.ballsInDangerZone[id];
            
            // Обновляем время в опасной зоне в объекте тела
            bodyData.lastTimeInDangerZone = timeInDanger;
            
            // Обновляем визуальное предупреждение
            this.updateDangerWarning(bodyData.sprite.x, bodyData.sprite.y, timeInDanger);
            
            // Если шар провел достаточно времени в опасной зоне, объявляем Game Over
            if (timeInDanger >= this.dangerTime) {
              this.triggerGameOver();
              return;
            }
          }
        } 
        // Если шар вышел из опасной зоны, удаляем его из отслеживания
        else if (this.ballsInDangerZone[id]) {
          delete this.ballsInDangerZone[id];
          bodyData.lastTimeInDangerZone = null;
          
          // Удаляем визуальное предупреждение
          this.removeDangerWarning(bodyData.sprite.x, bodyData.sprite.y);
        }
      }
    }
    
    // Если ни один шар не находится в опасной зоне, очищаем список
    if (!anyBallInDanger) {
      this.ballsInDangerZone = {};
    }
  }

  // Добавляет визуальное предупреждение для шара в опасной зоне
  private addDangerWarning(x: number, y: number): void {
    // Создаем мигающее красное кольцо вокруг шара
    const warningCircle = this.scene.add.circle(x, y, 25, 0xFF0000, 0);
    warningCircle.setStrokeStyle(2, 0xFF0000, 0.8);
    warningCircle.setData('type', 'warning');
    
    // Анимация пульсации
    this.scene.tweens.add({
      targets: warningCircle,
      scale: { from: 1, to: 1.2 },
      alpha: { from: 0.8, to: 0 },
      duration: 800,
      repeat: -1,
      yoyo: true
    });
  }

  // Обновляет визуальное предупреждение в зависимости от времени в опасной зоне
  private updateDangerWarning(x: number, y: number, timeInDanger: number): void {
    // Находим все предупреждения в этой позиции
    const warnings = this.scene.children.getChildren().filter(child => {
      const gameObj = child as Phaser.GameObjects.GameObject & { x?: number, y?: number };
      return gameObj.getData && gameObj.getData('type') === 'warning' && 
             typeof gameObj.x === 'number' && typeof gameObj.y === 'number' &&
             Math.abs(gameObj.x - x) < 5 && 
             Math.abs(gameObj.y - y) < 5;
    });
    
    // Обновляем цвет в зависимости от времени
    // Чем дольше шар в опасной зоне, тем интенсивнее предупреждение
    warnings.forEach(warning => {
      const progress = Math.min(timeInDanger / this.dangerTime, 1);
      
      // От желтого к красному по мере приближения к Game Over
      const startColor = 0xFFFF00; // Желтый
      const endColor = 0xFF0000;   // Красный
      
      // Вычисляем промежуточный цвет
      const r = Math.floor(255);
      const g = Math.floor(255 * (1 - progress));
      const b = Math.floor(0);
      const interpolatedColor = (r << 16) | (g << 8) | b;
      
      if (warning instanceof Phaser.GameObjects.Shape) {
        warning.setStrokeStyle(2 + progress * 3, interpolatedColor, 0.8);
        
        // Ускоряем анимацию при приближении к Game Over
        const tween = this.scene.tweens.getTweensOf(warning)[0];
        if (tween) {
          tween.timeScale = 1 + progress * 2;
        }
      }
    });
  }

  // Удаляет визуальное предупреждение
  private removeDangerWarning(x: number, y: number): void {
    // Находим все предупреждения в этой позиции
    const warnings = this.scene.children.getChildren().filter(child => {
      const gameObj = child as Phaser.GameObjects.GameObject & { x?: number, y?: number };
      return gameObj.getData && gameObj.getData('type') === 'warning' && 
             typeof gameObj.x === 'number' && typeof gameObj.y === 'number' &&
             Math.abs(gameObj.x - x) < 5 && 
             Math.abs(gameObj.y - y) < 5;
    });
    
    // Удаляем предупреждения
    warnings.forEach(warning => {
      this.scene.tweens.add({
        targets: warning,
        alpha: 0,
        scale: 0.5,
        duration: 300,
        onComplete: () => {
          warning.destroy();
        }
      });
    });
  }

  // Запускает последовательность Game Over
  private triggerGameOver(): void {
    if (this.gameOver) return;
    
    this.gameOver = true;
    
    // Устанавливаем флаг завершения игры в реестре
    this.scene.game.registry.set('gameOver', true);
    
    // Устанавливаем финальный счет
    const finalScore = this.scene.game.registry.get('gameScore') || 0;
    this.scene.game.registry.set('finalScore', finalScore);
    
    // Сохраняем лучший счет, если текущий превышает предыдущий
    try {
      const savedBestScore = localStorage.getItem('mergeGameBestScore');
      const bestScore = savedBestScore ? parseInt(savedBestScore) : 0;
      
      if (finalScore > bestScore) {
        localStorage.setItem('mergeGameBestScore', finalScore.toString());
        this.scene.game.registry.set('bestScore', finalScore);
      } else {
        this.scene.game.registry.set('bestScore', bestScore);
      }
    } catch (e) {
      console.error('Ошибка при сохранении лучшего счета:', e);
    }
    
    // Добавляем визуальные эффекты
    this.addGameOverEffects();
    
    // Воспроизводим звук окончания игры
    if (typeof window !== 'undefined' && this.scene.audioService) {
      this.scene.audioService.playSound('gameOverSound');
    }
  }

  // Добавляет визуальные эффекты при Game Over
  private addGameOverEffects(): void {
    // 1. Затемнение экрана
    const { width, height } = this.scene.game.canvas;
    const overlay = this.scene.add.rectangle(
      width / 2, 
      height / 2, 
      width, 
      height, 
      0x000000, 
      0
    );
    overlay.setDepth(100);
    
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0.5,
      duration: 1000,
      ease: 'Power2'
    });
    
    // 2. Мигание и тряска камеры
    this.scene.cameras.main.shake(1000, 0.01);
    this.scene.cameras.main.flash(500, 255, 0, 0);
    
    // 3. Временно обесцвечиваем все шары
    this.scene.children.getChildren().forEach(child => {
      if (child instanceof Phaser.GameObjects.Sprite && child.texture.key.startsWith('ball')) {
        this.scene.tweens.add({
          targets: child,
          alpha: 0.6,
          duration: 1000,
          ease: 'Power2'
        });
      }
    });
    
    // 4. Добавляем текст GAME OVER
    // Реализация отображения текста берется из MergeGameLauncher.tsx
  }

  // Проверяет, завершена ли игра
  public isOver(): boolean {
    return this.gameOver;
  }

  // Метод для сброса состояния GameOverManager при перезапуске игры
  public reset(): void {
    this.gameOver = false;
    this.isGameOver = false;
    this.gameOverTime = 0;
    this.ballsInDangerZone = {};
    this.dangerZoneEnabled = true;
    
    // Удаляем все предупреждения
    this.scene.children.getChildren()
      .filter(child => child.getData && child.getData('type') === 'warning')
      .forEach(child => {
        if (this.scene.tweens) {
          this.scene.tweens.killTweensOf(child);
        }
        child.destroy();
      });
  }
} 