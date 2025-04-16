// ScoreManager.ts - Управление счетом в игре
import * as Phaser from 'phaser';
import { MergeGameSceneType } from '../utils/types';

export class ScoreManager {
  private scene: MergeGameSceneType;
  private score: number = 0;
  private scoreText: Phaser.GameObjects.Text | null = null;
  private comboText: Phaser.GameObjects.Text | null = null; // Текст для отображения комбо-бонуса
  private comboTimeout: number | null = null; // Таймер для скрытия комбо-бонуса
  private currentComboBonus: number = 0; // Суммарный бонус за текущее комбо
  private lastComboTime: number = 0; // Время последнего комбо
  private comboTimeWindow: number = 3000; // 3 секунды для комбо-окна

  // Добавляем переменные для отслеживания быстрых изменений счета
  private scoreHistory: {value: number, timestamp: number}[] = [];
  private maxHistorySize: number = 10;
  private maxScoreIncreaseThreshold: number = 1000; // Максимально допустимое изменение за один раз
  private maxScoreIncreaseRatePerSecond: number = 2000; // Максимальная скорость изменения в секунду

  constructor(scene: MergeGameSceneType) {
    this.scene = scene;
  }

  // Настройка отображения счета
  public setup(): void {
    // Создаем текстовое поле для отображения счета
    this.scoreText = this.scene.add.text(
      20, 20,
      '0',
      {
        fontFamily: '"Russo One", "Arial", sans-serif',
        fontSize: '48px',
        color: '#FFD700',
        stroke: '#000000',
        strokeThickness: 6,
        shadow: { 
          color: '#000000', 
          fill: true, 
          offsetX: 2, 
          offsetY: 2, 
          blur: 4 
        }
      }
    );
    
    // Устанавливаем Z-индекс
    this.scoreText.setDepth(100);
    
    // Создаем текст для отображения комбо-бонуса
    this.comboText = this.scene.add.text(
      20, 80,
      '',
      {
        fontFamily: '"Russo One", "Arial", sans-serif',
        fontSize: '32px',
        color: '#00FF00',
        stroke: '#000000',
        strokeThickness: 3,
        shadow: { 
          color: '#000000', 
          fill: true, 
          offsetX: 1, 
          offsetY: 1, 
          blur: 2 
        }
      }
    );
    this.comboText.setDepth(100);
    this.comboText.setAlpha(0);
    
    // Обновляем счет в регистре игры
    this.scene.game.registry.set('gameScore', this.score);
  }

