/**
 * Простая система сохранения игрового прогресса
 * Использует только localStorage для надежности и простоты
 */
export { SaveSystem } from '../saveSystem';
export { SavePriority, StorageType } from './types';
export type { 
  SaveResult, 
  SaveInfo, 
  SaveSystemOptions,
  LoadResult
} from './types';

import { SaveSystem } from '../saveSystem';
export default SaveSystem; 