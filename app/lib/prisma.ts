import { PrismaClient } from '@prisma/client'

// Расширяем тип PrismaClient для syncQueue (временное решение)
type ExtendedPrismaClient = PrismaClient & {
  syncQueue: any
}

// Исключаем из транспиляции в production
// eslint-disable-next-line
declare global {
  var prisma: ExtendedPrismaClient | undefined
}

// Создаем и экспортируем экземпляр Prisma как синглтон
export const prisma: ExtendedPrismaClient = 
  global.prisma || 
  (new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] }) as ExtendedPrismaClient)

// Предотвращаем множественные экземпляры в режиме разработки
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
} 