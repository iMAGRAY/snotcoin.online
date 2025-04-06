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
    this.createBoundary(0, height / SCALE, width / SCALE, height / SCALE) // низ
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

        // Проверяем, что это столкновение двух шаров, а не шара со стеной
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
          
          // Если нашли оба шара, добавляем их в очередь на объединение
          if (idA && idB) {
            this.scheduleMerge(idA, idB);
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
    
    // Используем позицию предзагруженного шара
    const x = this.nextBall.x / SCALE;
    const y = this.nextBall.y / SCALE;
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
    
    // Генерируем уровень для следующего шара
    this.generateNextBallLevel();
    
    // Создаем новый предзагруженный шар
    this.createNextBall();
  }

  update() {
    // Обновление физики
    this.world.step(1/60)

    // Обрабатываем запланированные слияния ПОСЛЕ шага физической симуляции
    this.processPendingMerges();

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
          const newRadius = this.getRadiusByLevel(newLevel);
          
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
          
          // Создаем новый шар
          this.createCircle(newX, newY, newRadius, newLevel);
          
          // Добавляем визуальный эффект слияния
          this.addMergeEffect(newX * SCALE, newY * SCALE, newLevel);
          
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
    if (bodyData) {
      try {
        // Удаляем спрайт
        if (bodyData.sprite) {
          bodyData.sprite.destroy();
        }
        
        // Удаляем физическое тело из мира
        if (bodyData.body) {
          try {
            this.world.destroyBody(bodyData.body);
          } catch (e) {
            console.error('Error destroying body:', e);
          }
        }
        
        // Удаляем из списка
        delete this.bodies[id];
      } catch (error) {
        console.error(`Error destroying ball ${id}:`, error);
      }
    }
  }

  createBoundary(x1: number, y1: number, x2: number, y2: number) {
    const body = this.world.createBody({
      type: 'static',
      position: planck.Vec2(0, 0)
    })

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

    window.addEventListener('resize', handleResize)
    setIsLoaded(true)

    // Очистка при размонтировании
    return () => {
      window.removeEventListener('resize', handleResize)
      
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
        // Здесь будет вызов метода для активации способности
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
        <button 
          onClick={handlePauseClick}
          className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98] z-10"
        >
          <Image
            src="/images/merge/Game/ui/pause.webp"
            alt="Пауза"
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        </button>

        {/* Центральная часть с названием игры и счетом */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
          <h1 className="text-white text-2xl font-bold text-shadow-lg">Merge Game</h1>
          <div className="flex flex-col items-center mt-1">
            <div className="bg-[#1a2b3d80] px-4 py-1 rounded-lg border border-[#4a7a9e] text-white font-bold">
              Счет: {score}
            </div>
          </div>
        </div>

        {/* Правая часть - пустая */}
        <div className="w-12 h-12 z-10" />
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