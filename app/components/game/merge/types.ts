
"use client"

import * as Phaser from 'phaser';
import * as planck from "planck";

// Масштаб для перевода между физическими единицами и пикселями
export const SCALE = 30; 

// Типы для игры
export interface MergeGameAttemptsData {
  attemptsLeft: number;
  lastAttemptTime: number;
  nextRecoveryTime: number;
}

// Интерфейс пропсов для компонента лаунчера
export interface MergeGameLauncherProps {
  onBack: () => void;
  attemptsData?: MergeGameAttemptsData;
  maxAttempts?: number;
  remainingTime?: string;
}

// Тип для игрового тела в физическом мире
export type GameBody = {
  body: planck.Body;
  sprite: Phaser.GameObjects.Sprite;
  lastTimeInDangerZone?: number | null; // Добавляем поле для отслеживания времени в опасной зоне
}

// Интерфейс пропсов для кнопки с тач-эффектами
export interface TouchButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

// Состояние игры
export interface MergeGameState {
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
  finalScore: number;
  bestScore: number;
}
