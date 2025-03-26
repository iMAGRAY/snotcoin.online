import { RedisCache } from '../app/utils/redisClient';
import { ExtendedGameState } from '../app/types/gameTypes';
import { StructuredGameSave, gameStateToStructured, structuredToGameState } from '../app/types/saveTypes';

const testState: ExtendedGameState = {
  inventory: {
    snot: 100,
    snotCoins: 0,
    containerCapacity: 1000,
    containerCapacityLevel: 1,
    fillingSpeed: 1,
    fillingSpeedLevel: 1,
    collectionEfficiency: 1,
    containerSnot: 50,
    Cap: 1000,
    lastUpdateTimestamp: Date.now()
  },
  container: {
    level: 1,
    capacity: 1000,
    currentAmount: 50,
    fillRate: 1,
    currentFill: 0
  },
  upgrades: {
    containerLevel: 1,
    fillingSpeedLevel: 1,
    collectionEfficiencyLevel: 1,
    clickPower: { level: 1, value: 1 },
    passiveIncome: { level: 1, value: 0.1 }
  },
  items: [],
  achievements: {
    unlockedAchievements: []
  },
  stats: {
    totalSnot: 100,
    playTime: 300,
    highestLevel: 1,
    clickCount: 10,
    startDate: new Date().toISOString(),
    totalSnotCoins: 50,
    consecutiveLoginDays: 1
  },
  settings: {
    language: 'ru',
    theme: 'light',
    notifications: true,
    tutorialCompleted: false,
    musicEnabled: true,
    soundEnabled: true,
    notificationsEnabled: true
  },
  soundSettings: {
    musicVolume: 0.5,
    soundVolume: 0.5,
    notificationVolume: 0.5,
    clickVolume: 0.5,
    effectsVolume: 0.5,
    backgroundMusicVolume: 0.3,
    isMuted: false,
    isEffectsMuted: false,
    isBackgroundMusicMuted: false
  },
  activeTab: 'laboratory',
  hideInterface: false,
  isPlaying: false,
  isLoading: false,
  gameStarted: true,
  highestLevel: 1,
  containerLevel: 1,
  fillingSpeed: 1,
  containerSnot: 50,
  user: null,
  validationStatus: "pending",
  _userId: 'test_user_123',
  _saveVersion: 1,
  _lastModified: Date.now(),
  _decompressedAt: new Date().toISOString()
};

async function testRedisState() {
  console.log('Тестирование сохранения и загрузки состояния в Redis...');
  
  const cache = new RedisCache();
  
  // Ждем инициализацию
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // Преобразуем состояние в структурированный формат
    const structuredState = gameStateToStructured(testState);
    console.log('Структурированное состояние создано');
    
    // Сохраняем состояние
    console.log('Сохраняем тестовое состояние...');
    const saveResult = await cache.saveGameState('test_user_123', testState);
    
    if (saveResult.success) {
      console.log('✅ Состояние успешно сохранено');
      console.log('Метаданные:', saveResult.metadata);
    } else {
      console.log('❌ Ошибка при сохранении состояния:', saveResult.error);
      return;
    }
    
    // Загружаем состояние
    console.log('\nЗагружаем состояние...');
    const loadResult = await cache.loadGameState('test_user_123');
    
    if (loadResult.success && loadResult.data) {
      console.log('✅ Состояние успешно загружено');
      console.log('Метаданные:', loadResult.metadata);
      
      // Выводим загруженное состояние
      console.log('Загруженное состояние:', JSON.stringify(loadResult.data, null, 2));
      
      // Проверяем тип загруженного состояния
      const structuredSave = loadResult.data as unknown as StructuredGameSave;
      if ('critical' in structuredSave && 'integrity' in structuredSave) {
        // Преобразуем структурированное состояние в ExtendedGameState
        const loadedState = structuredToGameState(structuredSave);
        
        // Проверяем соответствие данных
        const matches = 
          loadedState.inventory.snot === testState.inventory.snot &&
          loadedState.container.capacity === testState.container.capacity &&
          loadedState.upgrades.containerLevel === testState.upgrades.containerLevel;
        
        if (matches) {
          console.log('✅ Загруженные данные соответствуют сохраненным');
        } else {
          console.log('❌ Загруженные данные отличаются от сохраненных');
        }
      } else {
        console.log('❌ Загруженное состояние имеет неверный формат');
      }
    } else {
      console.log('❌ Ошибка при загрузке состояния:', loadResult.error);
    }
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  } finally {
    // Очищаем ресурсы
    cache.destroy();
  }
}

testRedisState().catch(console.error);