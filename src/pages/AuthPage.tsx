import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../store/useAuthStore'

type AuthMode = 'login' | 'signup'

export function AuthPage() {
  const login = useAuthStore((state) => state.login)
  const signup = useAuthStore((state) => state.signup)
  const errorMessage = useAuthStore((state) => state.errorMessage)
  const clearError = useAuthStore((state) => state.clearError)
  const providerId = useAuthStore((state) => state.providerId)
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    clearError()

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signup(email, password, name)
      }
    } catch {
      // Error is stored in auth store.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-hero">
        <p className="text-sm font-semibold tracking-[0.16em] uppercase opacity-80">
          Meeting Assistant
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">
          会议智能助手
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-indigo-100">
          实时转写、讨论阶段判断、发言建议与会后复盘，集中在一个清晰的工作台里。
        </p>
        <ul className="mt-10 space-y-4 text-sm text-indigo-100">
          <li className="border-l border-indigo-200/40 pl-3">
            实时辅助：边听边看阶段与发言建议
          </li>
          <li className="border-l border-indigo-200/40 pl-3">
            回放复盘：按时间线回顾共识与分歧
          </li>
          <li className="border-l border-indigo-200/40 pl-3">
            自带模型：使用你自己的语音与文本模型配置
          </li>
        </ul>
      </section>

      <section className="auth-panel">
        <div className="panel-card w-full max-w-md p-8">
          <div className="mb-6">
            <h2 className="theme-title text-2xl font-semibold">
              {mode === 'login' ? '登录' : '创建账号'}
            </h2>
            <p className="theme-muted mt-2 text-sm">
              {providerId === 'mock-auth'
                ? '当前为本地开发模式，任意邮箱密码即可进入。'
                : '使用邮箱登录后即可配置模型并开始使用。'}
            </p>
          </div>

          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            {mode === 'signup' ? (
              <label className="block space-y-2 text-sm">
                <span className="theme-muted">昵称</span>
                <input
                  className="theme-input w-full px-3 py-2.5"
                  onChange={(event) => setName(event.currentTarget.value)}
                  placeholder="可选"
                  type="text"
                  value={name}
                />
              </label>
            ) : null}

            <label className="block space-y-2 text-sm">
              <span className="theme-muted">邮箱</span>
              <input
                autoComplete="email"
                className="theme-input w-full px-3 py-2.5"
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="theme-muted">密码</span>
              <input
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="theme-input w-full px-3 py-2.5"
                minLength={6}
                onChange={(event) => setPassword(event.currentTarget.value)}
                placeholder="至少 6 位"
                required
                type="password"
                value={password}
              />
            </label>

            {errorMessage ? (
              <p className="rounded-md border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-text)]">
                {errorMessage}
              </p>
            ) : null}

            <button
              className="btn-primary w-full py-2.5"
              disabled={submitting}
              type="submit"
            >
              {submitting
                ? '处理中…'
                : mode === 'login'
                  ? '登录'
                  : '注册并进入'}
            </button>
          </form>

          <div className="theme-muted mt-6 text-center text-sm">
            {mode === 'login' ? (
              <>
                还没有账号？{' '}
                <button
                  className="btn-ghost px-1 py-0 text-[color:var(--accent)]"
                  onClick={() => {
                    clearError()
                    setMode('signup')
                  }}
                  type="button"
                >
                  注册
                </button>
              </>
            ) : (
              <>
                已有账号？{' '}
                <button
                  className="btn-ghost px-1 py-0 text-[color:var(--accent)]"
                  onClick={() => {
                    clearError()
                    setMode('login')
                  }}
                  type="button"
                >
                  登录
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
