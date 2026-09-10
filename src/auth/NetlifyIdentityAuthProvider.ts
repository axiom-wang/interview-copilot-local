import {
  AUTH_EVENTS,
  getUser,
  handleAuthCallback,
  login,
  logout,
  onAuthChange,
  signup,
  type User,
} from '@netlify/identity'
import type { AuthChangeEvent, AuthProvider, AuthUser } from './AuthProvider'

const toAuthUser = (user: User | null): AuthUser | null => {
  if (!user?.id) {
    return null
  }

  const fullName = user.userMetadata?.full_name

  return {
    id: user.id,
    email: user.email ?? '',
    name:
      user.name ||
      (typeof fullName === 'string' ? fullName : undefined),
  }
}

const mapEvent = (event: string): AuthChangeEvent => {
  switch (event) {
    case AUTH_EVENTS.LOGIN:
      return 'login'
    case AUTH_EVENTS.LOGOUT:
      return 'logout'
    case AUTH_EVENTS.TOKEN_REFRESH:
      return 'token_refresh'
    case AUTH_EVENTS.USER_UPDATED:
      return 'user_updated'
    case AUTH_EVENTS.RECOVERY:
      return 'recovery'
    default:
      return 'user_updated'
  }
}

export class NetlifyIdentityAuthProvider implements AuthProvider {
  readonly id = 'netlify-identity'

  async getUser() {
    return toAuthUser(await getUser())
  }

  async login(email: string, password: string) {
    const user = await login(email.trim(), password)
    const authUser = toAuthUser(user)

    if (!authUser) {
      throw new Error('登录成功，但未能读取用户信息。')
    }

    return authUser
  }

  async signup(email: string, password: string, name?: string) {
    const user = await signup(email.trim(), password, {
      full_name: name?.trim() || undefined,
    })
    const authUser = toAuthUser(user)

    if (!authUser) {
      throw new Error('注册成功，请查收确认邮件后再登录。')
    }

    if (!user.confirmedAt) {
      throw new Error('注册成功，请查收确认邮件后再登录。')
    }

    return authUser
  }

  async logout() {
    await logout()
  }

  async handleAuthCallback() {
    await handleAuthCallback()
  }

  onAuthChange(
    callback: (event: AuthChangeEvent, user: AuthUser | null) => void,
  ) {
    return onAuthChange((event, user) => {
      callback(mapEvent(event), toAuthUser(user))
    })
  }
}
