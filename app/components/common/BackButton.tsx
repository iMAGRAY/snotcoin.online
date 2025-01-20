import React from 'react';
import { Button } from "../ui/button"
import { Pause } from 'lucide-react';

interface BackButtonProps {
  onClick: () => void;
}

const BackButton: React.FC<BackButtonProps> = ({ onClick }) => {
  return (
    <Button
      variant="outline"
      size="icon"
      className="absolute top-4 left-4 z-40 bg-black/50 hover:bg-black/70 text-white border-white/20"
      onClick={onClick}
    >
      <Pause className="h-4 w-4" />
      <span className="sr-only">Pause</span>
    </Button>
  );
};

export default BackButton;

