"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useGameState } from "../../../contexts/game/hooks/useGameState";
import { AnimatePresence } from "framer-motion";
import { toast } from 'react-hot-toast';
import { useForceSave } from '../../../hooks/useForceSave';
import { MergeGameLauncherProps } from './utils/types';

// Импорт компонентов
import GameHeader from './components/ui/GameHeader';
import AbilitiesBar from './components/ui/AbilitiesBar';
import GameContainer from './components/game/GameContainer';
import GameOverDialog from './components/ui/GameOverDialog';
import PauseDialog from './components/ui/PauseDialog';
import { activateAbility, pauseGame, resumeGame } from './components/game/gameActions';

const MergeGameLauncher: React.FC<MergeGameLauncherProps> = ({ 
  onBack, 
  attemptsData = { attemptsLeft: 0, lastAttemptTime: 0, nextRecoveryTime: 0 }, 
  maxAttempts = 3,
  remainingTime = ""
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [shouldRestart, setShouldRestart] = useState(false);
  const { inventory } = useGameState();
  
  // Хук для принудительного сохранения состояния игры
  const forceSave = useForceSave();

  useEffect(() => {
    // Получаем лучший счет из localStorage
    try {
      const savedBestScore = localStorage.getItem('mergeGameBestScore');
      if (savedBestScore) {
        setBestScore(parseInt(savedBestScore));
      }
    } catch (e) {
      console.error('Ошибка при чтении лучшего счета:', e);
    }
  }, []);

  const handleBackClick = useCallback(() => {
    // Система сохранений отключена - выводим лог и продолжаем выполнение
    console.log('[MergeGame] Система сохранений отключена');
    // Возвращаемся в меню
    onBack();
  }, [onBack]);

  const handlePauseClick = useCallback(() => {
    pauseGame();
    setIsPaused(true);
  }, []);

  // Обработчик продолжения игры
  const handleContinueClick = useCallback(() => {
    resumeGame();
    setIsPaused(false);
  }, []);

  // Функция для перезапуска игры
  const handleRestartClick = useCallback(() => {
    console.log('[MergeGame] Система сохранений отключена');
    
    // Запускаем перезапуск игры
    setShouldRestart(true);
  }, []);
  
  // Обработчик завершения перезапуска
  const handleRestartComplete = useCallback(() => {
    // Сбрасываем флаг перезапуска
    setShouldRestart(false);
    
    // Обновляем состояния
    setIsGameOver(false);
    setScore(0);
    setIsPaused(false);
  }, []);

  const handleAbilityClick = useCallback((ability: string) => {
    // Получаем стоимость активации способности в зависимости от вместимости контейнера
    const containerCapacity = inventory.containerCapacity || 1;
    let cost = 0;
    
    switch (ability) {
      case 'Bull':
        // 30% от вместимости контейнера без минимального порога
        cost = containerCapacity * 0.3;
        break;
      case 'Bomb':
        // 10% от вместимости контейнера без минимального порога
        cost = containerCapacity * 0.1;
        break;
      case 'Earthquake':
        // 20% от вместимости контейнера без минимального порога
        cost = containerCapacity * 0.2;
        break;
    }
    
    // Проверяем достаточно ли snotCoins
    if (inventory.snotCoins >= cost) {
      // Активируем способность
      setSelectedAbility(ability);
      
      // Обновляем состояние игры, вычитая стоимость способности из snotCoins
      const updatedInventory = {
        ...inventory,
        snotCoins: inventory.snotCoins - cost
      };
      
      // Отправляем действие для обновления состояния
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game:update-inventory', { 
          detail: updatedInventory 
        }));
      }
      
      // Активируем способность в игре
      activateAbility(ability);
      
      // Затем сбрасываем выбранную способность
      setTimeout(() => setSelectedAbility(null), 500);
    } else {
      // Показываем уведомление о недостатке ресурсов
      toast.error(`Недостаточно SnotCoin для ${ability}! Нужно ${cost.toFixed(1)} SnotCoin`);
    }
  }, [inventory]);

  // Обработчик обновления счета
  const handleScoreUpdate = useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  // Обработчик завершения игры
  const handleGameOver = useCallback((finalGameScore: number) => {
    setIsGameOver(true);
    setFinalScore(finalGameScore);
    
    // Обновляем лучший счет, если текущий больше
    if (finalGameScore > bestScore) {
      setBestScore(finalGameScore);
      try {
        localStorage.setItem('mergeGameBestScore', finalGameScore.toString());
      } catch (e) {
        console.error('Ошибка при сохранении лучшего счета:', e);
      }
    }
  }, [bestScore]);

  // Мемоизируем игровой контейнер, чтобы предотвратить ненужные перерисовки
  const gameContainer = useMemo(() => (
    <GameContainer 
      onScoreUpdate={handleScoreUpdate} 
      onGameOver={handleGameOver}
      shouldRestart={shouldRestart}
      onRestartComplete={handleRestartComplete}
    />
  ), [handleScoreUpdate, handleGameOver, shouldRestart, handleRestartComplete]);
  
  // Мемоизируем компоненты UI
  const gameHeader = useMemo(() => (
    <GameHeader 
      inventory={inventory} 
      onPauseClick={handlePauseClick} 
    />
  ), [inventory, handlePauseClick]);
  
  const abilitiesBar = useMemo(() => (
    <AbilitiesBar 
      inventory={inventory} 
      selectedAbility={selectedAbility} 
      onAbilityClick={handleAbilityClick} 
    />
  ), [inventory, selectedAbility, handleAbilityClick]);

  // Используем стабильный backgroundStyle для предотвращения перерисовок
  const backgroundStyle = useMemo(() => ({
    backgroundImage: "url('/images/merge/background/merge-background.webp')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)"
  }), []);

  return (
    <div 
      className="w-full h-screen relative flex flex-col"
      style={backgroundStyle}
    >
      {/* Верхний бар */}
      {gameHeader}
      
      {/* Игровой контейнер */}
      {gameContainer}
      
      {/* Нижний бар с кнопками способностей */}
      {abilitiesBar}
      
      {/* Окно Game Over */}
      {isGameOver && (
        <GameOverDialog
          finalScore={finalScore}
          bestScore={bestScore}
          attemptsData={attemptsData}
          maxAttempts={maxAttempts}
          onRestartClick={handleRestartClick}
          onBackClick={handleBackClick}
        />
      )}

      {/* Мини-меню паузы */}
      <AnimatePresence>
        {isPaused && !isGameOver && (
          <PauseDialog
            attemptsData={attemptsData}
            maxAttempts={maxAttempts}
            onContinueClick={handleContinueClick}
            onRestartClick={handleRestartClick}
            onBackClick={handleBackClick}
          />
        )}
      </AnimatePresence>

      {/* Кнопка возврата - скрытая, но доступная для вызова в любой момент */}
      <button 
        onClick={handleBackClick}
        className="absolute bottom-4 right-4 opacity-0 w-1 h-1 overflow-hidden pointer-events-none"
      >
        Назад
      </button>
    </div>
  );
};

export default MergeGameLauncher;
