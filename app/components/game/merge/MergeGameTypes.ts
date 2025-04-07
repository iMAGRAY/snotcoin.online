export interface MergeGameAttemptsData {
  attemptsLeft: number;
  lastAttemptTime: number;
  nextRecoveryTime: number;
}

export interface MergeGameState {
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
}

// Интерфейс для игрового тела в физическом мире
export interface GameBody {
  body: any; // Физическое тело planck.js
  sprite: Phaser.GameObjects.Sprite; // Спрайт Phaser
  lastTimeInDangerZone?: number | null; // Время, когда шар последний раз был в опасной зоне
} 