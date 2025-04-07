"use client"

import React, { useMemo, useCallback, useState } from "react"
import Image from "next/image"
import { useTranslation } from "../../../i18n"
import type { CollectButtonProps } from "../../../types/laboratory-types"
import { formatSnotValue } from "../../../utils/formatters"
import { ICONS } from "../../../constants/uiConstants"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"
import { useForceSave } from "../../../hooks/useForceSave"

// Длительность анимации сбора ресурсов
const ANIMATION_DURATION = 800; // Уменьшаем с 1000 до 800 мс

/**
 * Компонент кнопки сбора ресурсов
 */
const CollectButton: React.FC<CollectButtonProps> = React.memo(({ 
  onCollect, 
  containerSnot, 
  isCollecting 
}) => {
  const { t } = useTranslation()
  const store = useGameState()
  const setState = useGameDispatch()
  const forceSave = useForceSave()
  const [collectAnimationActive, setCollectAnimationActive] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  const isDisabled = typeof containerSnot !== 'number' || isNaN(containerSnot) || containerSnot <= 0 || isCollecting || collectAnimationActive

  const containerSnotValue = useMemo(() => {
    if (typeof containerSnot !== 'number' || isNaN(containerSnot)) {
      return '0';
    }
    return formatSnotValue(Math.max(0, containerSnot));
  }, [containerSnot]);

  const handleCollect = useCallback(() => {
    if (isDisabled) return;
    
    // Проверяем, что store и inventory существуют
    if (!store || !store.inventory) return;
    
    // Сразу обновляем анимацию, чтобы заблокировать повторные нажатия
    setCollectAnimationActive(true);
    
    const currentSnot = store?.inventory?.snot ?? 0;
    const validAmount = Math.max(0, containerSnot);
    const expectedFinalSnot = currentSnot + validAmount;
    
    // Вместо диспатча напрямую обновляем состояние
    setState(prevState => {
      if (!prevState || !prevState.inventory) return prevState;
      
      return {
        ...prevState,
        inventory: {
          ...prevState.inventory,
          snot: expectedFinalSnot,
          containerSnot: 0 // Обнуляем контейнер при сборе
        },
        _lastAction: 'COLLECT_CONTAINER_SNOT'
      };
    });
    
    // Запускаем сохранение сразу после обновления состояния
    forceSave(100);
    
    // Вызываем внешний обработчик для анимации полета чисел, если он есть
    if (onCollect) {
      onCollect();
    }
    
    // Разблокируем кнопку после завершения анимации
    setTimeout(() => {
      setCollectAnimationActive(false);
    }, ANIMATION_DURATION);
    
  }, [isDisabled, containerSnot, store?.inventory?.snot, setState, onCollect, forceSave]);

  // Стили для эффекта при наведении
  const buttonStyles = {
    transform: isHovered && !isDisabled ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isHovered && !isDisabled ? "0 0 12px rgba(250, 204, 21, 0.7)" : "0 0 0px rgba(250, 204, 21, 0)",
    transition: 'all 0.2s ease-in-out'
  };

  return (
    <button
      className={`flex items-center justify-center px-6 py-3 rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold border-2 border-yellow-300 w-3/5 h-16 z-50 ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-400'
      }`}
      onClick={handleCollect}
      disabled={isDisabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={buttonStyles}
    >
      <Image 
        src={ICONS.LABORATORY.BUTTONS.CLAIM}
        alt="Collect"
        width={24}
        height={24}
        className="mr-2"
      />
      <span>{t('Collect')}</span>
    </button>
  );
});

CollectButton.displayName = 'CollectButton';

export default CollectButton;

