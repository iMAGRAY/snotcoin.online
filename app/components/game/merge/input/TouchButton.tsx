"use client"

import React, { useState } from "react";
import { TouchButtonProps } from "../utils/types";

export const TouchButton: React.FC<TouchButtonProps> = ({ 
  onClick, 
  className = "", 
  disabled = false, 
  title = "",
  children 
}) => {
  const [isPressed, setIsPressed] = useState(false);
  
  const handleTouchStart = () => {
    if (!disabled) {
      setIsPressed(true);
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    // Логика для определения, покинул ли палец область кнопки
    const touch = e.touches[0];
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    const isOutside = 
      touch.clientX < rect.left || 
      touch.clientX > rect.right || 
      touch.clientY < rect.top || 
      touch.clientY > rect.bottom;
    
    if (isOutside && !disabled) {
      setIsPressed(false);
    } else if (!isOutside && !isPressed && !disabled) {
      setIsPressed(true);
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPressed && !disabled) {
      // Предотвращаем клик после скролла, устанавливая порог перемещения
      onClick();
    }
    setIsPressed(false);
  };
  
  const handleTouchCancel = () => {
    setIsPressed(false);
  };
  
  const pressedClass = isPressed ? "transform scale-95 opacity-90" : "";
  
  return (
    <button
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      disabled={disabled}
      className={`${className} ${pressedClass}`}
      title={title}
    >
      {children}
    </button>
  );
}; 