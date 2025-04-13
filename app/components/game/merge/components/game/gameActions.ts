"use client"

import * as Phaser from 'phaser';
import { MergeGameSceneType } from '../../utils/types';

let gameInstance: Phaser.Game | null = null;

// Глобальная ссылка на текущую сцену для доступа из других компонентов
let currentGameScene: MergeGameSceneType | null = null;

export const setGameInstance = (game: Phaser.Game) => {
  gameInstance = game;
};

/**
 * Устанавливает ссылку на текущую игровую сцену
 */
export const setGameScene = (scene: MergeGameSceneType) => {
  currentGameScene = scene;
};

/**
 * Очищает ссылку на игровую сцену
 */
export const clearGameScene = () => {
  currentGameScene = null;
};

/**
 * Получает текущую сцену
 */
export const getGameScene = (): MergeGameSceneType | null => {
  return currentGameScene;
};

/**
 * Активирует выбранную способность в игре
 */
export const activateAbility = (abilityType: string) => {
  if (!currentGameScene) {
    console.error('Невозможно активировать способность: сцена не инициализирована');
    return;
  }
  
  currentGameScene.activateAbility(abilityType);
};

/**
 * Перезапускает игру
 */
export const restartGame = () => {
  if (!currentGameScene) {
    console.error('Невозможно перезапустить игру: сцена не инициализирована');
    return;
  }
  
  currentGameScene.restart();
};

/**
 * Ставит игру на паузу
 */
export const pauseGame = () => {
  if (!currentGameScene) {
    console.error('Невозможно поставить игру на паузу: сцена не инициализирована');
    return;
  }
  
  currentGameScene.pause();
};

/**
 * Возобновляет игру после паузы
 */
export const resumeGame = () => {
  if (!currentGameScene) {
    console.error('Невозможно возобновить игру: сцена не инициализирована');
    return;
  }
  
  currentGameScene.resume();
}; 