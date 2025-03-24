import { PrismaClient } from '@prisma/client';

// Создаем глобальный экземпляр PrismaClient для предотвращения слишком большого количества соединений в режиме разработки
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Инициализируем PrismaClient
export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Сохраняем экземпляр в глобальном объекте только в режиме разработки
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma; 