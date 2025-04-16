// EffectsManager.ts - Управление визуальными эффектами
import * as Phaser from 'phaser';
import * as gameUtils from '../utils/utils';

export class EffectsManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Отображение полученных очков
  public showScorePoints(x: number, y: number, points: number, isCombo: boolean = false): void {
    // Создаем текст с отображением очков
    const pointsText = this.scene.add.text(x, y - 150, `+${points}`, {
      fontFamily: '"Russo One", "Impact", "Arial Black", sans-serif',
      fontSize: isCombo ? '64px' : '56px',
      fontStyle: 'bold',
      color: isCombo ? '#FF5500' : '#FFDD00', // Оранжевый цвет для комбо
      stroke: '#000000',
      strokeThickness: 5,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000',
        blur: 3,
        stroke: true,
        fill: true
      }
    });
    
    // Добавляем обводку золотом
    const glow = this.scene.add.text(x, y - 150, `+${points}`, {
      fontFamily: '"Russo One", "Impact", "Arial Black", sans-serif',
      fontSize: isCombo ? '64px' : '56px',
      fontStyle: 'bold',
      color: '#FFFFFF00', // Прозрачный цвет текста
      stroke: isCombo ? '#FF8C00' : '#FFA500',  // Оранжево-золотая обводка, ярче для комбо
      strokeThickness: isCombo ? 10 : 8
    });
    glow.setOrigin(0.5);
    glow.setAlpha(0.5);
    
    // Центрируем текст
    pointsText.setOrigin(0.5);
    
    // Добавляем начальную анимацию масштабирования
    pointsText.setScale(0);
    glow.setScale(0);
    
    // Анимация появления с масштабированием
    this.scene.tweens.add({
      targets: [pointsText, glow],
      scale: isCombo ? 2.8 : 2.4,
      duration: 200,
      ease: 'Back.out',
      onComplete: () => {
        // Анимация поднятия и исчезновения текста
        this.scene.tweens.add({
          targets: [pointsText, glow],
          y: y - (isCombo ? 350 : 300),
          alpha: 0,
          scale: 0.8,
          duration: 1200,
          ease: 'Power2',
          onComplete: () => {
            pointsText.destroy();
            glow.destroy();
          }
        });
      }
    });
    
    // Добавляем частицы-звездочки вокруг текста
    const colors = isCombo ? 
      [0xFF5500, 0xFF8C00, 0xFFAA00, 0xFFFFFF] : // Огненные цвета для комбо
      [0xFFD700, 0xFFA500, 0xFFFF00, 0xFFFFFF]; // Стандартные золотые цвета
    
    const particleCount = 8 + Math.min(isCombo ? 20 : 15, points / 10); // Увеличиваем количество частиц
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 20 + Math.random() * (isCombo ? 35 : 25); // Увеличиваем разброс частиц
      const delay = Math.random() * 100;
      const size = 3 + Math.random() * (isCombo ? 6 : 4); // Увеличиваем размер частиц
      
      const particleX = x + Math.cos(angle) * 5;
      const particleY = y - 150 + Math.sin(angle) * 5;
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      // Создаем частицу в виде звездочки
      const particle = this.scene.add.star(particleX, particleY, 5, size, size / 2, color);
      particle.setAlpha(0);
      
      // Анимация появления и движения частицы
      this.scene.tweens.add({
        targets: particle,
        x: particleX + Math.cos(angle) * distance,
        y: particleY + Math.sin(angle) * distance - (isCombo ? 50 : 40),
        alpha: { from: 0, to: 0.8, duration: 200 },
        scale: { from: 0.5, to: isCombo ? 2.5 : 2 },
        delay: delay,
        duration: 900,
        onComplete: () => {
          // Анимация исчезновения
          this.scene.tweens.add({
            targets: particle,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            onComplete: () => {
              particle.destroy();
            }
          });
        }
      });
    }
  }

  /**
   * Добавляет эффект объединения шаров
   * @param x X-координата эффекта
   * @param y Y-координата эффекта
   */
  public addMergeEffect(x: number, y: number): void {
    // Удален эффект кругов при объединении шаров
    // Метод оставлен пустым для обратной совместимости
  }

  // Эффект уничтожения шара
  public addDestructionEffect(x: number, y: number): void {
    // Создаем частицы для эффекта взрыва
    const particles = this.scene.add.particles(0, 0, 'ball1', {
      x: x,
      y: y,
      speed: { min: 50, max: 150 },
      scale: { start: 0.1, end: 0 },
      quantity: 1,
      lifespan: 500,
      blendMode: 'ADD',
      emitting: false
    });
    
    particles.explode(10, x, y);
    
    // Автоматически уничтожаем эмиттер через 600 мс
    this.scene.time.delayedCall(600, () => {
      particles.destroy();
    });
    
    // Добавляем вспышку
    const flash = this.scene.add.circle(x, y, 40, 0xffd700, 0.8);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 200,
      ease: 'Power1',
      onComplete: () => {
        flash.destroy();
      }
    });
  }

  // Упрощенный эффект уничтожения
  public addSimpleDestructionEffect(x: number, y: number): void {
    // Вспышка
    const flash = this.scene.add.circle(x, y, 20, 0xffffff, 0.6);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.3,
      duration: 200,
      ease: 'Power1',
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // Несколько частиц
    const colors = [0xffffff, 0xffcc00, 0xff9900];
    const particleCount = 10;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 2;
      const size = 2 + Math.random() * 2;
      
      const particleX = x;
      const particleY = y;
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = this.scene.add.circle(particleX, particleY, size, color, 0.8);
      
      this.scene.tweens.add({
        targets: particle,
        x: particleX + Math.cos(angle) * speed * 20,
        y: particleY + Math.sin(angle) * speed * 20,
        alpha: { from: 0.8, to: 0 },
        scale: { from: 1, to: 0.5 },
        ease: 'Power2',
        duration: 300 + Math.random() * 200,
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }

  // Небольшой взрыв
  public addMiniExplosionEffect(x: number, y: number): void {
    // Вспышка
    const flash = this.scene.add.circle(x, y, 15, 0xff6600, 0.6);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 200,
      ease: 'Power1',
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // Несколько частиц
    const colors = [0xff0000, 0xff6600, 0xffcc00];
    const particleCount = 15;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 2;
      const size = 2 + Math.random() * 2;
      
      const particleX = x;
      const particleY = y;
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = this.scene.add.circle(particleX, particleY, size, color, 0.8);
      
      this.scene.tweens.add({
        targets: particle,
        x: particleX + Math.cos(angle) * speed * 20,
        y: particleY + Math.sin(angle) * speed * 20,
        alpha: { from: 0.8, to: 0 },
        scale: { from: 1, to: 0.2 },
        ease: 'Power2',
        duration: 400 + Math.random() * 200,
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }

  // Эффект уничтожения быка
  public addBullDestructionEffect(x: number, y: number): void {
    // Вспышка
    const flash = this.scene.add.circle(x, y, 30, 0xff0000, 0.8);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.0,
      duration: 300,
      ease: 'Power1',
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // Волны
    const wave1 = this.scene.add.circle(x, y, 15, 0xffcc00, 0.6);
    const wave2 = this.scene.add.circle(x, y, 10, 0xff6600, 0.7);
    
    this.scene.tweens.add({
      targets: wave1,
      alpha: 0,
      scale: 3.0,
      duration: 400,
      ease: 'Power1',
      onComplete: () => {
        wave1.destroy();
      }
    });
    
    this.scene.tweens.add({
      targets: wave2,
      alpha: 0,
      scale: 2.5,
      duration: 300,
      delay: 100,
      ease: 'Power1',
      onComplete: () => {
        wave2.destroy();
      }
    });
    
    // Частицы
    const colors = [0xff0000, 0xff6600, 0xffcc00, 0xffff00];
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 3;
      const size = 3 + Math.random() * 3;
      
      const particleX = x;
      const particleY = y;
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = this.scene.add.circle(particleX, particleY, size, color, 0.9);
      
      this.scene.tweens.add({
        targets: particle,
        x: particleX + Math.cos(angle) * speed * 25,
        y: particleY + Math.sin(angle) * speed * 25,
        alpha: { from: 0.9, to: 0 },
        scale: { from: 1, to: 0.3 },
        ease: 'Power2',
        duration: 500 + Math.random() * 200,
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }

  /**
   * Показывает множитель комбо
   * @param x X-координата (не используется)
   * @param y Y-координата (не используется)
   * @param multiplier Множитель комбо
   * @param count Счетчик комбо
   */
  public showComboMultiplier(
    x: number,
    y: number,
    multiplier: number,
    count: number
  ): void {
    // Определяем координаты для отображения напротив счета у правой стены
    const rightWallX = this.scene.cameras.main.width - 10; // Ближе к правому краю (отступ 10px)
    const rightWallY = 10; // Такой же отступ сверху, как у Score
    
    // Удаляем все предыдущие элементы комбо, если они существуют
    this.scene.children.getAll().forEach(child => {
      if (child.name && 
         (child.name === 'combo-text' || 
          child.name === 'combo-multiplier' || 
          child.name === 'combo-counter' || 
          child.name === 'combo-particles' ||
          child.name === 'combo-bonus')) {
        child.destroy();
      }
    });
    
    // Создаем текст "COMBO" в стиле очков вылетающих из шаров
    const comboText = this.scene.add
      .text(rightWallX, rightWallY, "COMBO", {
        fontFamily: '"Russo One", "Impact", "Arial Black", sans-serif',
        fontSize: '96px',
        fontStyle: 'bold',
        color: '#FF5500',
        stroke: '#000000',
        strokeThickness: 6,
        shadow: {
          offsetX: 3,
          offsetY: 3,
          color: '#000',
          blur: 4,
          stroke: true,
          fill: true
        }
      })
      .setOrigin(1, 0)
      .setDepth(1000);
    comboText.setName('combo-text');

    // Создаем текст множителя
    const multiplierText = this.scene.add
      .text(
        rightWallX,
        rightWallY + 100,
        `${multiplier.toFixed(1)}x`,
        {
          fontFamily: '"Russo One", "Impact", "Arial Black", sans-serif',
          fontSize: '108px',
          fontStyle: 'bold',
          color: '#FFDD00',
          stroke: '#000000',
          strokeThickness: 6,
          shadow: {
            offsetX: 3,
            offsetY: 3,
            color: '#000',
            blur: 4,
            stroke: true,
            fill: true
          }
        }
      )
      .setOrigin(1, 0)
      .setDepth(1000);
    multiplierText.setName('combo-multiplier');

    // Создаем массив для всех элементов комбо
    const elements = [comboText, multiplierText];
    
    // Добавляем анимацию для всех элементов комбо
    elements.forEach(el => el.setScale(0));

    // Анимация появления с масштабированием
    this.scene.tweens.add({
      targets: elements,
      scale: 1,
      duration: 300,
      ease: 'Back.out',
      onComplete: () => {
        // Пульсация для множителя
        this.scene.tweens.add({
          targets: multiplierText,
          scaleX: 1.2,
          scaleY: 1.2,
          yoyo: true,
          repeat: 1,
          duration: 150,
          ease: 'Sine.easeInOut'
        });
      }
    });

    // Создаем эффект частиц как у вылетающих очков
    if (multiplier > 1.5) {
      const colors = [0xFF5500, 0xFF8C00, 0xFFAA00, 0xFFFFFF]; // Огненные цвета для комбо
      const particleCount = Math.min(15, Math.floor(multiplier * 3));
      
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 25;
        const delay = Math.random() * 200;
        const size = 2 + Math.random() * 3;
        
        const particleX = rightWallX - 30 + Math.cos(angle) * 5;
        const particleY = rightWallY + 100 + Math.sin(angle) * 5;
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Создаем частицу в виде звездочки
        const particle = this.scene.add.star(particleX, particleY, 5, size, size / 2, color);
        particle.setName('combo-particles');
        particle.setAlpha(0);
        particle.setDepth(998);
        
        // Анимация появления и движения частицы
        this.scene.tweens.add({
          targets: particle,
          x: particleX + Math.cos(angle) * distance,
          y: particleY + Math.sin(angle) * distance - 20,
          alpha: { from: 0, to: 0.8, duration: 200 },
          scale: { from: 0.5, to: 1.5 },
          delay: delay,
          duration: 900,
          onComplete: () => {
            // Анимация исчезновения
            this.scene.tweens.add({
              targets: particle,
              alpha: 0,
              scale: 0.5,
              duration: 300,
              onComplete: () => {
                particle.destroy();
              }
            });
          }
        });
      }
    }

    // Удаляем тексты через 3 секунды
    this.scene.time.delayedCall(2500, () => {
      this.scene.tweens.add({
        targets: elements,
        alpha: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          elements.forEach(el => el.destroy());
        }
      });
    });
  }
  
  /**
   * Добавление эффекта огненных частиц вокруг комбо-текста
   * @param x Координата X
   * @param y Координата Y
   * @param intensity Интенсивность эффекта (на основе множителя комбо)
   */
  private addFireParticlesEffect(x: number, y: number, intensity: number): void {
    // Цвета огня от желтого до красного
    const fireColors = [0xFF0000, 0xFF3300, 0xFF6600, 0xFF9900, 0xFFCC00, 0xFFFF00];
    
    // Количество частиц зависит от множителя комбо
    const particleCount = Math.floor(20 + intensity * 5);
    
    for (let i = 0; i < particleCount; i++) {
      // Случайный угол для распределения частиц вокруг текста
      const angle = Math.random() * Math.PI * 2;
      // Большая дистанция для более широкого огненного эффекта
      const distance = 30 + Math.random() * 100;
      const delay = Math.random() * 300;
      
      // Размер частиц огня
      const size = 3 + Math.random() * 4;
      
      // Начальная позиция вокруг текста
      const startX = x + (Math.random() - 0.5) * 150;
      const startY = y + 10 + Math.random() * 10;
      
      // Случайный цвет из палитры огня
      const color = fireColors[Math.floor(Math.random() * fireColors.length)];
      
      // Создаем частицу (используем круг вместо звезды для огня)
      const particle = this.scene.add.circle(startX, startY, size, color, 0.8);
      particle.setAlpha(0);
      
      // Анимация движения вверх с затуханием, имитирующая огонь
      this.scene.tweens.add({
        targets: particle,
        x: startX + (Math.random() - 0.5) * 20, // Небольшое случайное отклонение по X
        y: startY - distance, // Движение вверх
        alpha: { start: 0, to: 0.7, duration: 200, ease: 'Sine.easeIn' },
        scale: { start: 0.5, to: 1.5, ease: 'Sine.easeOut' },
        delay: delay,
        duration: 600 + Math.random() * 400,
        onComplete: () => {
          // Затухание в конце
          this.scene.tweens.add({
            targets: particle,
            alpha: 0,
            scale: 0.2,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
              particle.destroy();
            }
          });
        }
      });
    }
  }

  /**
   * Добавляет упрощенный эффект слияния (оптимизированный для большого количества шаров)
   * @param x Координата X
   * @param y Координата Y
   */
  public addSimpleMergeEffect(x: number, y: number): void {
    // При большом количестве шаров используем упрощенный эффект
    // без частиц для повышения производительности
    
    // Создаем свечение вместо частиц
    const glow = this.scene.add.sprite(x, y, 'ball1');
    glow.setScale(1.5);
    glow.setTint(0xFFFF99);
    glow.setAlpha(0.7);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    
    // Анимация свечения и исчезновения
    this.scene.tweens.add({
      targets: glow,
      alpha: 0,
      scale: 2,
      duration: 300,
      onComplete: () => {
        glow.destroy();
      }
    });
  }
}
