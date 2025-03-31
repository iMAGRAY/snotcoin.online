import { redisService } from '../app/services/redis';

async function testRedisConnection() {
  console.log('Тестирование подключения к Redis...');
  
  // Проверяем соединение
  const isAvailable = await redisService.isAvailable();
  
  if (isAvailable) {
    console.log('✅ Подключение к Redis успешно установлено');
    
    // Получаем статус
    const status = redisService.getStatus();
    console.log('Статус Redis:', status);
  } else {
    console.log('❌ Не удалось подключиться к Redis');
  }
}

testRedisConnection().catch(console.error); 