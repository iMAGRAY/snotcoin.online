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
    
    // Создаем текст для отображения комбо-бонуса (изначально невидимый)
    this.comboText = this.scene.add.text(
      10, 40, // Располагаем под основным счетом
      '', 
      { 
        fontFamily: '"Russo One", "Arial", sans-serif', 
        fontSize: '20px', 
        color: '#00FF00', // Зеленый цвет для бонуса
        stroke: '#000000',
        strokeThickness: 3,
        shadow: { color: '#000000', fill: true, offsetX: 1, offsetY: 1, blur: 2 }
      }
    );
    this.comboText.setDepth(100);
    this.comboText.setAlpha(0); // Скрываем до первого комбо
    
    // Обновляем счет в регистре игры для отображения в конце игры
    this.scene.game.registry.set('gameScore', this.score);
  }

  // Увеличиваем счет
  public increaseScore(points: number, isComboActive: boolean = false): void {
    const currentTime = Date.now();
    
    // Проверка на резкое изменение счета
    if (points > this.maxScoreIncreaseThreshold) {
      console.warn(`[ScoreManager] Обнаружено подозрительное изменение счета: +${points}. Применяем ограничение.`);
      points = this.maxScoreIncreaseThreshold;
    }
    
    // Проверяем скорость изменения счета
    const isScoreChangeValid = this.validateScoreChange(points, currentTime);
    if (!isScoreChangeValid) {
      console.warn(`[ScoreManager] Обнаружено подозрительно быстрое изменение счета. Игнорируем.`);
      return;
    }
    
    // Получаем базовые очки (без учета комбо)
    // Предполагаем, что баллы переданы уже с учетом множителя комбо
    const basePoints = isComboActive ? Math.floor(points / (1 + Math.floor((currentTime - this.lastComboTime > this.comboTimeWindow ? 1 : this.currentComboBonus/50 + 1) / 2) * 0.5)) : points;
    const comboBonus = points - basePoints;
    
    // Если это комбо, обновляем суммарный бонус и время последнего комбо
    if (isComboActive && comboBonus > 0) {
      // Проверяем, истекло ли окно комбо
      if (currentTime - this.lastComboTime > this.comboTimeWindow) {
        this.currentComboBonus = comboBonus; // Начинаем новое комбо
      } else {
        this.currentComboBonus += comboBonus; // Добавляем к текущему комбо
      }
      
      this.lastComboTime = currentTime;
      
      // Отображаем текущий бонус за комбо
      this.updateComboText();
    }
    
    // Добавляем запись в историю
    this.addToScoreHistory(this.score, currentTime);
    
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
} 