'use client'

import React, { useEffect, useRef } from 'react';
import * as planck from 'planck';
import { isBodyDestroyed } from '../utils/bodyUtils';
import { checkAndMergeBalls, hasBallsMarkedForMerge } from '../physics/checkAndMergeBalls';
import { checkAndHandleStuckBalls } from '../utils/stuckBallsUtils';
import { removeBall } from '../utils/ballUtils';
import { ExtendedBall } from '../types';
import { TIME_STEP, VELOCITY_ITERATIONS, POSITION_ITERATIONS, CHECK_MERGE_FREQUENCY, SCALE, STUCK_THRESHOLD_VELOCITY, STUCK_TIME_MS } from '../constants/gameConstants';

// Функция для получения цвета шара по его уровню
const getBallColor = (level: number): string => {
  const colors = {
    1: '#ff0000',  // Красный
    2: '#00ff00',  // Зеленый
    3: '#0000ff',  // Синий
    4: '#ffff00',  // Желтый
    5: '#ff00ff',  // Фуксия
    6: '#00ffff',  // Голубой
    7: '#ff8c00',  // Темно-оранжевый
    8: '#8a2be2',  // Сине-фиолетовый
    9: '#32cd32',  // Лайм
    10: '#fa8072',  // Лососевый
    11: '#ffd700',  // Золотой
    12: '#00fa9a',  // Весенне-зеленый
  };
  
  // Если уровень выходит за пределы диапазона, возвращаем случайный цвет
  if (level < 1 || level > 12) {
    const randomColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    return randomColor;
  }
  
  return colors[level as keyof typeof colors];
};

interface GamePhysicsProps {
  isPaused?: boolean;
  worldRef: React.MutableRefObject<planck.World | null>;
  ballsRef: React.MutableRefObject<ExtendedBall[]>;
  gameInstanceRef?: React.MutableRefObject<any>;
  potentiallyStuckBallsRef?: React.MutableRefObject<Map<ExtendedBall, number>>;
  playerBodyRef?: React.MutableRefObject<planck.Body | null>;
  leftWallRef?: React.MutableRefObject<planck.Body | null>;
  rightWallRef?: React.MutableRefObject<planck.Body | null>;
  topWallRef?: React.MutableRefObject<planck.Body | null>;
  floorRef?: React.MutableRefObject<planck.Body | null>;
  debugCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
  pixelsPerMeter: number;
}

const STUCK_CHECK_INTERVAL = 60; // Проверка зависших шаров каждую секунду при 60 FPS

