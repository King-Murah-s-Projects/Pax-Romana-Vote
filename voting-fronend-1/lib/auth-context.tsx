'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, votingApi, handleApiError, User } from '@/lib/api-config'

export type UserRole = "SUPER_ADMIN" | "EC_MEMBER" | "VOTER"

interface AuthContextType {
  user: User | null
  // Admin/Email-based authentication
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  loginWithCode: (email: string, verificationCode: string) => Promise<{ success: boolean; user?: User; message?: string }>
  sendVerificationCode: (email: string, name?: string) => Promise<{ success: boolean; message?: string }>
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message?: string }>
  resetPassword: (email: string, resetToken: string, newPassword: string) => Promise<{ success: boolean; message?: string }>

  // Voter OTP-based authentication
  generateOTP: (phoneNumber: string, name: string, email: string) => Promise<{ success: boolean; requiresOTP?: boolean; message?: string }>
  verifyOTP: (otp: string) => Promise<{ success: boolean; user?: User; message?: string }>

  // Common methods
  logout: () => Promise<void>
  refreshToken: () => Promise<{ success: boolean; message?: string }>

  // State
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingAuth, setPendingAuth] = useState<{
    phoneNumber: string
    name: string
    email: string
  } | null>(null)

  useEffect(() => {
    // Check for existing session on mount
    const storedUser = localStorage.getItem('imcs-pax-romana-user')
    const storedToken = localStorage.getItem('imcs-pax-romana-token')

    if (storedUser && storedToken) {
      try {
        const userData = JSON.parse(storedUser)
        setUser(userData)
        // Optionally verify token validity
        verifyTokenValidity()
      } catch (error) {
        console.error('Error parsing stored user data:', error)
        clearStoredAuth()
      }
    }
    setIsLoading(false)
  }, [])

  const clearStoredAuth = () => {
    localStorage.removeItem('imcs-pax-romana-user')
    localStorage.removeItem('imcs-pax-romana-token')
    localStorage.removeItem('imcs-pax-romana-refresh-token')
    setUser(null)
    setPendingAuth(null)
  }

  const verifyTokenValidity = async () => {
    try {
      const profile = await authApi.getProfile()
      setUser(profile)
    } catch (error) {
      console.error('Token validation failed:', error)
      clearStoredAuth()
    }
  }

  // Admin/Email-based authentication methods
  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await authApi.adminLogin(email, password)

      setUser(response.user)
      localStorage.setItem('imcs-pax-romana-user', JSON.stringify(response.user))
      localStorage.setItem('imcs-pax-romana-token', response.access_token)
      localStorage.setItem('imcs-pax-romana-refresh-token', response.refresh_token)

      return { success: true, message: 'Login successful' }
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      return { success: false, message: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithCode = async (email: string, verificationCode: string): Promise<{ success: boolean; user?: User; message?: string }> => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await authApi.verifyEmailAndLogin(email, verificationCode)

      setUser(response.user)
      localStorage.setItem('imcs-pax-romana-user', JSON.stringify(response.user))
      localStorage.setItem('imcs-pax-romana-token', response.access_token)
      localStorage.setItem('imcs-pax-romana-refresh-token', response.refresh_token)

      return { success: true, user: response.user, message: 'Login successful' }
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      return { success: false, message: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }

  const sendVerificationCode = async (email: string, name?: string): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null)
      const response = await authApi.sendVerificationCode(email, name)
      return { success: true, message: response.message || 'Verification code sent successfully' }
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      return { success: false, message: errorMessage }
    }
  }

  const requestPasswordReset = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null)
      await authApi.requestPasswordReset(email)
      return { success: true, message: 'Password reset email sent' }
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      return { success: false, message: errorMessage }
    }
  }

  const resetPassword = async (email: string, resetToken: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
    try {
      setError(null)
      await authApi.resetPassword(email, resetToken, newPassword)
      return { success: true, message: 'Password reset successful' }
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      return { success: false, message: errorMessage }
    }
  }

  // Voter OTP-based authentication methods
  const generateOTP = async (phoneNumber: string, name: string, email: string): Promise<{ success: boolean; requiresOTP?: boolean; message?: string }> => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await votingApi.generateOtp({
        phoneNumber,
        name,
        email
      })

      if (response.success) {
        setPendingAuth({ phoneNumber, name, email })
        return {
          success: true,
          requiresOTP: true,
          message: response.message || 'OTP sent successfully'
        }
      } else {
        return { success: false, message: response.message || 'Failed to send OTP' }
      }
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      return { success: false, message: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }

  const verifyOTP = async (otp: string): Promise<{ success: boolean; user?: User; message?: string }> => {
    if (!pendingAuth) {
      return { success: false, message: 'No pending authentication' }
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await votingApi.verifyOtp({
        phoneNumber: pendingAuth.phoneNumber,
        otp,
        email: pendingAuth.email
      })

      if (response.success && response.user && response.token) {
        const userData: User = {
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          role: 'VOTER' as UserRole,
          emailVerified: true,
          isActive: true,
          phoneNumber: pendingAuth.phoneNumber,
          sessionId: response.sessionId,
          token: response.token
        }

        setUser(userData)
        localStorage.setItem('imcs-pax-romana-user', JSON.stringify(userData))
        localStorage.setItem('imcs-pax-romana-token', response.token)
        setPendingAuth(null)

        return { success: true, user: userData, message: 'Authentication successful' }
      } else {
        return { success: false, message: response.message || 'OTP verification failed' }
      }
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      return { success: false, message: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }

  // Common methods
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true)
      // Call logout endpoint to invalidate token on server
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
      // Continue with client-side cleanup even if server call fails
    } finally {
      clearStoredAuth()
      // Remove voted status for current user
      if (user?.id) {
        localStorage.removeItem(`imcs-pax-romana-voted-${user.id}`)
      }
      setIsLoading(false)
    }
  }

  const refreshToken = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const storedRefreshToken = localStorage.getItem('imcs-pax-romana-refresh-token')
      if (!storedRefreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await authApi.refreshToken(storedRefreshToken)
      localStorage.setItem('imcs-pax-romana-token', response.access_token)
      return { success: true, message: 'Token refreshed successfully' }
    } catch (error) {
      console.error('Token refresh failed:', error)
      clearStoredAuth()
      return { success: false, message: handleApiError(error) }
    }
  }

  const clearError = () => {
    setError(null)
  }

  const value: AuthContextType = {
    user,
    login,
    loginWithCode,
    sendVerificationCode,
    requestPasswordReset,
    resetPassword,
    generateOTP,
    verifyOTP,
    logout,
    refreshToken,
    isAuthenticated: !!user,
    isLoading,
    error,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}