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
      if (this.coinKing && this.isPointerDown) {
        // Перемещаем CoinKing только при зажатой кнопке/пальце
        const { width } = this.scene.game.canvas;
        const newX = Phaser.Math.Clamp(pointer.x, 50, width - 50);
        this.coinKing.x = newX;
        
        // Перемещаем следующий шар вместе с CoinKing
        const mergeScene = this.scene as any;
        if (mergeScene.nextBall) {
          mergeScene.nextBall.x = newX;
        }
        
        this.verticalGuideX = newX;
        // Обновляем линию прицеливания
        updateAimLine(newX, this.scene.game.canvas.height);
      }
    });
    
    // Обработка кликов/тапов 
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPointerDown = true;
      
      if (this.coinKing) {
        // Начальное положение при нажатии
        const { width } = this.scene.game.canvas;
        const newX = Phaser.Math.Clamp(pointer.x, 50, width - 50);
        this.coinKing.x = newX;
        
        // Перемещаем следующий шар вместе с CoinKing
        const mergeScene = this.scene as any;
        if (mergeScene.nextBall) {
          mergeScene.nextBall.x = newX;
        }
        
        this.verticalGuideX = newX;
        // Обновляем линию прицеливания
        updateAimLine(newX, this.scene.game.canvas.height);
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
} 