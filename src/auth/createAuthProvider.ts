import type { AuthProvider } from './AuthProvider'
import { MockAuthProvider } from './MockAuthProvider'
import { NetlifyIdentityAuthProvider } from './NetlifyIdentityAuthProvider'

const isNetlifyHost = () => {
  if (typeof window === 'undefined') {
    return false
  }

  const host = window.location.hostname
  return host.endsWith('.netlify.app') || host.endsWith('.netlify.com')
}

const forceMockAuth = () =>
  import.meta.env.VITE_FORCE_MOCK_AUTH === 'true' ||
  Boolean(typeof window !== 'undefined' && window.interviewCopilot)

export const createAuthProvider = (): AuthProvider => {
  if (forceMockAuth() || !isNetlifyHost()) {
    return new MockAuthProvider()
  }

  return new NetlifyIdentityAuthProvider()
}
