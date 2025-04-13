// Bull.ts - Способность "Бык"
import * as Phaser from 'phaser';
import { GameBody, SCALE, MergeGameSceneType } from '../utils/types';
import * as gameUtils from '../utils/utils';

export class Bull {
  private scene: MergeGameSceneType;

  constructor(scene: MergeGameSceneType) {
    this.scene = scene;
  }

  public activate(): void {
    // Вызов метода сцены для создания и настройки быка
    if (this.scene.nextBall) {
      // Запоминаем текущий уровень шара, чтобы восстановить его после использования способности
      const originalLevel = this.scene.nextBallLevel;
      
      // Удаляем текущий шар для броска
      this.scene.nextBall.destroy();
      
      // Создаем шар Bull
      const ballY = this.scene.coinKing?.y ? this.scene.coinKing.y + 20 : 80;
      const ballX = this.scene.coinKing?.x || this.scene.game.canvas.width / 2;
      
      // Размер в 2 раза меньше обычного шара 3 уровня
      const specialRadius = gameUtils.getRadiusByLevel(3) / 2;
      const ballSize = specialRadius * 2 * SCALE;
      
      // Создаем спрайт шара Bull
      this.scene.nextBall = this.scene.add.sprite(ballX, ballY, 'bull');
      this.scene.nextBall.setDisplaySize(ballSize, ballSize);
      
      // Помечаем как специальный шар
      this.scene.nextBall.setData('special', 'bull');
      
      // Вернемся к обычному шару после выстрела
      this.scene.nextBallLevel = originalLevel;
    }
  }

  // Добавляет эффект разрушения для шара-быка
  public addBullDestructionEffect(x: number, y: number): void {
    // Создаем круговой эффект золотого сияния
    const circle = this.scene.add.circle(x, y, 30, 0xffd700, 0.6);
    circle.setScale(0.5);
    
    // Плавная анимация исчезновения
    this.scene.tweens.add({
      targets: circle,
      scale: 2,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        circle.destroy();
      }
    });
    
    // Добавляем искры вместо взрыва
    const sparkles = this.scene.add.particles(0, 0, 'ball1', {
      x: x,
      y: y,
      speed: { min: 20, max: 60 },
      scale: { start: 0.1, end: 0 },
      quantity: 1,
      lifespan: 800,
      gravityY: 100,
      tint: [0xffd700, 0xffff00, 0xff9900],
      emitting: false
    });
    
    sparkles.explode(15, x, y);
    
    // Автоматически уничтожаем эмиттер через 800 мс
    this.scene.time.delayedCall(800, () => {
      sparkles.destroy();
    });
  }

  // Добавляет эффект столкновения для шара-быка
  public addBullCollisionEffect(x: number, y: number): void {
    // 1. Создаем красные частицы как "искры от удара"
    const redSparks = this.scene.add.particles(0, 0, 'ball1', {
      x: x,
      y: y,
      speed: { min: 30, max: 100 },
      scale: { start: 0.15, end: 0 },
      quantity: 1,
      lifespan: 500,
      blendMode: 'ADD',
      tint: [0xff0000, 0xff3300, 0xff6600],
      emitting: false
    });
    
    redSparks.explode(10, x, y);
    
    // Автоматически уничтожаем эмиттер красных искр
    this.scene.time.delayedCall(500, () => {
      redSparks.destroy();
    });
    
    // 2. Создаем ударную волну (круг, который расширяется и исчезает)
    const shockwave = this.scene.add.circle(x, y, 10, 0xff3300, 0.7);
    this.scene.tweens.add({
      targets: shockwave,
      scale: 3,
      alpha: 0,
      duration: 300,
      ease: 'Power1',
      onComplete: () => {
        shockwave.destroy();
      }
    });
    
    // 3. Добавляем "пыль" от удара быка (коричневые/серые частицы)
    const dust = this.scene.add.particles(0, 0, 'ball1', {
      x: x,
      y: y,
      speed: { min: 10, max: 40 },
      scale: { start: 0.1, end: 0 },
      quantity: 1,
      lifespan: 800,
      tint: [0xa0a0a0, 0x808080, 0x606060],
      emitting: false
    });
    
    dust.explode(15, x, y);
    
    // Автоматически уничтожаем эмиттер пыли
    this.scene.time.delayedCall(800, () => {
      dust.destroy();
    });
    
    // 4. Небольшой эффект размытия/дрожания для шара, с которым столкнулся бык
    const blurCircle = this.scene.add.circle(x, y, 20, 0xffffff, 0.3);
    this.scene.tweens.add({
      targets: blurCircle,
      scale: { from: 0.8, to: 1.5 },
      alpha: { from: 0.3, to: 0 },
      duration: 200,
      ease: 'Power1',
      onComplete: () => {
        blurCircle.destroy();
      }
    });
  }
}
