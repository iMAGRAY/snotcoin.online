
// ScoreManager.ts - Управление игровым счетом
import * as Phaser from 'phaser';

export class ScoreManager {
  private scene: Phaser.Scene;
  private score: number = 0;
  private scoreText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public setup(): void {
    // Добавляем счет в левом верхнем углу игровой зоны
    this.scoreText = this.scene.add.text(12, 10, 'Счет: 0', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#FFFFFF', 
      stroke: '#000000',
      strokeThickness: 3,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, stroke: true, fill: true }
    });
    this.scoreText.setDepth(100); // Устанавливаем высокое значение depth, чтобы текст был поверх всего
  }

  public increaseScore(points: number): void {
    this.score += points;
    
    // Обновляем отображение счета
    if (this.scoreText) {
      this.scoreText.setText('Счет: ' + this.score);
    }
    
    // Сохраняем счет в реестре игры для доступа из React-компонента
    this.scene.game.registry.set('gameScore', this.score);
  }

  public getScore(): number {
    return this.score;
  }
}
