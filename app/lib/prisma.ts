import { PrismaClient } from '@prisma/client'
import type { ExtendedPrismaClient } from '@/app/types/prisma'

// Типы для обработки ошибок
type PrismaError = {
  code?: string;
  message: string;
}

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
prisma.$on('error', (event: unknown) => {
  const e = event as PrismaError | Error;
  console.error('Ошибка Prisma:', e);
  
  // Пытаемся переподключиться при ошибке
  if ('code' in e && (e.code === 'P1001' || e.code === 'P1002')) {
    console.log('Попытка переподключения к базе данных...');
    prisma.$connect();
  }
});

// Логирование запросов в development
if (process.env.NODE_ENV === 'development') {
  type PrismaQueryEvent = { query: string; params: string; duration: number; target: string };
  
  prisma.$on('query', (event: unknown) => {
    const e = event as PrismaQueryEvent;
    console.log('Query:', e.query);
    console.log('Duration:', e.duration, 'ms');
  });
}

// Экспортируем Prisma для использования в приложении
export default prisma; 