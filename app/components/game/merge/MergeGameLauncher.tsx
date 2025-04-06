"use client"

import React, { useEffect, useRef, useState } from "react"
import Phaser from "phaser"
import * as planck from "planck"
import { useGameState } from "../../../contexts"
import Image from "next/image"

interface MergeGameLauncherProps {
  onBack: () => void
}

const SCALE = 30 // Масштаб для перевода между физическими единицами и пикселями

type GameBody = {
  body: planck.Body;
  sprite: Phaser.GameObjects.Sprite;
}

class MergeGameScene extends Phaser.Scene {
  world: planck.World
  bodies: { [key: string]: GameBody } = {}
  nextId: number = 1
  coinKing: Phaser.GameObjects.Image | null = null
  isPointerDown: boolean = false
  lastShootTime: number = 0
  shootDelay: number = 500 // Задержка между выстрелами в миллисекундах
  nextBall: Phaser.GameObjects.Sprite | null = null // Следующий шар для броска
  nextBallLevel: number = 1 // Уровень следующего шара
  aimLine: Phaser.GameObjects.Graphics | null = null // Линия прицеливания
  maxLevel: number = 12 // Максимальный уровень шара
  maxRandomLevel: number = 6 // Максимальный уровень для случайных шаров
  baseRadius: number = 0.8 // Базовый радиус для шара 1 уровня
  pendingMerges: { idA: string, idB: string, levelA: number, positionA: planck.Vec2, positionB: planck.Vec2 }[] = []
  pendingDeletions: { id: string, type: string }[] = [] // Новый массив для отложенного удаления
  score: number = 0 // Счет игры
  scoreText: Phaser.GameObjects.Text | null = null // Текстовый объект для отображения счета

  constructor() {
    super({ key: 'MergeGameScene' })
    this.world = planck.World({
      gravity: planck.Vec2(0, 10)
    })
  }

  preload() {
    // Загружаем изображения шаров для всех уровней
    for (let i = 1; i <= this.maxLevel; i++) {
      this.load.image(`ball${i}`, `/images/merge/Balls/${i}.webp`);
    }
    this.load.image('coinKing', '/images/merge/Game/ui/CoinKing.webp')
    
    // Загружаем фоновые изображения
    this.load.image('background', '/images/merge/background/merge-background.webp')
    this.load.image('trees', '/images/merge/background/trees.webp')
    
    // Загружаем изображения специальных шаров
    this.load.image('bull', '/images/merge/Balls/Bull.webp')
    this.load.image('bomb', '/images/merge/Balls/bomb.webp')
  }

