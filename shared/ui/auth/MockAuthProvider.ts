import type { AuthChangeEvent, AuthProvider, AuthUser } from './AuthProvider'

const MOCK_STORAGE_KEY = 'meeting-assistant/mock-auth-user'

const readStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (typeof parsed.id !== 'string' || typeof parsed.email !== 'string') {
      return null
    }

    return {
      id: parsed.id,
      email: parsed.email,
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
    }
  } catch {
    return null
  }
}

const writeStoredUser = (user: AuthUser | null) => {
  if (!user) {
    localStorage.removeItem(MOCK_STORAGE_KEY)
    return
  }

  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(user))
}

export class MockAuthProvider implements AuthProvider {
  readonly id = 'mock-auth'

  private listeners = new Set<
    (event: AuthChangeEvent, user: AuthUser | null) => void
  >()

  private emit(event: AuthChangeEvent, user: AuthUser | null) {
    for (const listener of this.listeners) {
      listener(event, user)
    }
  }

  async getUser() {
    return readStoredUser()
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password.trim()) {
      throw new Error('请输入邮箱和密码。')
    }

    const existing = readStoredUser()
    const user: AuthUser = {
      id: existing?.email === normalizedEmail ? existing.id : `mock-${crypto.randomUUID()}`,
      email: normalizedEmail,
      name: existing?.email === normalizedEmail ? existing.name : normalizedEmail.split('@')[0],
    }

    writeStoredUser(user)
    this.emit('login', user)
    return user
  }

  async signup(email: string, password: string, name?: string) {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || password.trim().length < 6) {
      throw new Error('请输入有效邮箱，且密码至少 6 位。')
    }

    const user: AuthUser = {
      id: `mock-${crypto.randomUUID()}`,
      email: normalizedEmail,
      name: name?.trim() || normalizedEmail.split('@')[0],
    }

    writeStoredUser(user)
    this.emit('login', user)
    return user
  }

  async logout() {
    writeStoredUser(null)
    this.emit('logout', null)
  }

  async handleAuthCallback() {
    // Mock provider has no OAuth / email confirmation callbacks.
  }

  onAuthChange(
    callback: (event: AuthChangeEvent, user: AuthUser | null) => void,
  ) {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }
}
