"use client"

import * as Phaser from 'phaser';
import * as planck from "planck";

// Scale for converting between physics units and pixels
export const SCALE = 100; 

// Types for the game
export interface MergeGameAttemptsData {
  attemptsLeft: number;
  lastAttemptTime: number;
}

// Props interface for the launcher component
export interface MergeGameLauncherProps {
  onBack: () => void;
  attemptsData?: MergeGameAttemptsData;
  maxAttempts?: number;
  remainingTime?: string;
}

// Type for a game body in the physics world
export interface GameBody {
  body: planck.Body;
  sprite: Phaser.GameObjects.Sprite;
  lastTimeInDangerZone?: number | null; // Time spent in danger zone
}

// Props interface for a button with touch effects
export interface TouchButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

// Game state
export interface MergeGameState {
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
  finalScore: number;
  bestScore: number;
}

// Extended interface for the MergeGameScene
export interface MergeGameSceneType extends Phaser.Scene {
  bodies: { [key: string]: GameBody };
  nextBall: Phaser.GameObjects.Sprite | null;
  nextBallLevel: number;
  coinKing: Phaser.GameObjects.Image | null;
  pendingDeletions: { id: string, type: string }[];
  audioService?: {
    playSound: (key: string) => void;
  };
  destroyBombTarget: (targetId: string, targetBall: GameBody, bombId: string, bomb: GameBody) => void;
  increaseScore: (score: number) => void;
  activateAbility: (abilityType: string) => void;
  restart: () => void;
  pause: () => void;
  resume: () => void;
} 