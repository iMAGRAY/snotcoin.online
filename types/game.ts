export interface GameState {
  resources: {
    gold: number;
    wood: number;
    stone: number;
  };
  buildings: Building[];
  upgrades: Upgrade[];
  lastUpdated: number;
}

export interface Building {
  id: string;
  type: string;
  level: number;
  position: {
    x: number;
    y: number;
  };
}

export interface Upgrade {
  id: string;
  type: string;
  level: number;
  unlocked: boolean;
} 