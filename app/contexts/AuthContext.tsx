import type React from "react"
import { createContext, useContext, useState, useCallback } from "react"
import { saveUserToLocalStorage, clearLocalStorage } from "../utils/localStorage"

interface AuthContextType {
  user: any | null
  login: (userData: any) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null)

  const login = useCallback((userData: any) => {
    setUser(userData)
    saveUserToLocalStorage(userData)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    clearLocalStorage()
  }, [])

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

