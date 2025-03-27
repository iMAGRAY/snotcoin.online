import { RedisCache } from '../app/services/redis/types/redisTypes';
import { ExtendedGameState } from '../app/types/gameTypes';
import { StructuredGameSave, gameStateToStructured, structuredToGameState } from '../app/types/saveTypes';
import { redisService } from '../app/services/redis';

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
} as unknown as ExtendedGameState;

async function testRedisState() {
  console.log('Тестирование сохранения и загрузки состояния в Redis...');
  
  // Инициализируем сервис
  await redisService.initialize();
  
  try {
    // Преобразуем состояние в структурированный формат
    const structuredState = gameStateToStructured(testState);
    console.log('Структурированное состояние создано');
    
    // Сохраняем состояние с максимальным приоритетом
    console.log('Сохраняем тестовое состояние...');
    const saveResult = await redisService.saveGameState('test_user_123', testState, {
      isCritical: true,
      compress: true
    });
    
    if (saveResult.success) {
      console.log('✅ Состояние успешно сохранено');
      console.log('Метрики:', saveResult.metrics);
    } else {
      console.log('❌ Ошибка при сохранении состояния:', saveResult.error);
      return;
    }
    
    // Загружаем состояние
    console.log('\nЗагружаем состояние...');
    const loadResult = await redisService.loadGameState('test_user_123');
    
    if (loadResult.success && loadResult.data) {
      console.log('✅ Состояние успешно загружено');
      console.log('Метрики:', loadResult.metrics);
      
      // Проверяем соответствие данных
      const loadedState = loadResult.data as ExtendedGameState;
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
      console.log('❌ Ошибка при загрузке состояния:', loadResult.error);
    }
    
    // Получаем статистику
    const stats = await redisService.getCacheStats();
    console.log('\nСтатистика Redis:', stats);
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

testRedisState().catch(console.error);