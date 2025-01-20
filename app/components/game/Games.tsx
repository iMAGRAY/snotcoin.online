'use client'

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function Games() {
  return (
    <div className="h-full w-full relative overflow-hidden">
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: "url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Development-zhzzoE2fzADZ3E0lxh9vOGNqYhmrdy.webp')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}

