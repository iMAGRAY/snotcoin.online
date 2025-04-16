"use client";

import { useEffect } from "react";

/**
 * Компонент для защиты изображений от сохранения и перетаскивания
 * Добавляет обработчики событий на страницу
 */
const ImageProtection = () => {
  useEffect(() => {
    // Функция проверки, является ли элемент или его родители частью игры
    const isGameElement = (element: HTMLElement | null): boolean => {
      if (!element) return false;
      
      // Проверяем текущий элемент
      if (element.tagName.toLowerCase() === 'canvas') return true;
      if (element.hasAttribute('data-game')) return true;
      
      // Проверяем классы элемента на наличие слова 'game'
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.toLowerCase();
        if (classes.includes('game')) return true;
      }
      
      // Проверяем id элемента
      if (element.id && element.id.toLowerCase().includes('game')) return true;
      
      // Проверяем родительские элементы рекурсивно (до 5 уровней вверх)
      let parent = element.parentElement;
      let depth = 0;
      const maxDepth = 5;
      
      while (parent && depth < maxDepth) {
        if (parent.tagName.toLowerCase() === 'canvas') return true;
        if (parent.hasAttribute('data-game')) return true;
        
        if (parent.className && typeof parent.className === 'string') {
          const classes = parent.className.toLowerCase();
          if (classes.includes('game')) return true;
        }
        
        if (parent.id && parent.id.toLowerCase().includes('game')) return true;
        
        parent = parent.parentElement;
        depth++;
      }
      
      return false;
    };
    
    // Отключаем контекстное меню, но не для игровых элементов
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Разрешаем контекстное меню для игровых элементов
      if (isGameElement(target)) {
        return true;
      }
      
      e.preventDefault();
      return false;
    };
    
    // Отключаем перетаскивание изображений, но не для игровых элементов
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      
      // Разрешаем перетаскивание для игровых элементов
      if (isGameElement(target)) {
        return true;
      }
      
      e.preventDefault();
      return false;
    };
    
    // Отключаем комбинации клавиш для сохранения (Ctrl+S)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Блокируем Ctrl+S, Ctrl+U, F12
      if (
        (e.ctrlKey && (e.key === "s" || e.key === "S" || e.key === "u" || e.key === "U")) ||
        e.key === "F12"
      ) {
        e.preventDefault();
        return false;
      }
    };
    
    // Отключаем выделение текста
    const disableSelection = () => {
      document.documentElement.style.webkitUserSelect = "none";
      document.documentElement.style.msUserSelect = "none";
      document.documentElement.style.userSelect = "none";
    };

    // Добавляем обработчики событий
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("dragstart", handleDragStart);
    window.addEventListener("keydown", handleKeyDown);
    disableSelection();

    // Дополнительное отключение перетаскивания для всех изображений, кроме игровых
    const images = document.getElementsByTagName("img");
    for (let i = 0; i < images.length; i++) {
      if (!isGameElement(images[i])) {
        images[i].setAttribute("draggable", "false");
      }
    }

    // Очистка при размонтировании компонента
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("dragstart", handleDragStart);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null; // Этот компонент не рендерит никакой UI
};

export default ImageProtection; 