"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { formatSnotValue } from "../../../utils/formatters"
import { calculateFillingPercentage, calculateFillPercentage } from "../../../utils/resourceUtils"
import type { BackgroundImageProps } from "../../../types/laboratory-types"
import { ICONS } from "../../../constants/uiConstants"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"

// Компонент для отдельной частицы
const Particle: React.FC<{ 
  index: number, 
  totalParticles: number
}> = ({ index, totalParticles }) => {
  // Создаем разнообразные частицы с различной яркостью
  // Некоторые очень яркие, некоторые тусклые
  const brightness = Math.random();
  const particleSize = Math.random() * 6 + 2; // От 2 до 8 пикселей
  
  // Разные уровни яркости на основе случайного brightness
  const opacity = brightness < 0.3 ? 
    Math.random() * 0.2 + 0.1 : // Тусклые (10-30% непрозрачности)
    brightness > 0.8 ? 
      Math.random() * 0.3 + 0.7 : // Очень яркие (70-100% непрозрачности)
      Math.random() * 0.3 + 0.3;  // Средние (30-60% непрозрачности)
  
  // Большее разнообразие для начальных позиций - распределяем по всему экрану
  const startX = (Math.random() * 2 - 1) * 100; // От -100% до +100% ширины
  const startY = (Math.random() * 2 - 1) * 100; // От -100% до +100% высоты
  
  // Разная длительность анимации для каждой частицы
  const duration = 15 + Math.random() * 45; // От 15 до 60 секунд
  
  // Разное начальное положение в анимации
  const initialProgress = Math.random();
  
  // Генерируем случайные точки для движения по всему экрану
  const generateRandomPoints = () => {
    const numPoints = 6; // Больше точек для более хаотичного движения
    const points = [];
    
    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: (Math.random() * 2 - 1) * 120, // От -120% до +120% экрана по ширине
        y: (Math.random() * 2 - 1) * 120  // От -120% до +120% экрана по высоте
      });
    }
    
    return points;
  };
  
  const pathPoints = generateRandomPoints();
  
  // Преобразуем точки для анимации
  const xPoints = pathPoints.map(p => `${p.x}vw`);
  const yPoints = pathPoints.map(p => `${p.y}vh`);
  
  // Добавляем вариации свечения в зависимости от яркости
  const getGlow = () => {
    if (brightness > 0.8) {
      return `0 0 ${particleSize * 3}px ${particleSize * 1.5}px rgba(187, 235, 37, ${opacity * 0.9})`; // Яркое свечение
    } else if (brightness < 0.3) {
      return `0 0 ${particleSize}px ${particleSize * 0.5}px rgba(187, 235, 37, ${opacity * 0.5})`; // Слабое свечение
    } else {
      return `0 0 ${particleSize * 2}px ${particleSize}px rgba(187, 235, 37, ${opacity * 0.7})`; // Среднее свечение
    }
  };
  
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: `${particleSize}px`,
        height: `${particleSize}px`,
        backgroundColor: `rgba(187, 235, 37, ${opacity})`,
        opacity,
        boxShadow: getGlow(),
        left: `${startX}vw`,
        top: `${startY}vh`,
      }}
      animate={{
        x: xPoints,
        y: yPoints,
        scale: [1, 1.2, 0.8, 1.3, 0.9, 1.1, 1], // Больше вариации размера
        opacity: [
          opacity, 
          opacity * 1.3, 
          opacity * 0.6, 
          opacity * 1.5, 
          opacity * 0.7, 
          opacity * 1.2, 
          opacity
        ],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: "reverse" as const,
        ease: "easeInOut", // Плавное движение
        times: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1], // Равномерное распределение
        initialProgress, // Начинаем с разных точек анимации
      }}
    />
  );
};

// Компонент для группы частиц
const ParticleSystem: React.FC<{ count: number }> = ({ count }) => {
  // Создаем массив частиц
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => (
      <Particle 
        key={i} 
        index={i} 
        totalParticles={count}
      />
    ));
  }, [count]);
  
  return (
    <div className="fixed inset-0 w-full h-full z-20 pointer-events-none">
      {particles}
    </div>
  );
};

