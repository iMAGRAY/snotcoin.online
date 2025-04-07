/**
 * Модуль для сбора и экспорта метрик
 */

// Простая реализация метрик для серверного и клиентского использования
// В продакшене можно заменить на полноценную интеграцию с Prometheus/Datadog/etc.

interface Counter {
  value: number;
  labels: Record<string, any>;
  lastUpdated: Date;
}

interface Histogram {
  values: number[];
  count: number;
  sum: number;
  min: number;
  max: number;
  labels: Record<string, any>;
  lastUpdated: Date;
}

interface Gauge {
  value: number;
  labels: Record<string, any>;
  lastUpdated: Date;
}

// Типы параметров метрик
interface SaveCounterParams {
  reason?: string;
  concurrent?: boolean;
  duplicate?: boolean;
  userId?: string;
  throttled?: boolean;
}

interface LoadCounterParams {
  reason?: string;
}

interface SaveErrorParams {
  reason: string;
  userId?: string;
}

interface LoadErrorParams {
  reason: string;
  userId?: string;
}

interface SaveDurationParams {
  total?: boolean;
  db_save?: boolean;
  redis_save?: boolean;
  critical?: boolean;
  meaningful_changes?: boolean;
  merged?: boolean;
  reason?: string;
  concurrent?: boolean;
  source?: string;
  batched?: boolean;
  batch_size?: number;
}

interface LoadDurationParams {
  source?: string;
  cache_hit?: boolean;
  compressed?: boolean;
  db_error?: boolean;
  new_user?: boolean;
  error?: boolean;
}

class Metrics {
  private counters: Record<string, Counter> = {};
  private histograms: Record<string, Histogram> = {};
  private gauges: Record<string, Gauge> = {};

  /**
   * Инкрементирует счетчик с указанным именем и метками
   */
  incrementCounter(name: string, increment = 1, labels: Record<string, any> = {}): void {
    const key = this.formatKey(name, labels);
    
    if (!this.counters[key]) {
      this.counters[key] = {
        value: 0,
        labels,
        lastUpdated: new Date()
      };
    }
    
    this.counters[key].value += increment;
    this.counters[key].lastUpdated = new Date();
  }
  
  /**
   * Записывает значение в гистограмму
   */
  observeHistogram(name: string, value: number, labels: Record<string, any> = {}): void {
    const key = this.formatKey(name, labels);
    
    if (!this.histograms[key]) {
      this.histograms[key] = {
        values: [],
        count: 0,
        sum: 0,
        min: value,
        max: value,
        labels,
        lastUpdated: new Date()
      };
    }
    
    const histogram = this.histograms[key];
    histogram.values.push(value);
    histogram.count += 1;
    histogram.sum += value;
    histogram.min = Math.min(histogram.min, value);
    histogram.max = Math.max(histogram.max, value);
    histogram.lastUpdated = new Date();
    
    // Ограничиваем размер массива значений
    if (histogram.values.length > 1000) {
      histogram.values = histogram.values.slice(-1000);
    }
  }
  
  /**
   * Устанавливает значение метрики типа Gauge
   */
  setGauge(name: string, value: number, labels: Record<string, any> = {}): void {
    const key = this.formatKey(name, labels);
    
    this.gauges[key] = {
      value,
      labels,
      lastUpdated: new Date()
    };
  }
  
  /**
   * Получает значение счетчика
   */
  getCounter(name: string, labels: Record<string, any> = {}): number {
    const key = this.formatKey(name, labels);
    return this.counters[key]?.value || 0;
  }
  
  /**
   * Получает статистику гистограммы
   */
  getHistogram(name: string, labels: Record<string, any> = {}): {
    count: number;
    sum: number;
    avg?: number | undefined;
    min?: number | undefined;
    max?: number | undefined;
  } {
    const key = this.formatKey(name, labels);
    const histogram = this.histograms[key];
    
    if (!histogram) {
      return { count: 0, sum: 0 };
    }
    
    return {
      count: histogram.count,
      sum: histogram.sum,
      avg: histogram.count > 0 ? histogram.sum / histogram.count : undefined,
      min: histogram.min,
      max: histogram.max
    };
  }
  
