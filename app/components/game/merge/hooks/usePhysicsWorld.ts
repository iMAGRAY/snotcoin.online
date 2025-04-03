import { useRef, useEffect } from 'react';
import * as planck from 'planck';
import { PhysicsUserData } from '../types/index';
import { hasUserDataProperty } from '../utils/ballUtils';
import { 
  MAX_LEVEL, 
  BALL_RESTITUTION, 
  BALL_FRICTION, 
  GRAVITY_Y 
} from '../constants/gameConstants';

// Переменная для ограничения проверок коллизий
const MAX_CONTACT_CHECKS = 10; // Оптимизировано для производительности

// Хук для создания и управления физическим миром
export const usePhysicsWorld = () => {
  const worldRef = useRef<planck.World | null>(null);
  const playerBodyRef = useRef<planck.Body | null>(null);
  const leftWallRef = useRef<planck.Body | null>(null);
  const rightWallRef = useRef<planck.Body | null>(null);
  const topWallRef = useRef<planck.Body | null>(null);
  const floorRef = useRef<planck.Body | null>(null);
  
  // Счетчик проверок коллизий для ограничения вычислений
  const contactCountRef = useRef<number>(0);
  
  // Время последней проверки коллизий
  const lastContactCheckRef = useRef<number>(0);

  // Создаем мир при первом рендере
  useEffect(() => {
    // Создаем мир планк для физики с гравитацией по оси Y
    const world = planck.World({
      gravity: planck.Vec2(0, GRAVITY_Y)  // Используем константу GRAVITY_Y
    });
    
    // Настраиваем дополнительные параметры для лучшего соскальзывания
    world.setSubStepping(false); // Отключаем субшаги для лучшей производительности
    
    // Добавляем обработчик предварительных коллизий для игнорирования столкновений между игроком и шарами
    world.on('pre-solve', (contact) => {
      // Проверяем, не слишком ли часто происходят проверки
      const now = Date.now();
      if (now - lastContactCheckRef.current < 16) { // ~60fps
        contact.setEnabled(true); // Разрешаем контакт по умолчанию
        return;
      }
      lastContactCheckRef.current = now;
      
      // Ограничиваем количество проверок за кадр
      contactCountRef.current++;
      if (contactCountRef.current > MAX_CONTACT_CHECKS) {
        // После определенного количества проверок сбрасываем счетчик и выходим
        if (contactCountRef.current > 100) {
          contactCountRef.current = 0;
        }
        // Разрешаем контакт по умолчанию без проверок
        return;
      }
      
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();
      
      if (!fixtureA || !fixtureB) {
        contact.setEnabled(false);
        return;
      }
      
      const bodyA = fixtureA.getBody();
      const bodyB = fixtureB.getBody();
      
      // Пропускаем дальнейшие проверки, если любое из тел неактивно или недействительно
      if (!bodyA || !bodyB || !bodyA.isActive() || !bodyB.isActive()) {
        contact.setEnabled(false);
        return;
      }
      
      const dataA = bodyA.getUserData() as PhysicsUserData | null;
      const dataB = bodyB.getUserData() as PhysicsUserData | null;
      
      // Если один из объектов - игрок, а другой - шар, отключаем контакт
      if ((dataA && dataA.isPlayer) || (dataB && dataB.isPlayer)) {
        contact.setEnabled(false);
        return; // Выходим, чтобы не выполнять лишние проверки
      }
      
      // Если оба объекта - шары, проверяем их уровни
      if (dataA && dataB && dataA.level && dataB.level) {
        // Устанавливаем базовое трение для всех шаров
        contact.setFriction(BALL_FRICTION);
        
        // Если шары ТОЧНО одинакового уровня и не максимального - ВСЕГДА помечаем их для слияния,
        // независимо от предыдущих меток или времени создания
        if (dataA.level === dataB.level && dataA.level < MAX_LEVEL) {
          // Помечаем шары для немедленного слияния
          bodyA.setUserData({ ...dataA, shouldMerge: true, mergeWith: bodyB });
          bodyB.setUserData({ ...dataB, shouldMerge: true, mergeWith: bodyA });
          
          // Делаем контакт мягче для более естественного взаимодействия
          contact.setRestitution(BALL_RESTITUTION);
        } 
        // Для шаров максимального уровня - специальная физика
        else if (dataA.level === MAX_LEVEL || dataB.level === MAX_LEVEL) {
          // Шары максимального уровня имеют больше отскока и меньше трения
          contact.setRestitution(0.6); // Больше упругость для максимальных шаров
          contact.setFriction(0.05);  // Минимальное трение для лучшего соскальзывания
        }
        // Для шаров разных уровней - стандартная физика без слияния
        else {
          contact.setRestitution(BALL_RESTITUTION * 0.8); // Чуть меньше отскок для разных шаров
          contact.setFriction(BALL_FRICTION * 1.2);       // Чуть больше трение
        }
      }
    });
    
    // Добавляем обработчик для начала контакта между шарами
    world.on('begin-contact', (contact) => {
      // Ограничиваем количество проверок за кадр
      contactCountRef.current++;
      if (contactCountRef.current > MAX_CONTACT_CHECKS / 2) { // Ещё более жесткое ограничение
        return;
      }
      
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();
      
      if (!fixtureA || !fixtureB) return;
      
      const bodyA = fixtureA.getBody();
      const bodyB = fixtureB.getBody();
      
      // Пропускаем дальнейшие проверки, если любое из тел неактивно
      if (!bodyA || !bodyB || !bodyA.isActive() || !bodyB.isActive()) {
        return;
      }
      
      const dataA = bodyA.getUserData() as PhysicsUserData | null;
      const dataB = bodyB.getUserData() as PhysicsUserData | null;
      
      // Игнорируем контакт с игроком
      if ((dataA && dataA.isPlayer) || (dataB && dataB.isPlayer)) {
        return;
      }
      
      // Если оба объекта - шары, и у них одинаковый уровень, и уровень не максимальный - 
      // немедленно помечаем их для слияния
      if (dataA && dataB && dataA.level && dataB.level && 
          dataA.level === dataB.level && dataA.level < MAX_LEVEL) {
        bodyA.setUserData({ ...dataA, shouldMerge: true, mergeWith: bodyB });
        bodyB.setUserData({ ...dataB, shouldMerge: true, mergeWith: bodyA });
      }
      
      // Применяем слабый импульс для шаров разных уровней, чтобы избежать "прилипания"
      else if (dataA && dataB && dataA.level && dataB.level && dataA.level !== dataB.level) {
        try {
          // Применяем очень слабый импульс для предотвращения "склеивания" шаров
          const randomImpulse = 0.05;
          bodyA.applyAngularImpulse(randomImpulse * (Math.random() > 0.5 ? 1 : -1));
          bodyB.applyAngularImpulse(randomImpulse * (Math.random() > 0.5 ? 1 : -1));
        } catch (e) {
          // Игнорируем ошибки при применении импульса
        }
      }
    });
    
    // Добавляем обработчик конца шага физики, чтобы сбросить счетчик контактов
    world.on('post-solve', () => {
      // Сбрасываем счетчик контактов
      contactCountRef.current = 0;
    });
    
    worldRef.current = world;
    
    // Очистка при размонтировании
    return () => {
      // Очищаем физический мир
      if (worldRef.current) {
        try {
          worldRef.current.clearForces();
          
          // Удаляем все тела
          let body = worldRef.current.getBodyList();
          while (body) {
            const nextBody = body.getNext(); // Сохраняем ссылку на следующее тело
            try {
              body.setUserData(null); // Очищаем пользовательские данные
              worldRef.current.destroyBody(body);
            } catch (e) {
              console.warn("Ошибка при удалении тела во время размонтирования:", e);
            }
            body = nextBody;
          }
          
          worldRef.current = null;
        } catch (e) {
          console.error("Ошибка при очистке физического мира:", e);
        }
      }
      
      // Очищаем ссылки на тела
      playerBodyRef.current = null;
      leftWallRef.current = null;
      rightWallRef.current = null;
      topWallRef.current = null;
      floorRef.current = null;
    };
  }, []);

  return {
    worldRef,
    playerBodyRef,
    leftWallRef,
    rightWallRef,
    topWallRef,
    floorRef
  };
}; 