import { TrajectoryRef } from '../types';

// Максимальное количество сегментов в пунктирной линии для производительности
const MAX_SEGMENTS = 15;

// Создание пунктирной линии для отображения траектории
export const createTrajectoryLine = (
  scene: any,
  trajectoryLineRef: React.MutableRefObject<TrajectoryRef | null>,
  x: number,
  y: number
): void => {
  // Если уже существует траектория, уничтожаем её
  if (trajectoryLineRef.current) {
    trajectoryLineRef.current.destroy();
    trajectoryLineRef.current = null;
  }

  // Создаем графический объект для пунктирной линии
  const graphics = scene.add.graphics();
  graphics.lineStyle(2, 0xffffff, 0.5); // Полупрозрачная белая линия

  // Создаем массив сегментов для пунктирной линии
  const segments: Phaser.GameObjects.Line[] = [];

  // Создаем пунктирную линию из отдельных сегментов
  for (let i = 0; i < MAX_SEGMENTS; i++) {
    // Каждый второй сегмент будет невидимым для создания пунктирной линии
    const visible = i % 2 === 0;
    const lineSegment = scene.add.line(0, 0, 0, 0, 0, 10, 0xffffff, visible ? 0.5 : 0);
    lineSegment.setOrigin(0, 0);
    segments.push(lineSegment);
  }

  // Сохраняем ссылку на траекторию
  trajectoryLineRef.current = {
    graphics,
    segments,
    destroy: () => {
      if (graphics && !graphics.destroyed) {
        graphics.destroy();
      }
      
      segments.forEach(segment => {
        if (segment && !segment.destroyed) {
          segment.destroy();
        }
      });
    }
  };

  // Сразу обновляем положение линии
  updateTrajectoryLine(scene, trajectoryLineRef, x, y, false);
};

// Обновление положения пунктирной линии
export const updateTrajectoryLine = (
  scene: any,
  trajectoryLineRef: React.MutableRefObject<TrajectoryRef | null>,
  x: number,
  y: number,
  isPaused: boolean
): void => {
  // Если игра на паузе или нет линии, выходим
  if (isPaused || !trajectoryLineRef.current) return;

  const { segments } = trajectoryLineRef.current;

  // Задаем начальные параметры для пунктирной линии
  const startX = x;
  const startY = y;
  const segmentLength = 10; // Длина одного сегмента
  const gap = 5; // Расстояние между сегментами

  // Обновляем положение каждого сегмента
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment || segment.destroyed) continue;

    // Вычисляем позицию для текущего сегмента
    const posY = startY + (segmentLength + gap) * i;
    
    // Обновляем позицию и размер сегмента
    segment.setTo(startX, posY, startX, posY + segmentLength);
    
    // Обновляем прозрачность сегмента - дальние сегменты более прозрачные
    const alpha = 0.5 * (1 - i / segments.length);
    segment.setAlpha(i % 2 === 0 ? alpha : 0);
  }
}; 