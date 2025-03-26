import { redisService } from '../app/services/redis';

async function testRedisConnection() {
  console.log('Тестирование подключения к Redis...');
  
  // Инициализируем сервис
  await redisService.initialize();
  
  // Проверяем соединение
  const isAvailable = await redisService.isAvailable();
  
  if (isAvailable) {
    console.log('✅ Подключение к Redis успешно установлено');
  } else {
    console.log('❌ Не удалось подключиться к Redis');
  }
  
  // Получаем статистику
  const stats = await redisService.getCacheStats();
  console.log('Статистика Redis:', stats);
}

testRedisConnection().catch(console.error); 