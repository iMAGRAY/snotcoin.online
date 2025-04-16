"use client"

import * as Phaser from 'phaser';

export class UIManager {
  private scene: Phaser.Scene;
  private aimLine: Phaser.GameObjects.Graphics | null = null;
  private verticalGuideLine: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Инициализация линий прицеливания
   * @param canvasWidth Ширина игрового холста
   * @param canvasHeight Высота игрового холста
   */
  public setupUI(canvasWidth: number, canvasHeight: number): void {
    // Очищаем существующие линии, если они уже были созданы
    if (this.aimLine) {
      this.aimLine.clear();
      this.aimLine.destroy();
      this.aimLine = null;
    }
    
    if (this.verticalGuideLine) {
      this.verticalGuideLine.clear();
      this.verticalGuideLine.destroy();
      this.verticalGuideLine = null;
    }
    
    try {
      // Создаем линию прицеливания без начальной отрисовки
      this.aimLine = this.scene.add.graphics();
      this.aimLine.visible = false; // Изначально скрыта
      
      // Создаем вертикальную направляющую линию без начальной отрисовки
      this.verticalGuideLine = this.scene.add.graphics();
      this.verticalGuideLine.visible = false; // Изначально скрыта
      
      // Сохраняем размеры холста в registry для последующего использования
      this.scene.game.registry.set('gameWidth', canvasWidth);
      this.scene.game.registry.set('gameHeight', canvasHeight);
      
      console.log('UI Manager: линии прицеливания инициализированы успешно');
    } catch (error) {
      console.error('Ошибка при инициализации линий прицеливания:', error);
    }
  }

  /**
   * Обновление линии прицеливания
   * @param x Координата X
   * @param height Высота игрового холста
   */
  public updateAimLine(x: number, height: number): void {
    if (!this.aimLine) return;
    
    // Проверяем валидность координат
    if (isNaN(x) || !isFinite(x) || isNaN(height) || !isFinite(height)) {
      return;
    }
    
    this.aimLine.clear();
    this.aimLine.lineStyle(4, 0xFFFFFF, 0.5); // Увеличил толщину с 2 до 4
    
    // Получаем позицию CoinKing (для начала линии)
    // Учитываем смещение игровой зоны
    const offsetX = this.scene.game.registry.get('gameOffsetX') || 0;
    const gameWidth = this.scene.game.registry.get('gameWidth') || this.scene.cameras.main.width;
    
    // Ограничиваем x в пределах игровой зоны
    x = Math.max(offsetX, Math.min(offsetX + gameWidth, x));
    
    // Рисуем пунктирную линию сегментами от CoinKing до нижней части экрана
    const segmentLength = 10;
    const gapLength = 10;
    let currentY = 80; // Начинаем от линии под CoinKing
    
    while (currentY < height) {
      // Безопасно вычисляем конец сегмента
      const segmentEnd = Math.min(currentY + segmentLength, height);
      
      // Проверяем, что сегмент имеет положительную длину
      if (segmentEnd > currentY) {
        try {
          this.aimLine.beginPath();
          this.aimLine.moveTo(x, currentY);
          this.aimLine.lineTo(x, segmentEnd);
          this.aimLine.strokePath();
        } catch (error) {
          console.error('Ошибка при отрисовке линии прицеливания:', error);
          // Прерываем цикл, если произошла ошибка
          break;
        }
      }
      
      currentY = segmentEnd + gapLength;
    }
  }

  /**
   * Обновление вертикальной направляющей линии
   * @param x Координата X
   * @param startY Начальная координата Y
   * @param endY Конечная координата Y
   */
  public updateVerticalGuideLine(x: number, startY: number, endY: number): void {
    if (!this.verticalGuideLine) return;
    
    // Полностью очищаем предыдущую линию
    this.verticalGuideLine.clear();
    
    // Округляем координаты до целых чисел для предотвращения раздваивания линии
    x = Math.round(x);
    startY = Math.round(startY);
    endY = Math.round(endY);
    
    // Проверяем, что переданные координаты валидны
    if (isNaN(x) || !isFinite(x) || isNaN(startY) || !isFinite(startY) || isNaN(endY) || !isFinite(endY)) {
      console.error('Ошибка в updateVerticalGuideLine: получены некорректные координаты', { x, startY, endY });
      this.hideVerticalGuideLine(); // Скрываем линию при некорректных координатах
      return;
    }
    
    // Устанавливаем стиль линии - делаем её толще и более заметной
    this.verticalGuideLine.lineStyle(6, 0xFFFFFF, 0.7); // Увеличиваем толщину и прозрачность
    
    // Учитываем смещение игровой зоны
    const offsetX = this.scene.game.registry.get('gameOffsetX') || 0;
    const gameWidth = this.scene.game.registry.get('gameWidth') || this.scene.cameras.main.width;
    
    // Ограничиваем x в пределах игровой зоны и округляем
    x = Math.round(Math.max(offsetX, Math.min(offsetX + gameWidth, x)));
    
    // Убедимся, что startY < endY
    if (startY >= endY) {
      console.warn('updateVerticalGuideLine: startY >= endY, корректирую значения', { startY, endY });
      const temp = startY;
      startY = Math.min(startY, endY);
      endY = Math.max(temp, endY);
    }
    
    try {
      // Рисуем сплошную вертикальную линию
      this.verticalGuideLine.beginPath();
      this.verticalGuideLine.moveTo(x, startY);
      this.verticalGuideLine.lineTo(x, endY);
      this.verticalGuideLine.strokePath();
      
      // После успешной отрисовки делаем линию видимой
      this.verticalGuideLine.visible = true;
      this.verticalGuideLine.alpha = 1;
      
      // Применяем изменения немедленно
      this.scene.children.each((child: Phaser.GameObjects.GameObject) => {
        if (child.active) {
          child.update();
        }
      });
    } catch (error) {
      console.error('Ошибка при отрисовке вертикальной направляющей:', error);
      this.hideVerticalGuideLine(); // В случае ошибки скрываем линию
    }
  }

