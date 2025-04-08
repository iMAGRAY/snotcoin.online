"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { useGameState } from "../../../contexts/game/hooks/useGameState"
import { useGameDispatch } from "../../../contexts/game/hooks/useGameDispatch"
import * as Phaser from 'phaser'
import * as planck from "planck"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion" // Добавляем импорт AnimatePresence
import { toast } from 'react-hot-toast' // Добавляем импорт тоста для уведомлений
import { useForceSave } from '../../../hooks/useForceSave'
import dynamic from 'next/dynamic'
import { useTranslation } from 'react-i18next'

// Определяем типы для игры
interface MergeGameAttemptsData {
  attemptsLeft: number;
  lastAttemptTime: number;
  nextRecoveryTime: number;
}

// Определяем интерфейс пропсов для компонента
interface MergeGameLauncherProps {
  onBack: () => void;
  attemptsData?: MergeGameAttemptsData;
  maxAttempts?: number;
  remainingTime?: string;
}

const SCALE = 30 // Масштаб для перевода между физическими единицами и пикселями

type GameBody = {
  body: planck.Body;
  sprite: Phaser.GameObjects.Sprite;
  lastTimeInDangerZone?: number | null; // Добавляем поле для отслеживания времени в опасной зоне
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
  gameOverZone: Phaser.Geom.Rectangle | null = null // Зона для определения Game Over
  isGameOverCountdownActive: boolean = false // Флаг активности отсчета до Game Over
  gameOverCountdown: number = 0 // Таймер отсчета до Game Over
  gameOverText: Phaser.GameObjects.Text | null = null // Текст отсчета до Game Over
  gameOverTimer: Phaser.Time.TimerEvent | null = null // Таймер для Game Over
  isGameOver: boolean = false // Флаг окончания игры
  recentlyShot: Record<string, number> = {}
  newBallGracePeriod: number = 320 // Уменьшаю с 1500 до 320 мс для более короткого игнорирования новых шаров
  verticalGuideLine: Phaser.GameObjects.Graphics | null = null; // Вертикальная направляющая линия
  verticalGuideX: number = 0; // Позиция X вертикальной направляющей линии

  constructor() {
    super({ key: 'MergeGameScene' })
    this.world = planck.World({
      gravity: planck.Vec2(0, 15)
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
    this.scoreText = this.add.text(12, 10, 'Счет: 0', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#FFFFFF', 
      stroke: '#000000',
      strokeThickness: 3,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 2, stroke: true, fill: true }
    });
    this.scoreText.setDepth(100); // Устанавливаем высокое значение depth, чтобы текст был поверх всего
    
    // Добавляем CoinKing в верхнюю часть игровой зоны как управляемый объект
    this.coinKing = this.add.image(width / 2, 45, 'coinKing') // Подняли выше с 60 до 45
    this.coinKing.setScale(0.085) // Маленький размер
    
    // Добавляем горизонтальную пунктирную линию желтого цвета под CoinKing
    const horizontalLine = this.add.graphics();
    horizontalLine.lineStyle(2, 0xFFFF00, 0.8); // Желтый цвет (0xFFFF00)
    
    // Рисуем горизонтальную пунктирную линию
    const lineY = 75; // Координата Y линии (под CoinKing) - опущена ниже с 65 до 75
    const startX = 10; // Почти от левой стены (было 20% от ширины)
    const endX = width - 10; // Почти до правой стены (было 80% от ширины)
    
    // Рисуем пунктирную линию сегментами
    const segmentLength = 15;
    const gapLength = 8;
    let currentX = startX;
    
    while (currentX < endX) {
      const segmentEnd = Math.min(currentX + segmentLength, endX);
      horizontalLine.beginPath();
      horizontalLine.moveTo(currentX, lineY);
      horizontalLine.lineTo(segmentEnd, lineY);
      horizontalLine.strokePath();
      currentX = segmentEnd + gapLength;
    }
    
    // Создаем зону опасности над линией (от 0 до lineY) с дополнительным отступом вниз
    const safetyOffset = 5; // Дополнительный отступ вниз для более чувствительного определения пересечения
    this.gameOverZone = new Phaser.Geom.Rectangle(0, 0, width, lineY + safetyOffset);
    
    // Визуализация зоны опасности (полупрозрачная красная область)
    // Раскомментируйте для отладки
    /* 
    const zoneGraphics = this.add.graphics();
    zoneGraphics.fillStyle(0xFF0000, 0.2);
    zoneGraphics.fillRectShape(this.gameOverZone);
    */
    
    // Создаем текст для отсчета до Game Over (изначально скрыт)
    this.gameOverText = this.add.text(width / 2, height / 2, '3', {
      fontFamily: 'Arial',
      fontSize: '140px', // Увеличили размер с 120px до 140px
      color: '#FF0000',
      stroke: '#000000',
      strokeThickness: 10, // Увеличили толщину обводки с 8 до 10
      shadow: { offsetX: 3, offsetY: 3, color: '#000000', blur: 5, stroke: true, fill: true }
    });
    this.gameOverText.setOrigin(0.5); // Центрируем текст
    this.gameOverText.setAlpha(0); // Делаем текст прозрачным (скрываем)
    this.gameOverText.setDepth(200); // Ставим поверх всех элементов
    
    // Добавляем вертикальную направляющую линию
    this.verticalGuideLine = this.add.graphics();
    this.verticalGuideX = width / 2;
    
    // Рисуем вертикальную линию от горизонтальной до самого низа экрана
    // Используем точную высоту холста без смещения
    this.updateVerticalGuideLine(width / 2, lineY, height);
    
    // Генерируем уровень для следующего шара (до 6 уровня)
    this.generateNextBallLevel();
    
    // Создаем следующий шар для броска
    this.createNextBall();
    
    console.log('Merge Game инициализирована с унифицированным управлением для всех устройств');
    
    // Добавляем флаг определения типа устройства - добавляем console.log для отладки
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('Тип устройства:', isMobile ? 'Мобильное' : 'Десктоп', 'Управление: ' + 
      (isMobile ? 'зажать для перемещения, отпустить для броска' : 'движение мыши и клик'));
    
    // Добавляем обработчики для перемещения CoinKing
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.coinKing) {
        // Для мобильных устройств перемещаем CoinKing только при зажатом пальце
        // Для компьютера перемещаем всегда при движении мыши
        if (!isMobile || (isMobile && this.isPointerDown)) {
          // Обновляем только позицию X, Y остается фиксированной
          const newX = Phaser.Math.Clamp(pointer.x, 50, width - 50)
          this.coinKing.x = newX
          
          // Перемещаем следующий шар вместе с CoinKing
          if (this.nextBall) {
            this.nextBall.x = newX;
          }
          
          // Обновляем только линию прицеливания, но не изменяем вертикальную направляющую
          this.updateAimLine(newX, height);
        }
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
    
    // Обработка кликов/тапов 
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPointerDown = true;
      console.log('Pointerdown event');
      
      // Запоминаем позицию короля для вертикальной линии до выстрела
      if (this.coinKing) {
        this.verticalGuideX = this.coinKing.x;
        // Обновляем линию с зафиксированной позицией
        this.updateVerticalGuideLine(this.verticalGuideX, 75, this.game.canvas.height);
      }
      
      // На компьютере стреляем сразу при клике, на мобильных - только при отпускании
      if (!isMobile) {
        console.log('Стреляем на десктопе при клике');
        
        // Выстрел из CoinKing
        const currentTime = this.time.now;
        if (currentTime - this.lastShootTime > this.shootDelay && this.coinKing) {
          this.shootFromCoinKing();
          this.lastShootTime = currentTime;
        }
      }
    })
    
    this.input.on('pointerup', () => {
      console.log('Pointerup event, isMobile:', isMobile);
      
      // На мобильных устройствах стреляем при отпускании пальца
      if (isMobile && this.isPointerDown) {
        console.log('Стреляем на мобильном при отпускании');
        
        // Запоминаем позицию короля для вертикальной линии до выстрела
        if (this.coinKing) {
          this.verticalGuideX = this.coinKing.x;
          // Обновляем линию с зафиксированной позицией
          this.updateVerticalGuideLine(this.verticalGuideX, 75, this.game.canvas.height);
        }
        
        // Выстрел из CoinKing при отпускании пальца
        const currentTime = this.time.now;
        if (currentTime - this.lastShootTime > this.shootDelay && this.coinKing) {
          console.log('Условия для выстрела выполнены');
          this.shootFromCoinKing();
          this.lastShootTime = currentTime;
        }
      }
      
      this.isPointerDown = false;
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
            
            // Добавляем в список отложенных удалений
            this.pendingDeletions.push({ id: ballId, type: special });
            
            // Добавляем соответствующий эффект уничтожения
            if (position) {
              if (special === 'bull') {
                this.addBullDestructionEffect(position.x * SCALE, position.y * SCALE);
              } else if (special === 'bomb') {
                this.addDestructionEffect(position.x * SCALE, position.y * SCALE);
              }
            }
            
            console.log(`Шар ${special} добавлен в очередь на удаление при контакте с дном`);
            
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
            // Проверяем, есть ли специальные шары
            const ballA = this.bodies[idA];
            const ballB = this.bodies[idB];
            
            if (ballA && ballB) {
              // Проверяем, есть ли специальные шары
              const ballASpecial = ballA.sprite ? ballA.sprite.getData('special') : null;
              const ballBSpecial = ballB.sprite ? ballB.sprite.getData('special') : null;
              
              if (ballASpecial === 'bull') {
                // Шар Bull удаляет другой шар при столкновении
                this.destroyTargetBall(idB, ballB);
                
                // Запланируем удаление самого шара Bull через некоторое время
                this.time.delayedCall(200, () => {
                  if (this.bodies[idA]) {
                    // Добавляем в очередь удаления
                    this.pendingDeletions.push({ id: idA, type: 'bull_self' });
                  }
                });
              } else if (ballBSpecial === 'bull') {
                // Шар Bull удаляет другой шар при столкновении
                this.destroyTargetBall(idA, ballA);
                
                // Запланируем удаление самого шара Bull через некоторое время
                this.time.delayedCall(200, () => {
                  if (this.bodies[idB]) {
                    // Добавляем в очередь удаления
                    this.pendingDeletions.push({ id: idB, type: 'bull_self' });
                  }
                });
              } else if (ballASpecial === 'bomb') {
                // Шар Bomb удаляет ТОЛЬКО шар с которым столкнулся
                this.destroyBombTarget(idB, ballB, idA, ballA);
              } else if (ballBSpecial === 'bomb') {
                // Шар Bomb удаляет ТОЛЬКО шар с которым столкнулся
                this.destroyBombTarget(idA, ballA, idB, ballB);
              } else {
                // Стандартное поведение - запланировать объединение шаров
                this.scheduleMerge(idA, idB);
              }
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
    // Вероятности для различных уровней
    // Первые уровни выпадают чаще, более высокие реже
    const weights = [60, 30, 20, 12, 5, 2]; // Веса для уровней 1-6
    
    let totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const rand = Math.random() * totalWeight;
    
    let cumulativeWeight = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulativeWeight += weights[i] || 0; // Защита от undefined
      if (rand < cumulativeWeight) {
        this.nextBallLevel = i + 1;
        return;
      }
    }
    
    // Если по какой-то причине не выбрали уровень, устанавливаем 1-й уровень
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
    // Массив цветов для каждого уровня
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
    
    // Защита от выхода за границы массива
    const safeLevel = Math.max(1, Math.min(level, colors.length));
    const index = safeLevel - 1;
    // Оператор nullish coalescing для обеспечения возврата числа
    return colors[index] ?? 0xFFFFFF;
  }

  // Обновляем пунктирную линию прицеливания
  updateAimLine(x: number, height: number) {
    if (!this.aimLine) return;
    
    // Очищаем предыдущую линию
    this.aimLine.clear();
    
    // Вертикальные линии теперь обрабатываются только в методе updateVerticalGuideLine
    // Метод updateAimLine больше не рисует вертикальную линию
    
    // Обновляем только вертикальную направляющую линию при движении, 
    // если король перемещается, но не при выстреле
    const gameIsPaused = this.scene.isPaused();
    if (!gameIsPaused && !this.isGameOver && this.coinKing) {
      this.updateVerticalGuideLine(x, 75, this.game.canvas.height);
    }
  }

  // Метод для обновления вертикальной направляющей линии
  updateVerticalGuideLine(x: number, startY: number, endY: number) {
    if (!this.verticalGuideLine) return;
    
    // Очищаем предыдущую линию
    this.verticalGuideLine.clear();
    
    // Задаем стиль пунктирной линии - меняем на белый цвет и увеличиваем непрозрачность
    this.verticalGuideLine.lineStyle(2, 0xFFFFFF, 0.8);
    
    // Рисуем пунктирную линию от горизонтальной линии до самого низа экрана
    const vSegmentLength = 12;
    const vGapLength = 8;
    let currentY = startY;
    
    // Используем точное значение высоты без смещения, чтобы дойти до самого края
    while (currentY < endY) {
      const segmentEnd = Math.min(currentY + vSegmentLength, endY);
      this.verticalGuideLine.beginPath();
      this.verticalGuideLine.moveTo(x, currentY);
      this.verticalGuideLine.lineTo(x, segmentEnd);
      this.verticalGuideLine.strokePath();
      currentY = segmentEnd + vGapLength;
    }
    
    // Сохраняем текущую позицию X
    this.verticalGuideX = x;
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

  // Метод выстрела из CoinKing
  shootFromCoinKing() {
    const time = this.time.now;
    console.log('Метод shootFromCoinKing вызван', time);
    
    // Проверяем, прошло ли достаточно времени с последнего выстрела
    if (time - this.lastShootTime < this.shootDelay) {
      console.log('Не прошло достаточно времени после последнего выстрела');
      return;
    }
    
    // Если нет объекта короля или указатель не активен, то прекращаем
    if (!this.coinKing) {
      console.log('Нет объекта короля');
      return;
    }
    
    console.log('Все проверки прошли, создаем шар для выстрела');
    
    // Сохраняем текущую позицию вертикальной линии перед выстрелом
    const currentGuideX = this.verticalGuideX || this.coinKing.x;
    
    // Сначала перерисовываем вертикальную направляющую линию с текущей позицией
    // до самого низа экрана, чтобы она не исчезала при выстреле
    if (this.verticalGuideLine) {
      this.updateVerticalGuideLine(currentGuideX, 75, this.game.canvas.height);
    }
    
    // Конвертация физических координат в пиксели и обратно
    const worldToCanon = (value: number) => value / SCALE;
    const canonToWorld = (value: number) => value / SCALE;
    
    // Получаем текущий указатель
    const pointer = this.input.activePointer;
    
    // Радиус шара
    const radius = this.getRadiusByLevel(this.nextBallLevel);
    
    // Тип шара (обычный или специальный)
    const ballType = this.nextBall ? this.nextBall.getData('special') : null;
    let id = '';
    let newBall = null;
    
    // Создаем шар в зависимости от типа
    if (ballType) {
      // Создаем специальный шар
      const result = this.createSpecialCircle(
        canonToWorld(this.coinKing.x), 
        canonToWorld(this.coinKing.y + 40), // Небольшой отступ вниз от короля
        radius,
        ballType
      );
      
      id = String(result.id); // Преобразуем id к строке, так как ключи в this.bodies - строки
      newBall = result;
    } else {
      // Создаем обычный шар соответствующего уровня
      const result = this.createCircle(
        canonToWorld(this.coinKing.x), 
        canonToWorld(this.coinKing.y + 40), // Небольшой отступ вниз от короля
        radius,
        this.nextBallLevel
      );
      
      id = String(result.id); // Преобразуем id к строке
      newBall = result;
    }
    
    // Добавляем созданный шар в список недавних с отметкой времени
    this.recentlyShot[id] = time;
    
    // Визуально отмечаем новый шар (мигающее подсвечивание)
    if (newBall && newBall.sprite) {
      // Расчитываем физический размер шара
      const physicalSize = radius * 2 * SCALE;
      const originalScale = physicalSize / newBall.sprite.width;
      
      // Создаем временный эффект вокруг шара, сохраняя корректный масштаб
      this.tweens.add({
        targets: newBall.sprite,
        scale: { 
          from: originalScale * 1.1, // Увеличиваем относительно исходного размера 
          to: originalScale  // Возвращаем к исходному размеру
        },
        yoyo: true,
        repeat: 2,
        duration: 200,
        onComplete: () => {
          if (newBall && newBall.sprite) {
            // Возвращаем к исходному масштабу, а не к 1
            newBall.sprite.setScale(originalScale);
          }
        }
      });
    }
    
    // Применяем импульс в направлении указателя
    const bodyEntry = this.bodies[id];
    if (bodyEntry && bodyEntry.body) {
      // Расчет вектора направления
      const angle = Math.atan2(
        pointer.y - this.coinKing.y, 
        pointer.x - this.coinKing.x
      );
      
      // Сила выстрела
      const power = 20;
      
      // Создаем вектор импульса в нужном направлении
      const impulseX = Math.cos(angle) * power;
      const impulseY = Math.sin(angle) * power;
      
      // Применяем импульс к телу
      const body = bodyEntry.body;
      body.applyLinearImpulse(
        planck.Vec2(impulseX, impulseY), 
        body.getWorldCenter()
      );
    }
    
    // Сначала генерируем новый случайный уровень для следующего шара
    this.generateNextBallLevel();
    
    // Затем создаем новый шар для следующего выстрела
    this.createNextBall();
    
    // Обновляем время последнего выстрела
    this.lastShootTime = time;
  }

  update(time: number, delta: number) {
    // Ограничиваем delta максимальным значением для стабильности физики
    const maxDelta = 33; // ~30 FPS минимум
    const clampedDelta = Math.min(delta, maxDelta);
    
    // Обработка физики
    this.world.step(clampedDelta / 1000);
    
    // Обновление только видимых спрайтов
    const { width, height } = this.game.canvas;
    const visibleMargin = 100; // Дополнительный отступ за границы экрана
    
    // Обновление позиций спрайтов на основе физики
    for (const id in this.bodies) {
      const gameBody = this.bodies[id];
      if (gameBody && gameBody.body && gameBody.sprite) {
        const pos = gameBody.body.getPosition();
        const screenX = pos.x * SCALE;
        const screenY = pos.y * SCALE;
        
        // Проверяем, находится ли объект в поле зрения (с небольшим запасом)
        if (screenX > -visibleMargin && screenX < width + visibleMargin && 
            screenY > -visibleMargin && screenY < height + visibleMargin) {
          gameBody.sprite.x = screenX;
          gameBody.sprite.y = screenY;
          gameBody.sprite.rotation = gameBody.body.getAngle();
        }
      }
    }
    
    // Обрабатываем отложенные действия слияния перед физическим обновлением
    this.processPendingMerges();
    
    // Обрабатываем отложенные удаления
    this.processPendingDeletions();
    
    // Оптимизированная проверка шаров в зоне опасности
    // Проверяем каждый кадр, если активен отсчет, иначе каждые 5 кадров
    if (this.isGameOverCountdownActive || (time % 5 === 0 || this.game.loop.frame % 5 === 0)) {
      let ballsInDangerZone = false;
      
      if (this.gameOverZone) {
        // Проходим по всем шарам
        for (const id in this.bodies) {
          // Безопасное время для только что выпущенных шаров
          const isSafeNewBall = this.recentlyShot[id] && (time - this.recentlyShot[id] < this.newBallGracePeriod);
          
          // Если шар новый - пропускаем его
          if (isSafeNewBall) {
            continue;
          }
          
          const body = this.bodies[id];
          if (body && body.body && body.sprite && body.sprite.visible) {
            const pos = body.body.getPosition();
            
            // Получаем радиус для корректной проверки перекрытия
            const radius = body.body.getFixtureList()?.getShape()?.getRadius() || 0;
            
            // Проверяем скорость шара - если шар движется быстро вверх, игнорируем его
            const velocity = body.body.getLinearVelocity();
            const isMovingUpFast = velocity.y < -10; // Если скорость по Y отрицательная и большая, шар движется вверх быстро
            
            if (isMovingUpFast) {
              continue; // Пропускаем быстро движущиеся вверх шары
            }
            
            // Создаем прямоугольник для проверки пересечения
            const ballRect = new Phaser.Geom.Rectangle(
              (pos.x - radius) * SCALE, 
              (pos.y - radius) * SCALE,
              radius * 2 * SCALE, 
              radius * 2 * SCALE
            );
            
            // Проверяем пересечение с зоной опасности
            if (Phaser.Geom.Rectangle.Overlaps(this.gameOverZone, ballRect)) {
              // Дополнительно проверяем, что шар находится в зоне не мгновенно
              // (это может быть результатом телепортации или другого глюка)
              if (!body.lastTimeInDangerZone) {
                body.lastTimeInDangerZone = time;
              } else if (time - body.lastTimeInDangerZone > 100) { // Уменьшаем с 500 до 100 мс для более быстрой реакции
                ballsInDangerZone = true;
                break;
              }
            } else {
              // Сбрасываем счетчик если шар вышел из зоны
              body.lastTimeInDangerZone = null;
            }
          }
        }
        
        // Очищаем устаревшие записи о выпущенных шарах 
        // (не удаляем шары до 1.5 секунд для большей стабильности)
        for (const id in this.recentlyShot) {
          const shotTime = this.recentlyShot[id];
          if (shotTime && time - shotTime > 1500) {
            delete this.recentlyShot[id];
          }
        }
      }
      
      // Запускаем или останавливаем отсчет до Game Over
      if (ballsInDangerZone) {
        this.startGameOverCountdown();
      } else if (this.isGameOverCountdownActive) {
        this.stopGameOverCountdown();
      }
    }
    
    // Обновляем линию прицеливания
    if (this.coinKing && this.aimLine && this.isPointerDown) {
      const pointer = this.input.activePointer;
      this.updateAimLine(pointer.x, pointer.y);
    }
    
    // Проверяем и обновляем вертикальную линию, если она должна быть видна,
    // но исчезла или изменила позицию
    if (this.verticalGuideLine && !this.isGameOver && !this.isGameOverCountdownActive) {
      const currentX = this.verticalGuideX;
      if (currentX > 0) {
        this.updateVerticalGuideLine(currentX, 75, this.game.canvas.height);
      }
    }
  }
  
  // Метод для запуска отсчета до Game Over
  startGameOverCountdown() {
    if (this.isGameOverCountdownActive) return; // Уже запущен
    
    this.isGameOverCountdownActive = true;
    this.gameOverCountdown = 3; // 3 секунды
    
    // Создаем черный полупрозрачный фон для лучшей видимости таймера
    const { width, height } = this.game.canvas;
    const countdownBg = this.add.circle(width / 2, height / 2, 100, 0x000000, 0.6);
    countdownBg.setDepth(199); // Чуть ниже, чем текст
    
    // Сохраняем ссылку на фон для дальнейшего использования
    if (this.gameOverText) {
      this.gameOverText.setData('background', countdownBg);
    }
    
    // Показываем текст отсчета
    if (this.gameOverText) {
      this.gameOverText.setText(this.gameOverCountdown.toString());
      this.gameOverText.setAlpha(1);
      
      // Анимация появления
      this.tweens.add({
        targets: [this.gameOverText, countdownBg],
        scale: { from: 2, to: 1 },
        duration: 500,
        ease: 'Bounce.easeOut'
      });
      
      // Добавляем пульсацию
      this.tweens.add({
        targets: countdownBg,
        scale: { from: 1, to: 1.2 },
        alpha: { from: 0.6, to: 0.4 },
        duration: 1000,
        yoyo: true,
        repeat: -1
      });
    }
    
    // Создаем отсчет
    this.gameOverTimer = this.time.addEvent({
      delay: 1000, // 1 секунда
      callback: this.updateGameOverCountdown,
      callbackScope: this,
      loop: true
    });
  }
  
  // Обновление отсчета
  updateGameOverCountdown() {
    if (!this.isGameOverCountdownActive) return;
    
    this.gameOverCountdown--;
    
    if (this.gameOverText) {
      this.gameOverText.setText(this.gameOverCountdown.toString());
      
      // Анимация пульсации только для текста
      this.tweens.add({
        targets: this.gameOverText,
        scale: { from: 1.5, to: 1 },
        duration: 500,
        ease: 'Sine.easeOut'
      });
    }
    
    // Если отсчет завершен, вызываем Game Over
    if (this.gameOverCountdown <= 0) {
      this.triggerGameOver();
    }
  }
  
  // Остановка отсчета (если шары покинули зону опасности)
  stopGameOverCountdown() {
    if (!this.isGameOverCountdownActive) return;
    
    this.isGameOverCountdownActive = false;
    
    // Останавливаем таймер
    if (this.gameOverTimer) {
      this.gameOverTimer.remove();
      this.gameOverTimer = null;
    }
    
    // Скрываем текст и фон
    if (this.gameOverText) {
      // Получаем ссылку на фон
      const countdownBg = this.gameOverText.getData('background');
      
      // Анимация исчезновения
      this.tweens.add({
        targets: [this.gameOverText, countdownBg],
        alpha: 0,
        scale: 0.5,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          // Уничтожаем фон после анимации
          if (countdownBg) {
            countdownBg.destroy();
          }
        }
      });
    }
  }
  
  // Вызываем Game Over
  triggerGameOver() {
    this.isGameOver = true;
    
    // Останавливаем все таймеры
    if (this.gameOverTimer) {
      this.gameOverTimer.remove();
      this.gameOverTimer = null;
    }
    
    // Отображаем надпись Game Over
    if (this.gameOverText) {
      this.gameOverText.setText('GAME OVER');
      this.gameOverText.setFontSize('80px');
      
      // Анимация надписи Game Over
      this.tweens.add({
        targets: this.gameOverText,
        scale: { from: 0, to: 1 },
        duration: 1000,
        ease: 'Elastic.easeOut'
      });
    }
    
    // Сохраняем информацию о Game Over в реестре игры для React-компонента
    this.game.registry.set('gameOver', true);
    this.game.registry.set('finalScore', this.score);
    
    // Добавляем сохранение счета в localStorage для статистики
    try {
      const bestScore = localStorage.getItem('mergeGameBestScore');
      if (!bestScore || parseInt(bestScore) < this.score) {
        localStorage.setItem('mergeGameBestScore', this.score.toString());
      }
      
      // Сохраняем историю последних игр
      const gameHistoryStr = localStorage.getItem('mergeGameHistory');
      const gameHistory = gameHistoryStr ? JSON.parse(gameHistoryStr) : [];
      
      // Добавляем текущую игру в историю
      gameHistory.unshift({
        score: this.score,
        date: new Date().toISOString(),
        duration: Date.now() - (this.game.registry.get('gameStartTime') || Date.now())
      });
      
      // Ограничиваем историю до 10 последних игр
      if (gameHistory.length > 10) {
        gameHistory.pop();
      }
      
      localStorage.setItem('mergeGameHistory', JSON.stringify(gameHistory));
    } catch (e) {
      console.error('Ошибка при сохранении счета:', e);
    }
    
    // Останавливаем возможность управления
    this.input.enabled = false;
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
          const bodyAEntry = this.bodies[merge.idA];
          const bodyBEntry = this.bodies[merge.idB];
          
          if (!bodyAEntry || !bodyBEntry) {
            // Один из объектов был удален, пропускаем слияние
            continue;
          }
          
          const bodyA = bodyAEntry.body;
          const bodyB = bodyBEntry.body;
          const spriteA = bodyAEntry.sprite;
          const spriteB = bodyBEntry.sprite;
          
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
    if (bodyData && bodyData.body) {
      try {
        // Удаляем эффект свечения, если это специальный шар
        const glow = bodyData.sprite.getData('glow');
        if (glow) glow.destroy();
        
        // Удаляем спрайт
        if (bodyData.sprite) {
          bodyData.sprite.destroy();
        }
        
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
        if (this.bodies[id]) {
          const bodyData = this.bodies[id];
          if (bodyData && bodyData.body) {
            try {
              this.world.destroyBody(bodyData.body);
            } catch (e) {
              console.error('Second attempt to destroy body failed:', e);
            }
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
    
    // Получаем уровень шара для начисления очков
    const ballLevel = targetBall.sprite.getData('level') || 1;
    
    // Добавляем эффект уничтожения
    this.addBullCollisionEffect(ballX, ballY);
    
    // Вместо немедленного удаления добавляем в очередь отложенных удалений
    this.pendingDeletions.push(
      { id: targetId, type: 'bull_target' }
    );
    
    console.log(`Шар ${targetId} добавлен в очередь на удаление после столкновения с Bull`);
    
    // Начисляем очки за удаление шара - чем выше уровень шара, тем больше очков
    // Bull шар более мощный, поэтому даём больше очков (x15)
    this.increaseScore(ballLevel * 15);
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
    
    // Суммарное количество очков за все шары
    let totalScorePoints = 0;
    
    // Для каждого шара в радиусе создаем эффект и добавляем в очередь на удаление
    for (const id of ballsToRemove) {
      if (this.bodies[id]) {
        const ballData = this.bodies[id];
        if (ballData && ballData.body && ballData.sprite) {
          // Запоминаем позицию шара для эффекта
          const position = ballData.body.getPosition();
          if (!position) continue;
          
          const ballX = position.x * SCALE;
          const ballY = position.y * SCALE;
          
          // Получаем уровень шара для начисления очков
          const ballLevel = ballData.sprite.getData('level') || 1;
          
          // Накапливаем очки (x12 для Bomb)
          totalScorePoints += ballLevel * 12;
          
          // Добавляем эффект уничтожения
          this.addMiniExplosionEffect(ballX, ballY);
          
          // Добавляем в очередь на удаление вместо немедленного удаления
          this.pendingDeletions.push({ id, type: 'bomb_target' });
        }
      }
    }
    
    // Начисляем суммарные очки за все удаленные бомбой шары
    if (totalScorePoints > 0) {
      this.increaseScore(totalScorePoints);
    }
    
    // Добавляем саму бомбу в очередь на удаление
    this.pendingDeletions.push({ id: bombId, type: 'bomb_self' });
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
      { id: targetId, type: 'bomb_target' },
      { id: bombId, type: 'bomb_self' }
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
        
        // Добавляем эффект в зависимости от типа
        if (type === 'bull_self' || type === 'bull') {
          // Эффект для шара bull
          const position = bodyData.body.getPosition();
          if (position) {
            this.addBullDestructionEffect(position.x * SCALE, position.y * SCALE);
          }
        } else if (type === 'bull_target') {
          // Эти шары уже имеют эффект, добавленный в методе destroyTargetBall
        } else if (type === 'bomb_self' || type === 'bomb') {
          // Бомба уже имеет эффект при уничтожении
        } else if (type === 'bomb_target' || type === 'target') {
          // Цели бомбы уже имеют эффект
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

const MergeGameLauncher: React.FC<MergeGameLauncherProps> = ({ 
  onBack, 
  attemptsData = { attemptsLeft: 0, lastAttemptTime: 0, nextRecoveryTime: 0 }, 
  maxAttempts = 3,
  remainingTime = ""
}) => {
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [score, setScore] = useState(0)
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null)
  const [isGameOver, setIsGameOver] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const { inventory } = useGameState()
  
  // Хук для принудительного сохранения состояния игры
  const forceSave = useForceSave()

  useEffect(() => {
    if (!gameContainerRef.current) return

    // Получаем лучший счет из localStorage
    try {
      const savedBestScore = localStorage.getItem('mergeGameBestScore');
      if (savedBestScore) {
        setBestScore(parseInt(savedBestScore));
      }
    } catch (e) {
      console.error('Ошибка при чтении лучшего счета:', e);
    }

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
    
    // Сохраняем время начала игры
    game.registry.set('gameStartTime', Date.now());

    const handleResize = () => {
      game.scale.resize(window.innerWidth, window.innerHeight - 140)
    }

    // Обработчик для получения обновлений счета из игры и проверки Game Over
    const gameUpdateListener = () => {
      const gameScore = game.registry.get('gameScore');
      if (typeof gameScore === 'number') {
        setScore(gameScore);
      }
      
      // Проверяем, завершилась ли игра
      const gameOver = game.registry.get('gameOver');
      if (gameOver) {
        const finalGameScore = game.registry.get('finalScore');
        setIsGameOver(true);
        if (typeof finalGameScore === 'number') {
          setFinalScore(finalGameScore);
        }
      }
    };
    
    // Добавляем слушатель изменений в реестре каждые 500 мс
    const gameUpdateInterval = setInterval(gameUpdateListener, 500);

    window.addEventListener('resize', handleResize)
    setIsLoaded(true)

    // Очистка при размонтировании
    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(gameUpdateInterval);
      
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
    // Система сохранений отключена - выводим лог и продолжаем выполнение
    console.log('[MergeGame] Система сохранений отключена');
    // Возвращаемся в меню
    onBack();
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

  // Новый обработчик продолжения игры
  const handleContinueClick = () => {
    setIsPaused(false)
    if (gameRef.current) {
      gameRef.current.scene.resume('MergeGameScene')
    }
  }

  // Функция для перезапуска игры
  const handleRestartClick = () => {
    if (!gameRef.current) return;

    console.log('[MergeGame] Система сохранений отключена');
    
    // Останавливаем текущую игру
    gameRef.current.scene.stop('MergeGameScene');
    
    // Удаляем сцену перед добавлением новой
    gameRef.current.scene.remove('MergeGameScene');
    
    // Создаем новую сцену
    gameRef.current.scene.add('MergeGameScene', MergeGameScene, true);
    
    // Обновляем состояния
    setIsGameOver(false);
    setScore(0);
    setIsPaused(false);
    
    // Сохраняем время начала игры
    gameRef.current.registry.set('gameStartTime', Date.now());
  }

  const handleAbilityClick = (ability: string) => {
    // Получаем стоимость активации способности в зависимости от вместимости контейнера
    const containerCapacity = inventory.containerCapacity || 1;
    let cost = 0;
    
    switch (ability) {
      case 'Bull':
        // 30% от вместимости контейнера без минимального порога
        cost = containerCapacity * 0.3;
        break;
      case 'Bomb':
        // 10% от вместимости контейнера без минимального порога
        cost = containerCapacity * 0.1;
        break;
      case 'Earthquake':
        // 20% от вместимости контейнера без минимального порога
        cost = containerCapacity * 0.2;
        break;
    }
    
    // Проверяем достаточно ли snotCoins
    if (inventory.snotCoins >= cost) {
      // Активируем способность
      setSelectedAbility(ability);
      
      // Обновляем состояние игры, вычитая стоимость способности из snotCoins
      const updatedInventory = {
        ...inventory,
        snotCoins: inventory.snotCoins - cost
      };
      
      // Отправляем действие для обновления состояния
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game:update-inventory', { 
          detail: updatedInventory 
        }));
      }
      
      // Получаем доступ к сцене игры
      if (gameRef.current) {
        const scene = gameRef.current.scene.getScene('MergeGameScene') as MergeGameScene;
        if (scene) {
          // Вызываем метод активации способности
          scene.activateAbility(ability);
          
          // Затем сбрасываем выбранную способность
          setTimeout(() => setSelectedAbility(null), 500);
        }
      }
    } else {
      // Показываем уведомление о недостатке ресурсов
      toast.error(`Недостаточно SnotCoin для ${ability}! Нужно ${cost.toFixed(1)} SnotCoin`);
    }
  }

  // Улучшенная кнопка для тач-устройств
  const TouchButton = ({
    onClick,
    className,
    disabled = false,
    title,
    children
  }: {
    onClick: () => void,
    className?: string,
    disabled?: boolean,
    title?: string,
    children: React.ReactNode
  }) => {
    const [isPressed, setIsPressed] = useState(false);
    
    const handleTouchStart = (e: React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      setIsPressed(true);
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
    };
    
    const handleTouchEnd = (e: React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      if (isPressed) {
        onClick();
      }
      setIsPressed(false);
    };
    
    const handleTouchCancel = () => {
      setIsPressed(false);
    };
    
    const pressedClass = isPressed ? "transform scale-95 opacity-90" : "";
    
    return (
      <button
        onClick={onClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        disabled={disabled}
        className={`${className} ${pressedClass}`}
        title={title}
      >
        {children}
      </button>
    );
  };

  return (
    <div 
      className="w-full h-screen relative flex flex-col"
      style={{
        backgroundImage: "url('/images/merge/background/merge-background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backdropFilter: "blur(2px)", // Добавляем размытие фона
        WebkitBackdropFilter: "blur(2px)" // Для поддержки Safari
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
          <TouchButton
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
          </TouchButton>
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
      
      {/* Нижний бар с кнопками способностей (вернули обратно) */}
      <div 
        className="w-full h-[70px] relative flex items-center justify-center"
        style={{
          backgroundImage: "url('/images/merge/Game/ui/Footer.webp')",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 100%",
          backgroundPosition: "center"
        }}
      >
        <div className="relative w-full px-6">
          {/* Кнопки способностей подняты выше за счет отрицательного margin-top */}
          <div className="flex justify-around items-center w-full -mt-6">
            {/* Кнопки способностей с улучшенным обработчиком тач-событий */}
            {(() => {
              const containerCapacity = inventory.containerCapacity || 1;
              const bullCost = containerCapacity * 0.3;
              const bombCost = containerCapacity * 0.1;
              const earthquakeCost = containerCapacity * 0.2;
              
              return (
                <>
                  {/* Кнопка способности Bull */}
                  <div className="relative flex flex-col items-center">
                    <div className="relative">
                      <TouchButton
                        onClick={() => handleAbilityClick('Bull')}
                        className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center
                          ${selectedAbility === 'Bull' 
                            ? `ring-4 ring-yellow-400 shadow-[0_0_18px_rgba(255,204,0,0.8)] scale-110` 
                            : inventory.snotCoins >= bullCost
                              ? `ring-2 ring-yellow-600 hover:ring-yellow-400 shadow-lg hover:shadow-[0_0_15px_rgba(255,204,0,0.5)] hover:scale-105`
                              : 'ring-2 ring-gray-700 opacity-60 cursor-not-allowed'} 
                          transition-all duration-200 active:scale-[0.98] bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-700`}
                        title={`Стоимость: ${bullCost.toFixed(1)} SnotCoin`}
                        disabled={inventory.snotCoins < bullCost}
                      >
                        <div className={`w-[92%] h-[92%] rounded-full overflow-hidden p-1 bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 flex items-center justify-center`}>
                          <Image
                            src="/images/merge/abilities/bull.webp"
                            alt="Bull"
                            width={42}
                            height={42}
                            className="w-full h-full object-cover rounded-full"
                            priority
                          />
                        </div>
                      </TouchButton>
                      {/* Индикатор стоимости Bull - независимый элемент */}
                      <div className="absolute -top-3 -left-3 bg-gradient-to-br from-yellow-500 to-amber-600 text-white text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center shadow-lg border-2 border-yellow-300 z-20">
                        {bullCost.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Кнопка способности Bomb */}
                  <div className="relative flex flex-col items-center">
                    <div className="relative">
                      <TouchButton
                        onClick={() => handleAbilityClick('Bomb')}
                        className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center
                          ${selectedAbility === 'Bomb' 
                            ? `ring-4 ring-red-400 shadow-[0_0_18px_rgba(255,0,0,0.8)] scale-110` 
                            : inventory.snotCoins >= bombCost
                              ? `ring-2 ring-red-700 hover:ring-red-400 shadow-lg hover:shadow-[0_0_15px_rgba(255,0,0,0.5)] hover:scale-105`
                              : 'ring-2 ring-gray-700 opacity-60 cursor-not-allowed'} 
                          transition-all duration-200 active:scale-[0.98] bg-gradient-to-br from-red-400 via-red-500 to-rose-700`}
                        title={`Стоимость: ${bombCost.toFixed(1)} SnotCoin`}
                        disabled={inventory.snotCoins < bombCost}
                      >
                        <div className={`w-[92%] h-[92%] rounded-full overflow-hidden p-1 bg-gradient-to-br from-red-300 via-red-500 to-rose-600 flex items-center justify-center`}>
                          <Image
                            src="/images/merge/abilities/bomb.webp"
                            alt="Bomb"
                            width={42}
                            height={42}
                            className="w-full h-full object-cover rounded-full"
                            priority
                          />
                        </div>
                      </TouchButton>
                      {/* Индикатор стоимости Bomb - независимый элемент */}
                      <div className="absolute -top-3 -left-3 bg-gradient-to-br from-red-500 to-rose-600 text-white text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center shadow-lg border-2 border-red-300 z-20">
                        {bombCost.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Кнопка способности Earthquake - новый фиолетовый цвет */}
                  <div className="relative flex flex-col items-center">
                    <div className="relative">
                      <TouchButton
                        onClick={() => handleAbilityClick('Earthquake')}
                        className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center
                          ${selectedAbility === 'Earthquake' 
                            ? `ring-4 ring-purple-400 shadow-[0_0_18px_rgba(147,51,234,0.8)] scale-110` 
                            : inventory.snotCoins >= earthquakeCost
                              ? `ring-2 ring-purple-700 hover:ring-purple-400 shadow-lg hover:shadow-[0_0_15px_rgba(147,51,234,0.5)] hover:scale-105`
                              : 'ring-2 ring-gray-700 opacity-60 cursor-not-allowed'} 
                          transition-all duration-200 active:scale-[0.98] bg-gradient-to-br from-purple-400 via-purple-500 to-violet-700`}
                        title={`Стоимость: ${earthquakeCost.toFixed(1)} SnotCoin`}
                        disabled={inventory.snotCoins < earthquakeCost}
                      >
                        <div className={`w-[92%] h-[92%] rounded-full overflow-hidden p-1 bg-gradient-to-br from-purple-300 via-purple-500 to-violet-600 flex items-center justify-center`}>
                          <Image
                            src="/images/merge/abilities/eatherquake.webp"
                            alt="Earthquake"
                            width={42}
                            height={42}
                            className="w-full h-full object-cover rounded-full"
                            priority
                          />
                        </div>
                      </TouchButton>
                      {/* Индикатор стоимости Earthquake - независимый элемент */}
                      <div className="absolute -top-3 -left-3 bg-gradient-to-br from-purple-500 to-violet-600 text-white text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center shadow-lg border-2 border-purple-300 z-20">
                        {earthquakeCost.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
      
      {/* Индикатор загрузки */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a2b3d] z-10">
          <div className="text-white text-2xl">Загрузка игры...</div>
        </div>
      )}
      
      {/* Окно Game Over */}
      {isGameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-20">
          <motion.div 
            className="w-80 bg-gradient-to-b from-[#2a3b4d] to-[#1a2b3d] p-8 rounded-2xl border-2 border-[#4a7a9e] shadow-2xl"
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <h2 className="text-red-500 text-4xl font-bold text-center mb-6">GAME OVER</h2>
            <div className="text-white text-center mb-6">
              <p className="text-xl mb-2">Итоговый счет</p>
              <p className="text-3xl font-bold">{finalScore}</p>
              {bestScore > 0 && (
                <p className="text-sm mt-2">Лучший счет: <span className="font-bold">{bestScore}</span></p>
              )}
              <div className="mt-4 p-3 bg-gradient-to-r from-[#1a1a2e] to-[#162447] rounded-2xl border border-red-500/20 shadow-lg">
                <div className="mb-2 flex items-center justify-center">
                  <p className="text-sm font-medium text-gray-300">Осталось попыток:</p>
                </div>
                <div className="flex justify-center gap-2">
                  {[...Array(maxAttempts)].map((_, index) => (
                    <div 
                      key={index} 
                      className={`w-8 h-8 rounded-full flex items-center justify-center 
                        ${index < attemptsData.attemptsLeft 
                          ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-[0_0_8px_rgba(250,204,21,0.7)]' 
                          : 'bg-gray-700 opacity-50'}`}
                    >
                      {index < attemptsData.attemptsLeft ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col space-y-3">
              {attemptsData.attemptsLeft > 0 && (
                <TouchButton 
                  onClick={handleRestartClick}
                  className="relative w-full px-6 py-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl font-bold 
                    text-white shadow-lg border-2 border-blue-300 focus:outline-none focus:ring-2 
                    focus:ring-blue-300 focus:ring-opacity-50 h-14 hover:scale-105 hover:shadow-lg"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-lg font-bold">Начать заново</span>
                  </div>
                </TouchButton>
              )}
              <TouchButton 
                onClick={onBack}
                className="relative w-full px-6 py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl font-bold 
                  text-black shadow-lg border-2 border-yellow-300 focus:outline-none focus:ring-2 
                  focus:ring-yellow-300 focus:ring-opacity-50 h-16 hover:scale-105 hover:shadow-lg"
              >
                <div className="flex items-center justify-center space-x-2">
                  <Image 
                    src="/images/laboratory/buttons/claim-button.webp" 
                    width={28} 
                    height={28} 
                    alt="Back" 
                    className="h-7 w-7 mr-1" 
                  />
                  <span className="text-lg font-bold">Выйти в меню</span>
                </div>
              </TouchButton>
            </div>
          </motion.div>
        </div>
      )}

      {/* Мини-меню паузы */}
      <AnimatePresence>
        {isPaused && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-20">
            <motion.div 
              className="w-80 bg-gradient-to-b from-[#2a3b4d] to-[#1a2b3d] p-8 rounded-2xl border-2 border-[#4a7a9e] shadow-2xl"
              initial={{ scale: 0.8, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 50, opacity: 0 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <h2 className="text-white text-3xl font-bold text-center mb-6">ПАУЗА</h2>
              
              <div className="bg-gradient-to-r from-[#1a1a2e] to-[#162447] p-4 rounded-2xl mb-4 border border-blue-500/20 shadow-lg">
                <div className="mb-2 flex items-center justify-center">
                  <p className="text-sm font-medium text-blue-300">Осталось попыток:</p>
                </div>
                <div className="flex justify-center gap-2">
                  {[...Array(maxAttempts)].map((_, index) => (
                    <div 
                      key={index} 
                      className={`w-7 h-7 rounded-full flex items-center justify-center 
                        ${index < attemptsData.attemptsLeft 
                          ? 'bg-gradient-to-r from-blue-400 to-blue-600 shadow-[0_0_8px_rgba(96,165,250,0.7)]' 
                          : 'bg-gray-700 opacity-50'}`}
                    >
                      {index < attemptsData.attemptsLeft ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col space-y-4">
                <motion.button 
                  onClick={handleContinueClick}
                  className="relative px-6 py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl font-bold 
                    text-white shadow-lg border-2 border-yellow-300 focus:outline-none focus:ring-2 
                    focus:ring-yellow-300 focus:ring-opacity-50 h-16"
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 0 12px rgba(250, 204, 21, 0.7)",
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Image 
                      src="/images/laboratory/buttons/claim-button.webp" 
                      width={28} 
                      height={28} 
                      alt="Продолжить" 
                      className="inline-block" 
                    />
                    <span className="text-lg">Продолжить</span>
                  </div>
                </motion.button>
                
                {attemptsData.attemptsLeft > 0 && (
                  <motion.button 
                    onClick={handleRestartClick}
                    className="relative px-6 py-4 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl font-bold 
                      text-white shadow-lg border-2 border-blue-300 focus:outline-none focus:ring-2 
                      focus:ring-blue-300 focus:ring-opacity-50 h-16"
                    whileHover={{ 
                      scale: 1.05,
                      boxShadow: "0 0 12px rgba(59, 130, 246, 0.7)",
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-lg">Начать заново</span>
                    </div>
                  </motion.button>
                )}
                
                <motion.button 
                  onClick={onBack}
                  className="relative px-6 py-4 bg-gradient-to-r from-red-500 to-red-700 rounded-2xl font-bold 
                    text-white shadow-lg border-2 border-red-400 focus:outline-none focus:ring-2 
                    focus:ring-red-300 focus:ring-opacity-50 h-16"
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 0 12px rgba(220, 38, 38, 0.7)",
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-lg">Выйти в меню</span>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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