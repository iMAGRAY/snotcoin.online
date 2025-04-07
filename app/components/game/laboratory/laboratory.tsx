"use client"

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"
import CollectButton from "./CollectButton"
import BackgroundImage from "./BackgroundImage"
import FlyingNumber from "./flying-number"
import ContainerFlyingNumber from "./ContainerFlyingNumber"
import UpgradeButton from "./UpgradeButton"
import { formatSnotValue } from "../../../utils/formatters"
import { ANIMATION_DURATIONS, LAYOUT } from "../../../constants/uiConstants"
import { getSafeInventory, calculateFillingPercentage } from "../../../utils/resourceUtils"
import { FILL_RATES } from "../../../constants/gameConstants"
import { useSaveManager } from "../../../contexts/SaveManagerProvider"
import { SavePriority } from "../../../services/saveSystem/types"
import { cleanupLocalStorage, getLocalStorageSize, cleanupUserBackups } from "../../../services/localStorageManager"
import { useForceSave } from "../../../hooks/useForceSave"

// Порог заполнения localStorage, при котором запускается очистка (в процентах)
const LOCAL_STORAGE_CLEANUP_THRESHOLD = 75;
// Максимальное количество локальных сохранений для пользователя
const MAX_LOCAL_SAVES = 3;

/**
 * Компонент лаборатории - основная игровая страница
 */
const Laboratory: React.FC = () => {
  const gameState = useGameState()
  const setState = useGameDispatch()
  const router = useRouter()
  const [isCollecting, setIsCollecting] = useState(false)
  const [flyingNumberValue, setFlyingNumberValue] = useState<number | null>(null)
  
  // Используем SaveManager
  const saveManager = useSaveManager();
  
  // Состояние для анимации числа при клике на контейнер
  const [containerClickNumbers, setContainerClickNumbers] = useState<Array<{
    id: number;
    value: number;
    x: number;
    y: number;
  }>>([])
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  // Ссылка на счетчик для уникальных ID анимаций
  const counterRef = useRef(0)
  
  // Ссылка на текущее состояние и функцию обновления для доступа в интервалах без перерендера
  const gameStateRef = useRef(gameState)
  const setStateRef = useRef(setState)
  
  // Предотвращаем контекстное меню для защиты изображений от сохранения
  const preventContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  }, []);
  
  // Обновляем ссылки при изменении
  useEffect(() => {
    gameStateRef.current = gameState
    setStateRef.current = setState
  }, [gameState, setState])

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
        setStateRef.current(prevState => ({
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
  
  // Функция для сохранения состояния игры локально
  const saveGameLocally = useCallback(() => {
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
      
      // Проверяем заполнение localStorage
      const { percent } = getLocalStorageSize();
      
      // Если заполнение выше порога, запускаем очистку
      if (percent > LOCAL_STORAGE_CLEANUP_THRESHOLD) {
        cleanupLocalStorage(LOCAL_STORAGE_CLEANUP_THRESHOLD, userId);
      }
      
      // Используем SaveManager для сохранения состояния
      saveManager.save(userId, gameState).then(result => {
        if (result.success) {
          // После успешного сохранения очищаем старые копии, оставляя только MAX_LOCAL_SAVES последних
          const removedCount = cleanupUserBackups(userId, MAX_LOCAL_SAVES);
        }
      });
    } catch (error) {
      // Обработка ошибок без логирования
    }
  }, [gameState, saveManager]);
  
  // Используем хук для принудительного сохранения
  const forceSave = useForceSave();
  
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
    
    // Сразу запускаем сохранение, но с небольшой задержкой для обновления состояния
    forceSave(100);
    
    // Очищаем предыдущий таймер если он есть
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    
    // Устанавливаем таймер для скрытия анимации
    timerRef.current = setTimeout(() => {
      setFlyingNumberValue(null)
      setIsCollecting(false)
      timerRef.current = null
    }, ANIMATION_DURATIONS.FLYING_NUMBER)
    
  }, [setState, inventory.containerSnot, isCollecting, forceSave, gameState])

  /**
   * Переход на страницу улучшений
   */
  const handleUpgradeClick = useCallback(() => {
    // Вместо диспатча напрямую обновляем состояние
    setState(prevState => ({
      ...prevState,
      _activeTab: "laboratory"
    }));
    // Сразу переходим на страницу улучшений
    router.push("/upgrade", { scroll: false });
  }, [router, setState]);

  // Предварительно загружаем страницу улучшений при монтировании компонента
  useEffect(() => {
    router.prefetch('/upgrade');
  }, [router]);

  return (
    <motion.div
      className="relative w-full h-full flex flex-col items-center justify-between"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onContextMenu={preventContextMenu}
    >
      <div className="w-full md:w-4/5 lg:w-3/4 xl:w-2/3 mx-auto flex-1 flex flex-col justify-center overflow-hidden" style={{ maxHeight: '70vh' }}>
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
      
      <div className="w-full px-4 py-4 flex flex-row items-center justify-center space-x-4 absolute bottom-24 left-0 right-0 z-10">
        <CollectButton 
          onCollect={handleCollect} 
          containerSnot={inventory.containerSnot} 
          isCollecting={isCollecting} 
        />
        <UpgradeButton onClick={handleUpgradeClick} />
      </div>
      
      {flyingNumberValue !== null && (
        <FlyingNumber value={flyingNumberValue} />
      )}
      
      {/* Отображаем все активные анимации чисел при клике на контейнер */}
      {containerClickNumbers.map(item => (
        <ContainerFlyingNumber 
          key={item.id}
          value={item.value}
          positionX={item.x}
          positionY={item.y}
        />
      ))}
      
      {/* Отладочная панель для проверки заполнения контейнера */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-xs p-2 font-mono max-h-[70px] overflow-y-auto z-5">
        <div>Контейнер: {(inventory?.containerSnot ?? 0).toFixed(6)} / {inventory?.containerCapacity ?? 1} = {((inventory?.containerSnot ?? 0) / (inventory?.containerCapacity ?? 1) * 100).toFixed(2)}%</div>
        <div>Скорость: {(FILL_RATES.BASE_CONTAINER_FILL_RATE * (inventory?.fillingSpeed ?? 1) * 3600 * 24).toFixed(5)} в сутки</div>
        <div>Заполнится через: {(((inventory?.containerCapacity ?? 1) - (inventory?.containerSnot ?? 0)) / (FILL_RATES.BASE_CONTAINER_FILL_RATE * (inventory?.fillingSpeed ?? 1)) / 60).toFixed(1)} мин</div>
      </div>
    </motion.div>
  )
}

export default React.memo(Laboratory)

