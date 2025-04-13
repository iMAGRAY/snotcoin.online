"use client"

import React, { useState } from 'react';
import { TouchButtonProps } from '../utils/types';

const TouchButton = ({
  onClick, 
  className, 
  disabled = false, 
  title, 
  children
}: TouchButtonProps) => {
  const [isPressed, setIsPressed] = useState(false);
  
  const handleTouchStart = (e: any) => {
    if (disabled) return;
    e.preventDefault();
    setIsPressed(true);
  };
  
  const handleTouchMove = (e: any) => {
    if (disabled) return;
    e.preventDefault();
  };
  
  const handleTouchEnd = (e: any) => {
    if (disabled) return;
    e.preventDefault();
    if (isPressed) {
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

export default TouchButton; 