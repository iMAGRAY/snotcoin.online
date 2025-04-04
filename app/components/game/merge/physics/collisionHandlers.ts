'use client'

import * as planck from 'planck';
import { isBodyDestroyed } from '../utils/bodyUtils';
import { ExtendedBall, PhysicsUserData } from '../types';

// Набор для отслеживания обработанных контактов
const processedSpecialContacts = new Set<string>();

/**
 * Настраивает специальные коллизии для шаров Bull и Bomb
 */
export const setupSpecialBallsCollisions = (
  scene: any,
  worldRef: React.MutableRefObject<planck.World | null>,
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  floorRef?: React.MutableRefObject<planck.Body | null>
) => {
  if (!worldRef.current) return;
  
  // Регистрируем обработчик пре-контакта для шаров Bull (Ghost Ball)
  worldRef.current.on('pre-solve', (contact) => {
    try {
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();
      
      if (!fixtureA || !fixtureB) return;
      
      const bodyA = fixtureA.getBody();
      const bodyB = fixtureB.getBody();
      
      if (!bodyA || !bodyB) return;
      
      const userDataA = bodyA.getUserData() as PhysicsUserData;
      const userDataB = bodyB.getUserData() as PhysicsUserData;
      
      // Проверяем, является ли один из шаров Bull
      const isBullA = userDataA && userDataA.type === 'ball' && userDataA.specialType === 'Bull';
      const isBullB = userDataB && userDataB.type === 'ball' && userDataB.specialType === 'Bull';
      
      // Если ни один из объектов не Bull, выходим
      if (!isBullA && !isBullB) return;
      
      // Определяем объект Bull и второй объект
      const bullBody = isBullA ? bodyA : bodyB;
      const otherBody = isBullA ? bodyB : bodyA;
      const bullData = isBullA ? userDataA : userDataB;
      
      // Проверяем, является ли другой объект полом
      const isFloor = floorRef && otherBody === floorRef.current;
      
      // Если Bull столкнулся с полом, мгновенно удаляем его
      if (isFloor) {
        // Создаем уникальный идентификатор для контакта с полом с метками времени
        const floorContactId = `bull-floor-${bullData.createdAt || 0}-${Date.now()}`;
        
        // Если этот контакт уже обработан, пропускаем
        if (processedSpecialContacts.has(floorContactId)) {
          return;
        }
        
        // Добавляем контакт в обработанные
        processedSpecialContacts.add(floorContactId);
        
        // Находим Bull в массиве шаров, используем только совпадение по телу
        const bullIndex = ballsRef.current.findIndex(ball => 
          ball && ball.body && ball.body === bullBody
        );
        
        if (bullIndex >= 0) {
          // Создаем копию массива для безопасности
          const ballsCopy = [...ballsRef.current];
          const bullBall = ballsCopy[bullIndex];
          
          // Проверяем, что bullBall определен
          if (!bullBall) {
            return;
          }
          
          // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: Сначала удаляем шар из массива
          ballsRef.current.splice(bullIndex, 1);
          
          try {
            // Затем удаляем физическое тело из мира
            if (worldRef.current && bullBall.body) {
              try {
                // Обновляем мир перед удалением тела для гарантии актуального состояния
                worldRef.current.step(0.01, 1, 1);
                
                // Проверяем текущее состояние тела перед удалением
                const isActive = bullBall.body.isActive();
                const hasFixtures = !!bullBall.body.getFixtureList();
                const isInWorld = bullBall.body.getWorld() === worldRef.current;
                
                // Проверяем, есть ли мир и не разрушено ли уже тело
                if (isActive && hasFixtures && isInWorld) {
                  // Безусловно удаляем тело
                  worldRef.current.destroyBody(bullBall.body);
                } else {
                  // Тело Bull уже недействительно
                }
                
                // Очищаем ссылку на тело в любом случае
                bullBall.body = null as any;
              } catch (e) {
                // Ошибка при удалении тела Bull
              }
            } else {
              // Невозможно удалить тело Bull
            }
            
            // После всех физических операций удаляем визуальное представление
            if (bullBall.sprite && bullBall.sprite.container && !bullBall.sprite.container.destroyed) {
              // Мгновенно удаляем контейнер без анимации для надежности
              try {
                bullBall.sprite.container.destroy();
              } catch (err) {
                // Ошибка при уничтожении контейнера Bull
              }
            } else {
              // Контейнер Bull уже уничтожен или отсутствует
            }
          } catch (err) {
            // Критическая ошибка при удалении Bull
          }
          
          // Через 1 секунду удаляем контакт из обработанных
          setTimeout(() => {
            processedSpecialContacts.delete(floorContactId);
          }, 1000);
        } else {
          // Дополнительная проверка - ищем шар Bull по типу
          const bullByType = ballsRef.current.find(ball => 
            ball && ball.specialType === 'Bull'
          );
          
          if (bullByType) {
            // Находим индекс по типу
            const bullTypeIndex = ballsRef.current.indexOf(bullByType);
            if (bullTypeIndex >= 0) {
              // Удаляем шар из массива
              ballsRef.current.splice(bullTypeIndex, 1);
              
              // Удаляем физическое тело, если оно есть
              if (worldRef.current && bullByType.body) {
                try {
                  worldRef.current.destroyBody(bullByType.body);
                } catch (e) {
                  // Ошибка при удалении тела Bull по типу
                }
              }
              
              // Удаляем визуальное представление
              if (bullByType.sprite?.container && !bullByType.sprite.container.destroyed) {
                bullByType.sprite.container.destroy();
              }
            }
          } else {
            // Bull шар не найден ни по индексу, ни по типу
          }
        }
        
        return;
      }
      
      // Проверяем, является ли второй объект обычным шаром
      const isNormalBallA = userDataA && userDataA.type === 'ball' && !userDataA.specialType;
      const isNormalBallB = userDataB && userDataB.type === 'ball' && !userDataB.specialType;
      
      // Если один шар Bull, а другой обычный, отключаем физическую коллизию
      if ((isBullA && isNormalBallB) || (isBullB && isNormalBallA)) {
        // Отключаем контакт для имитации прохождения сквозь шар
        contact.setEnabled(false);
        
        // Определяем нормальный шар
        const normalBall = isBullA ? bodyB : bodyA;
        const normalBallData = isBullA ? userDataB : userDataA;
        
        if (!normalBallData) return;
        
        // Создаем уникальный ID для контакта
        const contactId = `bull-normal-${bullData.createdAt || Date.now()}-${normalBallData.createdAt || Date.now()}`;
        
        // Если контакт уже обработан, пропускаем
        if (processedSpecialContacts.has(contactId)) {
          return;
        }
        
        // Добавляем контакт в обработанные
        processedSpecialContacts.add(contactId);
        
        // Создаем уникальный идентификатор для тела
        const bodyUniqueID = normalBallData.createdAt || Date.now();
        
        // Находим индекс нормального шара в массиве
        const normalBallIndex = ballsRef.current.findIndex(ball => 
          ball && ball.body && ball.body === normalBall
        );
        
        if (normalBallIndex >= 0) {
          // Находим шар, который нужно удалить
          const ballsCopy = [...ballsRef.current];
          const ballToRemove = ballsCopy[normalBallIndex];
          
          // Проверяем, что шар существует
          if (!ballToRemove) {
            return;
          }
          
          // Сохраняем информацию о теле для лога
          const bodyInfo = {
            level: ballToRemove.level,
            uniqueID: bodyUniqueID,
            hasBody: !!ballToRemove.body
          };
          
          // ВАЖНО: Сначала удаляем шар из массива
          ballsRef.current.splice(normalBallIndex, 1);
          
          // Удаляем физическое тело из мира
          try {
            if (worldRef.current && ballToRemove.body) {
              try {
                // Проверяем состояние тела перед удалением
                if (!isBodyDestroyed(ballToRemove.body)) {
                  worldRef.current.destroyBody(ballToRemove.body);
                }
                // Считаем количество тел в мире для отладки
                const bodyCount = worldRef.current.getBodyCount();
                
                // Очищаем ссылку на тело
                ballToRemove.body = null as any;
              } catch (e) {
                // Ошибка при удалении тела шара
              }
            }
            
            // Удаляем визуальное представление
            if (ballToRemove.sprite && ballToRemove.sprite.container) {
              // Мгновенно удаляем без анимации для надежности
              try {
                if (!ballToRemove.sprite.container.destroyed) {
                  ballToRemove.sprite.container.destroy();
                }
              } catch (err) {
                // Ошибка при уничтожении контейнера
              }
            } else {
              // Контейнер шара отсутствует или уже уничтожен
            }
          } catch (err) {
            // Критическая ошибка при обработке столкновения с Bull
          }
        } else {
          // Не удалось найти шар в массиве по телу
        }
        
        // Через 300мс удаляем контакт из обработанных
      setTimeout(() => {
          processedSpecialContacts.delete(contactId);
      }, 300);
      }
    } catch (error) {
      // Ошибка в pre-solve коллизии для Bull
    }
  });
  
  // Регистрируем обработчик начала контакта для шаров Bomb
  worldRef.current.on('begin-contact', (contact) => {
    try {
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();
      
      if (!fixtureA || !fixtureB) return;
      
      const bodyA = fixtureA.getBody();
      const bodyB = fixtureB.getBody();
      
      if (!bodyA || !bodyB) return;
      
      const userDataA = bodyA.getUserData() as PhysicsUserData | null;
      const userDataB = bodyB.getUserData() as PhysicsUserData | null;
      
      // Проверяем, является ли один из шаров бомбой
      const isBombA = userDataA && userDataA.type === 'ball' && userDataA.specialType === 'Bomb';
      const isBombB = userDataB && userDataB.type === 'ball' && userDataB.specialType === 'Bomb';
      
      // Если нет бомбы, выходим
      if (!isBombA && !isBombB) return;
      
      // Определяем бомбу и другой объект
      const bombBody = isBombA ? bodyA : bodyB;
      const otherBody = isBombA ? bodyB : bodyA;
      const bombData = isBombA ? userDataA : userDataB;
      const otherData = isBombA ? userDataB : userDataA;
      
      // Проверяем, является ли второй объект обычным шаром
      const otherIsBall = otherData && otherData.type === 'ball';
      
      // Проверяем, является ли второй объект полом
      const isFloorA = userDataA && userDataA.type === 'floor';
      const isFloorB = userDataB && userDataB.type === 'floor';
      const otherIsFloor = isFloorA || isFloorB;
      
      // Если две бомбы сталкиваются, пропускаем (предотвращаем цепные реакции)
      if (isBombA && isBombB) {
        return;
      }
      
      // Пропускаем, если второй объект не шар и не пол
      if (!otherIsBall && !otherIsFloor) {
        return;
      }
      
      // Проверяем, не взорвалась ли уже бомба
      if (bombData && bombData.exploded) {
        return;
      }
      
      // Помечаем бомбу как взорвавшуюся для предотвращения повторных взрывов
      if (bombData) {
        bombData.exploded = true;
      }
      
      // Поиск бомбы в массиве шаров
      const bombIndex = ballsRef.current.findIndex(ball => 
        ball && ball.body && ball.body === bombBody
      );
      
      // Если нашли бомбу, создаем взрыв
      if (bombIndex >= 0) {
        const bombBall = ballsRef.current[bombIndex];
        
        if (bombBall && bombBall.sprite && bombBall.sprite.container && !bombBall.sprite.container.destroyed) {
          // Получаем координаты бомбы для эффекта взрыва
          const bombX = bombBall.sprite.container.x;
          const bombY = bombBall.sprite.container.y;
          
          // Создаем эффект взрыва
          // Проверяем существование текстуры для частиц
          if (!scene.textures.exists('particle')) {
            // Создаем временную текстуру, если отсутствует
            const graphics = scene.add.graphics();
            graphics.fillStyle(0xffffff);
            graphics.fillCircle(8, 8, 8);
            graphics.generateTexture('particle', 16, 16);
            graphics.destroy();
          }
          
          // Создаем взрыв и удаляем шары в зоне взрыва
          createExplosionAndRemoveBalls(scene, bombX, bombY, bombIndex);
        } else {
          // Не удалось найти спрайт бомбы или он уже уничтожен
        }
      } else {
        // Бомба не найдена в массиве шаров
      }
    } catch (error) {
      // Ошибка в begin-contact коллизии для Bomb
    }
  });
  
  // Также добавим pre-solve обработчик для бомб
  worldRef.current.on('pre-solve', (contact) => {
    try {
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();
      
      if (!fixtureA || !fixtureB) return;
      
      const bodyA = fixtureA.getBody();
      const bodyB = fixtureB.getBody();
      
      if (!bodyA || !bodyB) return;
      
      const userDataA = bodyA.getUserData() as PhysicsUserData | null;
      const userDataB = bodyB.getUserData() as PhysicsUserData | null;
      
      // Если нет данных пользователя, выходим
      if (!userDataA || !userDataB) return;
      
      // Проверяем, является ли один из шаров бомбой
      const isBombA = userDataA.type === 'ball' && userDataA.specialType === 'Bomb';
      const isBombB = userDataB.type === 'ball' && userDataB.specialType === 'Bomb';
      
      // Если нет бомбы, выходим
      if (!isBombA && !isBombB) return;
      
      // Определяем бомбу и другой объект
      const bombBody = isBombA ? bodyA : bodyB;
      
      // Создаем уникальный ID для контакта
      const contactId = `bomb-contact-${userDataA.createdAt || Date.now()}-${userDataB.createdAt || Date.now()}`;
      
      // Если контакт уже обработан, пропускаем
      if (processedSpecialContacts.has(contactId)) {
        return;
      }
      
      // Добавляем контакт в обработанные
      processedSpecialContacts.add(contactId);
      
      // Находим индекс бомбы в массиве
      const bombIndex = ballsRef.current.findIndex(ball => 
        ball && ball.body && ball.body === bombBody
      );
      
      if (bombIndex >= 0) {
        const bombBall = ballsRef.current[bombIndex];
        
        // Если нашли бомбу в массиве и она имеет спрайт
        if (bombBall && bombBall.sprite && bombBall.sprite.container && !bombBall.sprite.container.destroyed) {
          const x = bombBall.sprite.container.x;
          const y = bombBall.sprite.container.y;
          
          // Создаем эффект взрыва
          try {
            createExplosionAndRemoveBalls(scene, x, y, bombIndex);
          } catch (err) {
            // Ошибка при создании взрыва
          }
        } else {
          // Не удалось найти спрайт бомбы
        }
      } else {
        // Не удалось найти бомбу в массиве шаров
      }
      
      // Через 300мс удаляем контакт из обработанных
      setTimeout(() => {
        processedSpecialContacts.delete(contactId);
      }, 300);
    } catch (error) {
      // Ошибка в handleSpecialBallCollision
    }
  });
  
  // Функция для проверки определенности значения
  const isDefined = <T>(value: T | undefined): value is T => value !== undefined;
  
  // Функция для обработки столкновений особых шаров
  const handleSpecialBallCollision = (
    bodyA: planck.Body,
    bodyB: planck.Body,
    contact: planck.Contact,
    scene: any
  ) => {
    // ... содержимое функции ...
  };
  
  // Функция для создания взрыва и удаления шаров в радиусе взрыва
  const createExplosionAndRemoveBalls = (
    scene: any, 
    x: number, 
    y: number, 
    bombIndex: number
  ) => {
    if (!scene) {
      return;
    }
    
    if (bombIndex < 0 || bombIndex >= ballsRef.current.length) {
      return;
    }
    
    try {
      // Копия массива шаров для безопасного изменения
      const ballsCopy = [...ballsRef.current];
      
      // Находим бомбу по индексу
      const bombBall = ballsCopy[bombIndex];
      
      if (!bombBall) {
        return;
      }
      
      // Удаляем бомбу из массива
      ballsRef.current.splice(bombIndex, 1);
      
      // Удаляем физическое тело бомбы
      try {
        if (worldRef.current && bombBall.body && !isBodyDestroyed(bombBall.body)) {
          // Удаляем тело бомбы из физического мира
          worldRef.current.destroyBody(bombBall.body);
        }
      } catch (e) {
        // Ошибка при удалении тела бомбы
      }
      
      // Выполняем логику завершения взрыва
      const completeExplosion = () => {
        // Не создаем эмиттер частиц, а просто рисуем несколько кругов
        const explosionContainer = scene.add.container(x, y);
        
        // Радиус взрыва в пикселях
        const explosionRadius = 150; // можно настроить радиус
        
        // Создаем несколько кругов, имитирующих взрыв
        const explosionBase = scene.add.circle(0, 0, explosionRadius, 0xff7700, 0.5);
        const explosionGlow = scene.add.circle(0, 0, explosionRadius * 0.7, 0xffaa00, 0.6);
        const explosionCore = scene.add.circle(0, 0, explosionRadius * 0.4, 0xffffff, 0.8);
        
        // Добавляем круги в контейнер
        explosionContainer.add([explosionBase, explosionGlow, explosionCore]);
        
        // Устанавливаем высокий z-index для взрыва
        explosionContainer.setDepth(1000);
        
        // Добавляем анимацию масштабирования и исчезновения
        scene.tweens.add({
          targets: [explosionBase, explosionGlow, explosionCore],
          scale: { from: 0.2, to: 1.5 },
          alpha: { from: 1, to: 0 },
          duration: 600,
          ease: 'Power2',
          onComplete: () => {
            explosionContainer.destroy();
          }
        });
        
        // Ищем шары, которые находятся в радиусе взрыва
        const ballsToRemove: number[] = [];
        
        // Перебираем все шары и проверяем расстояние до взрыва
        for (let i = 0; i < ballsRef.current.length; i++) {
          const ball = ballsRef.current[i];
          
          if (ball && ball.sprite && ball.sprite.container && !ball.sprite.container.destroyed) {
            const ballX = ball.sprite.container.x;
            const ballY = ball.sprite.container.y;
            
            // Вычисляем расстояние между центром взрыва и шаром
            const distance = Math.sqrt(
              Math.pow(ballX - x, 2) + Math.pow(ballY - y, 2)
            );
            
            // Если шар в радиусе взрыва, добавляем его индекс в список для удаления
            if (distance <= explosionRadius) {
              ballsToRemove.push(i);
            }
          }
        }
        
        // Удаляем шары в обратном порядке индексов
        for (let j = ballsToRemove.length - 1; j >= 0; j--) {
          const index = ballsToRemove[j];
          if (index >= 0 && index < ballsRef.current.length) {
            const ball = ballsRef.current[index];
            
            // Удаляем шар из массива шаров
            ballsRef.current.splice(index, 1);
            
            // Удаляем физическое тело из мира
            if (worldRef.current && ball && ball.body) {
              try {
                // Проверяем состояние тела перед удалением
                const isActive = ball.body.isActive();
                const hasFixtures = !!ball.body.getFixtureList();
                const isInWorld = ball.body.getWorld() === worldRef.current;
                
                if (isActive && hasFixtures && isInWorld) {
                  // Безусловно удаляем тело
                  worldRef.current.destroyBody(ball.body);
                } else {
                  // Тело шара уже недействительно
                }
                
                // Очищаем ссылку на тело
                ball.body = null as any;
          } catch (e) {
                // Ошибка при удалении тела шара
              }
            }
            
            // Удаляем визуальное представление шара
            if (ball && ball.sprite && ball.sprite.container) {
              try {
                if (!ball.sprite.container.destroyed) {
                  ball.sprite.container.destroy();
                }
              } catch (err) {
                // Ошибка при удалении шара
              }
            }
          }
        }
        
        // Удаляем визуальное представление бомбы
        if (bombBall.sprite && bombBall.sprite.container && !bombBall.sprite.container.destroyed) {
          bombBall.sprite.container.destroy();
        }
        
        // Проверяем текущее количество тел в мире
        if (worldRef.current) {
          const bodyCount = worldRef.current.getBodyCount();
        }
        
        // Пытаемся очистить все невалидные контакты
        try {
          // Обновляем мир с очень маленьким шагом для обработки удаленных тел
          if (worldRef.current) {
            worldRef.current.step(0.001, 1, 1);
            const contactCount = 0; // для простоты не подсчитываем контакты
          }
        } catch (e) {
          // Ошибка при очистке контактов после взрыва
        }
      };
      
      // Выполняем логику взрыва
      completeExplosion();
    } catch (e) {
      // Критическая ошибка в функции createExplosionAndRemoveBalls
    }
  };
}; 