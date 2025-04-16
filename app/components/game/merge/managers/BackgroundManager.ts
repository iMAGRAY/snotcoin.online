"use client"

import * as Phaser from 'phaser';
import { SCALE } from '../utils/types';

export class BackgroundManager {
  private scene: Phaser.Scene;
  private horizontalLine: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Настройка фоновых элементов
   * @param width Ширина экрана
   * @param height Высота экрана
   * @param customLineY Пользовательская позиция Y горизонтальной линии
   * @returns Позиция Y горизонтальной линии
   */
  public setupBackground(width: number, height: number, customLineY?: number): number {
    // Убираем основной фон, так как он уже установлен в MergeGameLauncher
    // Основной фон (нижний слой) уже добавлен в MergeGameLauncher, 
    // поэтому не добавляем его здесь, чтобы избежать перекрытия
    
    // Деревья (верхний слой фона)
    const trees = this.scene.add.image(width / 2, height / 2, 'trees');
    trees.setDisplaySize(width, height);
    trees.setDepth(-5);
    
    // Добавляем горизонтальную пунктирную линию желтого цвета
    this.horizontalLine = this.scene.add.graphics();
    this.horizontalLine.lineStyle(4, 0xFFFF00, 0.8);
    
    // Определяем позицию линии: используем переданную позицию или вычисляем по умолчанию
    const lineY = customLineY !== undefined ? customLineY : Math.round(height * 0.10);
    
    // Рисуем горизонтальную пунктирную линию
    this.drawHorizontalDashedLine(10, width - 10, lineY, 20, 10);
    
    return lineY;
  }

  /**
   * Рисует пунктирную горизонтальную линию
   * @param startX Начальная X координата
   * @param endX Конечная X координата
   * @param y Координата Y линии
   * @param segmentLength Длина сегмента
   * @param gapLength Длина промежутка
   */
  private drawHorizontalDashedLine(
    startX: number, 
    endX: number, 
    y: number, 
    segmentLength: number, 
    gapLength: number
  ): void {
    if (!this.horizontalLine) return;
    
    let currentX = startX;
    
    while (currentX < endX) {
      const segmentEnd = Math.min(currentX + segmentLength, endX);
      this.horizontalLine.beginPath();
      this.horizontalLine.moveTo(currentX, y);
      this.horizontalLine.lineTo(segmentEnd, y);
      this.horizontalLine.strokePath();
      currentX = segmentEnd + gapLength;
    }
  }

  /**
   * Получает позицию Y горизонтальной линии
   * @returns Позиция Y линии или значение по умолчанию
   */
  public getLineY(): number {
    // Возвращаем позицию линии с учетом пропорций
    const { height } = this.scene.game.canvas;
    return Math.round(height * 0.05);
  }

  /**
   * Очистка ресурсов
   */
  public cleanup(): void {
    if (this.horizontalLine) {
      this.horizontalLine.destroy();
      this.horizontalLine = null;
    }
  }
} 