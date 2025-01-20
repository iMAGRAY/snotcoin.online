import React from 'react';
import { Button } from "./button";
import { RefreshCw } from 'lucide-react';

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-gray-900 bg-opacity-75 text-white p-4">
      <p className="text-xl mb-6 text-center">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      )}
    </div>
  );
};

export default ErrorDisplay;

