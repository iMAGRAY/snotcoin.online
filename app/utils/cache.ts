"use client"

import { useState, useEffect } from "react"

// Глобальное хранилище для данных в рамках сессии
const sessionStateStore: Record<string, any> = {};

export function useSessionState<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue
    }
    try {
      return sessionStateStore[key] ?? initialValue;
    } catch (error) {
      return initialValue
    }
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStateStore[key] = storedValue;
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue]
}

