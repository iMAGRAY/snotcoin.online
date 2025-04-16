// InputManager.ts - Управление вводом пользователя
import * as Phaser from 'phaser';
import { isMobile } from '../utils/utils';

export class InputManager {
  private scene: Phaser.Scene;
  private coinKing: Phaser.GameObjects.Image | null = null;
  private isPointerDown: boolean = false;
  private lastShootTime: number = 0;
  private shootDelay: number = 350; // Задержка между выстрелами в миллисекундах
  private verticalGuideX: number = 0;
  
  // Добавляем свойства для зоны проигрыша
  private gameOverZone: { x: number, y: number, width: number, height: number } = { x: 0, y: 0, width: 0, height: 0 };
  private gameOverCountdown: Phaser.Time.TimerEvent | null = null;
  private isGameOverCountdownActive: boolean = false;
  private gameOverText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public setCoinKing(coinKing: Phaser.GameObjects.Image): void {
    this.coinKing = coinKing;
  }

  public setup(updateAimLine: Function, updateVerticalGuideLine: Function, shootFromCoinKing: Function): void {
    const isMobileDevice = isMobile();
    
    // Добавляем обработчики для перемещения CoinKing
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.coinKing && this.isPointerDown) {
        // Перемещаем CoinKing только при зажатой кнопке/пальце
        const { width, height } = this.scene.game.canvas;
        // Уменьшаем зону перемещения, чтобы CoinKing не выходил за границы
        const minX = width * 0.1; // 10% от ширины экрана
        const maxX = width * 0.9; // 90% от ширины экрана
        const newX = Phaser.Math.Clamp(pointer.x, minX, maxX);
        this.coinKing.x = newX;
        
        // Перемещаем следующий шар вместе с CoinKing
        const mergeScene = this.scene as any;
        if (mergeScene.nextBall) {
          mergeScene.nextBall.x = newX;
        }
        
        this.verticalGuideX = newX;
        // Обновляем линию прицеливания
        updateAimLine(newX, height);
        
        // Создаем прямоугольную область над линией
        const graphics = this.scene.add.graphics();
        graphics.clear();
        
        // Сохраняем координаты зоны проигрыша (без отображения)
        this.gameOverZone = {
          x: minX,
          y: height * 0.01,
          width: maxX - minX,
          height: height * 0.135
        };
      }
    });
    
    // Обработка кликов/тапов 
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPointerDown = true;
      
      if (this.coinKing) {
        // Начальное положение при нажатии
        const { width, height } = this.scene.game.canvas;
        // Используем те же ограничения, что и при движении
        const minX = width * 0.1;
        const maxX = width * 0.9;
        const newX = Phaser.Math.Clamp(pointer.x, minX, maxX);
        this.coinKing.x = newX;
        
        // Перемещаем следующий шар вместе с CoinKing
        const mergeScene = this.scene as any;
        if (mergeScene.nextBall) {
          mergeScene.nextBall.x = newX;
        }
        
        this.verticalGuideX = newX;
        // Обновляем линию прицеливания
        updateAimLine(newX, height);
        
        // Создаем прямоугольную область над линией
        const graphics = this.scene.add.graphics();
        graphics.clear();
        
        // Сохраняем координаты зоны проигрыша (без отображения)
        this.gameOverZone = {
          x: minX,
          y: height * 0.01,
          width: maxX - minX,
          height: height * 0.135
        };
      }
    });
    
    this.scene.input.on('pointerup', () => {
      if (this.coinKing) {
        this.verticalGuideX = this.coinKing.x;
        // Обновление вертикальной линии теперь выполняется в update() в MergeGameScene
        
        // Выстрел из CoinKing при отпускании кнопки мыши/пальца
        const currentTime = this.scene.time.now;
        if (currentTime - this.lastShootTime > this.shootDelay) {
          shootFromCoinKing();
          this.lastShootTime = currentTime;
        }
      }
      
      this.isPointerDown = false;
    });
  }

  public getIsPointerDown(): boolean {
    return this.isPointerDown;
  }

  public getVerticalGuideX(): number {
    return this.verticalGuideX;
  }

  public setVerticalGuideX(x: number): void {
    this.verticalGuideX = x;
  }
  
  /**
   * Включение ввода
   */
  public enableInput(): void {
    // Включаем обработку ввода
    this.scene.input.enabled = true;
  }
  
  /**
   * Отключение ввода
   */
  public disableInput(): void {
    // Отключаем обработку ввода
    this.scene.input.enabled = false;
    this.isPointerDown = false;
  }

  /**
   * Проверяет, находятся ли шары в зоне проигрыша
   * @param balls Массив шаров на игровом поле
   */
  public checkBallsInGameOverZone(balls: Array<any> | Record<string, any>): void {
    if (!balls || Object.keys(balls).length === 0 || !this.gameOverZone) return;
    
    const currentTime = this.scene.time.now;
    const mergeScene = this.scene as any;
    const recentlyShot = mergeScene.shootingManager?.getRecentlyShot?.() || {};
    const immunityPeriod = 300; // 300 мс иммунитета для новых шаров
    
    // Проверяем каждый шар
    for (const key in balls) {
      const ball = balls[key];
      if (!ball || !ball.sprite) continue;
      
      // Получаем ID шара
      const ballId = ball.body?.getUserData?.()?.id;
      if (!ballId) continue;
      
      // Проверяем, не является ли шар недавно брошенным
      const shotTime = recentlyShot[ballId];
      if (shotTime && currentTime - shotTime < immunityPeriod) {
        // Шар имеет иммунитет, пропускаем его
        continue;
      }
      
      // Получаем позицию шара
      const ballX = ball.sprite.x;
      const ballY = ball.sprite.y;
      const ballRadius = ball.sprite.displayWidth / 2;
      
      // Проверяем, находится ли шар в зоне проигрыша
      if (
        ballX + ballRadius > this.gameOverZone.x &&
        ballX - ballRadius < this.gameOverZone.x + this.gameOverZone.width &&
        ballY + ballRadius > this.gameOverZone.y &&
        ballY - ballRadius < this.gameOverZone.y + this.gameOverZone.height
      ) {
        // Шар находится в зоне проигрыша, начинаем отсчет
        this.startGameOverCountdown();
        return;
      }
    }
    
    // Если ни один шар не в зоне проигрыша, сбрасываем отсчет
    if (this.isGameOverCountdownActive) {
      this.stopGameOverCountdown();
    }
  }
  
  /**
   * Запускает отсчет 3 секунд до проигрыша
   */
  private startGameOverCountdown(): void {
    if (this.isGameOverCountdownActive) return;
    
    this.isGameOverCountdownActive = true;
    
    // Создаем текст с отсчетом с улучшенным стилем
    if (!this.gameOverText) {
      this.gameOverText = this.scene.add.text(
        this.scene.game.canvas.width / 2, 
        this.scene.game.canvas.height / 2, 
        '3', 
        { 
          fontSize: '120px', 
          color: '#FF3333',
          fontFamily: 'Impact, "Arial Black", sans-serif',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 8,
          shadow: { offsetX: 3, offsetY: 3, color: '#000000', blur: 5, stroke: true, fill: true }
        }
      ).setOrigin(0.5).setDepth(1000);
      
      // Добавляем свечение
      const glow = this.scene.plugins.get('Phaser3Glow') as any;
      if (glow) {
        try {
          glow.add(this.gameOverText, {
            distance: 15,
            color: 0xFF0000
          });
        } catch (error) {
          console.warn('Плагин свечения недоступен:', error);
        }
      }
    } else {
      this.gameOverText.setText('3');
      this.gameOverText.setVisible(true);
    }
    
    // Анимация пульсации для текста
    this.scene.tweens.add({
      targets: this.gameOverText,
      scale: { from: 0.8, to: 1.2 },
      yoyo: true,
      duration: 500,
      repeat: 5, // Повторяем 5 раз (на весь период отсчета)
      ease: 'Sine.easeInOut'
    });
    
    // Запускаем таймер на 3 секунды
    this.gameOverCountdown = this.scene.time.addEvent({
      delay: 3000,
      callback: () => {
        this.triggerGameOver();
      },
      callbackScope: this
    });
    
    // Обновляем текст отсчета каждую секунду с эффектами
    this.scene.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        if (!this.gameOverText || !this.isGameOverCountdownActive) return;
        
        const currentTime = parseInt(this.gameOverText.text);
        if (currentTime > 1) {
          // Анимация для смены цифры
          this.scene.tweens.add({
            targets: this.gameOverText,
            alpha: 0,
            scale: 1.5,
            duration: 150,
            onComplete: () => {
              this.gameOverText!.setText((currentTime - 1).toString());
              // Анимация появления новой цифры
              this.scene.tweens.add({
                targets: this.gameOverText,
                alpha: 1,
                scale: 1,
                duration: 150
              });
            }
          });
        }
      },
      callbackScope: this
    });
    
    // Добавляем звуковой эффект тиканья, если он доступен
    try {
      const mergeScene = this.scene as any;
      if (mergeScene.audioService && mergeScene.audioService.playSound) {
        mergeScene.audioService.playSound('tickSound');
      }
    } catch (error) {
      console.warn('Не удалось воспроизвести звук тиканья:', error);
    }
  }
  
  /**
   * Останавливает отсчет до проигрыша
   */
  private stopGameOverCountdown(): void {
    if (!this.isGameOverCountdownActive) return;
    
    this.isGameOverCountdownActive = false;
    
    if (this.gameOverCountdown) {
      this.gameOverCountdown.remove();
      this.gameOverCountdown = null;
    }
    
    if (this.gameOverText) {
      this.gameOverText.setVisible(false);
    }
  }
  
  /**
   * Вызывает функцию проигрыша в сцене игры
   */
  private triggerGameOver(): void {
    this.stopGameOverCountdown();
    
    // Вызываем метод gameOver в сцене игры
    const mergeScene = this.scene as any;
    if (mergeScene.gameOver) {
      mergeScene.gameOver();
    }
  }
} 