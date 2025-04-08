"use client";

import { useEffect } from 'react';
import audioService from '../../app/services/audioService';

/**
 * Компонент для управления аудио в приложении.
 * Инициализирует и управляет фоновой музыкой и звуковыми эффектами.
 */
const AudioController: React.FC = () => {
  useEffect(() => {
    // Запускаем фоновую музыку после первого взаимодействия пользователя
    const handleUserInteraction = () => {
      audioService.playBackgroundMusic();
      
      // Удаляем слушатели событий после первого взаимодействия
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
    
    // Добавляем слушатели событий для запуска музыки после взаимодействия
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    
    return () => {
      // Очищаем слушатели при размонтировании компонента
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);
  
  // Компонент не отображает никакой UI
  return null;
};

export default AudioController; 