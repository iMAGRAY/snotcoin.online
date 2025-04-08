import { PrismaClient } from '@prisma/client'
import type { ExtendedPrismaClient, PrismaError, PrismaQueryEvent } from '@/app/types/prisma'

// Создаем и экспортируем экземпляр Prisma
export const prisma = new PrismaClient() as ExtendedPrismaClient;

// Обработка ошибок подключения
prisma.$on('error', (e: PrismaError) => {
  console.error('Ошибка Prisma:', e)
  
  // Пытаемся переподключиться при ошибке
  if (e.code === 'P1001' || e.code === 'P1002') {
    console.log('Попытка переподключения к базе данных...')
    prisma.$connect()
  }
})

// Экспортируем Prisma для использования в приложении
export default prisma; 