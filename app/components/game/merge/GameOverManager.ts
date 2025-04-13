
// GameOverManager.ts - Управление завершением игры
import * as Phaser from 'phaser';

export class GameOverManager {
  private scene: Phaser.Scene;
  private gameOverZone: Phaser.Geom.Rectangle | null = null;
  private isGameOverCountdownActive: boolean = false;
  private gameOverCountdown: number = 0;
  private gameOverText: Phaser.GameObjects.Text | null = null;
  private gameOverTimer: Phaser.Time.TimerEvent | null = null;
  private isGameOver: boolean = false;
  private countdownBg: Phaser.GameObjects.Shape | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public setupGameOverZone(width: number, lineY: number, safetyOffset: number = 5): void {
    // Создаем зону опасности над линией (от 0 до lineY) с дополнительным отступом вниз
    this.gameOverZone = new Phaser.Geom.Rectangle(0, 0, width, lineY + safetyOffset);
    
    // Создаем текст для отсчета до Game Over (изначально скрыт)
    this.gameOverText = this.scene.add.text(width / 2, this.scene.game.canvas.height / 2, '3', {
      fontFamily: 'Arial',
      fontSize: '140px',
      color: '#FF0000',
      stroke: '#000000',
      strokeThickness: 10,
      shadow: { offsetX: 3, offsetY: 3, color: '#000000', blur: 5, stroke: true, fill: true }
    });
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setAlpha(0);
    this.gameOverText.setDepth(200);
  }

  public checkBallsInDangerZone(bodies: { [key: string]: any }): boolean {
    if (!this.gameOverZone) return false;
    
    let ballsInDangerZone = false;
    
    for (const id in bodies) {
      const bodyData = bodies[id];
      if (bodyData && bodyData.body && bodyData.sprite) {
        // Проверяем только те шары, которые не двигаются слишком быстро
        const velocity = bodyData.body.getLinearVelocity();
        const speedSquared = velocity.x * velocity.x + velocity.y * velocity.y;
        
        // Если шар движется достаточно медленно и находится в зоне опасности
        if (speedSquared < 20 && this.gameOverZone.contains(bodyData.sprite.x, bodyData.sprite.y)) {
          ballsInDangerZone = true;
          break;
        }
      }
    }
    
    // Если шары находятся в зоне опасности и отсчет еще не запущен, начинаем его
    if (ballsInDangerZone && !this.isGameOverCountdownActive && !this.isGameOver) {
      this.startGameOverCountdown();
    }
    // Если шаров нет в зоне опасности, но отсчет запущен, останавливаем его
    else if (!ballsInDangerZone && this.isGameOverCountdownActive) {
      this.stopGameOverCountdown();
    }
    
    return ballsInDangerZone;
  }

  public startGameOverCountdown(): void {
    if (this.isGameOverCountdownActive || this.isGameOver) return;
    
    this.isGameOverCountdownActive = true;
    this.gameOverCountdown = 3; // Начинаем с 3 секунд
    
    // Создаем черный полупрозрачный фон для лучшей видимости таймера
    const { width, height } = this.scene.game.canvas;
    this.countdownBg = this.scene.add.circle(width / 2, height / 2, 100, 0x000000, 0.6);
    this.countdownBg.setDepth(199); // Чуть ниже, чем текст
    
    // Обновляем текст отсчета
    if (this.gameOverText) {
      this.gameOverText.setText(String(this.gameOverCountdown));
      this.gameOverText.setAlpha(1);
      this.gameOverText.setScale(1);
      
      // Анимация появления
      this.scene.tweens.add({
        targets: [this.gameOverText, this.countdownBg],
        scale: { from: 2, to: 1 },
        duration: 500,
        ease: 'Back.easeOut'
      });
      
      // Добавляем пульсацию
      this.scene.tweens.add({
        targets: this.countdownBg,
        scale: { from: 1, to: 1.2 },
        alpha: { from: 0.6, to: 0.4 },
        duration: 600,
        yoyo: true,
        repeat: -1
      });
    }
    
    // Создаем отсчет
    this.gameOverTimer = this.scene.time.addEvent({
      delay: 1000, // 1 секунда
      callback: this.updateGameOverCountdown,
      callbackScope: this,
      loop: true
    });
  }

