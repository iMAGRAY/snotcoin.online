'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Message {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}

interface GameStatusTickerProps {
  className?: string;
}

/**
 * Компонент для отображения системных сообщений в игре
 */
export default function GameStatusTicker({ className = '' }: GameStatusTickerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const MAX_MESSAGES = 5;
  const MESSAGE_LIFETIME = 5000; // 5 секунд
  
  // Добавление нового сообщения
  const addMessage = (text: string, type: 'success' | 'error' | 'info') => {
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text,
      type,
      timestamp: Date.now()
    };
    
    // Обновляем сообщения, сохраняя только последние MAX_MESSAGES
    const updatedMessages = [...messagesRef.current, newMessage].slice(-MAX_MESSAGES);
    messagesRef.current = updatedMessages;
    setMessages(updatedMessages);
    
    // Запускаем удаление сообщения по таймеру
    setTimeout(() => {
      removeMessage(newMessage.id);
    }, MESSAGE_LIFETIME);
  };
  
  // Удаление сообщения по ID
  const removeMessage = (id: string) => {
    const updatedMessages = messagesRef.current.filter(msg => msg.id !== id);
    messagesRef.current = updatedMessages;
    setMessages(updatedMessages);
  };
  
  // Слушаем события игры
  useEffect(() => {
    // Функция для обработки событий игры
    const handleGameEvent = (event: CustomEvent) => {
      const eventData = event.detail;
      
      switch (eventData.type) {
        case 'game_save_start':
          addMessage('Сохранение игры...', 'info');
          break;
        case 'game_save_success':
          addMessage('Игра успешно сохранена', 'success');
          break;
        case 'game_save_error':
          addMessage(`Ошибка сохранения: ${eventData.message || 'Неизвестная ошибка'}`, 'error');
          break;
        case 'game_sync_start':
          addMessage('Синхронизация с сервером...', 'info');
          break;
        case 'game_sync_success':
          addMessage('Синхронизация завершена', 'success');
          break;
        case 'game_sync_error':
          addMessage(`Ошибка синхронизации: ${eventData.message || 'Проверьте соединение'}`, 'error');
          break;
        case 'achievement_unlocked':
          addMessage(`🏆 Достижение разблокировано: ${eventData.name}`, 'success');
          break;
        default:
          if (eventData.message) {
            addMessage(eventData.message, eventData.messageType || 'info');
          }
      }
    };
    
    // Регистрируем обработчик событий
    window.addEventListener('game_event', handleGameEvent as EventListener);
    
    // При первой загрузке показываем информационное сообщение
    const savedState = localStorage.getItem('snotcoin_game_state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        const lastModified = state._lastModified;
        
        if (lastModified) {
          const date = new Date(lastModified);
          addMessage(`Последнее сохранение: ${date.toLocaleString()}`, 'info');
        }
      } catch (e) {
        console.error('Ошибка при чтении сохраненного состояния:', e);
      }
    }
    
    // Очищаем обработчик при размонтировании
    return () => {
      window.removeEventListener('game_event', handleGameEvent as EventListener);
    };
  }, []);
  
  // Если нет сообщений, ничего не рендерим
  if (messages.length === 0) {
    return null;
  }
  
  return (
    <div className={`game-status-ticker fixed left-1/2 transform -translate-x-1/2 z-50 ${className}`} style={{ top: '20px' }}>
      <AnimatePresence mode="popLayout">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className={`py-2 px-4 rounded-full shadow-lg text-sm font-medium mb-2 mx-auto max-w-md text-center ${
              message.type === 'success' ? 'bg-green-600 text-white' :
              message.type === 'error' ? 'bg-red-600 text-white' :
              'bg-blue-600 text-white'
            }`}
            onClick={() => removeMessage(message.id)}
          >
            {message.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
} 