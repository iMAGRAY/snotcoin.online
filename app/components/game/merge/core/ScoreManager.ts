// ScoreManager.ts - Управление счетом в игре
import * as Phaser from 'phaser';
import { MergeGameSceneType } from '../utils/types';

export class ScoreManager {
  private scene: MergeGameSceneType;
  private score: number = 0;
  private scoreText: Phaser.GameObjects.Text | null = null;

  constructor(scene: MergeGameSceneType) {
    this.scene = scene;
  }

  // Настройка отображения счета
  public setup(): void {
    // Создаем текстовое поле для отображения счета
    this.scoreText = this.scene.add.text(
      10, 10, 
      'Score: 0', 
      { 
        fontFamily: 'Arial', 
        fontSize: '24px', 
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        shadow: { color: '#000000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
      }
    );
    
    // Устанавливаем Z-индекс, чтобы текст был поверх всех элементов
    this.scoreText.setDepth(100);
    
    // Обновляем счет в регистре игры для отображения в конце игры
    this.scene.game.registry.set('gameScore', this.score);
  }

  // Увеличиваем счет
  public increaseScore(points: number): void {
    this.score += points;
    
    // Обновляем текстовое поле
    if (this.scoreText) {
      this.scoreText.setText(`Score: ${this.score}`);
    }
    
    // Обновляем счет в регистре игры для отображения в конце игры
    this.scene.game.registry.set('gameScore', this.score);
    this.scene.game.registry.set('finalScore', this.score);
    
    // Обновляем лучший счет, если текущий превышает предыдущий
    try {
      const savedBestScore = localStorage.getItem('mergeGameBestScore');
      const bestScore = savedBestScore ? parseInt(savedBestScore) : 0;
      
      if (this.score > bestScore) {
        localStorage.setItem('mergeGameBestScore', this.score.toString());
        this.scene.game.registry.set('bestScore', this.score);
      }
    } catch (e) {
      console.error('Ошибка при обновлении лучшего счета:', e);
    }
  }

  // Получить текущий счет
  public getScore(): number {
    return this.score;
  }
} 