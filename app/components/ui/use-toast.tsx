import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Типы для тостов
export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning';
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (props: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

// Создаем контекст для тостов
const ToastContext = createContext<ToastContextValue | null>(null);

// Хук для использования тостов
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast должен использоваться внутри ToastProvider');
  }
  return context;
}

// Компонент для отображения тоста
const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const { title, description, variant = 'default' } = toast;
  
  return (
    <div 
      className={`toast toast-${variant}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="toast-content">
        {title && <div className="toast-title">{title}</div>}
        {description && <div className="toast-description">{description}</div>}
      </div>
      <button 
        onClick={onDismiss} 
        className="toast-close"
        aria-label="Закрыть"
      >
        &times;
      </button>
    </div>
  );
};

// Провайдер для тостов
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Функция для создания тоста
  const toast = useCallback((props: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, ...props };
    
    setToasts((prev) => [...prev, newToast]);
    
    // Автоматически удаляем тост через указанное время
    if (props.duration !== 0) {
      setTimeout(() => {
        dismiss(id);
      }, props.duration || 5000);
    }
    
    return id;
  }, []);
  
  // Функция для удаления тоста
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);
  
  // Функция для удаления всех тостов
  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);
  
  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, dismissAll }}>
      {children}
      
      {/* Рендерим все тосты */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <ToastItem
              key={t.id}
              toast={t}
              onDismiss={() => dismiss(t.id)}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}; 