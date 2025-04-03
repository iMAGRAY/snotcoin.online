import * as planck from 'planck';

// Тип для Phaser
export type PhaserType = typeof import('phaser');

// Пропсы для игры
export interface MergeGameProps {
  onClose: () => void;
  gameOptions?: {
    initialPause?: boolean;
  };
}

// Интерфейс для шаров
export interface Ball {
  body: planck.Body;
  sprite: {
    container: any;
    circle: any;
    text: any;
    effectsContainer?: any;
    glow?: any;
    stars?: any[];
  };
  level: number;
  originalGameWidth?: number; // Размер игры на момент создания шара
  specialType?: string; // Тип специального шара (Bull, Bomb и т.д.)
}

// Интерфейс для шара для броска (без физики)
export interface NextBall {
  sprite: {
    container: any;
    circle: any;
    text: any;
    outline?: any;
  };
  level: number;
  specialType?: string | undefined; // Тип специального шара (Bull, Bomb и т.д.)
}

// Пропсы для компонентов физики
export interface PhysicsWorldProps {
  worldRef: React.MutableRefObject<planck.World | null>;
  playerBodyRef: React.MutableRefObject<planck.Body | null>;
  leftWallRef: React.MutableRefObject<planck.Body | null>;
  rightWallRef: React.MutableRefObject<planck.Body | null>;
  topWallRef: React.MutableRefObject<planck.Body | null>;
  floorRef: React.MutableRefObject<planck.Body | null>;
}

// Пропсы для игрового UI
export interface GameUIProps {
  onClose: () => void;
  isPaused: boolean;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
  isTabActive: boolean;
  futureNextBallLevel: number;
  resumeGame: () => void;
}

// Интерфейс для состояний игры
export interface GameState {
  isLoading: boolean;
  hasError: boolean;
  debugMessage: string;
  isPaused: boolean;
  isTabActive: boolean;
  futureNextBallLevel: number;
}

// Интерфейс для трассировки
export interface TrajectoryRef {
  destroy: () => void;
}

// Интерфейс для пользовательских данных физики
export interface PhysicsUserData {
  level?: number;
  isPlayer?: boolean;
  shouldMerge?: boolean;
  mergeWith?: planck.Body;
} 