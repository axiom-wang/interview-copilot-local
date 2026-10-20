import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveScenarioProfile } from '../../../meeting/scenarios'
import { ContextFields, ScenarioPicker } from '../PromptContextInputs'
import { applyPendingContext, useHasPendingContext } from '../promptContext'
import { useDismiss } from '../../hooks/useDismiss'
import { useAppStore } from '../../store/useAppStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useSettingsStore } from '../../store/useSettingsStore'

const formatElapsed = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

type Health = 'ok' | 'warning' | 'error'

const healthDotClass: Record<Health, string> = {
  ok: 'bg-[color:var(--success)]',
  warning: 'bg-[color:var(--warning)]',
  error: 'bg-[color:var(--danger)]',
}

function StatusRow({ label, value, health }: { label: string; value: string; health?: Health }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="theme-muted">{label}</span>
      <span className="theme-title flex min-w-0 items-center gap-1.5 text-right">
        {health ? (
          <span className={clsx('inline-block h-1.5 w-1.5 shrink-0 rounded-full', healthDotClass[health])} />
        ) : null}
        <span className="truncate">{value}</span>
      </span>
    </div>
  )
}

function SystemStatusButton() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, close)
  const astProviderLabel = useAppStore((state) => state.astProviderLabel)
  const analysisProviderLabel = useAppStore((state) => state.analysisProviderLabel)
  const listeningStatusLabel = useAppStore((state) => state.listeningStatusLabel)
  const speakerStability = useAppStore((state) => state.speakerStability)
  const runtimeEnvironment = useAppStore((state) => state.runtimeEnvironment)
  const errorMessage = useAppStore((state) => state.errorMessage)
  const isAnalyzing = useAppStore((state) => state.isAnalyzing)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const hasAstConfig = useSettingsStore((state) => state.hasAstConfig)
  const hasLlmConfig = useSettingsStore((state) => state.hasLlmConfig)

  const configured = hasAstConfig() && hasLlmConfig()
  const health: Health = errorMessage
    ? 'error'
    : !configured || speakerStability === 'unstable'
      ? 'warning'
      : 'ok'
  const label = errorMessage ? '有异常' : !configured ? '待配置' : '就绪'

  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        className="btn-ghost gap-2 px-2.5"
        onClick={() => setOpen((value) => !value)}
        title="系统状态"
        type="button"
      >
        <span className={clsx('inline-block h-2 w-2 rounded-full', healthDotClass[health])} />
        <span className="hidden text-xs sm:inline">{label}</span>
      </button>
      {open ? (
        <div className="panel-card absolute right-0 z-30 mt-2 w-72 p-3 text-xs">
          <StatusRow
            health={hasAstConfig() ? 'ok' : 'warning'}
            label="语音转写"
            value={hasAstConfig() ? astProviderLabel : '未配置'}
          />
          <StatusRow
            health={hasLlmConfig() ? 'ok' : 'warning'}
            label="文本分析"
            value={hasLlmConfig() ? analysisProviderLabel : '未配置'}
          />
          <StatusRow label="收音" value={listeningStatusLabel} />
          <StatusRow
            health={speakerStability === 'unstable' ? 'warning' : undefined}
            label="说话人识别"
            value={
              speakerStability === 'unstable'
                ? '不稳定'
                : speakerStability === 'stable'
                  ? '稳定'
                  : '等待识别'
            }
          />
          <StatusRow label="分析" value={isAnalyzing ? '刷新中' : '待命'} />
          <StatusRow label="运行环境" value={runtimeEnvironment === 'electron' ? '桌面端' : '网页端'} />
          {errorMessage ? (
            <p className="mt-2 rounded-[var(--radius-control)] bg-[color:var(--danger-soft)] px-2.5 py-2 leading-5 text-[color:var(--danger-text)]">
              {errorMessage}
            </p>
          ) : null}
          {!configured ? (
            <button
              className="btn-primary mt-2 w-full text-xs"
              onClick={() => {
                setActiveView('settings')
                close()
              }}
              type="button"
            >
              前往模型设置
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function UserMenu() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, close)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const activeView = useAppStore((state) => state.activeView)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const displayName = user?.name || user?.email || '用户'

  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        aria-label="账户菜单"
        className={clsx(
          'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition',
          activeView === 'settings' || open
            ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]'
            : 'border-[color:var(--panel-border)] bg-[color:var(--surface-inline)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-inline-hover)]',
        )}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {displayName.slice(0, 1).toUpperCase()}
      </button>
      {open ? (
        <div className="panel-card absolute right-0 z-30 mt-2 w-60 p-1.5 text-sm">
          <div className="theme-divider border-b px-2.5 pt-1.5 pb-2.5">
            <p className="theme-title truncate font-medium">{displayName}</p>
            {user?.email && user.email !== displayName ? (
              <p className="theme-muted truncate text-xs">{user.email}</p>
            ) : null}
          </div>
          <button
            className="btn-ghost mt-1 w-full justify-start"
            onClick={() => {
              setActiveView('settings')
              close()
            }}
            type="button"
          >
            模型设置
          </button>
          <button
            className="btn-ghost w-full justify-start"
            onClick={() => void logout()}
            type="button"
          >
            退出登录
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ContextDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hasPending = useHasPendingContext()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="theme-overlay fixed inset-0 z-40 flex justify-end">
      <button
        aria-label="关闭会议背景"
        className="h-full flex-1 cursor-default bg-transparent"
        onClick={onClose}
        type="button"
      />
      <aside className="panel-card flex h-full w-full max-w-lg flex-col rounded-none border-y-0 border-r-0">
        <div className="theme-divider flex items-center justify-between border-b px-5 py-4">
          <h2 className="theme-title text-base font-semibold">会议背景</h2>
          <button className="btn-ghost" onClick={onClose} type="button">
            关闭
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <ScenarioPicker />
          <ContextFields compact />
        </div>
        <div className="theme-divider flex items-center justify-between gap-3 border-t px-5 py-3">
          <span className="theme-muted text-xs">
            {hasPending ? '有未应用的修改' : '已与当前分析同步'}
          </span>
          <button
            className="btn-primary"
            disabled={!hasPending}
            onClick={() => {
              applyPendingContext()
              onClose()
            }}
            type="button"
          >
            应用到后续分析
          </button>
        </div>
      </aside>
    </div>
  )
}

function RecordingIndicator() {
  const isStreaming = useAppStore((state) => state.isStreaming)
  const isPaused = useAppStore((state) => state.isPaused)
  const currentSessionStartedAt = useAppStore((state) => state.currentSessionStartedAt)
  const scenarioId = useAppStore((state) => state.scenarioId)
  const activeView = useAppStore((state) => state.activeView)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const listeningStatusLabel = useAppStore((state) => state.listeningStatusLabel)
  const questionCapture = useAppStore((state) => state.questionCapture)
  const [elapsedSec, setElapsedSec] = useState(0)
  const isQa = resolveScenarioProfile(scenarioId).interactionModel === 'qa'
  // In qa scenarios the microphone is only live while a question is being captured.
  const idleQa = isQa && questionCapture !== 'recording'

  useEffect(() => {
    if (!isStreaming || !currentSessionStartedAt) {
      return
    }

    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - currentSessionStartedAt) / 1000)))
    }

    const first = window.setTimeout(tick, 0)
    const timer = isPaused ? null : window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      if (timer !== null) window.clearInterval(timer)
    }
  }, [isStreaming, isPaused, currentSessionStartedAt])

  if (!isStreaming) {
    return null
  }

  return (
    <button
      className={clsx(
        'flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] px-2 py-1 text-sm',
        activeView !== 'live' && 'hover:bg-[color:var(--surface-inline)]',
      )}
      disabled={activeView === 'live'}
      onClick={() => setActiveView('live')}
      title={activeView === 'live' ? undefined : '返回当前会议'}
      type="button"
    >
      <span
        className={clsx(
          'recording-dot inline-block h-2.5 w-2.5 shrink-0 rounded-full',
          isPaused || idleQa ? 'bg-[color:var(--warning)]' : 'bg-[color:var(--danger)]',
        )}
        data-paused={isPaused || idleQa}
      />
      <span className="theme-title font-semibold tabular-nums">{formatElapsed(elapsedSec)}</span>
      <span className="theme-muted hidden md:inline">
        {isQa ? listeningStatusLabel : isPaused ? '已暂停' : '收音中'}
      </span>
      <span className="status-badge hidden truncate lg:inline-flex">
        {resolveScenarioProfile(scenarioId).label}
      </span>
    </button>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const activeView = useAppStore((state) => state.activeView)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const isStreaming = useAppStore((state) => state.isStreaming)
  const isPaused = useAppStore((state) => state.isPaused)
  const liveSegments = useAppStore((state) => state.liveSegments)
  const togglePause = useAppStore((state) => state.togglePause)
  const scenarioId = useAppStore((state) => state.scenarioId)
  const stopStream = useAppStore((state) => state.stopStream)
  const pinCurrentSegment = useAppStore((state) => state.pinCurrentSegment)
  const applyModelSettings = useAppStore((state) => state.applyModelSettings)
  const user = useAuthStore((state) => state.user)
  const settings = useSettingsStore((state) => state.settings)
  const loadForUser = useSettingsStore((state) => state.loadForUser)
  const [contextOpen, setContextOpen] = useState(false)
  const closeContext = useCallback(() => setContextOpen(false), [])

  useEffect(() => {
    if (!user) {
      return
    }

    loadForUser(user.id)
  }, [loadForUser, user])

  useEffect(() => {
    applyModelSettings(settings)
  }, [applyModelSettings, settings])

  const navItems = [
    { id: 'live' as const, label: '会议' },
    { id: 'replay' as const, label: '历史会话' },
  ]

  const showLiveControls = activeView === 'live' && isStreaming
  const isQa = resolveScenarioProfile(scenarioId).interactionModel === 'qa'

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="flex min-w-0 items-center gap-4">
          <span className="theme-title hidden shrink-0 text-sm font-semibold sm:inline">
            会议智能助手
          </span>
          <nav aria-label="主导航" className="tabs-list shrink-0 p-0.5">
            {navItems.map((item) => (
              <button
                aria-current={activeView === item.id ? 'page' : undefined}
                className="tabs-trigger px-3 py-1.5"
                data-active={activeView === item.id}
                key={item.id}
                onClick={() => setActiveView(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>
          {activeView === 'settings' ? (
            <span className="theme-muted hidden text-sm md:inline">模型设置</span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          <RecordingIndicator />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {showLiveControls ? (
            <>
              <button
                className="btn-ghost"
                onClick={() => setContextOpen(true)}
                type="button"
              >
                会议背景
              </button>
              {isQa ? null : (
                <>
                  <button
                    className="btn-ghost"
                    disabled={liveSegments.length === 0}
                    onClick={pinCurrentSegment}
                    title="标记最新一段发言（快捷键 M）"
                    type="button"
                  >
                    标记
                  </button>
                  <button
                    className={isPaused ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => void togglePause()}
                    type="button"
                  >
                    {isPaused ? '继续' : '暂停'}
                  </button>
                </>
              )}
              <button
                className="btn-danger"
                onClick={() => void stopStream()}
                type="button"
              >
                结束会议
              </button>
              <span aria-hidden="true" className="theme-divider mx-1 h-5 border-l" />
            </>
          ) : null}
          <SystemStatusButton />
          <UserMenu />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-4 md:p-5">{children}</main>

      <ContextDrawer onClose={closeContext} open={contextOpen} />
    </div>
  )
}
