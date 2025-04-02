'use client';

import React, { useState } from 'react';

/**
 * Простой компонент DevTools, заменяющий старый с проблемами кодировки
 */
const DevTools: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 10, y: 10 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Обработчики для перемещения окна
  const startDrag = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Обработчик перемещения
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Обработчик клавиш
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) {
    return (
      <div className="fixed top-16 right-4 z-[9999]">
        <button 
          onClick={() => setIsOpen(true)} 
          className="bg-green-500 text-white p-2 rounded-md shadow-lg hover:bg-green-600 transition-colors text-xs"
        >
          Activate Dev Mode (Ctrl+A)
        </button>
      </div>
    );
  }

  return (
    <div 
      className="fixed z-[9999] bg-gray-900 rounded-lg shadow-xl border border-gray-700 text-white resize-both overflow-auto"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        minWidth: '300px',
        minHeight: '200px',
        maxWidth: '90vw',
        maxHeight: '80vh'
      }}
    >
      <div 
        className="p-2 flex justify-between items-center cursor-move bg-gray-800 rounded-t-lg border-b border-gray-700"
        onMouseDown={startDrag}
      >
        <h3 className="text-sm font-medium">Dev Mode</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="p-4">
        <p className="text-sm mb-2">Инструменты разработчика</p>
        <div className="flex space-x-2 mt-4">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded text-sm"
          >
            Перезагрузить страницу
          </button>
        </div>
      </div>
    </div>
  );
};

export default DevTools; 