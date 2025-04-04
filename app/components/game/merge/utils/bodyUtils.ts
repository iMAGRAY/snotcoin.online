import * as planck from 'planck';
import { PhysicsUserData, ExtendedBall } from '../types';

/**
 * Проверяет, было ли уничтожено физическое тело
 */
export const isBodyDestroyed = (body: planck.Body): boolean => {
  try {
    // Проверяем три условия, которые указывают на то, что тело может быть уничтожено
    return !body || // Тело не существует
           !body.isActive() || // Тело не активно
           !body.getFixtureList() || // У тела нет фикстур
           !body.getWorld(); // Тело не привязано к миру
  } catch (e) {
    // Ошибка при проверке тела, считаем его удаленным
    return true; // При ошибке считаем, что тело уничтожено
  }
};

// Константа для максимального уровня шара
const MAX_LEVEL = 12;

/**
 * Настраивает обработчики столкновений для обычных шаров
 */
export const setupNormalBallsCollisions = (
  world: planck.World,
  ballsRef: React.MutableRefObject<ExtendedBall[]>
) => {
  // Создаем набор для хранения уже обработанных пар контактов
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
      
      const userDataA = bodyA.getUserData() as PhysicsUserData | null;
      const userDataB = bodyB.getUserData() as PhysicsUserData | null;
      
      // Проверяем, являются ли оба объекта шарами (не специальными)
      const isBallA = userDataA && userDataA.type === 'ball' && !userDataA.specialType;
      const isBallB = userDataB && userDataB.type === 'ball' && !userDataB.specialType;
      
      // Если оба объекта - шары
      if (isBallA && isBallB && userDataA && userDataB) {
        // Проверяем уровни шаров
        const levelA = userDataA.level ?? 0;
        const levelB = userDataB.level ?? 0;
        
        // Если уровни одинаковые и не максимальные (добавлена явная проверка, чтобы шары 12 уровня не сливались)
        if (levelA === levelB && levelA > 0 && levelA < MAX_LEVEL) {
          // Создаем уникальный идентификатор для пары контактов
          const contactId = `${Math.min(userDataA.createdAt || 0, userDataB.createdAt || 0)}-${Math.max(userDataA.createdAt || 0, userDataB.createdAt || 0)}`;
          
          // Если этот контакт уже обработан, пропускаем
          if (processedContacts.has(contactId)) {
            return;
          }
          
          // Добавляем контакт в набор обработанных
          processedContacts.add(contactId);
          
          // Удаляем контакт из обработанных через время
          setTimeout(() => {
            processedContacts.delete(contactId);
          }, 500);
          
          // Помечаем оба шара для слияния
          bodyA.setUserData({
            ...userDataA,
            shouldMerge: true,
            mergeWith: bodyB,
            mergeTime: Date.now()
          });
          
          bodyB.setUserData({
            ...userDataB,
            shouldMerge: true,
            mergeWith: bodyA,
            mergeTime: Date.now()
          });
        }
      }
    } catch (error) {
      // Ошибка при обработке контакта нормальных шаров
    }
  });
};

// Обработчик контакта для шаров одинакового уровня
export const processContactBetweenSameLevelBalls = (
  contact: planck.Contact,
  bodyA: planck.Body,
  bodyB: planck.Body,
  userDataA: any,
  userDataB: any,
  levelA: number,
  levelB: number,
  timeKey: string,
  mergeContactTime: Set<string>
): boolean => {
  try {
    // Проверяем, что шары одного уровня, оба являются шарами и уровень не максимальный
    if (levelA === levelB && levelA < MAX_LEVEL && (userDataA.type === 'ball' && userDataB.type === 'ball')) {
      // Шары одного уровня коснулись друг друга
      // Контакт шаров одинакового уровня
      
      // Создаем уникальный ключ для контакта
      const contactKey = `${userDataA.createdAt}-${userDataB.createdAt}-${timeKey}`;
      const reverseContactKey = `${userDataB.createdAt}-${userDataA.createdAt}-${timeKey}`;
      
      // Проверяем, не был ли этот контакт уже обработан
      if (mergeContactTime.has(contactKey) || mergeContactTime.has(reverseContactKey)) {
        return true; // Этот контакт уже обрабатывался, пропускаем
      }
      
      // Если шары ещё не были помечены для слияния
      if (!userDataA.shouldMerge && !userDataB.shouldMerge) {
        // Проверяем скорость шаров — слитком быстрые шары не сливаем сразу
        const velocityThreshold = 6.0; // Пороговое значение скорости для проверки
        const velA = bodyA.getLinearVelocity();
        const velB = bodyB.getLinearVelocity();
        const speedA = Math.sqrt(velA.x * velA.x + velA.y * velA.y);
        const speedB = Math.sqrt(velB.x * velB.x + velB.y * velB.y);
        
        if (speedA < velocityThreshold && speedB < velocityThreshold) {
          // Помечаем шары для слияния
          userDataA.shouldMerge = true;
          userDataA.mergeWith = bodyB;
          userDataB.shouldMerge = true;
          userDataB.mergeWith = bodyA;
          
          // Обновляем данные шаров
          bodyA.setUserData(userDataA);
          bodyB.setUserData(userDataB);
          
          // Добавляем контакт в набор обработанных
          mergeContactTime.add(contactKey);
          
          // Шары уровня помечены для слияния
          
          return true; // Контакт обработан
        }
      }
    }
    return true; // Продолжаем обработку контакта
  } catch (error) {
    // Ошибка при обработке контакта нормальных шаров
    return true; // В случае ошибки разрешаем контакт
  }
}; 