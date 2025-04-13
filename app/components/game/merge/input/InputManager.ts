// InputManager.ts - Управление вводом пользователя
import * as Phaser from 'phaser';
import { isMobile } from '../utils/utils';

export class InputManager {
  private scene: Phaser.Scene;
  private coinKing: Phaser.GameObjects.Image | null = null;
  private isPointerDown: boolean = false;
  private lastShootTime: number = 0;
  private shootDelay: number = 500; // Задержка между выстрелами в миллисекундах
  private verticalGuideX: number = 0;

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
      if (this.coinKing) {
        // Для мобильных устройств перемещаем CoinKing только при зажатом пальце
        // Для компьютера перемещаем всегда при движении мыши
        if (!isMobileDevice || (isMobileDevice && this.isPointerDown)) {
          // Обновляем только позицию X, Y остается фиксированной
          const { width } = this.scene.game.canvas;
          const newX = Phaser.Math.Clamp(pointer.x, 50, width - 50);
          this.coinKing.x = newX;
          
          // Перемещаем следующий шар вместе с CoinKing
          const mergeScene = this.scene as any;
          if (mergeScene.nextBall) {
            mergeScene.nextBall.x = newX;
          }
          
          // Обновляем линию прицеливания
          updateAimLine(newX, this.scene.game.canvas.height);
        }
      }
    });
    
    // Обработка кликов/тапов 
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPointerDown = true;
      
      if (this.coinKing) {
        this.verticalGuideX = this.coinKing.x;
        // Обновляем линию с зафиксированной позицией
        updateVerticalGuideLine(this.verticalGuideX, 75, this.scene.game.canvas.height);
      }
      
      // На компьютере стреляем сразу при клике, на мобильных - только при отпускании
      if (!isMobileDevice) {
        // Выстрел из CoinKing
        const currentTime = this.scene.time.now;
        if (currentTime - this.lastShootTime > this.shootDelay && this.coinKing) {
          shootFromCoinKing();
          this.lastShootTime = currentTime;
        }
      }
    });
    
    this.scene.input.on('pointerup', () => {
      // На мобильных устройствах стреляем при отпускании пальца
      if (isMobileDevice) {
        if (this.coinKing) {
          this.verticalGuideX = this.coinKing.x;
          // Обновляем линию с зафиксированной позицией
          updateVerticalGuideLine(this.verticalGuideX, 75, this.scene.game.canvas.height);
        }
        
        // Выстрел из CoinKing при отпускании пальца
        const currentTime = this.scene.time.now;
        if (currentTime - this.lastShootTime > this.shootDelay && this.coinKing) {
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
} 