// EffectsManager.ts - Управление визуальными эффектами
import * as Phaser from 'phaser';
import * as gameUtils from '../utils';

export class EffectsManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Эффект объединения шаров
  public addMergeEffect(x: number, y: number, level: number): void {
    // Создаем круговой эффект
    const circle = this.scene.add.circle(x, y, 30, gameUtils.getColorByLevel(level), 0.7);
    circle.setScale(0.5);
    
    // Анимация пульсации и исчезновения
    this.scene.tweens.add({
      targets: circle,
      scale: 1.5,
      alpha: 0,
      duration: 500,
      ease: 'Power1',
      onComplete: () => {
        circle.destroy();
      }
    });
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
}
