"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useGameState } from "../../../contexts/game/hooks/useGameState";
import { AnimatePresence } from "framer-motion";
import { toast } from 'react-hot-toast';
import { useForceSave } from '../../../hooks/useForceSave';
import { MergeGameLauncherProps } from './utils/types';
import Image from 'next/image';
import Resources from "../../common/Resources";

// Импорт компонентов
import AbilitiesBar from './components/ui/AbilitiesBar';
import GameContainer from './components/game/GameContainer';
import GameOverDialog from './components/ui/GameOverDialog';
import PauseDialog from './components/ui/PauseDialog';
import { activateAbility, pauseGame, resumeGame } from './components/game/gameActions';

const MergeGameLauncher: React.FC<MergeGameLauncherProps> = ({ 
  onBack, 
  attemptsData = { attemptsLeft: 0, lastAttemptTime: 0 }, 
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
      default:
        // Для любой другой неизвестной способности (защита от ошибок)
        cost = containerCapacity * 0.1;
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
      if (typeof activateAbility === 'function') {
        activateAbility(ability);
      }
      
      // Затем сбрасываем выбранную способность
      setTimeout(() => setSelectedAbility(null), 500);
    } else {
      // Недостаточно snotCoins для использования этой способности
      toast.error(`Not enough KingCoin for ${ability}! Need ${cost.toFixed(1)} KingCoin`);
    }
  }, [inventory, activateAbility, toast]);

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
  const abilitiesBar = useMemo(() => (
    <AbilitiesBar 
      inventory={inventory} 
      selectedAbility={selectedAbility} 
      onAbilityClick={handleAbilityClick} 
    />
  ), [inventory, selectedAbility, handleAbilityClick]);

  // Используем стабильный backgroundStyle для предотвращения перерисовок
  const backgroundStyle = useMemo(() => ({
    backgroundImage: "url('/images/merge/Game/BackGround.webp')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)"
  }), []);

  return (
    <div 
      className="w-full h-screen relative flex flex-col"
      data-game="true"
      style={{
        ...backgroundStyle,
        position: "relative",
        zIndex: 1005,
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh"
      }}
    >
      {/* Отдельная кнопка паузы */}
      <button
        onClick={handlePauseClick}
        className="fixed top-2 right-2 w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 bg-gray-700/90 backdrop-filter backdrop-blur-sm border border-white/30 z-[100]" 
      >
        <Image
          src="/images/merge/Game/ui/pause.webp"
          alt="Пауза"
          width={32}
          height={32}
          className="w-full h-full object-cover"
        />
      </button>
      
      {/* Ресурсы (такие же как на Merge странице) */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <Resources 
          isVisible={true}
          activeTab="merge"
          snot={inventory.snot || 0}
          kingCoins={inventory.snotCoins || 0}
          containerCapacity={inventory.containerCapacity}
          containerLevel={inventory.containerCapacityLevel}
          containerSnot={inventory.containerSnot}
          containerFillingSpeed={inventory.fillingSpeed}
          fillingSpeedLevel={inventory.fillingSpeedLevel}
        />
      </div>
      
      {/* Игровой контейнер */}
      <div className="flex-grow w-full flex justify-center items-end" data-game="true" style={{ margin: "0", padding: "0" }}>
        {gameContainer}
      </div>
      
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
        Back
      </button>
    </div>
  );
};

export default MergeGameLauncher;
