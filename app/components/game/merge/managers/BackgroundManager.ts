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
   * @returns Позиция Y горизонтальной линии
   */
  public setupBackground(width: number, height: number): number {
    // Убираем основной фон, так как он уже установлен в MergeGameLauncher
    // Основной фон (нижний слой) уже добавлен в MergeGameLauncher, 
    // поэтому не добавляем его здесь, чтобы избежать перекрытия
    
    // Деревья (верхний слой фона)
    const trees = this.scene.add.image(width / 2, height / 2, 'trees');
    trees.setDisplaySize(width, height);
    trees.setDepth(-5);
    
    // Добавляем горизонтальную пунктирную линию желтого цвета
    this.horizontalLine = this.scene.add.graphics();
    this.horizontalLine.lineStyle(2, 0xFFFF00, 0.8);
    
    // Определяем позицию линии
    const lineY = 75;
    
    // Рисуем горизонтальную пунктирную линию
    this.drawHorizontalDashedLine(10, width - 10, lineY, 15, 8);
    
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
} 