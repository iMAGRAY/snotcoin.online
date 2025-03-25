import { Pool } from 'pg';

// Строка подключения к базе данных
const connectionString = process.env.POSTGRES_URL || 'postgresql://admin:6780Iphone@80.242.56.250:5432/GameProgress';

// Создаем пул соединений
const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  max: 20, // максимальное количество клиентов в пуле
  idleTimeoutMillis: 30000, // время простоя клиента до его освобождения (30 сек)
  connectionTimeoutMillis: 2000, // время ожидания соединения (2 сек)
});

// Обработка событий пула соединений
pool.on('error', (err: Error) => {
  console.error('Произошла ошибка в пуле соединений PostgreSQL', err);
});

// Класс для работы с пользователями
export class UserModel {
  /**
   * Поиск пользователя по farcaster_fid
   */
  static async findByFarcasterId(fid: number) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE farcaster_fid = $1',
        [fid]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Ошибка при поиске пользователя по farcaster_fid:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Создание нового пользователя
   */
  static async create(userData: {
    farcaster_fid: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
  }) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO users (farcaster_fid, username, display_name, pfp, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          userData.farcaster_fid,
          userData.username || null,
          userData.first_name || null,
          userData.photo_url || null,
          new Date(),
          new Date()
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при создании пользователя:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Обновление данных пользователя
   */
  static async update(userData: {
    id: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  }) {
    try {
      const result = await pool.query(
        `UPDATE users SET 
          username = COALESCE($1, username),
          first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          updated_at = NOW()
        WHERE id = $4 
        RETURNING *`,
        [
          userData.username || null,
          userData.first_name || null,
          userData.last_name || null,
          userData.id
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при обновлении пользователя:', error);
      throw error;
    }
  }

  /**
   * Обновление JWT токена пользователя
   */
  static async updateToken(userId: string, token: string) {
    try {
      const result = await pool.query(
        'UPDATE users SET jwt_token = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [token, userId]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Ошибка при обновлении токена пользователя:', error);
      throw error;
    }
  }

  /**
   * Проверка токена пользователя
   */
  static async validateToken(userId: string, token: string) {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1 AND jwt_token = $2',
        [userId, token]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Ошибка при проверке токена пользователя:', error);
      throw error;
    }
  }
}

// Экспортируем пул соединений для прямого использования
export default pool; 