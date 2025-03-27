import { PrismaClient } from '@prisma/client'
import type { ExtendedPrismaClient, PrismaError, PrismaQueryEvent } from '@/app/types/prisma'

// Создаем глобальную переменную для хранения экземпляра Prisma
declare global {
  var prisma: ExtendedPrismaClient | undefined
}

// Создаем или используем существующий экземпляр Prisma
export const prisma = (global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})) as ExtendedPrismaClient

// Сохраняем экземпляр в глобальной переменной в режиме разработки
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// Обработка ошибок подключения
prisma.$on('error', (e: PrismaError) => {
  console.error('Ошибка Prisma:', e)
  
  // Пытаемся переподключиться при ошибке
  if (e.code === 'P1001' || e.code === 'P1002') {
    console.log('Попытка переподключения к базе данных...')
    prisma.$connect()
  }
})

// Обработка предупреждений
prisma.$on('warn', (e: PrismaError) => {
  console.warn('Предупреждение Prisma:', e)
})

// Обработка запросов (только в режиме разработки)
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e: PrismaQueryEvent) => {
    console.log('Запрос Prisma:', e)
  })
} 