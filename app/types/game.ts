export * from './gameTypes';

/**
 * Расширенное состояние игры с метаданными для сохранения
 */
import { GameState } from './gameTypes';

export interface ExtendedGameState extends GameState {
  _decompressedAt?: string;
  _compressedAt?: string;
  _compressionVersion?: number;
  _backupId?: string;
  _backupTimestamp?: number;
  _backupType?: string;
  _backupReason?: string;
  _backupMetadata?: Record<string, any>;
  _syncId?: string;
  _syncTimestamp?: number;
  _syncType?: string;
  _syncReason?: string;
  _syncMetadata?: Record<string, any>;
  _validationErrors?: string[];
  _validationWarnings?: string[];
  _validationMetadata?: Record<string, any>;
  _lastMerged?: string;
  _mergeInfo?: {
    timestamp: number;
    strategy: string;
    conflicts: number;
    resolved: number;
    duration: number;
  };
  repairData?: {
    timestamp: number;
    strategy: string;
    conflicts: number;
    resolved: number;
    duration: number;
  };
  _dataSource?: string; // Источник данных: 'local', 'server', 'new'
  _loadedAt?: string;   // Время загрузки данных
  score?: number;
  source?: string;
  containerSnot?: number;
  quests?: Record<string, {
    id: string;
    progress: number;
    completed: boolean;
    completed_at?: string;
    started_at?: string;
    steps?: Record<string, boolean>;
    metadata?: Record<string, any>;
  }>;
  _isEncrypted?: boolean;
  _integrityVerified?: boolean;
  _integrityWarning?: boolean;
} 