  public updateGameOverCountdown(): void {
    if (!this.isGameOverCountdownActive) return;
    
    this.gameOverCountdown--;
    
    if (this.gameOverCountdown <= 0) {
      // Время истекло, запускаем Game Over
      this.triggerGameOver();
      return;
    }
    
    // Обновляем текст отсчета
    if (this.gameOverText) {
      this.gameOverText.setText(String(this.gameOverCountdown));
      
      // Анимация пульсации только для текста
      this.scene.tweens.add({
        targets: this.gameOverText,
        scale: { from: 1.5, to: 1 },
        duration: 500,
        ease: 'Back.easeOut'
      });
    }
  }

  public stopGameOverCountdown(): void {
    if (!this.isGameOverCountdownActive) return;
    
    this.isGameOverCountdownActive = false;
    
    // Останавливаем таймер
    if (this.gameOverTimer) {
      this.gameOverTimer.remove();
      this.gameOverTimer = null;
    }
    
    // Скрываем текст отсчета и фон с анимацией
    if (this.gameOverText && this.countdownBg) {
      const countdownBg = this.countdownBg;
      
      // Анимация исчезновения
      this.scene.tweens.add({
        targets: [this.gameOverText, countdownBg],
        alpha: 0,
        scale: 0.5,
        duration: 300,
        ease: 'Back.easeIn',
        onComplete: () => {
          // Сбрасываем свойства текста
          if (this.gameOverText) {
            this.gameOverText.setAlpha(0);
            this.gameOverText.setScale(1);
          }
          
          // Уничтожаем фон
          if (countdownBg) {
            countdownBg.destroy();
          }
          this.countdownBg = null;
        }
      });
    }
  }

  public triggerGameOver(): void {
    if (this.isGameOver) return;
    
    this.isGameOver = true;
    this.isGameOverCountdownActive = false;
    
    // Останавливаем таймер отсчета
    if (this.gameOverTimer) {
      this.gameOverTimer.remove();
      this.gameOverTimer = null;
    }
    
    // Обновляем текст Game Over
    if (this.gameOverText) {
      this.gameOverText.setText('GAME OVER');
      this.gameOverText.setFontSize('60px');
      this.gameOverText.setAlpha(1);
      
      // Анимация надписи Game Over
      this.scene.tweens.add({
        targets: this.gameOverText,
        scale: { from: 0, to: 1 },
        duration: 1000,
        ease: 'Elastic.Out'
      });
    }
    
    // Сохраняем информацию о Game Over в реестре игры для React-компонента
    this.scene.game.registry.set('gameOver', true);
    this.scene.game.registry.set('finalScore', this.scene.score);
    
    // Добавляем сохранение счета в localStorage для статистики
    try {
      const existingScoresJSON = localStorage.getItem('mergeGameScores');
      let scores = [];
      
      if (existingScoresJSON) {
        scores = JSON.parse(existingScoresJSON);
      }
      
      // Добавляем новый результат
      scores.push({
        score: this.scene.score,
        date: new Date().toISOString(),
        duration: Date.now() - (this.scene.game.registry.get('gameStartTime') || Date.now())
      });
      
      // Ограничиваем историю до 10 последних игр
      while (scores.length > 10) {
        scores.shift();
      }
      
      // Сохраняем обновленные результаты
      localStorage.setItem('mergeGameScores', JSON.stringify(scores));
    } catch (e) {
      console.error('Ошибка сохранения результатов игры:', e);
    }
    
    // Останавливаем возможность управления
    this.scene.input.enabled = false;
  }

  public isActive(): boolean {
    return this.isGameOverCountdownActive;
  }

  public isOver(): boolean {
    return this.isGameOver;
  }
}
