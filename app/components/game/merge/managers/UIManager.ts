"use client"

import * as Phaser from 'phaser';

export class UIManager {
  private scene: Phaser.Scene;
  private aimLine: Phaser.GameObjects.Graphics | null = null;
  private verticalGuideLine: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Инициализация линий прицеливания
   * @param canvasWidth Ширина игрового холста
   * @param canvasHeight Высота игрового холста
   */
  public setupUI(canvasWidth: number, canvasHeight: number): void {
    // Создаем линию прицеливания
    this.aimLine = this.scene.add.graphics();
    this.updateAimLine(canvasWidth / 2, canvasHeight);
    
    // Создаем вертикальную направляющую линию
    this.verticalGuideLine = this.scene.add.graphics();
  }

  /**
   * Обновление линии прицеливания
   * @param x Координата X
   * @param height Высота игрового холста
   */
  public updateAimLine(x: number, height: number): void {
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

  /**
   * Обновление вертикальной направляющей линии
   * @param x Координата X
   * @param startY Начальная координата Y
   * @param endY Конечная координата Y
   */
  public updateVerticalGuideLine(x: number, startY: number, endY: number): void {
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

  /**
   * Получение линии прицеливания
   */
  public getAimLine(): Phaser.GameObjects.Graphics | null {
    return this.aimLine;
  }

  /**
   * Получение вертикальной направляющей линии
   */
  public getVerticalGuideLine(): Phaser.GameObjects.Graphics | null {
    return this.verticalGuideLine;
  }

  /**
   * Скрывает вертикальную направляющую линию
   */
  public hideVerticalGuideLine(): void {
    if (this.verticalGuideLine) {
      this.verticalGuideLine.clear();
    }
  }

  /**
   * Очистка ресурсов
   */
  public cleanup(): void {
    if (this.aimLine) {
      this.aimLine.destroy();
      this.aimLine = null;
    }
    
    if (this.verticalGuideLine) {
      this.verticalGuideLine.destroy();
      this.verticalGuideLine = null;
    }
  }

  /**
   * Показать оверлей паузы
   */
  public showPauseOverlay(): void {
    // Заглушка: метод реализован для соответствия интерфейсу
    // Реальная реализация оверлея паузы находится в компонентах React
    console.log('Показываем оверлей паузы');
  }

  /**
   * Скрыть оверлей паузы
   */
  public hidePauseOverlay(): void {
    // Заглушка: метод реализован для соответствия интерфейсу
    // Реальная реализация оверлея паузы находится в компонентах React
    console.log('Скрываем оверлей паузы');
  }
} 