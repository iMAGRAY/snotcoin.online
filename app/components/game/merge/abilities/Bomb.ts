// Bomb.ts - Способность "Бомба"
import * as Phaser from 'phaser';
import { GameBody, SCALE, MergeGameSceneType } from '../utils/types';
import * as gameUtils from '../utils/utils';

export class Bomb {
  private scene: MergeGameSceneType;

  constructor(scene: MergeGameSceneType) {
    this.scene = scene;
  }

  public activate(): void {
    // Вызов метода сцены для создания и настройки бомбы
    if (this.scene.nextBall) {
      // Запоминаем текущий уровень шара, чтобы восстановить его после использования способности
      const originalLevel = this.scene.nextBallLevel;
      
      // Удаляем текущий шар для броска
      this.scene.nextBall.destroy();
      
      // Создаем шар Bomb
      const ballY = this.scene.coinKing?.y ? this.scene.coinKing.y + 20 : 80;
      const ballX = this.scene.coinKing?.x || this.scene.game.canvas.width / 2;
      
      // Используем точно такой же размер, как для шара Bull
      const specialRadius = gameUtils.getRadiusByLevel(3) / 2; // Такой же, как у Bull
      const ballSize = specialRadius * 2 * SCALE;
      
      // Создаем спрайт шара Bomb
      this.scene.nextBall = this.scene.add.sprite(ballX, ballY, 'bomb');
      this.scene.nextBall.setDisplaySize(ballSize, ballSize);
      
      // Помечаем как специальный шар
      this.scene.nextBall.setData('special', 'bomb');
      
      // Вернемся к обычному шару после выстрела
      this.scene.nextBallLevel = originalLevel;
    }
  }

  // Эффект области действия бомбы
  public bombAreaEffect(bombId: string, bomb: GameBody, radius: number): void {
    // Получаем позицию бомбы
    const bombPosition = bomb.body.getPosition();
    const pos = { x: bombPosition.x * SCALE, y: bombPosition.y * SCALE };
    
    // Добавляем визуальный эффект взрыва
    this.addBombExplosionEffect(pos.x, pos.y);
    
    // Добавляем эффект области действия (с радиусом поражения)
    this.addBombAreaEffect(pos.x, pos.y, radius * SCALE);
    
    // Проверяем все тела на перекрытие с областью взрыва
    interface Target {
      id: string;
      ball: GameBody;
      distance: number;
    }
    
    const targetsToDestroy: Target[] = [];
    
    for (const targetId in this.scene.bodies) {
      if (targetId !== bombId) { // Не учитываем саму бомбу
        const targetBall = this.scene.bodies[targetId];
        if (targetBall && targetBall.body) {
          const targetPosition = targetBall.body.getPosition();
          const dx = targetPosition.x - bombPosition.x;
          const dy = targetPosition.y - bombPosition.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Если цель находится в радиусе взрыва
          if (distance <= radius) {
            targetsToDestroy.push({ 
              id: targetId, 
              ball: targetBall, 
              distance: distance 
            });
          }
        }
      }
    }
    
    // Сортируем цели по расстоянию (ближайшие взрываются первыми)
    targetsToDestroy.sort((a, b) => a.distance - b.distance);
    
    // Удаляем цели с задержкой для эффекта цепной реакции
    for (let i = 0; i < targetsToDestroy.length; i++) {
      const target = targetsToDestroy[i];
      
      this.scene.time.delayedCall(i * 60, () => {
        if (this.scene.bodies[target.id]) {
          this.scene.destroyBombTarget(target.id, target.ball, bombId, bomb);
        }
      });
    }
    
    // Очки за взрыв бомбы - за каждую уничтоженную цель
    this.scene.increaseScore(targetsToDestroy.length * 20);
    
    // Добавляем в очередь удаления саму бомбу
    this.scene.pendingDeletions.push({ id: bombId, type: 'bomb_self' });
  }

  // Добавляет эффект взрыва бомбы
  public addBombExplosionEffect(x: number, y: number): void {
    // Воспроизводим звук взрыва
    if (typeof window !== 'undefined' && this.scene.audioService) {
      this.scene.audioService.playSound('bombSound');
    }
    
    // Вспышка в центре взрыва
    const flash = this.scene.add.circle(x, y, 30, 0xff3300, 0.7);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 300,
      ease: 'Power1',
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // Круговая волна
    const shockwave = this.scene.add.circle(x, y, 10, 0xff9900, 0.5);
    this.scene.tweens.add({
      targets: shockwave,
      scale: 3,
      alpha: 0,
      duration: 500,
      ease: 'Power1',
      onComplete: () => {
        shockwave.destroy();
      }
    });
    
    // Частицы взрыва
    const colors = [0xff0000, 0xff5500, 0xff9900, 0xffcc00];
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 3;
      const size = 3 + Math.random() * 4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = this.scene.add.circle(x, y, size, color, 0.8);
      
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed * 30,
        y: y + Math.sin(angle) * speed * 30,
        alpha: { from: 0.8, to: 0 },
        scale: { from: 1, to: 0.2 },
        ease: 'Power2',
        duration: 600 + Math.random() * 400,
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }

  // Добавляет визуальный эффект области действия бомбы
  public addBombAreaEffect(x: number, y: number, radius: number): void {
    // 1. Вспышка в центре взрыва
    const flash = this.scene.add.circle(x, y, 40, 0xff3300, 0.7);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 300,
      ease: 'Power1',
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // 2. Ударная волна
    const shockwave = this.scene.add.circle(x, y, 10, 0xff9900, 0.5);
    this.scene.tweens.add({
      targets: shockwave,
      scale: Math.max(1, radius / 10), // Масштабируем в зависимости от радиуса, но не меньше 1
      alpha: 0,
      duration: 500,
      ease: 'Power1',
      onComplete: () => {
        shockwave.destroy();
      }
    });
    
    // 3. Частицы взрыва
    const colors = [0xff0000, 0xff5500, 0xff9900, 0xffcc00];
    const particleCount = Math.min(50, radius * 0.6); // Количество частиц зависит от радиуса
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const speed = 2 + Math.random() * 2;
      const size = 2 + Math.random() * 3;
      
      const particleX = x + Math.cos(angle) * distance * 0.5;
      const particleY = y + Math.sin(angle) * distance * 0.5;
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = this.scene.add.circle(particleX, particleY, size, color, 0.8);
      
      this.scene.tweens.add({
        targets: particle,
        x: particleX + Math.cos(angle) * speed * 20,
        y: particleY + Math.sin(angle) * speed * 20,
        alpha: { from: 0.8, to: 0 },
        scale: { from: 1, to: 0.2 },
        ease: 'Power2',
        duration: 500 + Math.random() * 300,
        onComplete: () => {
          particle.destroy();
        }
      });
    }
    
    // 4. Круг для обозначения области поражения
    const radiusCircle = this.scene.add.circle(x, y, radius, 0xff6600, 0.2);
    this.scene.tweens.add({
      targets: radiusCircle,
      alpha: 0,
      scale: 1.2,
      duration: 500,
      ease: 'Power1',
      onComplete: () => {
        radiusCircle.destroy();
      }
    });
  }
}
