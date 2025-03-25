import type React from "react"
import { Button } from "./button"
import { RefreshCw, Home } from "lucide-react"

interface ErrorDisplayProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  onHome?: () => void;
  variant?: "default" | "game";
  fullScreen?: boolean;
  homeText?: string;
  retryText?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  message,
  title,
  onRetry,
  onHome,
  variant = "default",
  fullScreen = false,
  homeText = "Вернуться на главную",
  retryText = "Try Again"
}) => {
  const isGame = variant === "game";
  
  const containerClasses = fullScreen
    ? "fixed inset-0 flex items-center justify-center"
    : "flex flex-col items-center justify-center h-full w-full";
    
  const bgClasses = isGame
    ? "bg-black/90"
    : "bg-gray-900 bg-opacity-75";
    
  const cardClasses = isGame
    ? "text-red-500 text-center max-w-md p-6 bg-black/80 rounded-lg border border-red-800"
    : "text-white text-center max-w-md p-6 rounded-lg";
    
  const buttonClasses = isGame
    ? "mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded transition-colors flex items-center gap-2"
    : "px-4 py-2 bg-blue-500 hover:bg-blue-600 transition-colors flex items-center gap-2";

  const handleHomeClick = () => {
    if (onHome) {
      onHome();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className={`${containerClasses} ${bgClasses} text-white p-4`}>
      <div className={cardClasses}>
        {title && <div className="text-xl font-bold mb-2">{title}</div>}
        <p className="text-xl mb-6 text-center">{message}</p>
        
        <div className="flex flex-wrap justify-center gap-4">
          {onRetry && (
            <Button
              onClick={onRetry}
              className={buttonClasses}
            >
              <RefreshCw className="w-4 h-4" />
              {retryText}
            </Button>
          )}
          
          {(isGame || onHome) && (
            <Button
              onClick={handleHomeClick}
              className={buttonClasses}
            >
              <Home className="w-4 h-4" />
              {homeText}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ErrorDisplay

