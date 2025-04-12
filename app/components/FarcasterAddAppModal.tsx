'use client';

import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { sdk } from '@farcaster/frame-sdk';

interface FarcasterAddAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName?: string;
  appDescription?: string;
}

/**
 * Модальное окно для предложения добавить приложение в избранное Farcaster
 */
const FarcasterAddAppModal: React.FC<FarcasterAddAppModalProps> = ({
  isOpen,
  onClose,
  appName = 'Snotcoin',
  appDescription = 'PLAY 2 SNOT - Merge, earn and progress in this addictive Farcaster game'
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [addResult, setAddResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  // Обработчик добавления приложения в избранное
  const handleAddApp = useCallback(async () => {
    if (!sdk?.actions?.addFrame) {
      setAddResult({
        success: false,
        message: 'Farcaster SDK не доступен'
      });
      return;
    }

    try {
      setIsAdding(true);
      setAddResult(null);

      const result = await sdk.actions.addFrame();
      
      if (result && 'added' in result && result.added === true) {
        setAddResult({
          success: true,
          message: 'Приложение успешно добавлено!'
        });
        
        // Автоматически закрываем окно после успешного добавления
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        const reason = result && 'reason' in result ? result.reason : 'unknown';
        setAddResult({
          success: false,
          message: `Не удалось добавить приложение: ${reason}`
        });
      }
    } catch (error) {
      console.error('[FarcasterAddAppModal] Ошибка при добавлении приложения:', error);
      setAddResult({
        success: false,
        message: 'Произошла ошибка при добавлении'
      });
    } finally {
      setIsAdding(false);
    }
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 text-white border-gray-700 max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            Добавить {appName} в избранное
          </DialogTitle>
          <DialogDescription className="text-center text-gray-300">
            {appDescription}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center mt-4">
          <div className="w-16 h-16 bg-indigo-600 rounded-full mb-4 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          
          <p className="text-sm text-gray-400 mb-4 text-center">
            Добавьте приложение в избранное, чтобы получать уведомления и быстрый доступ к игре
          </p>
          
          {addResult && (
            <div className={`mb-4 p-2 rounded text-center ${
              addResult.success ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'
            }`}>
              {addResult.message}
            </div>
          )}
          
          <div className="flex space-x-4 w-full justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              disabled={isAdding}
            >
              Позже
            </button>
            
            <button
              onClick={handleAddApp}
              disabled={isAdding}
              className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center ${
                isAdding ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isAdding ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Добавление...
                </>
              ) : (
                'Добавить'
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FarcasterAddAppModal; 