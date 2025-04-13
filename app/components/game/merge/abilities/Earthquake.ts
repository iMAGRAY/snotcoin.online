// Earthquake.ts - Способность "Землетрясение"
import * as Phaser from 'phaser';
import { GameBody, SCALE, MergeGameSceneType } from '../types';
import * as gameUtils from '../utils';
import * as planck from 'planck';

export class Earthquake {
  private scene: MergeGameSceneType;

  constructor(scene: MergeGameSceneType) {
    this.scene = scene;
  }

  public activate(): void {
    // Воспроизводим звук землетрясения
    if (typeof window !== 'undefined' && this.scene.audioService) {
      this.scene.audioService.playSound('earthquakeSound');
    }
    
    // Создаем эффект тряски экрана с большей интенсивностью
    this.scene.cameras.main.shake(3000, 0.022); // Уменьшено с 0.025 до 0.022
    
    // Добавляем начальный импульс всем шарам с увеличенной силой
    this.applyEarthquakeImpulse(42, 34); // Уменьшено с 50/40 до 42/34
    
    // Создаем повторяющиеся импульсы в течение 3 секунд
    const repeatCount = 5; // Количество повторений
    const interval = 500; // Интервал между импульсами в мс
    
    // Создаем таймеры для повторных импульсов
    for (let i = 1; i <= repeatCount; i++) {
      this.scene.time.delayedCall(i * interval, () => {
        // Каждый следующий импульс немного слабее, но начальная сила больше
        const strength = 38 - i * 3.5; // Уменьшено с 45-i*4 до 38-i*3.5
        this.applyEarthquakeImpulse(strength, strength / 2);
      });
    }
    
    // Добавляем визуальный эффект для землетрясения
    this.addEarthquakeEffect();
  }

  // Метод для применения импульсов при землетрясении
  private applyEarthquakeImpulse(horizontalStrength: number, verticalStrength: number): void {
    for (const id in this.scene.bodies) {
      const bodyData = this.scene.bodies[id];
      if (bodyData && bodyData.body) {
        // Случайный импульс в обоих направлениях с большей силой
        const impulseX = (Math.random() - 0.5) * horizontalStrength * 2.1;
        const impulseY = (Math.random() - 0.5) * verticalStrength * 2.3;
        
        try {
          // Применяем импульс к телу
          bodyData.body.applyLinearImpulse(
            planck.Vec2(impulseX, impulseY), 
            bodyData.body.getWorldCenter()
          );
          
          // Добавляем случайное вращение для большего эффекта хаоса
          const angularImpulse = (Math.random() - 0.5) * 6;
          bodyData.body.applyAngularImpulse(angularImpulse);
        } catch (e) {
          console.error('Error applying earthquake impulse:', e);
        }
      }
    }
  }
  
  // Визуальный эффект землетрясения
  private addEarthquakeEffect(): void {
    const { width, height } = this.scene.game.canvas;
    
    // 1. Создаем эффект пыли снизу экрана
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * width;
      const y = height - Math.random() * 60 - 50;
      
      // Частицы пыли
      const dustParticle = this.scene.add.circle(x, y, 2 + Math.random() * 3, 0xa0a0a0, 0.7);
      
      this.scene.tweens.add({
        targets: dustParticle,
        y: y - 50 - Math.random() * 30,
        alpha: 0,
        scale: 0.5 + Math.random(),
        duration: 1000 + Math.random() * 1000,
        ease: 'Power1',
        onComplete: () => {
          dustParticle.destroy();
        }
      });
    }
    
    // 2. Создаем эффект растрескивания земли
    const crackLines = 5;
    for (let i = 0; i < crackLines; i++) {
      const startX = Math.random() * width;
      const line = this.scene.add.graphics();
      line.lineStyle(2, 0x808080, 0.8);
      
      // Рисуем трещину
      line.beginPath();
      line.moveTo(startX, height - 60);
      
      let currentX = startX;
      let currentY = height - 60;
      const segments = 5 + Math.floor(Math.random() * 5);
      
      for (let j = 0; j < segments; j++) {
        currentX += (Math.random() - 0.5) * 40;
        currentY -= Math.random() * 40;
        line.lineTo(currentX, currentY);
      }
      
      line.strokePath();
      
      // Анимация появления и исчезновения трещины
      this.scene.tweens.add({
        targets: line,
        alpha: { from: 0, to: 1 },
        duration: 200,
        yoyo: true,
        hold: 1000,
        onComplete: () => {
          line.destroy();
        }
      });
    }
  }
}
