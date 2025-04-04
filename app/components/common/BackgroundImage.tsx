'use client';

import React from 'react';
import Image from 'next/image';

interface BackgroundImageProps {
  src: string;
  alt?: string;
  priority?: boolean;
  className?: string;
}

/**
 * Компонент для отображения фоновых изображений
 */
const BackgroundImage: React.FC<BackgroundImageProps> = ({
  src,
  alt = 'Background Image',
  priority = false,
  className = '',
}) => {
  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden -z-10 ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        quality={80}
        sizes="100vw"
        className="object-cover"
      />
    </div>
  );
};

export default BackgroundImage; 