  /**
   * Получает значение метрики типа Gauge
   */
  getGauge(name: string, labels: Record<string, any> = {}): number {
    const key = this.formatKey(name, labels);
    return this.gauges[key]?.value || 0;
  }
  
  /**
   * Форматирует ключ для хранения метрики
   */
  private formatKey(name: string, labels: Record<string, any>): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}:${v}`)
      .sort()
      .join(',');
    
    return labelStr ? `${name}{${labelStr}}` : name;
  }
  
  /**
   * Возвращает все метрики в формате JSON
   */
  getMetrics(): Record<string, any> {
    return {
      counters: this.counters,
      histograms: this.histograms,
      gauges: this.gauges
    };
  }
  
  /**
   * Создает таймер для измерения длительности операций
   */
  startTimer(name: string, labels: Record<string, any> = {}): () => number {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.observeHistogram(name, duration, labels);
      return duration;
    };
  }
  
  /**
   * Измеряет время выполнения асинхронной функции
   */
  async measureAsyncFn<T>(
    name: string,
    fn: () => Promise<T>,
    labels: Record<string, any> = {}
  ): Promise<T> {
    const endTimer = this.startTimer(name, labels);
    
    try {
      const result = await fn();
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      // Добавляем метку ошибки
      this.incrementCounter(`${name}_errors`, 1, {
        ...labels,
        error: error instanceof Error ? error.message : 'unknown'
      });
      throw error;
    }
  }
  
  /**
   * Сбрасывает все метрики
   */
  reset(): void {
    this.counters = {};
    this.histograms = {};
    this.gauges = {};
  }
}

// Создаем и экспортируем экземпляр метрик
const metrics = new Metrics();

// Предварительно созданные метрики для сохранения/загрузки игры
export const gameMetrics = {
  // Счетчики
  saveTotalCounter: (labels = {}) => metrics.incrementCounter('game_save_total', 1, labels),
  saveErrorCounter: (labels = {}) => metrics.incrementCounter('game_save_errors', 1, labels),
  loadTotalCounter: (labels = {}) => metrics.incrementCounter('game_load_total', 1, labels),
  loadErrorCounter: (labels = {}) => metrics.incrementCounter('game_load_errors', 1, labels),
  versionConflictCounter: (labels = {}) => metrics.incrementCounter('game_version_conflicts', 1, labels),
  
  // Гистограммы
  saveDuration: (duration: number, labels = {}) => metrics.observeHistogram('game_save_duration_ms', duration, labels),
  loadDuration: (duration: number, labels = {}) => metrics.observeHistogram('game_load_duration_ms', duration, labels),
  
  // Измерители времени
  startSaveTimer: (labels = {}) => metrics.startTimer('game_save_duration_ms', labels),
  startLoadTimer: (labels = {}) => metrics.startTimer('game_load_duration_ms', labels),
  
  // Асинхронные измерители
  measureSave: <T>(fn: () => Promise<T>, labels = {}) => 
    metrics.measureAsyncFn('game_save_duration_ms', fn, labels),
  
  measureLoad: <T>(fn: () => Promise<T>, labels = {}) =>
    metrics.measureAsyncFn('game_load_duration_ms', fn, labels)
};

// Предварительно созданные метрики для фоновой синхронизации
export const syncMetrics = {
  taskScheduledCounter: (labels = {}) => metrics.incrementCounter('sync_tasks_scheduled', 1, labels),
  taskCompletedCounter: (labels = {}) => metrics.incrementCounter('sync_tasks_completed', 1, labels),
  taskFailedCounter: (labels = {}) => metrics.incrementCounter('sync_tasks_failed', 1, labels),
  
  // Измерители времени
  measureSyncTask: <T>(type: string, fn: () => Promise<T>, labels = {}) =>
    metrics.measureAsyncFn('sync_task_duration_ms', fn, { type, ...labels })
};

// По умолчанию экспортируем основной экземпляр метрик
export default metrics; 