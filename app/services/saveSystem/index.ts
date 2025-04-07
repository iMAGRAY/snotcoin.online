/**
 * Система сохранений игры SnotCoin
 * Обеспечивает надежное сохранение и загрузку игрового состояния
 * с использованием различных хранилищ и механизмов синхронизации
 */
import { SaveManager } from './SaveManager';
import * as types from './types';
import * as utils from './utils';
import * as adapters from './adapters';

// Экспортируем полный набор типов и утилит для использования в приложении
export { types, utils, adapters };

// Создаем глобальный экземпляр менеджера сохранений
// для использования во всем приложении
export const saveManager = new SaveManager();

// По умолчанию экспортируем класс SaveManager
// для создания пользовательских экземпляров при необходимости
export default SaveManager; 