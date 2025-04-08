import { PrismaClient } from '@prisma/client'
import type { ExtendedPrismaClient, PrismaError, PrismaQueryEvent } from '@/app/types/prisma'

// Создаем и экспортируем экземпляр Prisma
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
    errorFormat: 'pretty'
  }) as ExtendedPrismaClient;
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Обработка ошибок подключения
prisma.$on('error', (e: PrismaError) => {
  console.error('Ошибка Prisma:', e)
  
  // Пытаемся переподключиться при ошибке
  if (e.code === 'P1001' || e.code === 'P1002') {
    console.log('Попытка переподключения к базе данных...')
    prisma.$connect()
  }
});

// Логирование запросов в development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e: PrismaQueryEvent) => {
    console.log('Query:', e.query)
    console.log('Duration:', e.duration, 'ms')
  });
}

// Экспортируем Prisma для использования в приложении
export default prisma; 