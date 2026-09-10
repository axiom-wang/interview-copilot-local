export interface AuthUser {
  id: string
  email: string
  name?: string
}

export type AuthChangeEvent =
  | 'login'
  | 'logout'
  | 'token_refresh'
  | 'user_updated'
  | 'recovery'

export interface AuthProvider {
  readonly id: string
  getUser(): Promise<AuthUser | null>
  login(email: string, password: string): Promise<AuthUser>
  signup(email: string, password: string, name?: string): Promise<AuthUser>
  logout(): Promise<void>
  handleAuthCallback(): Promise<void>
  onAuthChange(
    callback: (event: AuthChangeEvent, user: AuthUser | null) => void,
  ): () => void
}
