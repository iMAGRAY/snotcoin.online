import { useState, useCallback } from 'react';
import { Ball } from '../types/fusion-game';
import { useGameContext } from '../contexts/GameContext';

export const useGameState = () => {
  const [thrownBalls, setThrownBalls] = useState<Ball[]>([]);
  const [score, setScore] = useState(0);
  const [highestMergedLevel, setHighestMergedLevel] = useState(1);
  const [gameOverCountdown, setGameOverCountdown] = useState<number | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [earnedSnot, setEarnedSnot] = useState(0);
  const [initialSnot, setInitialSnot] = useState(0);

  const { state: gameState, dispatch: gameDispatch } = useGameContext();

  const addBall = useCallback((ball: Ball) => {
    setThrownBalls(prev => [...prev, ball]);
  }, []);

  const updateBalls = useCallback((updatedBalls: Ball[]) => {
    setThrownBalls(updatedBalls);
  }, []);

  const increaseScore = useCallback((amount: number) => {
    setScore(prev => prev + amount);
  }, []);

  const updateHighestMergedLevel = useCallback((level: number) => {
    setHighestMergedLevel(prev => Math.max(prev, level));
  }, []);

  const setGameOver = useCallback(() => {
    setIsGameOver(true);
    setFinalScore(score);
    setEarnedSnot(gameState.inventory.snot - initialSnot);
  }, [score, gameState.inventory.snot, initialSnot]);

  const resetGame = useCallback(() => {
    setThrownBalls([]);
    setScore(0);
    setIsGameOver(false);
    setHighestMergedLevel(1);
    setGameOverCountdown(null);
    setInitialSnot(gameState.inventory.snot);
  }, [gameState.inventory.snot]);

  return {
    thrownBalls,
    score,
    highestMergedLevel,
    gameOverCountdown,
    isGameOver,
    finalScore,
    earnedSnot,
    addBall,
    updateBalls,
    increaseScore,
    updateHighestMergedLevel,
    setGameOver,
    resetGame,
    setGameOverCountdown,
  };
};

