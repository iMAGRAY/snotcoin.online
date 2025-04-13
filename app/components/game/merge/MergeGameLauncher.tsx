"use client"

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useGameState } from "../../../contexts/game/hooks/useGameState";
import { useGameDispatch } from "../../../contexts/game/hooks/useGameDispatch";
import * as Phaser from 'phaser';
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from 'react-hot-toast';
import { useForceSave } from '../../../hooks/useForceSave';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import audioService from '../../../services/audioService';
import { MergeGameLauncherProps, MergeGameAttemptsData } from './types';
import MergeGameScene from './MergeGameScene';

// Компонент TouchButton вынесен за пределы основного компонента
type TouchButtonProps = {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
};

const TouchButton: React.FC<TouchButtonProps> = ({ 
  onClick, 
  className = "", 
  disabled = false, 
  title = "",
  children 
}) => {
  const [isPressed, setIsPressed] = useState(false);
  
  const handleTouchStart = () => {
    if (!disabled) {
      setIsPressed(true);
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    // Логика для определения, покинул ли палец область кнопки
    const touch = e.touches[0];
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    const isOutside = 
      touch.clientX < rect.left || 
      touch.clientX > rect.right || 
      touch.clientY < rect.top || 
      touch.clientY > rect.bottom;
    
    if (isOutside && !disabled) {
      setIsPressed(false);
    } else if (!isOutside && !isPressed && !disabled) {
      setIsPressed(true);
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPressed && !disabled) {
      // Предотвращаем клик после скролла, устанавливая порог перемещения
      onClick();
    }
    setIsPressed(false);
  };
  
  const handleTouchCancel = () => {
    setIsPressed(false);
  };
  
  const pressedClass = isPressed ? "transform scale-95 opacity-90" : "";
  
  return (
    <button
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      disabled={disabled}
      className={`${className} ${pressedClass}`}
      title={title}
    >
      {children}
    </button>
  );
};

const MergeGameLauncher: React.FC<MergeGameLauncherProps> = ({ 
  onBack, 
  attemptsData = { attemptsLeft: 0, lastAttemptTime: 0, nextRecoveryTime: 0 }, 
  maxAttempts = 3,
  remainingTime = ""
}) => {
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [score, setScore] = useState(0)
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null)
  const [isGameOver, setIsGameOver] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const { inventory } = useGameState()
  
  // Хук для принудительного сохранения состояния игры
  const forceSave = useForceSave()

  useEffect(() => {
    if (!gameContainerRef.current) return

    // Получаем лучший счет из localStorage
    try {
      const savedBestScore = localStorage.getItem('mergeGameBestScore');
      if (savedBestScore) {
        setBestScore(parseInt(savedBestScore));
      }
    } catch (e) {
      console.error('Ошибка при чтении лучшего счета:', e);
    }

    // Создаём игру Phaser
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight - 140, // Уменьшаем высоту для учета верхнего и нижнего бара
      backgroundColor: 'transparent', // Прозрачный фон вместо синего
      parent: gameContainerRef.current,
      physics: {
        default: 'arcade',
        arcade: {
          debug: false,
        },
      },
      scene: [MergeGameScene],
      transparent: true // Делаем канвас прозрачным
    }

    const game = new Phaser.Game(config)
    gameRef.current = game
    
    // Сохраняем время начала игры
    game.registry.set('gameStartTime', Date.now());

    const handleResize = () => {
      game.scale.resize(window.innerWidth, window.innerHeight - 140)
    }

    // Обработчик для получения обновлений счета из игры и проверки Game Over
    const gameUpdateListener = () => {
      const gameScore = game.registry.get('gameScore');
      if (typeof gameScore === 'number') {
        setScore(gameScore);
      }
      
      // Проверяем, завершилась ли игра
      const gameOver = game.registry.get('gameOver');
      if (gameOver) {
        const finalGameScore = game.registry.get('finalScore');
        setIsGameOver(true);
        if (typeof finalGameScore === 'number') {
          setFinalScore(finalGameScore);
        }
      }
    };
    
    // Добавляем слушатель изменений в реестре каждые 500 мс
    const gameUpdateInterval = setInterval(gameUpdateListener, 500);

    window.addEventListener('resize', handleResize)
    setIsLoaded(true)

    // Очистка при размонтировании
    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(gameUpdateInterval);
      
      if (game) {
        // Очищаем сцену перед уничтожением
        const scene = game.scene.getScene('MergeGameScene') as MergeGameScene
        if (scene) {
          scene.cleanup()
        }
        
        game.destroy(true)
        gameRef.current = null
      }
    }
  }, [])

  const handleBackClick = () => {
    // Система сохранений отключена - выводим лог и продолжаем выполнение
    console.log('[MergeGame] Система сохранений отключена');
    // Возвращаемся в меню
    onBack();
  }

  const handlePauseClick = () => {
    setIsPaused(!isPaused)
    if (gameRef.current) {
      const game = gameRef.current
      if (isPaused) {
        game.scene.resume('MergeGameScene')
      } else {
        game.scene.pause('MergeGameScene')
      }
    }
  }

  // Новый обработчик продолжения игры
  const handleContinueClick = () => {
    setIsPaused(false)
    if (gameRef.current) {
      gameRef.current.scene.resume('MergeGameScene')
    }
  }

  // Функция для перезапуска игры
  const handleRestartClick = () => {
    if (!gameRef.current) return;

    console.log('[MergeGame] Система сохранений отключена');
    
    // Останавливаем текущую игру
    gameRef.current.scene.stop('MergeGameScene');
    
    // Удаляем сцену перед добавлением новой
    gameRef.current.scene.remove('MergeGameScene');
    
    // Создаем новую сцену
    gameRef.current.scene.add('MergeGameScene', MergeGameScene, true);
    
    // Обновляем состояния
    setIsGameOver(false);
    setScore(0);
    setIsPaused(false);
    
    // Сохраняем время начала игры
    gameRef.current.registry.set('gameStartTime', Date.now());
  }

  const handleAbilityClick = (ability: string) => {
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
      
      // Получаем доступ к сцене игры
      if (gameRef.current) {
        const scene = gameRef.current.scene.getScene('MergeGameScene') as MergeGameScene;
        if (scene) {
          // Вызываем метод активации способности
          scene.activateAbility(ability);
          
          // Затем сбрасываем выбранную способность
          setTimeout(() => setSelectedAbility(null), 500);
        }
      }
    } else {
      // Показываем уведомление о недостатке ресурсов
      toast.error(`Недостаточно SnotCoin для ${ability}! Нужно ${cost.toFixed(1)} SnotCoin`);
    }
  }

  return (
    <div 
      className="w-full h-screen relative flex flex-col"
      style={{
        backgroundImage: "url('/images/merge/background/merge-background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backdropFilter: "blur(2px)", // Добавляем размытие фона
        WebkitBackdropFilter: "blur(2px)" // Для поддержки Safari
      }}
    >
      {/* Верхний бар */}
      <div 
        className="w-full h-[70px] relative flex items-center justify-between px-6"
        style={{
          backgroundImage: "url('/images/merge/Game/ui/Header.webp')",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 100%",
          backgroundPosition: "center"
        }}
      >
        {/* Левая часть с кнопкой паузы */}
        <div className="flex items-center z-10">
          <TouchButton
            onClick={handlePauseClick}
            className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98] mr-4"
          >
            <Image
              src="/images/merge/Game/ui/pause.webp"
              alt="Пауза"
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </TouchButton>
        </div>

        {/* Правая часть - ресурсы игрока */}
        <div className="flex items-center z-10">
          <div className="flex items-center mr-4">
            <Image
              src="/images/common/icons/snot-icon.webp"
              alt="Snot"
              width={30}
              height={30}
              className="w-7 h-7 mr-2"
            />
            <span className="text-white font-bold">{(inventory.snot || 0).toFixed(3)}</span>
          </div>
          
          <div className="flex items-center">
            <Image
              src="/images/common/icons/snotcoin-icon.webp"
              alt="SnotCoin"
              width={30}
              height={30}
              className="w-7 h-7 mr-2"
            />
            <span className="text-white font-bold">{(inventory.snotCoins || 0).toFixed(3)}</span>
          </div>
        </div>
      </div>
      
      {/* Игровой контейнер без обводки */}
      <div ref={gameContainerRef} className="flex-grow outline-none" />
      
      {/* Нижний бар с кнопками способностей (вернули обратно) */}
      <div 
        className="w-full h-[70px] relative flex items-center justify-center"
        style={{
          backgroundImage: "url('/images/merge/Game/ui/Footer.webp')",
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 100%",
          backgroundPosition: "center"
        }}
      >
        <div className="relative w-full px-6">
          {/* Кнопки способностей подняты выше за счет отрицательного margin-top */}
          <div className="flex justify-around items-center w-full -mt-6">
            {/* Кнопки способностей с улучшенным обработчиком тач-событий */}
            {(() => {
              const containerCapacity = inventory.containerCapacity || 1;
              const bullCost = containerCapacity * 0.3;
              const bombCost = containerCapacity * 0.1;
              const earthquakeCost = containerCapacity * 0.2;
              
              return (
                <>
                  {/* Кнопка способности Bull */}
                  <div className="relative flex flex-col items-center">
                    <div className="relative">
                      <TouchButton
                        onClick={() => handleAbilityClick('Bull')}
                        className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center
                          ${selectedAbility === 'Bull' 
                            ? `ring-4 ring-yellow-400 shadow-[0_0_18px_rgba(255,204,0,0.8)] scale-110` 
                            : inventory.snotCoins >= bullCost
                              ? `ring-2 ring-yellow-600 hover:ring-yellow-400 shadow-lg hover:shadow-[0_0_15px_rgba(255,204,0,0.5)] hover:scale-105`
                              : 'ring-2 ring-gray-700 opacity-60 cursor-not-allowed'} 
                          transition-all duration-200 active:scale-[0.98] bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-700`}
                        title={`Стоимость: ${bullCost.toFixed(1)} SnotCoin`}
                        disabled={inventory.snotCoins < bullCost}
                      >
                        <div className={`w-[92%] h-[92%] rounded-full overflow-hidden p-1 bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 flex items-center justify-center`}>
                          <Image
                            src="/images/merge/abilities/bull.webp"
                            alt="Bull"
                            width={42}
                            height={42}
                            className="w-full h-full object-cover rounded-full"
                            priority
                          />
                        </div>
                      </TouchButton>
                      {/* Индикатор стоимости Bull - независимый элемент */}
                      <div className="absolute -top-3 -left-3 bg-gradient-to-br from-yellow-500 to-amber-600 text-white text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center shadow-lg border-2 border-yellow-300 z-20">
                        {bullCost.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Кнопка способности Bomb */}
                  <div className="relative flex flex-col items-center">
                    <div className="relative">
                      <TouchButton
                        onClick={() => handleAbilityClick('Bomb')}
                        className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center
                          ${selectedAbility === 'Bomb' 
                            ? `ring-4 ring-red-400 shadow-[0_0_18px_rgba(255,0,0,0.8)] scale-110` 
                            : inventory.snotCoins >= bombCost
                              ? `ring-2 ring-red-700 hover:ring-red-400 shadow-lg hover:shadow-[0_0_15px_rgba(255,0,0,0.5)] hover:scale-105`
                              : 'ring-2 ring-gray-700 opacity-60 cursor-not-allowed'} 
                          transition-all duration-200 active:scale-[0.98] bg-gradient-to-br from-red-400 via-red-500 to-rose-700`}
                        title={`Стоимость: ${bombCost.toFixed(1)} SnotCoin`}
                        disabled={inventory.snotCoins < bombCost}
                      >
                        <div className={`w-[92%] h-[92%] rounded-full overflow-hidden p-1 bg-gradient-to-br from-red-300 via-red-500 to-rose-600 flex items-center justify-center`}>
                          <Image
                            src="/images/merge/abilities/bomb.webp"
                            alt="Bomb"
                            width={42}
                            height={42}
                            className="w-full h-full object-cover rounded-full"
                            priority
                          />
                        </div>
                      </TouchButton>
                      {/* Индикатор стоимости Bomb - независимый элемент */}
                      <div className="absolute -top-3 -left-3 bg-gradient-to-br from-red-500 to-rose-600 text-white text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center shadow-lg border-2 border-red-300 z-20">
                        {bombCost.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Кнопка способности Earthquake - новый фиолетовый цвет */}
                  <div className="relative flex flex-col items-center">
                    <div className="relative">
                      <TouchButton
                        onClick={() => handleAbilityClick('Earthquake')}
                        className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center
                          ${selectedAbility === 'Earthquake' 
                            ? `ring-4 ring-purple-400 shadow-[0_0_18px_rgba(147,51,234,0.8)] scale-110` 
                            : inventory.snotCoins >= earthquakeCost
                              ? `ring-2 ring-purple-700 hover:ring-purple-400 shadow-lg hover:shadow-[0_0_15px_rgba(147,51,234,0.5)] hover:scale-105`
                              : 'ring-2 ring-gray-700 opacity-60 cursor-not-allowed'} 
                          transition-all duration-200 active:scale-[0.98] bg-gradient-to-br from-purple-400 via-purple-500 to-violet-700`}
                        title={`Стоимость: ${earthquakeCost.toFixed(1)} SnotCoin`}
                        disabled={inventory.snotCoins < earthquakeCost}
                      >
                        <div className={`w-[92%] h-[92%] rounded-full overflow-hidden p-1 bg-gradient-to-br from-purple-300 via-purple-500 to-violet-600 flex items-center justify-center`}>
                          <Image
                            src="/images/merge/abilities/eatherquake.webp"
                            alt="Earthquake"
                            width={42}
                            height={42}
                            className="w-full h-full object-cover rounded-full"
                            priority
                          />
                        </div>
                      </TouchButton>
                      {/* Индикатор стоимости Earthquake - независимый элемент */}
                      <div className="absolute -top-3 -left-3 bg-gradient-to-br from-purple-500 to-violet-600 text-white text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center shadow-lg border-2 border-purple-300 z-20">
                        {earthquakeCost.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
      
      {/* Индикатор загрузки */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a2b3d] z-10">
          <div className="text-white text-2xl">Загрузка игры...</div>
        </div>
      )}
      
      {/* Окно Game Over */}
      {isGameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-20">
          <motion.div 
            className="w-80 bg-gradient-to-b from-[#2a3b4d] to-[#1a2b3d] p-8 rounded-2xl border-2 border-[#4a7a9e] shadow-2xl"
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <h2 className="text-red-500 text-4xl font-bold text-center mb-6">GAME OVER</h2>
            <div className="text-white text-center mb-6">
              <p className="text-xl mb-2">Итоговый счет</p>
              <p className="text-3xl font-bold">{finalScore}</p>
              {bestScore > 0 && (
                <p className="text-sm mt-2">Лучший счет: <span className="font-bold">{bestScore}</span></p>
              )}
              <div className="mt-4 p-3 bg-gradient-to-r from-[#1a1a2e] to-[#162447] rounded-2xl border border-red-500/20 shadow-lg">
                <div className="mb-2 flex items-center justify-center">
                  <p className="text-sm font-medium text-gray-300">Осталось попыток:</p>
                </div>
                <div className="flex justify-center gap-2">
                  {[...Array(maxAttempts)].map((_, index) => (
                    <div 
                      key={index} 
                      className={`w-8 h-8 rounded-full flex items-center justify-center 
                        ${index < attemptsData.attemptsLeft 
                          ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-[0_0_8px_rgba(250,204,21,0.7)]' 
                          : 'bg-gray-700 opacity-50'}`}
                    >
                      {index < attemptsData.attemptsLeft ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col space-y-3">
              {attemptsData.attemptsLeft > 0 && (
                <TouchButton 
                  onClick={handleRestartClick}
                  className="relative w-full px-6 py-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl font-bold 
                    text-white shadow-lg border-2 border-blue-300 focus:outline-none focus:ring-2 
                    focus:ring-blue-300 focus:ring-opacity-50 h-14 hover:scale-105 hover:shadow-lg"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-lg font-bold">Начать заново</span>
                  </div>
                </TouchButton>
              )}
              <TouchButton 
                onClick={onBack}
                className="relative w-full px-6 py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl font-bold 
                  text-black shadow-lg border-2 border-yellow-300 focus:outline-none focus:ring-2 
                  focus:ring-yellow-300 focus:ring-opacity-50 h-16 hover:scale-105 hover:shadow-lg"
              >
                <div className="flex items-center justify-center space-x-2">
                  <Image 
                    src="/images/laboratory/buttons/claim-button.webp" 
                    width={28} 
                    height={28} 
                    alt="Back" 
                    className="h-7 w-7 mr-1" 
                  />
                  <span className="text-lg font-bold">Выйти в меню</span>
                </div>
              </TouchButton>
            </div>
          </motion.div>
        </div>
      )}

      {/* Мини-меню паузы */}
      <AnimatePresence>
        {isPaused && !isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-20">
            <motion.div 
              className="w-80 bg-gradient-to-b from-[#2a3b4d] to-[#1a2b3d] p-8 rounded-2xl border-2 border-[#4a7a9e] shadow-2xl"
              initial={{ scale: 0.8, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 50, opacity: 0 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <h2 className="text-white text-3xl font-bold text-center mb-6">ПАУЗА</h2>
              
              <div className="bg-gradient-to-r from-[#1a1a2e] to-[#162447] p-4 rounded-2xl mb-4 border border-blue-500/20 shadow-lg">
                <div className="mb-2 flex items-center justify-center">
                  <p className="text-sm font-medium text-blue-300">Осталось попыток:</p>
                </div>
                <div className="flex justify-center gap-2">
                  {[...Array(maxAttempts)].map((_, index) => (
                    <div 
                      key={index} 
                      className={`w-7 h-7 rounded-full flex items-center justify-center 
                        ${index < attemptsData.attemptsLeft 
                          ? 'bg-gradient-to-r from-blue-400 to-blue-600 shadow-[0_0_8px_rgba(96,165,250,0.7)]' 
                          : 'bg-gray-700 opacity-50'}`}
                    >
                      {index < attemptsData.attemptsLeft ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col space-y-4">
                <motion.button 
                  onClick={handleContinueClick}
                  className="relative px-6 py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl font-bold 
                    text-white shadow-lg border-2 border-yellow-300 focus:outline-none focus:ring-2 
                    focus:ring-yellow-300 focus:ring-opacity-50 h-16"
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 0 12px rgba(250, 204, 21, 0.7)",
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Image 
                      src="/images/laboratory/buttons/claim-button.webp" 
                      width={28} 
                      height={28} 
                      alt="Продолжить" 
                      className="inline-block" 
                    />
                    <span className="text-lg">Продолжить</span>
                  </div>
                </motion.button>
                
                {attemptsData.attemptsLeft > 0 && (
                  <motion.button 
                    onClick={handleRestartClick}
                    className="relative px-6 py-4 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl font-bold 
                      text-white shadow-lg border-2 border-blue-300 focus:outline-none focus:ring-2 
                      focus:ring-blue-300 focus:ring-opacity-50 h-16"
                    whileHover={{ 
                      scale: 1.05,
                      boxShadow: "0 0 12px rgba(59, 130, 246, 0.7)",
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-lg">Начать заново</span>
                    </div>
                  </motion.button>
                )}
                
                <motion.button 
                  onClick={onBack}
                  className="relative px-6 py-4 bg-gradient-to-r from-red-500 to-red-700 rounded-2xl font-bold 
                    text-white shadow-lg border-2 border-red-400 focus:outline-none focus:ring-2 
                    focus:ring-red-300 focus:ring-opacity-50 h-16"
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 0 12px rgba(220, 38, 38, 0.7)",
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-lg">Выйти в меню</span>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          </div>
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
  )
}

export default MergeGameLauncher;
