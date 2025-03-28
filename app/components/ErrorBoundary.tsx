"use client"

import React from "react"
import { motion } from "framer-motion"

export const ErrorDisplay: React.FC<{ message: string; error?: Error | null; onRetry?: () => void }> = ({
  message,
  error,
  onRetry,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="flex flex-col items-center justify-center w-full h-full text-red-500 bg-gray-900 p-4 text-center"
  >
    <p className="text-xl font-bold mb-4">{message}</p>
    {error && (
      <div className="mt-4 text-sm text-gray-400 max-w-md">
        <p className="font-semibold">Error details:</p>
        <p>Name: {error.name || "Unknown"}</p>
        <p>Message: {error.message || "No message available"}</p>
        {error.stack ? (
          <details>
            <summary className="cursor-pointer mt-2 text-blue-400 hover:text-blue-300">Stack trace</summary>
            <pre className="text-left whitespace-pre-wrap mt-2 bg-gray-800 p-2 rounded overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        ) : (
          <p>No stack trace available</p>
        )}
      </div>
    )}
    {onRetry && (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        onClick={onRetry}
      >
        Retry
      </motion.button>
    )}
  </motion.div>
)

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Ошибка поймана и обрабатывается отображением fallback
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <ErrorDisplay
            message="An unexpected error occurred"
            error={this.state.error}
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        )
      )
    }

    return this.props.children
  }
}

