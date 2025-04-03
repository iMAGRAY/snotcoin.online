'use client'

import planck from 'planck';
import { PhysicsUserData, ExtendedBall } from '../types/index';

/**
 * Настраивает обнаружение столкновений для специальных шаров (Bull и Bomb)
 * @param world Физический мир
 * @param ballsRef Ссылка на массив шаров
 * @param worldRef Ссылка на физический мир
 * @param floorRef Ссылка на тело пола
 * @param leftWallRef Ссылка на тело левой стены
 * @param rightWallRef Ссылка на тело правой стены
 * @param topWallRef Ссылка на тело верхней стены
 * @param removeBall Функция для удаления шара
 * @param dispatch Функция для отправки действий в хранилище
 * @param snotCoins Количество SnotCoins
 * @param isBodyDestroyed Функция для проверки, удалено ли тело
 */
export const setupSpecialBallsCollisions = (
  world: planck.World,
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  worldRef: React.MutableRefObject<planck.World | null>,
  floorRef: React.MutableRefObject<planck.Body | null>,
  leftWallRef: React.MutableRefObject<planck.Body | null>,
  rightWallRef: React.MutableRefObject<planck.Body | null>,
  topWallRef: React.MutableRefObject<planck.Body | null>,
  removeBall: (ball: ExtendedBall) => void,
  dispatch: any,
  snotCoins: number,
  isBodyDestroyed: (body: planck.Body) => boolean
) => {
  // Создаем сет для отслеживания уже обработанных контактов
  const processedContacts = new Set<string>();
  
  // Регистрируем обработчик начала контакта
  world.on('begin-contact', (contact: planck.Contact) => {
    try {
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();
      
      if (!fixtureA || !fixtureB) return;
      
      const bodyA = fixtureA.getBody();
      const bodyB = fixtureB.getBody();
      
      if (!bodyA || !bodyB) return;
      
      const userDataA = bodyA.getUserData() as PhysicsUserData || {};
      const userDataB = bodyB.getUserData() as PhysicsUserData || {};
      
      // Проверяем, является ли один из объектов специальным шаром (Bull или Bomb)
      const isBullA = userDataA.specialType === 'Bull';
      const isBullB = userDataB.specialType === 'Bull';
      const isBombA = userDataA.specialType === 'Bomb';
      const isBombB = userDataB.specialType === 'Bomb';
      
      const isSpecialA = isBullA || isBombA;
      const isSpecialB = isBullB || isBombB;
      
      // Если ни один из объектов не является специальным шаром, пропускаем
      if (!isSpecialA && !isSpecialB) return;
      
      // Определяем, какой из объектов является специальным шаром
      const specialBody = isSpecialA ? bodyA : bodyB;
      const otherBody = isSpecialA ? bodyB : bodyA;
      const specialData = isSpecialA ? userDataA : userDataB;
      const otherData = isSpecialA ? userDataB : userDataA;
      const specialType = specialData.specialType || 'unknown';
      
      // Создаем уникальный идентификатор контакта
      const contactId = `${specialData.createdAt || Date.now()}-${otherData.createdAt || Date.now() + 1}`;
      
      // Проверяем, был ли этот контакт уже обработан
      if (processedContacts.has(contactId)) {
        return; // Пропускаем повторные контакты
      }
      
      // Добавляем контакт в список обработанных
      processedContacts.add(contactId);
      
      // Очищаем список обработанных контактов через 300 мс
      setTimeout(() => {
        processedContacts.delete(contactId);
      }, 300);
      
      // Получаем данные для отладки
      const specialLevel = specialData.level || 'неизвестен';
      const otherLevel = otherData.level || 'неизвестен';
      const otherType = otherData.type || 'неизвестен';
      
      console.log(`КОНТАКТ: ${specialType} (${specialLevel}) с объектом типа ${otherType}, уровень ${otherLevel}`);
      
      // Проверяем, является ли другой объект полом, стеной или другим объектом
      const isFloor = otherBody === floorRef.current;
      const isWall = otherBody === leftWallRef.current || 
                      otherBody === rightWallRef.current ||
                      otherBody === topWallRef.current;
      
      // Если специальный шар касается пола, удаляем его
      if (isFloor) {
        const specialBall = ballsRef.current.find(ball => 
          ball && ball.body === specialBody && ball.specialType === specialType
        );
        
        if (specialBall) {
          console.log(`${specialType} касается пола, удаляем его`);
          removeBall(specialBall);
        }
        return;
      }
      
      // Если это стена, пропускаем обработку
      if (isWall) {
        console.log(`${specialType} столкнулся со стеной, пропускаем`);
        return;
      }
      
      // Проверяем, является ли другой объект шаром
      const isBallByUserData = otherData && 
                          (otherData.isBall === true || 
                           otherData.type === 'ball' || 
                           (typeof otherData.level === 'number' && otherData.level > 0));
      
      const existsInBallsArray = ballsRef.current.some(ball => ball && ball.body === otherBody);
      const isNotSelfSpecial = otherData.specialType !== specialType;
      
      const isBallObject = (isBallByUserData || existsInBallsArray) && isNotSelfSpecial;
      
      if (!isBallObject) {
        console.log('Объект не является шаром, пропускаем');
        return;
      }
      
      // Находим шар, который нужно обработать
      const ballToProcess = ballsRef.current.find(ball => 
        ball && ball.body === otherBody
      );
      
      if (ballToProcess) {
        console.log(`${specialType} столкнулся с шаром уровня ${ballToProcess.level}`);
        
        // Для Bull шара начисляем очки и удаляем другой шар
        if (specialType === 'Bull') {
          const ballLevel = ballToProcess.level || 0;
          
          // Начисляем очки
          dispatch({
            type: 'UPDATE_INVENTORY',
            payload: {
              snotCoins: snotCoins + ballLevel
            }
          });
          
          // Удаляем обычный шар
          removeBall(ballToProcess);
        } 
        // Для Bomb шара удаляем и его, и другой шар
        else if (specialType === 'Bomb') {
          // Удаляем обычный шар
          removeBall(ballToProcess);
          
          // Находим и удаляем Bomb шар
          const bombBall = ballsRef.current.find(ball => 
            ball && ball.body === specialBody && ball.specialType === 'Bomb'
          );
          
          if (bombBall) {
            console.log('Удаляем шар Bomb после столкновения');
            removeBall(bombBall);
          }
        }
      } else {
        console.log(`${specialType} столкнулся с объектом, но шар для обработки не найден`);
        
        // Дополнительная проверка: принудительно удаляем потерянное тело
        if (otherData.level && otherBody && worldRef.current && !isBodyDestroyed(otherBody)) {
          try {
            worldRef.current.destroyBody(otherBody);
            console.log(`Удалено "потерянное" физическое тело с уровнем ${otherData.level}`);
          } catch (e) {
            console.error(`Ошибка при удалении "потерянного" тела:`, e);
          }
        }
        
        // Если это Bomb, убираем и его тоже
        if (specialType === 'Bomb') {
          const bombBall = ballsRef.current.find(ball => 
            ball && ball.body === specialBody && ball.specialType === 'Bomb'
          );
          
          if (bombBall) {
            console.log('Удаляем шар Bomb после контакта с потерянным объектом');
            removeBall(bombBall);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке контакта:', error);
    }
  });
}; 