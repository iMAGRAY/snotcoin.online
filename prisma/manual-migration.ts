// Скрипт для ручной миграции типа поля farcaster_fid в таблице users
// Поскольку миграция через prisma migrate требует больших прав, чем есть у пользователя,
// этот скрипт выполняет SQL-запрос напрямую.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Начинаем миграцию типа поля farcaster_fid...');
    
    // Создаем временную колонку farcaster_fid_text
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users 
      ADD COLUMN farcaster_fid_text TEXT;
    `);
    
    console.log('Создана временная колонка farcaster_fid_text');
    
    // Копируем данные из farcaster_fid в farcaster_fid_text
    await prisma.$executeRawUnsafe(`
      UPDATE users
      SET farcaster_fid_text = farcaster_fid::TEXT;
    `);
    
    console.log('Данные скопированы в текстовую колонку');
    
    // Удаляем ограничение уникальности со старой колонки
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_farcaster_fid_key;
    `);
    
    console.log('Удалено ограничение уникальности');
    
    // Удаляем старую колонку
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      DROP COLUMN farcaster_fid;
    `);
    
    console.log('Старая колонка удалена');
    
    // Переименовываем новую колонку
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      RENAME COLUMN farcaster_fid_text TO farcaster_fid;
    `);
    
    console.log('Новая колонка переименована');
    
    // Добавляем ограничение уникальности для новой колонки
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      ADD CONSTRAINT users_farcaster_fid_key UNIQUE (farcaster_fid);
    `);
    
    console.log('Добавлено ограничение уникальности к новой колонке');
    
    // Добавляем NOT NULL ограничение
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      ALTER COLUMN farcaster_fid SET NOT NULL;
    `);
    
    console.log('Миграция успешно завершена!');
  } catch (error) {
    console.error('Ошибка при выполнении миграции:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 