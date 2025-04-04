import * as planck from 'planck';
import { PhysicsUserData, ExtendedBall } from '../types';

/**
 * Проверяет, было ли удалено тело из физического мира
 */
export const isBodyDestroyed = (body: planck.Body): boolean => {
  // Проверяем несколько признаков, указывающих на то, что тело было удалено
  try {
    // 1. Проверяем, активно ли тело
    if (!body.isActive()) return true;
    
    // 2. Проверяем наличие фикстур
    if (!body.getFixtureList()) return true;
    
    // 3. Проверяем, связано ли тело с миром
    if (!body.getWorld()) return true;
    
    // Если все проверки прошли, тело не считается удаленным
    return false;
  } catch (e) {
    // Если при доступе к телу возникла ошибка, считаем его удаленным
    console.warn('Ошибка при проверке тела, считаем его удаленным:', e);
    return true;
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
        
        // Если уровни одинаковые и не максимальные
        if (levelA === levelB && levelA > 0 && levelA < MAX_LEVEL) {
          console.log(`Контакт шаров одинакового уровня ${levelA}`);
          
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
          
          console.log(`Шары уровня ${levelA} помечены для слияния`);
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке контакта нормальных шаров:', error);
    }
  });
}; 