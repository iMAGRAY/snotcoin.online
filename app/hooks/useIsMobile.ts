'use client';

import { useState, useEffect } from 'react';

/**
 * Хук для определения мобильного устройства
 * @param breakpoint - точка перехода в пикселях (по умолчанию 768px)
 * @returns {boolean} - true если экран меньше или равен breakpoint
 */
export const useIsMobile = (breakpoint = 768): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    // Проверка при первом рендере
    checkMobile();

    // Добавляем обработчик изменения размера окна
    window.addEventListener('resize', checkMobile);

    // Очищаем обработчик при размонтировании компонента
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [breakpoint]);

  return isMobile;
}; 