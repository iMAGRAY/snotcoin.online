import { RedisCache } from '../app/utils/redisClient';

async function testRedisConnection() {
  console.log('Тестирование подключения к Redis...');
  
  const cache = new RedisCache();
  
  // Ждем инициализацию
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const isConnected = await cache.testConnection();
  
  if (isConnected) {
    console.log('✅ Подключение к Redis успешно установлено');
  } else {
    console.log('❌ Не удалось подключиться к Redis');
  }
  
  // Очищаем ресурсы
  cache.destroy();
}

testRedisConnection().catch(console.error); 