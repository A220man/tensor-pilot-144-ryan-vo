import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { api } from '../api/client'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (token: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      login: async (token: string) => {
        set({ isLoading: true, error: null })
        try {
          api.setToken(token)
          const user = await api.validateToken(token)
          set({ user, isAuthenticated: true, isLoading: false, error: null })
        } catch (error) {
          api.clearToken()
          set({ user: null, isAuthenticated: false, isLoading: false, error: 'Invalid token' })
          throw error
        }
      },

      logout: async () => {
        set({ isLoading: true })
        try {
          await api.logout()
        } catch {
          // Ignore logout errors
        } finally {
          api.clearToken()
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },

      checkAuth: async () => {
        const token = localStorage.getItem('access_token')
        if (!token) {
          set({ isLoading: false })
          return
        }

        api.setToken(token)
        try {
          const user = await api.getMe()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch {
          api.clearToken()
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)