import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export type FeedbackPosition = "top" | "bottom" | "center";
export type FeedbackType = "info" | "success" | "warning" | "error";

interface FeedbackMessageProps {
  message: string | null;
  position?: FeedbackPosition;
  type?: FeedbackType;
  duration?: number;
  className?: string;
  isVisible?: boolean;
}

const FeedbackMessage: React.FC<FeedbackMessageProps> = ({
  message,
  position = "bottom",
  type = "info",
  className,
  isVisible = true,
}) => {
  if (!message || !isVisible) return null;
  
  const positionClasses = {
    top: "top-4 left-0 right-0",
    center: "top-1/2 left-0 right-0 -translate-y-1/2",
    bottom: "bottom-20 left-0 right-0"
  };
  
  const typeClasses = {
    info: "bg-black/80 text-white",
    success: "bg-green-600/80 text-white",
    warning: "bg-amber-500/80 text-white",
    error: "bg-red-600/80 text-white"
  };
  
  return (
    <motion.div 
      className={cn(
        "absolute z-[1001] flex justify-center", 
        positionClasses[position],
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium shadow-lg", 
        typeClasses[type]
      )}>
        {message}
      </div>
    </motion.div>
  );
};

export default FeedbackMessage; 