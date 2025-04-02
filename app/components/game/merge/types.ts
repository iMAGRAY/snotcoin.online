// Интерфейс для ссылки на пунктирную линию траектории
export interface TrajectoryRef {
  graphics: any; // Графический объект Phaser
  segments: any[]; // Массив сегментов линии
  destroy: () => void; // Функция для очистки ресурсов
} 