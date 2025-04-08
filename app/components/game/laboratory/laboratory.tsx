"use client"

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"
import CollectButton from "./CollectButton"
import BackgroundImage from "./BackgroundImage"
import FlyingNumber from "./flying-number"
import { formatSnotValue } from "../../../utils/formatters"
import { ANIMATION_DURATIONS, LAYOUT } from "../../../constants/uiConstants"
import { getSafeInventory, calculateFillingPercentage } from "../../../utils/resourceUtils"
import { FILL_RATES } from "../../../constants/gameConstants"
import { clearAllData } from '../../../services/storage'

// Порог заполнения localStorage, при котором запускается очистка (в процентах)
const LOCAL_STORAGE_CLEANUP_THRESHOLD = 75;
// Максимальное количество локальных сохранений для пользователя
const MAX_LOCAL_SAVES = 3;

// Константы для хранения
const STORAGE_PREFIX = 'snotcoin_';
const GAME_STATE_KEY = 'game_state_';

/**
 * Компонент лаборатории - основная игровая страница
 */
const Laboratory: React.FC = () => {
  const gameState = useGameState()
  const setState = useGameDispatch()
  const router = useRouter()
  const [isCollecting, setIsCollecting] = useState(false)
  const [flyingNumberValue, setFlyingNumberValue] = useState<number | null>(null)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Ссылка на текущее состояние и функцию обновления для доступа в интервалах без перерендера
  const gameStateRef = useRef(gameState)
  
  // Предотвращаем контекстное меню для защиты изображений от сохранения
  const preventContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  }, []);
  
  // Обновляем ссылки при изменении
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  // Безопасно получаем данные инвентаря
  const inventory = useMemo(() => 
    getSafeInventory(gameState), 
    [gameState]
  )
  
  // Вычисляем процент заполнения контейнера
  const containerFilling = useMemo(() => 
    calculateFillingPercentage(inventory), 
    [inventory]
  )
  
  // Очищаем таймер при размонтировании компонента
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])
  
  // Обновление lastUpdateTimestamp при загрузке компонента
  useEffect(() => {
    // Проверяем наличие lastUpdateTimestamp
    const { lastUpdateTimestamp } = inventory;
    
    // Если lastUpdateTimestamp отсутствует или не является числом, обновляем его
    if (!lastUpdateTimestamp || typeof lastUpdateTimestamp !== 'number') {
      // Обновляем lastUpdateTimestamp в состоянии напрямую
      setState(prevState => ({
        ...prevState,
        inventory: {
          ...prevState.inventory,
          lastUpdateTimestamp: Date.now()
        }
      }));
    }
  }, [inventory, setState]);
  
  // Обновление ресурсов по таймеру - без зависимостей, которые меняются при рендере
  useEffect(() => {
    // Вычисляем скорость заполнения для 1 snot за 24 часа при уровне скорости 1
    const updateResourcesAndFillContainer = () => {
      // Получаем текущие значения из gameStateRef, чтобы избежать цикла обновлений
      const currentState = gameStateRef.current;
      const currentInventory = getSafeInventory(currentState);
      
      const currentContainerSnot = currentInventory.containerSnot ?? 0;
      const containerCapacity = currentInventory.containerCapacity ?? 1;
      const fillingSpeed = currentInventory.fillingSpeed ?? 1;
      
      // Используем константу для базовой скорости заполнения
      const baseIncreasePerSecond = FILL_RATES.BASE_CONTAINER_FILL_RATE;
      
      // Учитываем текущий уровень скорости заполнения
      const actualIncreasePerSecond = baseIncreasePerSecond * fillingSpeed;
      
      // Одно обновление каждую секунду
      const increasePerInterval = actualIncreasePerSecond * (ANIMATION_DURATIONS.RESOURCE_UPDATE_INTERVAL / 1000);
      
      // Ограничиваем новое значение вместимостью контейнера
      const newContainerSnot = Math.min(
        containerCapacity,
        currentContainerSnot + increasePerInterval
      );
      
      // Обновляем состояние только при реальном изменении
      if (Math.abs(newContainerSnot - currentContainerSnot) > 0.00001) {
        setState(prevState => ({
          ...prevState,
          inventory: {
            ...prevState.inventory,
            containerSnot: newContainerSnot
          }
        }));
      }
    };
    
    // Убеждаемся, что константа задана
    const updateInterval = ANIMATION_DURATIONS.RESOURCE_UPDATE_INTERVAL || 1000;
    
    // Сохраняем ссылку на интервал в переменной
    const resourceUpdateInterval = setInterval(updateResourcesAndFillContainer, updateInterval);
    
    // Вызываем функцию сразу при монтировании, но через setTimeout с нулевой задержкой, 
    // чтобы избежать проблем с рендерингом
    const initialUpdateTimeout = setTimeout(updateResourcesAndFillContainer, 0);

    // Очищаем интервал и таймаут при размонтировании компонента
    return () => {
      clearInterval(resourceUpdateInterval);
      clearTimeout(initialUpdateTimeout);
    };
  }, []); // Пустой массив зависимостей, чтобы эффект выполнялся только один раз при монтировании

  // Состояние для хранения последнего нажатия на контейнер
  const lastContainerClickRef = useRef<number>(0);
  
  // Функция для локального отслеживания нажатий на контейнер
  const trackContainerClick = useCallback(() => {
    const userId = gameState._userId;
    if (!userId) return;
    
    try {
      // Проверяем время последнего сохранения, чтобы избежать слишком частых сохранений
      const now = Date.now();
      const timeSinceLastSave = now - lastContainerClickRef.current;
      
      // Если с последнего сохранения прошло менее 5 секунд, пропускаем сохранение
      const MIN_SAVE_INTERVAL = 5000; // 5 секунд
      if (timeSinceLastSave < MIN_SAVE_INTERVAL) {
        return;
      }
      
      // Обновляем время последнего сохранения
      lastContainerClickRef.current = now;
    } catch (error) {
      // Обработка ошибок без логирования
    }
  }, [gameState]);
  
  /**
   * Обработчик сбора ресурсов
   */
  const handleCollect = useCallback(() => {
    // Проверяем наличие необходимых данных
    if (!gameState || !gameState.inventory) return;
    
    // Проверяем возможность сбора
    if (inventory.containerSnot <= 0 || isCollecting || isNaN(inventory.containerSnot)) return
    
    // Получаем проверенное значение для сбора
    const amountToCollect = Math.max(0, inventory.containerSnot)
    
    // Немедленно устанавливаем состояние сбора для блокировки повторного нажатия
    setIsCollecting(true)
    
    // Показываем анимацию с текущим значением
    setFlyingNumberValue(amountToCollect)
    
    // Сохраняем исходное значение снота ДО операции сбора
    const initialSnot = gameState?.inventory?.snot ?? 0;
    const expectedFinalSnot = initialSnot + amountToCollect;

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
    
    // Сбрасываем состояние сбора через некоторое время
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    
    timerRef.current = setTimeout(() => {
      setIsCollecting(false)
      setFlyingNumberValue(null)
    }, 2000);
    
    // Отслеживаем нажатие на контейнер
    trackContainerClick();
  }, [
    gameState, 
    inventory.containerSnot, 
    isCollecting, 
    setState, 
    trackContainerClick
  ]);

  // Функция для сброса всех сохраненных данных
  const handleResetData = useCallback(() => {
    if (window.confirm('Вы уверены, что хотите сбросить все данные? Это необходимо для применения исправления скорости заполнения контейнера.')) {
      clearAllData();
      window.location.reload();
    }
  }, []);

  return (
    <div className="laboratory">
      <div className="background-container">
        <BackgroundImage 
          store={gameState}
          onContainerClick={() => {}}
          allowContainerClick={false}
          isContainerClicked={isCollecting}
          id="container-element"
          containerSnotValue={formatSnotValue(inventory.containerSnot, 4)}
          containerFilling={(inventory.containerSnot / Math.max(1, inventory.containerCapacity)) * 100}
        />
      </div>
      
      <div className="gameplay-container" onContextMenu={preventContextMenu}>
        <div className="resource-section">
          <div className="resource-display">
            <div className="resource-icon snot-icon" />
            <div className="resource-amount">
              {formatSnotValue(inventory.snot)}
            </div>
            
            {/* Анимация летящего числа при сборе */}
            {flyingNumberValue !== null && (
              <FlyingNumber 
                value={flyingNumberValue} 
              />
            )}
          </div>
        </div>
        
        {/* Кнопка сброса данных (только для локальной разработки) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 mx-auto w-full px-4">
            <button 
              onClick={handleResetData}
              className="w-full h-10 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md text-sm"
            >
              Сбросить данные (для тестирования)
            </button>
          </div>
        )}
        
        {/* Кнопка Collect размещена ниже, но выше tabbar */}
        <div className="collect-button-container">
          <CollectButton 
            onCollect={handleCollect}
            containerSnot={inventory.containerSnot}
            isCollecting={isCollecting}
          />
        </div>
      </div>
    </div>
  )
}

export default Laboratory

