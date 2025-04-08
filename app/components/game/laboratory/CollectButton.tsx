"use client"

import React, { useMemo, useCallback, useState, useContext } from "react"
import Image from "next/image"
import { useTranslation } from "../../../i18n"
import type { CollectButtonProps } from "../../../types/laboratory-types"
import { formatSnotValue } from "../../../utils/formatters"
import { ICONS } from "../../../constants/uiConstants"
import { useGameState } from "../../../contexts/game/hooks"
import { useContainer } from "../../../hooks/useContainer"
import { useResources } from "../../../contexts/ResourceContext"
import { GameContext } from "../../../contexts/game/GameContext"

// Длительность анимации сбора ресурсов
const ANIMATION_DURATION = 800; // Уменьшаем с 1000 до 800 мс

/**
 * Компонент кнопки сбора ресурсов
 */
const CollectButton: React.FC<CollectButtonProps> = React.memo(({ 
  onCollect, 
  containerSnot: propContainerSnot,
  isCollecting: propIsCollecting
}) => {
  const { t } = useTranslation()
  const store = useGameState()
  const gameContext = useContext(GameContext);
  const { 
    collect, 
    containerSnot: contextContainerSnot, 
    isCollecting: contextIsCollecting,
    lastCollectError
  } = useContainer()
  
  // Получаем ресурсы, обрабатывая возможные ошибки
  let resources = null;
  try {
    resources = useResources();
  } catch (e) {
    console.warn('[CollectButton] Не удалось получить ResourceContext:', e);
  }
  
  const containerSnot = propContainerSnot !== undefined ? propContainerSnot : contextContainerSnot;
  const storeSnot = store?.inventory?.snot || 0;
  
  const [collectAnimationActive, setCollectAnimationActive] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [collectError, setCollectError] = useState<string | null>(null)
  
  const isCollecting = propIsCollecting || contextIsCollecting;
  const isDisabled = typeof containerSnot !== 'number' || 
                     isNaN(containerSnot) || 
                     containerSnot <= 0 || 
                     isCollecting || 
                     collectAnimationActive;

  const containerSnotValue = useMemo(() => {
    if (typeof containerSnot !== 'number' || isNaN(containerSnot)) {
      return '0';
    }
    return formatSnotValue(Math.max(0, containerSnot));
  }, [containerSnot]);

  const handleCollect = useCallback(async () => {
    if (isDisabled) return;
    
    setCollectAnimationActive(true);
    
    try {
      // Логируем информацию о состоянии
      console.log("[CollectButton] Сбор ресурсов:", {
        containerSnot,
        isCollecting,
        isDisabled
      });
      
      // Передаем containerSnot в функцию collect
      let success = await collect(containerSnot);
      
      // Если не удалось собрать через основной метод, используем fallback
      if (!success && store && store.inventory && containerSnot > 0) {
        console.log("[CollectButton] Основной метод сбора не сработал, пробуем fallback");
        
        try {
          const oldSnot = store.inventory.snot || 0;
          const newSnot = oldSnot + containerSnot;
          
          // Используем dispatch из контекста игры
          if (gameContext && gameContext.dispatch) {
            gameContext.dispatch({
              type: 'UPDATE_INVENTORY',
              payload: {
                snot: newSnot,
                containerSnot: 0
              }
            });
            
            // Считаем операцию успешной
            success = true;
            setCollectError(null);
          } else {
            console.warn("[CollectButton] GameContext недоступен для fallback");
            throw new Error("GameContext dispatch недоступен");
          }
        } catch (fallbackError) {
          console.error("[CollectButton] Ошибка в fallback сборе:", fallbackError);
          setCollectError(`Ошибка при сборе: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }
      
      if (success) {
        console.log("[CollectButton] Сбор успешно выполнен");
        setCollectError(null);
      } else {
        console.warn("[CollectButton] Ошибка при сборе ресурсов", {
          error: lastCollectError || "Неизвестная ошибка"
        });
        setCollectError(lastCollectError || "Ошибка при сборе ресурсов");
      }
    } catch (error) {
      console.error("[CollectButton] Критическая ошибка при сборе:", error);
      setCollectError(error instanceof Error ? error.message : String(error));
    } finally {
      if (onCollect) {
        try {
          onCollect();
        } catch (e) {
          console.warn("[CollectButton] Ошибка в onCollect:", e);
        }
      }
      
      setTimeout(() => {
        setCollectAnimationActive(false);
      }, ANIMATION_DURATION);
    }
    
  }, [isDisabled, containerSnot, store, collect, lastCollectError, onCollect, gameContext, isCollecting]);

  const buttonStyles = {
    transform: isHovered && !isDisabled ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isHovered && !isDisabled ? "0 0 12px rgba(250, 204, 21, 0.7)" : "0 0 0px rgba(250, 204, 21, 0)",
    transition: 'all 0.2s ease-in-out'
  };

  return (
    <div className="w-full px-4 mt-4 flex flex-col items-center">
      {collectError && (
        <div className="bg-red-100 text-red-700 p-2 rounded mb-2 text-xs text-center">
          Ошибка: {collectError}
        </div>
      )}
      <button
        disabled={isDisabled}
        onClick={handleCollect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`w-full h-14 rounded-xl font-semibold text-black text-lg flex items-center justify-center gap-2 
          ${isDisabled 
            ? 'bg-gray-400 opacity-50 cursor-not-allowed' 
            : 'bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 cursor-pointer'
          }`}
        style={buttonStyles}
      >
        <Image
          src={ICONS.LABORATORY.BUTTONS.CLAIM}
          width={24}
          height={24}
          alt="Collect icon"
          className="mr-1"
        />
        Collect
      </button>
    </div>
  );
});

CollectButton.displayName = 'CollectButton';

export default CollectButton;