  // Увеличиваем счет
  public increaseScore(points: number, isComboActive: boolean = false): void {
    const currentTime = Date.now();
    
    // Добавляем запись в историю
    this.addToScoreHistory(this.score, currentTime);
    
    this.score += points;
    
    // Обновляем текстовое поле с анимацией
    if (this.scoreText) {
      // Создаем временный текст для анимации
      const scorePopup = this.scene.add.text(
        this.scoreText.x,
        this.scoreText.y - 50, // Начальная позиция выше основного счета
        `+${points}`,
        {
          fontFamily: '"Russo One", "Arial", sans-serif',
          fontSize: '32px',
          color: '#FFD700',
          stroke: '#000000',
          strokeThickness: 4,
          shadow: { 
            color: '#000000', 
            fill: true, 
            offsetX: 2, 
            offsetY: 2, 
            blur: 4 
          }
        }
      );
      scorePopup.setDepth(100);

      // Анимация появления и исчезновения
      this.scene.tweens.add({
        targets: scorePopup,
        y: scorePopup.y - 30, // Поднимаем текст выше
        alpha: 0,
        duration: 2000, // Увеличиваем длительность с 1000 до 2000 мс
        ease: 'Power2',
        onComplete: () => {
          scorePopup.destroy();
        }
      });

      // Анимация основного счета
      this.scene.tweens.add({
        targets: this.scoreText,
        scale: 1.5,
        duration: 150,
        yoyo: true,
        ease: 'Bounce.out',
        onStart: () => {
          this.scoreText?.setText(this.formatScore(this.score));
        }
      });
    }
    
    // Обновляем счет в регистре игры
    this.scene.game.registry.set('gameScore', this.score);
    this.scene.game.registry.set('finalScore', this.score);
    
    // Обновляем лучший счет
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

  /**
   * Обновляет текст комбо-бонуса на экране
   */
  private updateComboText(): void {
    if (!this.comboText || this.currentComboBonus <= 0) return;
    
    // Обновляем текст комбо-бонуса с общей суммой бонуса
    this.comboText.setText(`+${this.currentComboBonus} за комбо`);
    
    // Если текст скрыт, показываем его с эффектной анимацией
    if (this.comboText.alpha < 1) {
      this.scene.tweens.add({
        targets: this.comboText,
        alpha: 1,
        scale: { from: 0.8, to: 1 },
        duration: 300,
        ease: 'Back.out'
      });
    } else {
      // Если текст уже видимый, делаем эффект пульсации
      this.scene.tweens.add({
        targets: this.comboText,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 150,
        yoyo: true,
        ease: 'Sine.easeInOut'
      });
    }
    
    // Сбрасываем предыдущий таймер, если он существует
    if (this.comboTimeout !== null) {
      clearTimeout(this.comboTimeout);
    }
    
    // Устанавливаем таймер на скрытие текста через 2.5 секунды
    this.comboTimeout = window.setTimeout(() => {
      if (this.comboText && this.comboText.active) {
        this.scene.tweens.add({
          targets: this.comboText,
          alpha: 0,
          duration: 500,
          ease: 'Power2',
          onComplete: () => {
            // Сбрасываем суммарный бонус после исчезновения текста
            this.currentComboBonus = 0;
          }
        });
      }
      this.comboTimeout = null;
    }, 2500);
  }

  /**
   * Отображает бонус за комбо под счетом
   * @param comboMultiplier Множитель комбо
   */
  public showComboBonus(comboMultiplier: number): void {
    // Этот метод теперь просто обновляет текст комбо
    // Весь логика подсчета переведена в метод increaseScore и updateComboText
    if (comboMultiplier <= 1) return;
    
    // Вызываем обновление текста для показа текущего накопленного бонуса
    this.updateComboText();
  }

  /**
   * Сбрасывает текущий комбо-бонус
   */
  public resetComboBonus(): void {
    this.currentComboBonus = 0;
    this.lastComboTime = 0;
    
    // Скрываем текст комбо-бонуса
    if (this.comboText && this.comboText.alpha > 0) {
      this.scene.tweens.add({
        targets: this.comboText,
        alpha: 0,
        duration: 300,
        ease: 'Power2'
      });
    }
    
    // Сбрасываем таймер
    if (this.comboTimeout !== null) {
      clearTimeout(this.comboTimeout);
      this.comboTimeout = null;
    }
  }

  // Получить текущий счет
  public getScore(): number {
    return this.score;
  }

  // Добавляем новые методы для проверки изменения счета
  
  /**
   * Добавляет запись в историю изменений счета
   * @param score Текущее значение счета
   * @param timestamp Временная метка
   */
  private addToScoreHistory(score: number, timestamp: number): void {
    this.scoreHistory.push({value: score, timestamp});
    
    // Удаляем старые записи, если превышен размер истории
    if (this.scoreHistory.length > this.maxHistorySize) {
      this.scoreHistory.shift();
    }
  }
  
  /**
   * Проверяет валидность изменения счета на основе истории
   * @param points Количество добавляемых очков
   * @param currentTime Текущее время
   * @returns true если изменение валидно, false если подозрительно
   */
  private validateScoreChange(points: number, currentTime: number): boolean {
    // Если история пуста - считаем валидным
    if (this.scoreHistory.length === 0) return true;
    
    // Проверяем скорость изменения счета за последнюю секунду
    const recentEntries = this.scoreHistory.filter(
      entry => currentTime - entry.timestamp <= 1000
    );
    
    if (recentEntries.length > 0) {
      // Считаем сумму всех изменений за последнюю секунду
      const totalRecentIncrease = recentEntries.reduce(
        (sum, entry, index, array) => {
          if (index === 0) return 0;
          return sum + Math.max(0, entry.value - (array[index - 1]?.value || 0));
        }, 
        0
      );
      
      // Если сумма изменений + текущее изменение превышает порог - считаем подозрительным
      if (totalRecentIncrease + points > this.maxScoreIncreaseRatePerSecond) {
        return false;
      }
    }
    
    return true;
  }

  // Добавляем метод для форматирования счета
  private formatScore(score: number): string {
    return score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }
} 