const GamePhysics: React.FC<GamePhysicsProps> = ({
  isPaused,
  worldRef,
  ballsRef,
  gameInstanceRef,
  potentiallyStuckBallsRef,
  playerBodyRef,
  leftWallRef,
  rightWallRef,
  topWallRef,
  floorRef,
  debugCanvasRef,
  pixelsPerMeter
}) => {
  const frameCounterRef = useRef<number>(0);
  const stuckCheckCounterRef = useRef<number>(0);
  const prevPositionsRef = useRef<Map<string, { x: number, y: number, angle: number }>>(new Map());
  
  // Количество кадров между проверками слияния
  const CHECK_MERGE_FREQUENCY = 60; // ~1 секунда при 60 FPS
  
  // Константы для физического движка
  const TIME_STEP = 1/60;
  const VELOCITY_ITERATIONS = 8;
  const POSITION_ITERATIONS = 3;
  const STUCK_CHECK_INTERVAL = 60; // Проверка зависших шаров каждую секунду при 60 FPS
  
  // Константа для масштабирования физических координат в пиксели
  const SCALE = pixelsPerMeter; // Используем переданное значение
  
  // Эффект для обновления физики на каждом кадре
  useEffect(() => {
    let animationFrameId: number | null = null;
    
    // Игнорируем все для каждого фрейма в дебаг режиме
    if (debugCanvasRef && debugCanvasRef.current) {
      // Функция для рендеринга физического мира
      const renderPhysics = () => {
        const canvas = debugCanvasRef?.current;
        if (!canvas || !worldRef.current) return;
        
        // Очистка холста
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Устанавливаем масштаб и перевод координат
        ctx.save();
        ctx.scale(pixelsPerMeter, pixelsPerMeter); // Масштабирование для физического мира
        
        // Рисуем тела
        if (worldRef.current) {
          let body = worldRef.current.getBodyList();
          while (body) {
            const bodyPos = body.getPosition();
            
            // Рисуем контур тела
            let currentFixture = body.getFixtureList();
            while (currentFixture) {
              const shape = currentFixture.getShape();
              const type = shape.getType();
              
              // Определяем тип тела и выбираем цвет
              let color = '#ffffff'; // По умолчанию белый цвет
              
              // Проверяем, это основной игрок
              if (playerBodyRef?.current && body === playerBodyRef.current) {
                color = '#00ff00'; // Зеленый цвет для игрока
              } 
              // Проверяем, это стена
              else if (
                (leftWallRef?.current && body === leftWallRef.current) || 
                (rightWallRef?.current && body === rightWallRef.current) || 
                (topWallRef?.current && body === topWallRef.current)
              ) {
                color = '#0000ff'; // Синий цвет для стен
              }
              // Проверяем, это пол
              else if (floorRef?.current && body === floorRef.current) {
                color = '#ff0000'; // Красный цвет для пола
              }
              // Проверяем, это шар
              else {
                const userData = body.getUserData();
                if (userData && (userData as any).ballId !== undefined) {
                  // Это шар, определяем его цвет по уровню
                  const level = (userData as any).level || 1;
                  color = getBallColor(level);
                  
                  // Если шар потенциально застрял, делаем его более заметным
                  const stuckBalls = potentiallyStuckBallsRef?.current;
                  if (stuckBalls && stuckBalls.has(userData as ExtendedBall)) {
                    color = '#ff00ff'; // Яркий цвет для застрявших шаров
                  }
                }
              }
              
              ctx.fillStyle = color;
              ctx.strokeStyle = color;
              
              if (type === 'circle') {
                // Безопасный доступ к радиусу круга
                const radius = (shape as any).getRadius ? (shape as any).getRadius() : 1;
                
                // Рисуем круг
                ctx.beginPath();
                ctx.arc(bodyPos.x, bodyPos.y, radius, 0, Math.PI * 2);
                ctx.stroke();
              } else if (type === 'polygon' || type === 'edge') {
                // Безопасный доступ к вершинам полигона
                const vertices = (shape as any).getVertices ? (shape as any).getVertices() : [];
                if (vertices && vertices.length > 0) {
                  ctx.beginPath();
                  const firstVert = body.getWorldPoint(vertices[0]);
                  ctx.moveTo(firstVert.x, firstVert.y);
                  
                  for (let i = 1; i < vertices.length; i++) {
                    const vert = body.getWorldPoint(vertices[i]);
                    ctx.lineTo(vert.x, vert.y);
                  }
                  
                  ctx.closePath();
                  ctx.stroke();
                }
              }
              
              currentFixture = currentFixture.getNext();
            }
            
            body = body.getNext();
          }
        }
        
        ctx.restore();
        
        // Получаем состояние обработки игры
        const gameInstance = gameInstanceRef?.current;
        const isGameRunning = !isPaused || (gameInstance && gameInstance.scene?.scenes[0]?.scene?.isActive() === true);
        
        // Запускаем следующий кадр только если игра активна
        if (isGameRunning) {
          animationFrameId = requestAnimationFrame(renderPhysics);
        }
      };
      
      // Инициализация масштаба и запуск рендеринга
      renderPhysics();
    }
    
    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [worldRef, ballsRef, isPaused, playerBodyRef, leftWallRef, rightWallRef, topWallRef, floorRef, debugCanvasRef, gameInstanceRef, potentiallyStuckBallsRef, pixelsPerMeter]);

  // Функция для проверки и обработки зависших шаров
  const checkStuckBalls = () => {
    if (!worldRef.current || !gameInstanceRef?.current) return;
    
    // Фильтруем массив шаров, оставляя только валидные
    // Используем более эффективный способ с обходом массива с конца
    for (let i = ballsRef.current.length - 1; i >= 0; i--) {
      const ball = ballsRef.current[i];
      if (!ball || !ball.body || !ball.sprite || !ball.sprite.container || ball.sprite.container.destroyed) {
        // Удаляем некорректные элементы
        ballsRef.current.splice(i, 1);
        continue;
      }
      
      // Чистим физические ресурсы мертвых шаров, которые не были правильно удалены
      if (ball.body && !ball.body.isActive()) {
        if (worldRef.current) {
          ball.body.setUserData(null);
          try {
            worldRef.current.destroyBody(ball.body);
          } catch (e) {
            // Ошибка при удалении неактивного тела
          }
        }
        ballsRef.current.splice(i, 1);
        continue;
      }
    }
    
    // Проверяем зависшие шары с помощью утилиты
    const stuckBallsMap = potentiallyStuckBallsRef?.current;
    if (stuckBallsMap) {
      checkAndHandleStuckBalls(
        ballsRef.current,
        stuckBallsMap,
        STUCK_THRESHOLD_VELOCITY,
        STUCK_TIME_MS,
        removeBallHandler
      );
    }
  };
  
  // Функция для удаления одного шара
  const removeBallHandler = (ball: ExtendedBall) => {
    removeBall(ball, ballsRef, worldRef);
  };

  // Компонент не рендерит никакого UI
  return null;
};

export default GamePhysics; 