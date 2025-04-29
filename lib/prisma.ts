import { PrismaClient } from '@prisma/client';
import type { ExtendedPrismaClient } from '@/app/types/prisma';

// В глобальной области видимости объявляем переменную prisma, чтобы не создавать новый экземпляр при каждом запросе
declare global {
  // eslint-disable-next-line no-var
  var prisma: ExtendedPrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient() as ExtendedPrismaClient;

// В режиме разработки сохраняем ссылку на экземпляр в глобальной переменной
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
} 