  /**
   * Получение линии прицеливания
   */
  public getAimLine(): Phaser.GameObjects.Graphics | null {
    return this.aimLine;
  }

  /**
   * Получение вертикальной направляющей линии
   */
  public getVerticalGuideLine(): Phaser.GameObjects.Graphics | null {
    return this.verticalGuideLine;
  }

  /**
   * Скрывает вертикальную направляющую линию
   */
  public hideVerticalGuideLine(): void {
    if (this.verticalGuideLine) {
      // Очистка графического объекта
      this.verticalGuideLine.clear();
      // Скрываем объект
      this.verticalGuideLine.visible = false;
      // Сбрасываем альфа-канал для надежности
      this.verticalGuideLine.alpha = 1;
      
      // Применяем изменения немедленно
      this.scene.children.each((child: Phaser.GameObjects.GameObject) => {
        if (child.active) {
          child.update();
        }
      });
    }
  }

  /**
   * Очистка ресурсов
   */
  public cleanup(): void {
    try {
      if (this.aimLine) {
        this.aimLine.clear();
        this.aimLine.visible = false;
        this.aimLine.destroy();
        this.aimLine = null;
      }
      
      if (this.verticalGuideLine) {
        this.verticalGuideLine.clear();
        this.verticalGuideLine.visible = false;
        this.verticalGuideLine.destroy();
        this.verticalGuideLine = null;
      }
      
      console.log('UI Manager: ресурсы успешно очищены');
    } catch (error) {
      console.error('Ошибка при очистке ресурсов UI Manager:', error);
    }
  }

  /**
   * Показать оверлей паузы
   */
  public showPauseOverlay(): void {
    // Заглушка: метод реализован для соответствия интерфейсу
    // Реальная реализация оверлея паузы находится в компонентах React
    console.log('Показываем оверлей паузы');
  }

  /**
   * Скрыть оверлей паузы
   */
  public hidePauseOverlay(): void {
    // Заглушка: метод реализован для соответствия интерфейсу
    // Реальная реализация оверлея паузы находится в компонентах React
    console.log('Скрываем оверлей паузы');
  }

  /**
   * Показывает сообщение в игре
   * @param message Текст сообщения
   * @param color Цвет текста (в формате 0xRRGGBB)
   * @param fontSize Размер шрифта в пикселях
   * @param duration Продолжительность отображения в миллисекундах
   */
  public showMessage(message: string, color: number = 0xFFFFFF, fontSize: number = 24, duration: number = 1500): void {
    const { width } = this.scene.game.canvas;
    
    // Создаем текст сообщения
    const textObject = this.scene.add.text(
      width / 2, 
      100, 
      message, 
      { 
        fontSize: `${fontSize}px`,
        fontFamily: 'Impact, Arial, sans-serif',
        fontStyle: 'bold',
        color: this.rgbToHex(color),
        stroke: '#000000',
        strokeThickness: 4,
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 2, stroke: true, fill: true }
      }
    ).setOrigin(0.5).setDepth(1000);
    
    // Анимация появления
    this.scene.tweens.add({
      targets: textObject,
      alpha: { from: 0, to: 1 },
      y: { from: 50, to: 100 },
      ease: 'Power2',
      duration: 300
    });
    
    // Таймер для удаления сообщения
    this.scene.time.delayedCall(duration, () => {
      // Анимация исчезновения
      this.scene.tweens.add({
        targets: textObject,
        alpha: 0,
        y: 50,
        ease: 'Power2',
        duration: 300,
        onComplete: () => {
          textObject.destroy();
        }
      });
    });
  }
  
  /**
   * Преобразует числовое представление цвета в шестнадцатеричную строку
   * @param color Цвет в формате 0xRRGGBB
   * @returns Строка цвета в формате '#RRGGBB'
   */
  private rgbToHex(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
} 