const BackgroundImage: React.FC<BackgroundImageProps> = React.memo(
  ({ store, onContainerClick, allowContainerClick, isContainerClicked, id, containerSnotValue, containerFilling }) => {
    // Получаем доступ к состоянию и диспетчеру на уровне компонента
    const gameState = useGameState();
    const dispatch = useGameDispatch();
    
    // Вычисляем процент заполнения на основе данных инвентаря
    const containerFillingMemo = useMemo(() => {
      // Если передан containerFilling, используем его непосредственно
      if (typeof containerFilling === 'number') {
        // Убеждаемся, что значение в пределах от 0 до 100
        return Math.min(100, Math.max(0, containerFilling));
      }
      
      // Иначе вычисляем из данных инвентаря напрямую
      if (!store?.inventory) return 0;
      
      const containerSnot = Math.max(0, store.inventory.containerSnot || 0);
      const containerCapacity = Math.max(1, store.inventory.containerCapacity || 1);
      
      // Процент заполнения = (текущее количество / ёмкость) * 100
      return Math.min(100, Math.max(0, (containerSnot / containerCapacity) * 100));
    }, [containerFilling, store?.inventory?.containerSnot, store?.inventory?.containerCapacity]);

    // При клике на контейнер (сборе ресурсов) принудительно устанавливаем заполнение в 0
    const adjustedFilling = isContainerClicked ? 0 : containerFillingMemo;

    const containerSnotValueMemo = useMemo(() => {
      // Используем переданное значение, если оно есть
      if (containerSnotValue) {
        return containerSnotValue;
      }
      
      const containerSnot = Math.max(0, store?.inventory?.containerSnot ?? 0);
      
      if (isNaN(containerSnot)) {
        return "0";
      }
      
      return formatSnotValue(containerSnot, 4);
    }, [store?.inventory?.containerSnot, containerSnotValue])

    const handleContainerClick = (e: React.MouseEvent) => {
      if (onContainerClick && allowContainerClick) {
        // Вызываем оригинальный обработчик клика с передачей события
        onContainerClick(e);
      }
    };

    // Варианты мигания для эффекта неисправного монитора
    const flickerVariants = {
      flicker: {
        opacity: [0.7, 0.3, 0.8, 0.5, 0.7],
        x: [0, -1, 1, -1, 0],
        textShadow: [
          "0 2px 4px rgba(0, 0, 0, 0.8), 0 0 10px rgba(16, 185, 129, 0.6), 0 0 15px rgba(0, 0, 0, 0.7)",
          "0 2px 4px rgba(0, 0, 0, 0.6), 0 0 8px rgba(16, 185, 129, 0.4), 0 0 15px rgba(0, 0, 0, 0.5)",
          "0 2px 4px rgba(0, 0, 0, 0.9), 0 0 12px rgba(16, 185, 129, 0.7), 0 0 15px rgba(0, 0, 0, 0.8)",
          "0 2px 4px rgba(0, 0, 0, 0.7), 0 0 9px rgba(16, 185, 129, 0.5), 0 0 15px rgba(0, 0, 0, 0.6)",
          "0 2px 4px rgba(0, 0, 0, 0.8), 0 0 10px rgba(16, 185, 129, 0.6), 0 0 15px rgba(0, 0, 0, 0.7)",
        ],
        transition: {
          duration: 2.5,
          repeat: Infinity,
          repeatType: "reverse" as const,
          ease: "easeInOut",
          times: [0, 0.2, 0.4, 0.7, 1]
        }
      }
    };

    // Точные координаты и размеры видимого окна контейнера
    const containerWindow = {
      left: "30.5%",
      top: "42%",
      width: "26%",
      height: "15%",
      borderRadius: "0.5rem"
    };

    return (
      <div className="fixed inset-0 w-full h-full overflow-hidden">
        <style jsx>{`
        :root {
          --container-fill: ${containerFilling}%;
        }
        .drop-shadow-glow-green {
          filter: drop-shadow(0 0 5px rgba(187, 235, 37, 0.7));
        }
        @keyframes glitch {
          0% {
            text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.5), -0.05em -0.025em 0 rgba(0, 255, 0, 0.5), -0.025em 0.05em 0 rgba(0, 0, 255, 0.5);
          }
          14% {
            text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.5), -0.05em -0.025em 0 rgba(0, 255, 0, 0.5), -0.025em 0.05em 0 rgba(0, 0, 255, 0.5);
          }
          15% {
            text-shadow: -0.05em -0.025em 0 rgba(255, 0, 0, 0.5), 0.025em 0.025em 0 rgba(0, 255, 0, 0.5), -0.05em -0.05em 0 rgba(0, 0, 255, 0.5);
          }
          49% {
            text-shadow: -0.05em -0.025em 0 rgba(255, 0, 0, 0.5), 0.025em 0.025em 0 rgba(0, 255, 0, 0.5), -0.05em -0.05em 0 rgba(0, 0, 255, 0.5);
          }
          50% {
            text-shadow: 0.025em 0.05em 0 rgba(255, 0, 0, 0.5), 0.05em 0 0 rgba(0, 255, 0, 0.5), 0 -0.05em 0 rgba(0, 0, 255, 0.5);
          }
          99% {
            text-shadow: 0.025em 0.05em 0 rgba(255, 0, 0, 0.5), 0.05em 0 0 rgba(0, 255, 0, 0.5), 0 -0.05em 0 rgba(0, 0, 255, 0.5);
          }
          100% {
            text-shadow: -0.025em 0 0 rgba(255, 0, 0, 0.5), -0.025em -0.025em 0 rgba(0, 255, 0, 0.5), -0.025em -0.05em 0 rgba(0, 0, 255, 0.5);
          }
        }
        /* Предотвращаем выделение всех элементов в игре */
        * {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }
        /* Предотвращаем действия перетаскивания по всему приложению */
        img {
          pointer-events: none;
        }
      `}</style>
        {/* Система частиц по всему экрану */}
        <ParticleSystem count={60} />
        
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src={ICONS.LABORATORY.BACKGROUND}
            alt="Background"
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
            priority
            draggable="false"
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="relative w-full h-full max-w-[100vw] max-h-[100vh]">
            
            {/* Заполняющийся контейнер - теперь будет отображен ЗА машиной, но перед фоном */}
            <div 
              className="absolute z-20 overflow-hidden"
              style={{
                left: "30.5%",
                top: "42%",
                width: "26%",
                height: "15%",
                borderRadius: "0.5rem",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                backdropFilter: "blur(2px)"
              }}
            >
              <div
                key={`container-fill-${adjustedFilling}`}
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#bbeb25] to-[#a3d119] transition-all duration-300 ease-in-out"
                style={{ 
                  height: `${adjustedFilling}%`,
                  boxShadow: "0 -5px 15px rgba(187, 235, 37, 0.4)",
                  transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              />
            </div>
            
            <motion.div
              id={id}
              className={`absolute inset-0 z-30 ${allowContainerClick ? "cursor-pointer" : ""}`}
              onClick={handleContainerClick}
              style={{
                pointerEvents: allowContainerClick ? "auto" : "none",
                touchAction: "manipulation",
              }}
              animate={isContainerClicked ? "clicked" : "idle"}
              whileTap="tapped"
              variants={{
                idle: { scale: 1 },
                clicked: { scale: 1.02, transition: { type: "spring", stiffness: 1000, damping: 15, duration: 0.06 } },
                tapped: { scale: 0.98, transition: { type: "spring", stiffness: 1500, damping: 20, duration: 0.03 } },
              }}
            >
              <Image
                src={ICONS.LABORATORY.MACHINE}
                alt="Storage Machine"
                fill
                sizes="100vw"
                style={{ objectFit: "contain" }}
                priority
                draggable="false"
                onContextMenu={(e) => e.preventDefault()}
              />
              
              {/* Числовой дисплей с абсолютным значением - теперь внутри контейнера */}
              <motion.div
                className="absolute bottom-[33%] left-[45%] transform -translate-x-1/2 z-50"
                animate="flicker"
                style={{
                  pointerEvents: "none", // Предотвращаем перехват событий
                }}
              >
                <motion.span
                  className="text-[#bbeb25] font-bold text-2xl tracking-wider opacity-80"
                  style={{
                    textShadow: `
                    0 2px 4px rgba(0, 0, 0, 0.8),
                    0 0 10px rgba(16, 185, 129, 0.6),
                    0 0 15px rgba(0, 0, 0, 0.7)
                  `,
                  }}
                  variants={flickerVariants}
                >
                  {containerSnotValueMemo}
                </motion.span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    )
  },
)

BackgroundImage.displayName = "BackgroundImage"

export default BackgroundImage

