import { create } from 'zustand'
import type { AuthProvider, AuthUser } from '../auth/AuthProvider'
import { createAuthProvider } from '../auth/createAuthProvider'

interface AuthState {
  ready: boolean
  user: AuthUser | null
  providerId: string
  errorMessage: string | null
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

let authProvider: AuthProvider | null = null
let unsubscribeAuth: (() => void) | null = null

const getAuthProvider = () => {
  if (!authProvider) {
    authProvider = createAuthProvider()
  }

  return authProvider
}

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  user: null,
  providerId: 'mock-auth',
  errorMessage: null,
  initialize: async () => {
    const provider = getAuthProvider()

    unsubscribeAuth?.()
    unsubscribeAuth = provider.onAuthChange((_event, user) => {
      set({ user, ready: true, errorMessage: null })
    })

    try {
      await provider.handleAuthCallback()
      const user = await provider.getUser()
      set({
        ready: true,
        user,
        providerId: provider.id,
        errorMessage: null,
      })
    } catch (error) {
      set({
        ready: true,
        user: null,
        providerId: provider.id,
        errorMessage:
          error instanceof Error ? error.message : '认证初始化失败。',
      })
    }
  },
  login: async (email, password) => {
    const provider = getAuthProvider()
    set({ errorMessage: null })

    try {
      const user = await provider.login(email, password)
      set({ user, errorMessage: null })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '登录失败，请稍后重试。'
      set({ errorMessage: message })
      throw error
    }
  },
  signup: async (email, password, name) => {
    const provider = getAuthProvider()
    set({ errorMessage: null })

    try {
      const user = await provider.signup(email, password, name)
      set({ user, errorMessage: null })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '注册失败，请稍后重试。'
      set({ errorMessage: message })
      throw error
    }
  },
  logout: async () => {
    const provider = getAuthProvider()
    await provider.logout()
    set({ user: null, errorMessage: null })
  },
  clearError: () => set({ errorMessage: null }),
}))
