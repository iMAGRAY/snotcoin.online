// Скрипт для ручной миграции базы данных
// Выполняет SQL-запросы напрямую, когда миграция через prisma migrate невозможна

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Начинаем выполнение миграций...');

    // 1. Проверяем наличие таблицы sync_queue
    console.log('Проверяем наличие таблицы sync_queue...');
    
    const syncQueueExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sync_queue'
      );
    `;
    
    if (!(syncQueueExists as any)[0].exists) {
      console.log('Таблица sync_queue не найдена. Создаем...');
      
      await prisma.$executeRawUnsafe(`
        CREATE TABLE sync_queue (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          data JSONB NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          attempts INTEGER NOT NULL DEFAULT 0
        );
      `);
      
      // Создаем индексы для оптимизации запросов
      await prisma.$executeRawUnsafe(`
        CREATE INDEX idx_sync_queue_user_id ON sync_queue(user_id);
      `);
      
      await prisma.$executeRawUnsafe(`
        CREATE INDEX idx_sync_queue_status ON sync_queue(status);
      `);
      
      console.log('Таблица sync_queue успешно создана!');
    } else {
      console.log('Таблица sync_queue уже существует.');
      
      // Проверяем, существует ли колонка operation_type в sync_queue
      const operationTypeExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'sync_queue' 
          AND column_name = 'operation_type'
        );
      `;
      
      if ((operationTypeExists as any)[0].exists) {
        console.log('Колонка operation_type найдена в sync_queue. Переименовываем в operation...');
        await prisma.$executeRawUnsafe(`
          ALTER TABLE sync_queue RENAME COLUMN operation_type TO operation;
        `);
        console.log('Колонка переименована успешно!');
      } else {
        console.log('Колонка operation_type не найдена, проверка завершена.');
      }
    }
    
    // 2. Проверяем наличие таблицы progress_history
    console.log('Проверяем наличие таблицы progress_history...');
    
    const progressHistoryExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'progress_history'
      );
    `;
    
    if (!(progressHistoryExists as any)[0].exists) {
      console.log('Таблица progress_history не найдена. Создаем...');
      
      await prisma.$executeRawUnsafe(`
        CREATE TABLE progress_history (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          save_type TEXT NOT NULL,
          save_reason TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      
      // Создаем индексы для оптимизации запросов
      await prisma.$executeRawUnsafe(`
        CREATE INDEX idx_progress_history_user_id ON progress_history(user_id);
      `);
      
      await prisma.$executeRawUnsafe(`
        CREATE INDEX idx_progress_history_created_at ON progress_history(created_at);
      `);
      
      console.log('Таблица progress_history успешно создана!');
    } else {
      console.log('Таблица progress_history уже существует.');
    }
    
    // 3. Проверяем тип колонки farcaster_fid (сохраняем существующую миграцию)
    console.log('Проверяем тип колонки farcaster_fid в таблице users...');
    
    const columnTypeResult = await prisma.$queryRaw`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'farcaster_fid';
    `;
    
    const columnTypes = columnTypeResult as any[];
    
    // Если колонка существует и тип не TEXT, выполняем миграцию
    if (columnTypes.length > 0 && columnTypes[0].data_type !== 'text') {
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
      
      console.log('Миграция типа поля farcaster_fid успешно завершена!');
    } else {
      console.log('Колонка farcaster_fid уже имеет тип TEXT или не найдена.');
    }
    
    console.log('Все миграции выполнены успешно!');
  } catch (error) {
    console.error('Ошибка при выполнении миграции:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 