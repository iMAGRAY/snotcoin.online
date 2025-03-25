/**
 * Компонент для отображения ошибок аутентификации через Telegram
 */
import React from 'react';

/**
 * Параметры компонента ошибки аутентификации
 */
interface TelegramAuthErrorProps {
  errorMessage?: string;
  onRetry: () => void;
  onOpenInTelegram: () => void;
  onClose: () => void;
  attemptCount?: number;
}

const TelegramAuthError: React.FC<TelegramAuthErrorProps> = ({
  errorMessage,
  onRetry,
  onOpenInTelegram,
  onClose,
  attemptCount = 0
}) => {
  // Определяем сообщение в зависимости от количества попыток
  const getErrorMessage = () => {
    if (!errorMessage) {
      return 'Не удалось выполнить авторизацию через Telegram. Пожалуйста, попробуйте еще раз.';
    }
    
    // Если много попыток, предлагаем альтернативные действия
    if (attemptCount >= 3) {
      return `${errorMessage}\n\nПопробуйте открыть ссылку в приложении Telegram или перезагрузить страницу.`;
    }
    
    return errorMessage;
  };
  
  return (
    <div className="auth-error-container">
      <div className="auth-error-card">
        <div className="auth-error-header">
          <h2>Ошибка авторизации</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        
        <div className="auth-error-content">
          <div className="error-icon">❌</div>
          
          <p className="error-message">
            {getErrorMessage()}
          </p>
          
          {attemptCount >= 3 && (
            <p className="error-tip">
              Возможно, в вашем клиенте Telegram отключен доступ к WebApp. Проверьте настройки или используйте другой способ входа.
            </p>
          )}
          
          <div className="error-actions">
            <button 
              className="retry-button"
              onClick={onRetry}
            >
              Повторить попытку
            </button>
            
            <button 
              className="open-telegram-button"
              onClick={onOpenInTelegram}
            >
              Открыть в Telegram
            </button>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .auth-error-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 1000;
        }
        
        .auth-error-card {
          background-color: white;
          border-radius: 12px;
          width: 90%;
          max-width: 420px;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }
        
        .auth-error-header {
          padding: 16px 20px;
          background-color: #f2f2f2;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .auth-error-header h2 {
          margin: 0;
          font-size: 18px;
          color: #333;
        }
        
        .close-button {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
        }
        
        .auth-error-content {
          padding: 24px;
          text-align: center;
        }
        
        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .error-message {
          color: #444;
          margin-bottom: 16px;
          line-height: 1.5;
          white-space: pre-line;
        }
        
        .error-tip {
          color: #888;
          font-size: 14px;
          margin-bottom: 20px;
          padding: 10px;
          background-color: #f7f7f7;
          border-radius: 8px;
          line-height: 1.4;
        }
        
        .error-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .retry-button, .open-telegram-button {
          padding: 12px 0;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }
        
        .retry-button {
          background-color: #5288c1;
          color: white;
          border: none;
        }
        
        .open-telegram-button {
          background-color: white;
          color: #5288c1;
          border: 1px solid #5288c1;
        }
        
        .retry-button:hover {
          background-color: #4778b1;
        }
        
        .open-telegram-button:hover {
          background-color: #f5f9ff;
        }
      `}</style>
    </div>
  );
};

export default TelegramAuthError; 