  create() {
    // Создаем границы мира
    const { width, height } = this.game.canvas
    
    // Добавляем фоновые изображения
    // Основной фон (нижний слой)
    const background = this.add.image(width / 2, height / 2, 'background')
    background.setDisplaySize(width, height)
    background.setDepth(-10) // Устанавливаем самый нижний слой
    
    // Деревья (верхний слой фона)
    const trees = this.add.image(width / 2, height / 2, 'trees')
    trees.setDisplaySize(width, height)
    trees.setDepth(-5) // Устанавливаем слой выше основного фона, но ниже игровых объектов
    
    // Добавляем пунктирную линию прицеливания
    this.aimLine = this.add.graphics();
    this.updateAimLine(width / 2, height);
    
    // Добавляем счет в левом верхнем углу игровой зоны
    this.scoreText = this.add.text(20, 20, 'Счет: 0', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#FFFFFF', 
      stroke: '#000000',
      strokeThickness: 4,
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 3, stroke: true, fill: true }
    });
    this.scoreText.setDepth(100); // Устанавливаем высокое значение depth, чтобы текст был поверх всего
    
    // Добавляем CoinKing в верхнюю часть игровой зоны как управляемый объект
    this.coinKing = this.add.image(width / 2, 60, 'coinKing')
    this.coinKing.setScale(0.085) // Маленький размер
    
    // Генерируем уровень для следующего шара (до 6 уровня)
    this.generateNextBallLevel();
    
    // Создаем следующий шар для броска
    this.createNextBall();
    
    // Добавляем обработчики для перемещения CoinKing
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.coinKing) {
        // Обновляем только позицию X, Y остается фиксированной
        const newX = Phaser.Math.Clamp(pointer.x, 50, width - 50)
        this.coinKing.x = newX
        
        // Перемещаем следующий шар вместе с CoinKing
        if (this.nextBall) {
          this.nextBall.x = newX;
        }
        
        // Обновляем линию прицеливания
        this.updateAimLine(newX, height);
      }
    })
    
    // ====== Создаем границы и стены ======
    
    // Основные границы мира
    this.createBoundary(0, height / SCALE, width / SCALE, height / SCALE, 'bottom') // низ (с идентификатором 'bottom')
    this.createBoundary(0, 0, 0, height / SCALE) // левая стена (край)
    this.createBoundary(width / SCALE, 0, width / SCALE, height / SCALE) // правая стена (край)
    
    // Дополнительные невидимые стены внутри игровой зоны
    const wallOffset = width * 0.05 / SCALE; // 5% от ширины экрана (было 10%)
    
    // Левая внутренняя стена
    this.createBoundary(wallOffset, 0, wallOffset, height / SCALE);
    
    // Правая внутренняя стена
    this.createBoundary(width / SCALE - wallOffset, 0, width / SCALE - wallOffset, height / SCALE);
    
    // Добавляем визуальные индикаторы положения внутренних стен (только для отладки, можно удалить)
    /* 
    this.add.line(0, 0, wallOffset * SCALE, 0, wallOffset * SCALE, height, 0xff0000)
      .setOrigin(0, 0)
      .setAlpha(0.3);
    this.add.line(0, 0, width - wallOffset * SCALE, 0, width - wallOffset * SCALE, height, 0xff0000)
      .setOrigin(0, 0)
      .setAlpha(0.3);
    */
    
    // Обработка кликов/тапов только для выстрела
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPointerDown = true;
      
      // Выстрел из CoinKing
      const currentTime = this.time.now;
      if (currentTime - this.lastShootTime > this.shootDelay && this.coinKing) {
        this.shootFromCoinKing();
        this.lastShootTime = currentTime;
      }
    })
    
    this.input.on('pointerup', () => {
      this.isPointerDown = false
    })
    
    // Настраиваем обработчик контактов в физическом движке
    this.world.on('begin-contact', (contact: planck.Contact) => {
      try {
        if (!contact) return;

        const fixtureA = contact.getFixtureA();
        const fixtureB = contact.getFixtureB();
        
        if (!fixtureA || !fixtureB) return;

        const bodyA = fixtureA.getBody();
        const bodyB = fixtureB.getBody();
        
        if (!bodyA || !bodyB) return;

        // Проверяем столкновение с нижним баром (дном)
        const bottomBarContact = 
          (bodyA.getUserData() === 'bottom' && bodyB.getType() === 'dynamic') ||
          (bodyB.getUserData() === 'bottom' && bodyA.getType() === 'dynamic');
          
        if (bottomBarContact) {
          // Определяем, какое из тел является шаром
          const ballBody = bodyA.getUserData() === 'bottom' ? bodyB : bodyA;
          
          // Ищем ID шара в нашем списке
          let ballId = '';
          for (const id in this.bodies) {
            if (this.bodies[id] && this.bodies[id].body === ballBody) {
              ballId = id;
              break;
            }
          }
          
          // Если нашли шар и это Bull или Bomb - удаляем его
          const ballData = this.bodies[ballId];
          if (ballId && ballData && ballData.sprite && 
              (ballData.sprite.getData('special') === 'bull' || 
               ballData.sprite.getData('special') === 'bomb')) {
            
            const position = ballData.body.getPosition();
            const special = ballData.sprite.getData('special');
            
            // Удаляем запись из списка
            delete this.bodies[ballId];
            
            // Удаляем спрайт
            ballData.sprite.destroy();
            
            // Удаляем физическое тело из мира
            this.world.destroyBody(ballData.body);
            
            // Добавляем соответствующий эффект уничтожения
            if (position) {
              if (special === 'bull') {
                this.addBullDestructionEffect(position.x * SCALE, position.y * SCALE);
              } else if (special === 'bomb') {
                this.addDestructionEffect(position.x * SCALE, position.y * SCALE);
              }
            }
            
            return; // Прекращаем обработку контакта
          }
        }

        // Проверяем, что это столкновение двух динамических тел
        if (bodyA.getType() === 'dynamic' && bodyB.getType() === 'dynamic') {
          // Ищем ID шаров в нашем списке
          let idA = '';
          let idB = '';
          
          for (const id in this.bodies) {
            if (this.bodies[id] && this.bodies[id].body === bodyA) {
              idA = id;
            } else if (this.bodies[id] && this.bodies[id].body === bodyB) {
              idB = id;
            }
          }
          
          // Если нашли оба шара
          if (idA && idB) {
            // Проверяем, является ли один из шаров специальным
            const ballA = this.bodies[idA];
            const ballB = this.bodies[idB];
            
            if (ballA && ballB && ballA.sprite && ballA.sprite.getData('special') === 'bull') {
              // Шар Bull удаляет другой шар при столкновении
              this.destroyTargetBall(idB, ballB);
            } else if (ballB && ballA && ballB.sprite && ballB.sprite.getData('special') === 'bull') {
              // Шар Bull удаляет другой шар при столкновении
              this.destroyTargetBall(idA, ballA);
            } else if (ballA && ballB && ballA.sprite && ballA.sprite.getData('special') === 'bomb') {
              // Шар Bomb удаляет ТОЛЬКО шар с которым столкнулся
              this.destroyBombTarget(idB, ballB, idA, ballA);
            } else if (ballB && ballA && ballB.sprite && ballB.sprite.getData('special') === 'bomb') {
              // Шар Bomb удаляет ТОЛЬКО шар с которым столкнулся
              this.destroyBombTarget(idA, ballA, idB, ballB);
            } else {
              // Стандартное поведение - запланировать объединение шаров
              this.scheduleMerge(idA, idB);
            }
          }
        }
      } catch (error) {
        console.error('Error in contact handler:', error);
      }
    });
  }

  // Генерируем уровень для следующего шара (до 6 уровня)
  generateNextBallLevel() {
    // Массив весов для каждого уровня (чем больше вес, тем чаще появляется шар)
    const weights = [];
    
    // Заполняем массив весами: чем выше уровень, тем меньше вероятность
    for (let i = 1; i <= this.maxRandomLevel; i++) {
      // Используем обратную экспоненциальную зависимость: чем выше уровень, тем ниже вес
      weights.push(Math.pow(0.6, i - 1));
    }
    
    // Сумма всех весов
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    // Генерируем случайное число от 0 до суммы весов
    const random = Math.random() * totalWeight;
    
    // Определяем, какому уровню соответствует это случайное число
    let cumulativeWeight = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulativeWeight += weights[i];
      if (random < cumulativeWeight) {
        this.nextBallLevel = i + 1;
        return;
      }
    }
    
    // Если случайно не определили уровень, берем первый (самый частый)
    this.nextBallLevel = 1;
  }

  // Получаем радиус шара по его уровню
  getRadiusByLevel(level: number): number {
    // Используем геометрическую прогрессию для увеличения размера
    // Настраиваем так, чтобы шар 12 уровня имел радиус примерно 1/4 ширины экрана
    const growthFactor = 1.15; // Коэффициент роста (уменьшен для более плавного роста)
    return this.baseRadius * Math.pow(growthFactor, level - 1);
  }

  // Получаем цвет шара по его уровню
  getColorByLevel(level: number): number {
    const colors = [
      0xFF5555, // Уровень 1 - красный
      0xFF9955, // Уровень 2 - оранжевый
      0xFFFF55, // Уровень 3 - желтый
      0x55FF55, // Уровень 4 - зеленый
      0x55FFFF, // Уровень 5 - голубой
      0x5555FF, // Уровень 6 - синий
      0xFF55FF, // Уровень 7 - фиолетовый
      0xFFFFFF, // Уровень 8 - белый
      0xFFD700, // Уровень 9 - золотой
      0xC0C0C0, // Уровень 10 - серебряный
      0xE5E4E2, // Уровень 11 - платиновый
      0x3D85C6  // Уровень 12 - сапфировый
    ];
    // Убедимся, что уровень находится в допустимом диапазоне и является числом
    const levelValue = typeof level === 'number' ? level : 1;
    const safeLevel = Math.max(1, Math.min(levelValue, colors.length));
    return colors[safeLevel - 1];
  }

  // Обновляем пунктирную линию прицеливания
  updateAimLine(x: number, height: number) {
    if (!this.aimLine) return;
    
    // Очищаем предыдущую линию
    this.aimLine.clear();
    
    // Задаем стиль пунктирной линии
    this.aimLine.lineStyle(2, 0xFFFFFF, 0.5);
    
    // Рисуем пунктирную линию от CoinKing до пола
    const startY = 80; // Чуть ниже CoinKing
    const endY = height - 70; // До пола (с учетом нижнего бара)
    
    // Рисуем пунктирную линию сегментами
    const segmentLength = 10;
    const gapLength = 5;
    let currentY = startY;
    
    while (currentY < endY) {
      const segmentEnd = Math.min(currentY + segmentLength, endY);
      this.aimLine.beginPath();
      this.aimLine.moveTo(x, currentY);
      this.aimLine.lineTo(x, segmentEnd);
      this.aimLine.strokePath();
      currentY = segmentEnd + gapLength;
    }
  }

  // Создаем следующий шар для броска
  createNextBall() {
    if (this.coinKing) {
      const ballRadius = this.getRadiusByLevel(this.nextBallLevel);
      const ballSize = ballRadius * 2 * SCALE; // Реальный размер шара в пикселях
      const ballY = this.coinKing.y + 20; // Размещаем шар чуть ниже CoinKing
      
      // Если уже есть следующий шар, удаляем его
      if (this.nextBall) {
        this.nextBall.destroy();
      }
      
      // Создаем спрайт шара с изображением, соответствующим уровню
      this.nextBall = this.add.sprite(this.coinKing.x, ballY, `ball${this.nextBallLevel}`);
      this.nextBall.setDisplaySize(ballSize, ballSize);
      
      // Сохраняем уровень как свойство шара
      this.nextBall.setData('level', this.nextBallLevel);
    }
  }

  // Метод для выстрела шаром из CoinKing
  shootFromCoinKing() {
    if (!this.coinKing || !this.nextBall) return;
    
    // Проверяем, является ли шар специальным
    const isSpecialBall = this.nextBall.getData('special');
    
    // Используем позицию предзагруженного шара
    const x = this.nextBall.x / SCALE;
    const y = this.nextBall.y / SCALE;
    
    if (isSpecialBall === 'bull') {
      // Для шара Bull НЕ создаем физическое тело, только спрайт
      const radius = this.getRadiusByLevel(3) / 2; // В 2 раза меньше
      const ballSize = radius * 2 * SCALE;
      
      // Удаляем эффект свечения, если он есть
      const oldGlow = this.nextBall.getData('glow');
      if (oldGlow) oldGlow.destroy();
      
      // Создаем движущийся спрайт без физического тела
      const bullSprite = this.add.sprite(
        this.nextBall.x, 
        this.nextBall.y, 
        'bull'
      );
      
      bullSprite.setDisplaySize(ballSize, ballSize);
      bullSprite.setOrigin(0.5);
      bullSprite.setData('special', 'bull');
      bullSprite.setData('velocity', { x: 0, y: 300 }); // Скорость движения вниз в пикселях в секунду
      
      // Добавляем в специальный список для обновления в методе update
      bullSprite.setData('isBullProjectile', true);
    } else if (isSpecialBall === 'bomb') {
      // Используем такой же размер, как для шара Bull
      const radius = this.getRadiusByLevel(3) / 2;
      const result = this.createSpecialCircle(x, y, radius, 'bomb');
      
      // Проверяем, что тело успешно создано
      if (result.body) {
        // Добавляем импульс вниз
        result.body.applyLinearImpulse(planck.Vec2(0, 2), result.body.getWorldCenter());
      } else {
        console.error('Failed to create bomb ball for shooting');
      }
    } else {
      // Стандартный код для обычного шара
      const level = this.nextBallLevel;
      const radius = this.getRadiusByLevel(level);
      
      // Создаем физический шар на месте предзагруженного спрайта
      const result = this.createCircle(x, y, radius, level);
      
      // Проверяем, что тело успешно создано
      if (result.body) {
        // Добавляем импульс вниз
        result.body.applyLinearImpulse(planck.Vec2(0, 2), result.body.getWorldCenter());
      } else {
        console.error('Failed to create ball for shooting');
      }
    }
    
    // Генерируем уровень для следующего шара
    this.generateNextBallLevel();
    
    // Создаем новый предзагруженный шар
    this.createNextBall();
  }

  update(time: number, delta: number) {
    // Обновление физики
    this.world.step(1/60)

    // Обрабатываем запланированные слияния ПОСЛЕ шага физической симуляции
    this.processPendingMerges();

    // Обрабатываем отложенные удаления ПОСЛЕ шага физической симуляции
    this.processPendingDeletions();

    // Обновляем текст счета
    if (this.scoreText) {
      this.scoreText.setText(`Счет: ${this.score}`);
    }

    // Обновление позиций спрайтов
    for (const id in this.bodies) {
      const bodyData = this.bodies[id]
      if (bodyData) {
        const position = bodyData.body.getPosition()
        bodyData.sprite.x = position.x * SCALE
        bodyData.sprite.y = position.y * SCALE
        bodyData.sprite.rotation = bodyData.body.getAngle()
      }
    }
    
    // Массив бомб, которые достигли дна и должны быть удалены
    const bombsToRemove: string[] = [];
    
    // Проходим по всем телам и находим бомбы, которые достигли дна
    for (const id in this.bodies) {
      const bodyData = this.bodies[id];
      // Проверяем, что это бомба
      if (bodyData && bodyData.sprite && bodyData.body && bodyData.sprite.getData('special') === 'bomb') {
        // Получаем положение бомбы
        const bombPosition = bodyData.body.getPosition();
        if (!bombPosition) continue;
        
        const bombX = bombPosition.x * SCALE;
        const bombY = bombPosition.y * SCALE;
        
        // Проверяем, достигла ли бомба нижней границы
        if (bombY > this.game.canvas.height - 70) {
          // Удаляем бомбу, добавляем эффект
          this.addDestructionEffect(bombX, bombY);
          bombsToRemove.push(id);
        }
      }
    }
    
    // Удаляем бомбы, которые достигли дна
    for (const bombId of bombsToRemove) {
      if (this.bodies[bombId]) {
        const bombData = this.bodies[bombId];
        if (bombData.sprite) bombData.sprite.destroy();
        if (bombData.body) {
          try {
            this.world.destroyBody(bombData.body);
          } catch (e) {
            console.error('Error destroying bomb at bottom:', e);
          }
        }
        delete this.bodies[bombId];
      }
    }
    
    // Обновляем позиции всех шаров Bull без физического тела
    const bullProjectiles: Phaser.GameObjects.Sprite[] = [];
    this.children.list.forEach((gameObject: any) => {
      if (gameObject instanceof Phaser.GameObjects.Sprite && 
          gameObject.getData('isBullProjectile')) {
        bullProjectiles.push(gameObject);
      }
    });
    
    // Для каждого шара Bull проверяем столкновения и обновляем позицию
    bullProjectiles.forEach((bullSprite) => {
      // Получаем текущую скорость
      const velocity = bullSprite.getData('velocity');
      
      // Обновляем позицию
      bullSprite.y += velocity.y * (delta / 1000); // Дельта в миллисекундах, переводим в секунды
      
      // Проверяем, достиг ли шар Bull нижней границы
      if (bullSprite.y > this.game.canvas.height - 70) {
        // Удаляем шар Bull
        this.addBullDestructionEffect(bullSprite.x, bullSprite.y);
        bullSprite.destroy();
        return;
      }
      
      // Проверяем столкновения с другими шарами
      const bullBounds = bullSprite.getBounds();
      
      // Проходим по всем шарам и проверяем пересечение с шаром Bull
      for (const id in this.bodies) {
        const bodyData = this.bodies[id];
        
        if (bodyData && bodyData.sprite) {
          const ballBounds = bodyData.sprite.getBounds();
          
          // Проверяем пересечение
          if (Phaser.Geom.Rectangle.Overlaps(bullBounds, ballBounds)) {
            // Запоминаем позицию шара для эффекта
            const ballPosition = bodyData.body.getPosition();
            const ballX = ballPosition.x * SCALE;
            const ballY = ballPosition.y * SCALE;
            
            // Сохраняем ссылки на объекты перед удалением
            const bodyToDestroy = bodyData.body;
            const spriteToDestroy = bodyData.sprite;
            
            // Удаляем запись из списка this.bodies
            delete this.bodies[id];
            
            // Удаляем спрайт
            spriteToDestroy.destroy();
            
            // Удаляем физическое тело из мира
            try {
              this.world.destroyBody(bodyToDestroy);
            } catch (e) {
              console.error('Error destroying body:', e);
            }
            
            // Используем специальный эффект столкновения шара Bull
            this.addBullCollisionEffect(ballX, ballY);
            
            // НЕ удаляем шар Bull, он продолжает двигаться!
            // Прерываем цикл, так как шар уже удален
            break;
          }
        }
      }
      
      // Шар Bull не исчезает при столкновении с другими шарами
    });
  }

  // Планируем объединение шаров (вместо немедленного слияния)
  scheduleMerge(idA: string, idB: string) {
    const ballA = this.bodies[idA];
    const ballB = this.bodies[idB];
    
    if (!ballA || !ballB) return;
    
    const levelDataA = ballA.sprite.getData('level');
    const levelDataB = ballB.sprite.getData('level');
    
    const levelA = typeof levelDataA === 'number' ? levelDataA : 1;
    const levelB = typeof levelDataB === 'number' ? levelDataB : 1;
    
    // Если уровни совпадают и это не максимальный уровень
    if (levelA === levelB && levelA < this.maxLevel) {
      // Проверяем, не запланировано ли уже слияние с этими шарами
      const alreadyScheduled = this.pendingMerges.some(merge => 
        (merge.idA === idA || merge.idA === idB || merge.idB === idA || merge.idB === idB)
      );
      
      if (!alreadyScheduled) {
        this.pendingMerges.push({
          idA,
          idB,
          levelA,
          positionA: ballA.body.getPosition().clone(),
          positionB: ballB.body.getPosition().clone()
        });
      }
    }
  }

  // Обрабатываем запланированные слияния после обновления физики
  processPendingMerges() {
    if (this.pendingMerges.length === 0) return;
    
    // Обрабатываем все запланированные слияния
    for (const merge of this.pendingMerges) {
      // Проверяем, существуют ли все еще оба тела
      if (this.bodies[merge.idA] && this.bodies[merge.idB]) {
        try {
          // Вычисляем позицию для нового шара (среднее между двумя старыми)
          const newX = (merge.positionA.x + merge.positionB.x) / 2;
          const newY = (merge.positionA.y + merge.positionB.y) / 2;
          
          // Создаем новый шар следующего уровня
          const newLevel = merge.levelA + 1;
          
          // Сохраняем ссылки на объекты
          const bodyA = this.bodies[merge.idA].body;
          const bodyB = this.bodies[merge.idB].body;
          const spriteA = this.bodies[merge.idA].sprite;
          const spriteB = this.bodies[merge.idB].sprite;
          
          // Удаляем записи из списка
          delete this.bodies[merge.idA];
          delete this.bodies[merge.idB];
          
          // Удаляем физические тела из мира
          this.world.destroyBody(bodyA);
          this.world.destroyBody(bodyB);
          
          // Удаляем спрайты
          spriteA.destroy();
          spriteB.destroy();
          
          // Создаем новый шар и увеличиваем счет
          this.createMergedBall(newX, newY, newLevel);
          
          console.log(`Успешно объединены шары ${merge.idA} и ${merge.idB} в шар уровня ${newLevel}`);
        } catch (error) {
          console.error('Error processing merge:', error);
        }
      }
    }
    
    // Очищаем список запланированных слияний
    this.pendingMerges = [];
  }

  // Добавляем визуальный эффект слияния
  addMergeEffect(x: number, y: number, level: number) {
    // Создаем круговой эффект
    const circle = this.add.circle(x, y, 30, this.getColorByLevel(level), 0.7);
    circle.setScale(0.5);
    
    // Анимация пульсации и исчезновения
    this.tweens.add({
      targets: circle,
      scale: 1.5,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        circle.destroy();
      }
    });
  }

  // Удаляем шар по его ID
  destroyBall(id: string) {
    const bodyData = this.bodies[id];
    if (bodyData && bodyData.body && bodyData.sprite) {
      try {
        // Удаляем эффект свечения, если это специальный шар
        const glow = bodyData.sprite.getData('glow');
        if (glow) glow.destroy();
        
        // Удаляем спрайт
        bodyData.sprite.destroy();
        
        // Сначала сохраняем тело, чтобы удалить его правильно
        const physicalBody = bodyData.body;
        
        // Удаляем запись из списка bodies до удаления физического тела
        delete this.bodies[id];
        
        // Удаляем физическое тело из мира после удаления из списка
        try {
          this.world.destroyBody(physicalBody);
        } catch (e) {
          console.error('Error destroying body:', e);
        }
      } catch (error) {
        console.error(`Error destroying ball ${id}:`, error);
        
        // Если произошла ошибка, попробуем еще раз удалить тело
        if (this.bodies[id] && this.bodies[id].body) {
          try {
            this.world.destroyBody(this.bodies[id].body);
          } catch (e) {
            console.error('Second attempt to destroy body failed:', e);
          }
          delete this.bodies[id];
        }
      }
    }
  }

  // Изменяем метод создания границ, чтобы добавить пользовательские данные
  createBoundary(x1: number, y1: number, x2: number, y2: number, userData?: string) {
    const body = this.world.createBody({
      type: 'static',
      position: planck.Vec2(0, 0)
    })
    
    if (userData) {
      body.setUserData(userData);
    }

    body.createFixture({
      shape: planck.Edge(planck.Vec2(x1, y1), planck.Vec2(x2, y2)),
      friction: 0.3
    })

    return body
  }

  createCircle(x: number, y: number, radius: number, level: number = 1) {
    // Создаем физическое тело
    const body = this.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y),
      angularDamping: 0.1,
      linearDamping: 0.1
    })
    
    // Проверяем, что тело успешно создано
    if (!body) {
      console.error('Failed to create physical body');
      return { body: null, sprite: null, id: -1 };
    }

    body.createFixture({
      shape: planck.Circle(radius),
      density: 1.0,
      friction: 0.3,
      restitution: 0.5
    })

    // Создаем спрайт с изображением, соответствующим уровню
    const sprite = this.add.sprite(
      x * SCALE, 
      y * SCALE, 
      `ball${level}`
    )
    
    sprite.setDisplaySize(radius * 2 * SCALE, radius * 2 * SCALE)
    sprite.setOrigin(0.5)
    sprite.setData('level', level);
    
    // Сохраняем ссылку на тело и спрайт
    const id = this.nextId++
    this.bodies[id] = { body, sprite }

    return { body, sprite, id }
  }

  getRandomColor() {
    const colors = [0xFF5555, 0x55FF55, 0x5555FF, 0xFFFF55, 0xFF55FF, 0x55FFFF]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  cleanup() {
    // Уничтожаем все тела
    for (const id in this.bodies) {
      this.destroyBall(id);
    }
    if (this.coinKing) {
      this.coinKing.destroy();
    }
    if (this.nextBall) {
      this.nextBall.destroy();
    }
    if (this.aimLine) {
      this.aimLine.destroy();
    }
    this.bodies = {};
  }

  // Обработчик активации способностей
  activateAbility(ability: string) {
    switch (ability) {
      case 'Bull':
        this.activateBullAbility();
        break;
      case 'Bomb':
        this.activateBombAbility();
        break;
      case 'Earthquake':
        this.activateEarthquakeAbility();
        break;
    }
  }
  
  // Активация способности Bull с меньшим размером шара
  activateBullAbility() {
    if (this.nextBall) {
      // Запоминаем текущий уровень шара, чтобы восстановить его после использования способности
      const originalLevel = this.nextBallLevel;
      
      // Удаляем текущий шар для броска
      this.nextBall.destroy();
      
      // Создаем шар Bull
      const ballY = this.coinKing?.y ? this.coinKing.y + 20 : 80;
      const ballX = this.coinKing?.x || this.game.canvas.width / 2;
      
      // Размер в 2 раза меньше обычного шара 3 уровня
      const specialRadius = this.getRadiusByLevel(3) / 2;
      const ballSize = specialRadius * 2 * SCALE;
      
      // Создаем спрайт шара Bull
      this.nextBall = this.add.sprite(ballX, ballY, 'bull');
      this.nextBall.setDisplaySize(ballSize, ballSize);
      
      // Помечаем как специальный шар
      this.nextBall.setData('special', 'bull');
      
      // Вернемся к обычному шару после выстрела
      this.nextBallLevel = originalLevel;
    }
  }

  // Активация способности Bomb
  activateBombAbility() {
    if (this.nextBall) {
      // Запоминаем текущий уровень шара, чтобы восстановить его после использования способности
      const originalLevel = this.nextBallLevel;
      
      // Удаляем текущий шар для броска
      this.nextBall.destroy();
      
      // Создаем шар Bomb
      const ballY = this.coinKing?.y ? this.coinKing.y + 20 : 80;
      const ballX = this.coinKing?.x || this.game.canvas.width / 2;
      
      // Используем точно такой же размер, как для шара Bull
      const specialRadius = this.getRadiusByLevel(3) / 2; // Такой же, как у Bull
      const ballSize = specialRadius * 2 * SCALE;
      
      // Создаем спрайт шара Bomb
      this.nextBall = this.add.sprite(ballX, ballY, 'bomb');
      this.nextBall.setDisplaySize(ballSize, ballSize);
      
      // Помечаем как специальный шар
      this.nextBall.setData('special', 'bomb');
      
      // Вернемся к обычному шару после выстрела
      this.nextBallLevel = originalLevel;
    }
  }

  // Метод для применения импульсов при землетрясении
  applyEarthquakeImpulse(horizontalStrength: number, verticalStrength: number) {
    for (const id in this.bodies) {
      const bodyData = this.bodies[id];
      if (bodyData && bodyData.body) {
        // Случайный импульс в обоих направлениях с большей силой
        const impulseX = (Math.random() - 0.5) * horizontalStrength * 2.1; // Уменьшено с 2.5 до 2.1
        const impulseY = (Math.random() - 0.5) * verticalStrength * 2.3; // Уменьшено с 2.8 до 2.3
        
        try {
          // Применяем импульс к телу
          bodyData.body.applyLinearImpulse(
            planck.Vec2(impulseX, impulseY), 
            bodyData.body.getWorldCenter()
          );
          
          // Добавляем случайное вращение для большего эффекта хаоса
          const angularImpulse = (Math.random() - 0.5) * 6; // Уменьшено с 7 до 6
          bodyData.body.applyAngularImpulse(angularImpulse);
        } catch (e) {
          console.error('Error applying earthquake impulse:', e);
        }
      }
    }
  }

  // Активация способности Earthquake
  activateEarthquakeAbility() {
    // Создаем эффект тряски экрана с большей интенсивностью
    this.cameras.main.shake(3000, 0.022); // Уменьшено с 0.025 до 0.022
    
    // Добавляем начальный импульс всем шарам с увеличенной силой
    this.applyEarthquakeImpulse(42, 34); // Уменьшено с 50/40 до 42/34
    
    // Создаем повторяющиеся импульсы в течение 3 секунд
    const repeatCount = 5; // Количество повторений
    const interval = 500; // Интервал между импульсами в мс
    
    // Создаем таймеры для повторных импульсов
    for (let i = 1; i <= repeatCount; i++) {
      this.time.delayedCall(i * interval, () => {
        // Каждый следующий импульс немного слабее, но начальная сила больше
        const strength = 38 - i * 3.5; // Уменьшено с 45-i*4 до 38-i*3.5
        this.applyEarthquakeImpulse(strength, strength / 2);
      });
    }
    
    // Добавляем визуальный эффект для землетрясения
    this.addEarthquakeEffect();
  }
  
  // Визуальный эффект землетрясения
  addEarthquakeEffect() {
    const { width, height } = this.game.canvas;
    
    // 1. Создаем эффект пыли снизу экрана
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * width;
      const y = height - Math.random() * 60 - 50;
      
      // Частицы пыли
      const dustParticle = this.add.circle(x, y, 2 + Math.random() * 3, 0xa0a0a0, 0.7);
      
      this.tweens.add({
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
      const line = this.add.graphics();
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
      this.tweens.add({
        targets: line,
        alpha: { from: 0, to: 1 },
        duration: 200,
        yoyo: true,
        hold: 2000,
        ease: 'Sine.easeOut',
        onComplete: () => {
          line.destroy();
        }
      });
    }
    
    // 3. Звуковой эффект (если в игре есть звук)
    // this.sound.play('earthquake');
  }

  // Создаем специальный шар (Bull, Bomb и т.д.)
  createSpecialCircle(x: number, y: number, radius: number, type: string) {
    // Создаем физическое тело
    const body = this.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(x, y),
      angularDamping: 0.1,
      linearDamping: 0.1,
      bullet: true // Улучшенное обнаружение коллизий для быстрых объектов
    })
    
    // Проверяем, что тело успешно создано
    if (!body) {
      console.error('Failed to create special physical body');
      return { body: null, sprite: null, id: -1 };
    }

    body.createFixture({
      shape: planck.Circle(radius),
      density: 1.0,
      friction: 0.3,
      restitution: 0.5
    })

    // Создаем спрайт с изображением специального шара
    const sprite = this.add.sprite(
      x * SCALE, 
      y * SCALE, 
      type // 'bull', 'bomb', etc.
    )
    
    // Установка размера спрайта
    sprite.setDisplaySize(radius * 2 * SCALE, radius * 2 * SCALE)
    sprite.setOrigin(0.5)
    
    // Запоминаем тип специального шара
    sprite.setData('special', type); 
    
    // Не добавляем пульсацию ни для Bull, ни для Bomb
    if (type !== 'bull' && type !== 'bomb') {
      // Для других типов используем стандартную анимацию
      this.tweens.add({
        targets: sprite,
        scale: { from: 0.9, to: 1.1 },
        duration: 800,
        yoyo: true,
        repeat: -1
      });
    }
    
    // Сохраняем ссылку на тело и спрайт
    const id = this.nextId++
    this.bodies[id] = { body, sprite }

    return { body, sprite, id }
  }

  // Добавляем эффект уничтожения шара
  addDestructionEffect(x: number, y: number) {
    // Создаем частицы для эффекта взрыва
    const particles = this.add.particles(0, 0, 'ball1', {
      x: x,
      y: y,
      speed: { min: 50, max: 150 },
      lifespan: 600,
      quantity: 10,
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD'
    });
    
    // Автоматически уничтожаем эмиттер через 600 мс
    this.time.delayedCall(600, () => {
      particles.destroy();
    });
    
    // Добавляем вспышку
    const flash = this.add.circle(x, y, 40, 0xffd700, 0.8);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 300,
      onComplete: () => {
        flash.destroy();
      }
    });
  }

  // Добавляем специальный эффект для столкновения шара Bull с другими шарами
  addBullCollisionEffect(x: number, y: number) {
    // Создаем эффект удара быка
    
    // 1. Создаем красные частицы как "искры от удара"
    const redSparks = this.add.particles(0, 0, 'ball1', {
      x: x,
      y: y,
      speed: { min: 30, max: 100 },
      angle: { min: 0, max: 360 },
      lifespan: 500,
      quantity: 8,
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.8, end: 0 },
      blendMode: 'ADD',
      tint: 0xff0000 // Красный цвет для ассоциации с быком
    });
    
    // Автоматически уничтожаем эмиттер красных искр
    this.time.delayedCall(500, () => {
      redSparks.destroy();
    });
    
    // 2. Создаем ударную волну (круг, который расширяется и исчезает)
    const shockwave = this.add.circle(x, y, 10, 0xff3300, 0.7);
    this.tweens.add({
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
    const dust = this.add.particles(0, 0, 'ball1', {
      x: x,
      y: y,
      speed: { min: 10, max: 40 },
      angle: { min: 180, max: 360 }, // Направлены вниз и в стороны
      lifespan: 800,
      quantity: 5,
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: 0x8B4513 // Коричневый цвет для пыли
    });
    
    // Автоматически уничтожаем эмиттер пыли
    this.time.delayedCall(800, () => {
      dust.destroy();
    });
    
    // 4. Небольшой эффект размытия/дрожания для шара, с которым столкнулся бык
    const blurCircle = this.add.circle(x, y, 20, 0xffffff, 0.3);
    this.tweens.add({
      targets: blurCircle,
      scale: { from: 0.8, to: 1.5 },
      alpha: { from: 0.3, to: 0 },
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        blurCircle.destroy();
      }
    });
  }

  // Добавляем новый метод для более мягкой анимации исчезновения шара Bull
  addBullDestructionEffect(x: number, y: number) {
    // Создаем более мягкую и элегантную анимацию для Bull
    
    // Создаем круговой эффект золотого сияния
    const circle = this.add.circle(x, y, 30, 0xffd700, 0.6);
    circle.setScale(0.5);
    
    // Плавная анимация исчезновения
    this.tweens.add({
      targets: circle,
      scale: 2,
      alpha: 0,
      duration: 400,
      ease: 'Sine.easeOut',
      onComplete: () => {
        circle.destroy();
      }
    });
    
    // Добавляем искры вместо взрыва
    const sparkles = this.add.particles(0, 0, 'ball1', {
      x: x,
      y: y,
      speed: { min: 20, max: 60 },
      angle: { min: 0, max: 360 },
      lifespan: 800,
      quantity: 6,
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.8, end: 0 },
      blendMode: 'ADD',
      tint: 0xffd700 // Золотой цвет
    });
    
    // Автоматически уничтожаем эмиттер через 800 мс
    this.time.delayedCall(800, () => {
      sparkles.destroy();
    });
  }

  // Метод для удаления целевого шара (используется для Bull)
  destroyTargetBall(targetId: string, targetBall: GameBody) {
    if (!targetBall || !targetBall.body || !targetBall.sprite) return;
    
    // Запоминаем позицию шара для эффекта
    const position = targetBall.body.getPosition();
    const ballX = position.x * SCALE;
    const ballY = position.y * SCALE;
    
    // Удаляем запись из списка
    delete this.bodies[targetId];
    
    // Удаляем спрайт
    targetBall.sprite.destroy();
    
    // Удаляем физическое тело из мира
    try {
      this.world.destroyBody(targetBall.body);
    } catch (e) {
      console.error('Error destroying body:', e);
    }
    
    // Добавляем эффект уничтожения
    this.addBullCollisionEffect(ballX, ballY);
  }

  // Метод для эффекта бомбы в области - исправляем удаление шаров
  bombAreaEffect(bombId: string, bomb: GameBody, radius: number) {
    if (!bomb || !bomb.sprite || !bomb.body) return;
    
    // Получаем позицию бомбы
    const bombPosition = bomb.body.getPosition();
    if (!bombPosition) return; // Защита от undefined
    
    const bombX = bombPosition.x * SCALE;
    const bombY = bombPosition.y * SCALE;
    
    // Создаем эффект взрыва
    this.addBombAreaEffect(bombX, bombY, radius);
    
    // Шары, которые нужно удалить
    const ballsToRemove: string[] = [];
    
    // Проходим по всем шарам и проверяем расстояние
    for (const id in this.bodies) {
      // Пропускаем саму бомбу на этом этапе, удалим её отдельно
      if (id === bombId) continue;
      
      const bodyData = this.bodies[id];
      if (bodyData && bodyData.body) {
        const ballPosition = bodyData.body.getPosition();
        if (!ballPosition) continue; // Защита от undefined
        
        const ballX = ballPosition.x * SCALE;
        const ballY = ballPosition.y * SCALE;
        
        // Рассчитываем расстояние между бомбой и шаром
        const distance = Math.sqrt(
          Math.pow(bombX - ballX, 2) + 
          Math.pow(bombY - ballY, 2)
        );
        
        // Если шар в радиусе взрыва, добавляем в список на удаление
        if (distance <= radius) {
          ballsToRemove.push(id);
        }
      }
    }
    
    console.log(`Bomb explosion: removing ${ballsToRemove.length} balls in radius ${radius}`);
    
    // Для каждого шара в радиусе создаем эффект и удаляем его
    for (const id of ballsToRemove) {
      if (this.bodies[id]) {
        const ballData = this.bodies[id];
        if (ballData && ballData.body && ballData.sprite) {
          // Запоминаем позицию шара для эффекта
          const position = ballData.body.getPosition();
          if (!position) continue;
          
          const ballX = position.x * SCALE;
          const ballY = position.y * SCALE;
          
          // Удаляем запись из списка
          delete this.bodies[id];
          
          // Удаляем спрайт
          ballData.sprite.destroy();
          
          // Удаляем физическое тело из мира
          try {
            this.world.destroyBody(ballData.body);
          } catch (e) {
            console.error('Error destroying body:', e);
          }
          
          // Добавляем эффект уничтожения
          this.addMiniExplosionEffect(ballX, ballY);
        }
      }
    }
    
    // Обязательно удаляем саму бомбу после взрыва
    if (this.bodies[bombId]) {
      const bombData = this.bodies[bombId];
      
      // Удаляем запись из списка перед удалением объектов
      delete this.bodies[bombId];
      
      // Удаляем спрайт
      if (bombData.sprite) bombData.sprite.destroy();
      
      // Удаляем физическое тело из мира
      if (bombData.body) {
        try {
          this.world.destroyBody(bombData.body);
        } catch (e) {
          console.error('Error destroying bomb body:', e);
        }
      }
    }
  }

  // Добавляем эффект взрыва бомбы с радиусом поражения
  addBombAreaEffect(x: number, y: number, radius: number) {
    // 1. Вспышка в центре взрыва
    const flash = this.add.circle(x, y, 40, 0xff3300, 0.7);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // 2. Ударная волна
    const shockwave = this.add.circle(x, y, 10, 0xff9900, 0.5);
    this.tweens.add({
      targets: shockwave,
      scale: Math.max(1, radius / 10), // Масштабируем в зависимости от радиуса, но не меньше 1
      alpha: 0,
      duration: 400,
      ease: 'Power1',
      onComplete: () => {
        shockwave.destroy();
      }
    });
    
    // 3. Создаем простые круги для имитации огненных частиц взрыва
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      const distance = 5 + Math.random() * 20;
      const size = 3 + Math.random() * 5;
      
      const particleX = x + Math.cos(angle) * distance;
      const particleY = y + Math.sin(angle) * distance;
      
      // Случайный цвет огня
      const colors = [0xff0000, 0xff7700, 0xff9900, 0xffaa00];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = this.add.circle(particleX, particleY, size, color, 0.8);
      
      this.tweens.add({
        targets: particle,
        x: particleX + Math.cos(angle) * speed,
        y: particleY + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.5,
        duration: 300 + Math.random() * 300,
        ease: 'Power1',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
    
    // 4. Круг для обозначения области поражения
    const radiusCircle = this.add.circle(x, y, radius, 0xff6600, 0.2);
    this.tweens.add({
      targets: radiusCircle,
      alpha: 0,
      scale: 1.2,
      duration: 300,
      ease: 'Power1',
      onComplete: () => {
        radiusCircle.destroy();
      }
    });
  }
  
  // Добавляем эффект мини-взрыва для шаров, уничтоженных бомбой
  addMiniExplosionEffect(x: number, y: number) {
    // Вспышка
    const flash = this.add.circle(x, y, 15, 0xff6600, 0.6);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // Маленькие частицы
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;
      const size = 2 + Math.random() * 3;
      
      const particleX = x;
      const particleY = y;
      
      // Случайный цвет огня
      const colors = [0xff0000, 0xff7700, 0xff9900];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = this.add.circle(particleX, particleY, size, color, 0.8);
      
      this.tweens.add({
        targets: particle,
        x: particleX + Math.cos(angle) * speed,
        y: particleY + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.5,
        duration: 200 + Math.random() * 100,
        ease: 'Power1',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }
  
  // Обновляем метод простого эффекта уничтожения 
  addSimpleDestructionEffect(x: number, y: number) {
    // Вспышка
    const flash = this.add.circle(x, y, 20, 0xffffff, 0.6);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.3,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // Маленькие частицы вместо изображения монеты
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 25;
      const size = 2 + Math.random() * 2;
      
      const particleX = x;
      const particleY = y;
      
      // Случайный цвет
      const colors = [0xffffff, 0xffff00, 0xcccccc];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = this.add.circle(particleX, particleY, size, color, 0.8);
      
      this.tweens.add({
        targets: particle,
        x: particleX + Math.cos(angle) * speed,
        y: particleY + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.5,
        duration: 150 + Math.random() * 100,
        ease: 'Power1',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }

  // Метод для удаления шара при столкновении с бомбой
  destroyBombTarget(targetId: string, targetBall: GameBody, bombId: string, bomb: GameBody) {
    if (!targetBall || !targetBall.body || !targetBall.sprite) return;
    
    console.log(`Планируем удаление шара ${targetId} и бомбы ${bombId} при столкновении`);
    
    // Запоминаем позицию шара для эффекта
    const position = targetBall.body.getPosition();
    const ballX = position.x * SCALE;
    const ballY = position.y * SCALE;
    
    // Добавляем эффект взрыва бомбы в месте столкновения
    this.addBombExplosionEffect(ballX, ballY);
    
    // Добавляем объекты в список отложенных удалений
    this.pendingDeletions.push(
      { id: targetId, type: 'target' },
      { id: bombId, type: 'bomb' }
    );
    
    console.log(`Объекты добавлены в очередь на удаление. Будут удалены в следующем кадре.`);
  }
  
  // Добавляем эффект взрыва бомбы при столкновении с одним шаром
  addBombExplosionEffect(x: number, y: number) {
    // Вспышка в центре взрыва
    const flash = this.add.circle(x, y, 30, 0xff3300, 0.7);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        flash.destroy();
      }
    });
    
    // Круговая волна
    const shockwave = this.add.circle(x, y, 10, 0xff9900, 0.5);
    this.tweens.add({
      targets: shockwave,
      scale: 3,
      alpha: 0,
      duration: 400,
      ease: 'Power1',
      onComplete: () => {
        shockwave.destroy();
      }
    });
    
    // Создаем огненные частицы взрыва
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      const size = 3 + Math.random() * 5;
      
      // Случайный цвет огня
      const colors = [0xff0000, 0xff7700, 0xff9900, 0xffaa00];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = this.add.circle(x, y, size, color, 0.8);
      
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.5,
        duration: 300 + Math.random() * 300,
        ease: 'Power1',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }

  // Обработка отложенных удалений объектов
  processPendingDeletions() {
    if (this.pendingDeletions.length === 0) return;
    
    console.log(`Обработка ${this.pendingDeletions.length} отложенных удалений`);
    
    for (const deletion of this.pendingDeletions) {
      const { id, type } = deletion;
      
      if (this.bodies[id]) {
        const bodyData = this.bodies[id];
        
        console.log(`Удаление отложенного объекта ${id} типа ${type}`);
        
        // Удаляем спрайт
        if (bodyData.sprite) {
          bodyData.sprite.destroy();
          console.log(`- Спрайт удален`);
        }
        
        // Удаляем физическое тело
        if (bodyData.body) {
          try {
            this.world.destroyBody(bodyData.body);
            console.log(`- Физическое тело удалено`);
          } catch (e) {
            console.error(`Ошибка при удалении тела ${id}:`, e);
          }
        }
        
        // Удаляем запись из списка
        delete this.bodies[id];
        console.log(`- Запись в списке удалена`);
      } else {
        console.log(`Объект ${id} не найден в списке тел`);
      }
    }
    
    // Очищаем список отложенных удалений
    this.pendingDeletions = [];
  }

  // Метод для увеличения счета
  increaseScore(points: number) {
    this.score += points;
    
    // Обновляем текст счета
    if (this.scoreText) {
      this.scoreText.setText(`Счет: ${this.score}`);
    }
    
    // Сохраняем счет в реестре игры для доступа из React-компонента
    this.game.registry.set('gameScore', this.score);
  }

  // Метод для создания нового шара следующего уровня после слияния
  createMergedBall(newX: number, newY: number, newLevel: number) {
    // Создаем новый шар
    this.createCircle(newX, newY, this.getRadiusByLevel(newLevel), newLevel);
    
    // Добавляем визуальный эффект слияния
    this.addMergeEffect(newX * SCALE, newY * SCALE, newLevel);
    
    // Увеличиваем счет - чем выше уровень шара, тем больше очков
    this.increaseScore(newLevel * 10);
  }
}

const MergeGameLauncher: React.FC<MergeGameLauncherProps> = ({ onBack }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [score, setScore] = useState(0)
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null)
  const { inventory } = useGameState()

  useEffect(() => {
    if (!gameContainerRef.current) return

    // Создаём игру Phaser
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight - 140, // Уменьшаем высоту для учета верхнего и нижнего бара
      backgroundColor: 'transparent', // Прозрачный фон вместо синего
      parent: gameContainerRef.current,
      physics: {
        default: 'arcade',
        arcade: {
          debug: false,
        },
      },
      scene: [MergeGameScene],
      transparent: true // Делаем канвас прозрачным
    }

    const game = new Phaser.Game(config)
    gameRef.current = game

    const handleResize = () => {
      game.scale.resize(window.innerWidth, window.innerHeight - 140)
    }

    // Обработчик для получения обновлений счета из игры
    const scoreUpdateListener = () => {
      const gameScore = game.registry.get('gameScore');
      if (typeof gameScore === 'number') {
        setScore(gameScore);
      }
    };
    
    // Добавляем слушатель изменений в реестре каждые 500 мс
    const scoreUpdateInterval = setInterval(scoreUpdateListener, 500);

    window.addEventListener('resize', handleResize)
    setIsLoaded(true)

    // Очистка при размонтировании
    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(scoreUpdateInterval);
      
      if (game) {
        // Очищаем сцену перед уничтожением
        const scene = game.scene.getScene('MergeGameScene') as MergeGameScene
        if (scene) {
          scene.cleanup()
        }
        
        game.destroy(true)
        gameRef.current = null
      }
    }
  }, [])

  const handleBackClick = () => {
    onBack()
  }

  const handlePauseClick = () => {
    setIsPaused(!isPaused)
    if (gameRef.current) {
      const game = gameRef.current
      if (isPaused) {
        game.scene.resume('MergeGameScene')
      } else {
        game.scene.pause('MergeGameScene')
      }
    }
  }

  const handleAbilityClick = (ability: string) => {
    setSelectedAbility(ability);
    
    // Получаем доступ к сцене игры
    if (gameRef.current) {
      const scene = gameRef.current.scene.getScene('MergeGameScene') as MergeGameScene;
      if (scene) {
        // Вызываем метод активации способности
        scene.activateAbility(ability);
        console.log(`Активирована способность: ${ability}`);
        
        // Затем сбрасываем выбранную способность
        setTimeout(() => setSelectedAbility(null), 500);
      }
    }
  }

  return (
    <div 
      className="w-full h-screen relative flex flex-col"
      style={{
        backgroundImage: "url('/images/merge/background/merge-background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      {/* Верхний бар */}
      <div 
        className="w-full h-[70px] relative flex items-center justify-between px-6"
        style={{
          backgroundImage: "url('/images/merge/Game/ui/Header.webp')",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 100%",
          backgroundPosition: "center"
        }}
      >
        {/* Левая часть с кнопкой паузы */}
        <div className="flex items-center z-10">
          <button 
            onClick={handlePauseClick}
            className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98] mr-4"
          >
            <Image
              src="/images/merge/Game/ui/pause.webp"
              alt="Пауза"
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </button>
        </div>

        {/* Правая часть - ресурсы игрока */}
        <div className="flex items-center z-10">
          <div className="flex items-center mr-4">
            <Image
              src="/images/common/icons/snot-icon.webp"
              alt="Snot"
              width={30}
              height={30}
              className="w-7 h-7 mr-2"
            />
            <span className="text-white font-bold">{(inventory.snot || 0).toFixed(3)}</span>
          </div>
          
          <div className="flex items-center">
            <Image
              src="/images/common/icons/snotcoin-icon.webp"
              alt="SnotCoin"
              width={30}
              height={30}
              className="w-7 h-7 mr-2"
            />
            <span className="text-white font-bold">{(inventory.snotCoins || 0).toFixed(3)}</span>
          </div>
        </div>
      </div>
      
      {/* Игровой контейнер без обводки */}
      <div ref={gameContainerRef} className="flex-grow outline-none" />
      
      {/* Нижний бар с кнопками способностей */}
      <div 
        className="w-full h-[70px] relative flex items-center justify-center"
        style={{
          backgroundImage: "url('/images/merge/Game/ui/Footer.webp')",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 100%",
          backgroundPosition: "center"
        }}
      >
        <div className="flex justify-around items-center w-full px-6">
          {/* Кнопка способности Bull */}
          <button 
            onClick={() => handleAbilityClick('Bull')}
            className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-all duration-200 
              ${selectedAbility === 'Bull' ? 'scale-110 ring-2 ring-yellow-400' : 'hover:scale-105'} 
              active:scale-[0.98]`}
          >
            <Image
              src="/images/merge/Game/ui/Bull.webp"
              alt="Bull"
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          </button>
          
          {/* Кнопка способности Bomb */}
          <button 
            onClick={() => handleAbilityClick('Bomb')}
            className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-all duration-200 
              ${selectedAbility === 'Bomb' ? 'scale-110 ring-2 ring-yellow-400' : 'hover:scale-105'} 
              active:scale-[0.98]`}
          >
            <Image
              src="/images/merge/Game/ui/Bomb.webp"
              alt="Bomb"
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          </button>
          
          {/* Кнопка способности Earthquake */}
          <button 
            onClick={() => handleAbilityClick('Earthquake')}
            className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-all duration-200 
              ${selectedAbility === 'Earthquake' ? 'scale-110 ring-2 ring-yellow-400' : 'hover:scale-105'} 
              active:scale-[0.98]`}
          >
            <Image
              src="/images/merge/Game/ui/Eatherquake.webp"
              alt="Earthquake"
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>
      
      {/* Индикатор загрузки */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a2b3d] z-10">
          <div className="text-white text-2xl">Загрузка игры...</div>
        </div>
      )}

      {/* Кнопка возврата - скрытая, но доступная для вызова в любой момент */}
      <button 
        onClick={handleBackClick}
        className="absolute bottom-4 right-4 opacity-0 w-1 h-1 overflow-hidden pointer-events-none"
      >
        Назад
      </button>
    </div>
  )
}

export default MergeGameLauncher 