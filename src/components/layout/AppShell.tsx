import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { PromptContextInputs } from '../PromptContextInputs'
import { useAppStore } from '../../store/useAppStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useSettingsStore } from '../../store/useSettingsStore'

function SystemStatusPopover() {
  const [open, setOpen] = useState(false)
  const astProviderLabel = useAppStore((state) => state.astProviderLabel)
  const analysisProviderLabel = useAppStore((state) => state.analysisProviderLabel)
  const inputSourceLabel = useAppStore((state) => state.inputSourceLabel)
  const listeningStatusLabel = useAppStore((state) => state.listeningStatusLabel)
  const speakerStability = useAppStore((state) => state.speakerStability)
  const runtimeEnvironment = useAppStore((state) => state.runtimeEnvironment)
  const isAnalyzing = useAppStore((state) => state.isAnalyzing)
  const liveSegments = useAppStore((state) => state.liveSegments)
  const hasFullConfig = useSettingsStore((state) => state.hasFullConfig)

  const stabilityLabel =
    speakerStability === 'unstable'
      ? '识别不稳定'
      : speakerStability === 'stable'
        ? '识别稳定'
        : '等待识别'

  return (
    <div className="relative">
      <button
        className="btn-secondary"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        系统状态
      </button>
      {open ? (
        <div className="panel-card absolute right-0 z-30 mt-2 w-72 space-y-2 p-3 text-xs shadow-[var(--shadow-md)]">
          <div className="flex justify-between gap-3">
            <span className="theme-muted">运行环境</span>
            <span>{runtimeEnvironment === 'electron' ? '桌面端' : '网页端'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="theme-muted">模型配置</span>
            <span>{hasFullConfig() ? '已完成' : '未完成'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="theme-muted">语音转写</span>
            <span>{astProviderLabel}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="theme-muted">文本分析</span>
            <span>{analysisProviderLabel}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="theme-muted">输入源</span>
            <span>{inputSourceLabel}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="theme-muted">监听状态</span>
            <span>{listeningStatusLabel}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="theme-muted">识别稳定度</span>
            <span>{stabilityLabel}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="theme-muted">分析状态</span>
            <span>{isAnalyzing ? '刷新中' : '待命'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="theme-muted">转写片段</span>
            <span>{liveSegments.length}</span>
          </div>
          <button
            className="btn-ghost w-full"
            onClick={() => setOpen(false)}
            type="button"
          >
            关闭
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SessionPrepDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const questionContextDraft = useAppStore((state) => state.questionContextDraft)
  const roleContextDraft = useAppStore((state) => state.roleContextDraft)
  const questionContext = useAppStore((state) => state.questionContext)
  const roleContext = useAppStore((state) => state.roleContext)
  const setQuestionContextDraft = useAppStore((state) => state.setQuestionContextDraft)
  const setRoleContextDraft = useAppStore((state) => state.setRoleContextDraft)
  const applyQuestionContext = useAppStore((state) => state.applyQuestionContext)
  const applyRoleContext = useAppStore((state) => state.applyRoleContext)
  const clearQuestionContext = useAppStore((state) => state.clearQuestionContext)
  const clearRoleContext = useAppStore((state) => state.clearRoleContext)

  if (!open) {
    return null
  }

  return (
    <div className="theme-overlay fixed inset-0 z-40 flex justify-end">
      <button
        aria-label="关闭会话准备"
        className="h-full flex-1 cursor-default bg-transparent"
        onClick={onClose}
        type="button"
      />
      <aside className="panel-card h-full w-full max-w-lg overflow-y-auto rounded-none border-y-0 border-r-0 p-5 shadow-[var(--shadow-md)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="kicker theme-muted text-[11px]">Session Prep</p>
            <h2 className="theme-title mt-1 text-lg font-semibold">会话准备</h2>
          </div>
          <button className="btn-ghost" onClick={onClose} type="button">
            关闭
          </button>
        </div>
        <PromptContextInputs
          appliedQuestionContext={questionContext}
          appliedRoleContext={roleContext}
          collapsed={false}
          onApplyQuestionContext={applyQuestionContext}
          onApplyRoleContext={applyRoleContext}
          onClearQuestionContext={clearQuestionContext}
          onClearRoleContext={clearRoleContext}
          onQuestionContextDraftChange={setQuestionContextDraft}
          onRoleContextDraftChange={setRoleContextDraft}
          onToggleCollapsed={() => undefined}
          questionContextDraft={questionContextDraft}
          roleContextDraft={roleContextDraft}
        />
      </aside>
    </div>
  )
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'interview-copilot-local/sidebar-collapsed'

const readStoredSidebarCollapsed = () => {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const activeView = useAppStore((state) => state.activeView)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const isStreaming = useAppStore((state) => state.isStreaming)
  const isPaused = useAppStore((state) => state.isPaused)
  const supportsLiveAssist = useAppStore((state) => state.supportsLiveAssist)
  const liveSegments = useAppStore((state) => state.liveSegments)
  const currentSessionStartedAt = useAppStore((state) => state.currentSessionStartedAt)
  const startStream = useAppStore((state) => state.startStream)
  const togglePause = useAppStore((state) => state.togglePause)
  const stopStream = useAppStore((state) => state.stopStream)
  const pinCurrentSegment = useAppStore((state) => state.pinCurrentSegment)
  const saveCurrentSession = useAppStore((state) => state.saveCurrentSession)
  const applyModelSettings = useAppStore((state) => state.applyModelSettings)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const settings = useSettingsStore((state) => state.settings)
  const loadForUser = useSettingsStore((state) => state.loadForUser)
  const hasFullConfig = useSettingsStore((state) => state.hasFullConfig)
  const [prepOpen, setPrepOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readStoredSidebarCollapsed)
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_STORAGE_KEY,
        sidebarCollapsed ? '1' : '0',
      )
    } catch {
      // ignore storage failures; the collapse state stays session-only
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!user) {
      return
    }

    loadForUser(user.id)
  }, [loadForUser, user])

  useEffect(() => {
    applyModelSettings(settings)
  }, [applyModelSettings, settings])

  useEffect(() => {
    setNavOpen(false)
  }, [activeView])

  useEffect(() => {
    if (!isStreaming || isPaused || !currentSessionStartedAt) {
      return
    }

    const tick = () => {
      setElapsedSec(
        Math.max(0, Math.floor((Date.now() - currentSessionStartedAt) / 1000)),
      )
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [isStreaming, isPaused, currentSessionStartedAt])

  const navItems = [
    { id: 'live' as const, label: '实时辅助' },
    { id: 'replay' as const, label: '回放复盘' },
    { id: 'settings' as const, label: '模型设置' },
  ]

  const titleMap = {
    live: '实时辅助',
    replay: '回放复盘',
    settings: '模型设置',
  }

  const canStart =
    supportsLiveAssist && hasFullConfig() && !isStreaming

  const elapsedLabel = isStreaming
    ? `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`
    : '00:00'

  return (
    <div
      className="app-shell"
      data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}
    >
      {navOpen ? (
        <button
          aria-label="关闭导航"
          className="sidebar-backdrop"
          onClick={() => setNavOpen(false)}
          type="button"
        />
      ) : null}

      <aside className="sidebar" data-open={navOpen}>
        <div className="flex items-start justify-between gap-2 border-b border-[color:var(--sidebar-border)] px-5 py-5">
          <div className="min-w-0">
            <p className="kicker theme-muted text-[10px]">Meeting Assistant</p>
            <h1 className="theme-title mt-2 text-lg font-semibold">会议智能助手</h1>
          </div>
          <button
            aria-label="收起侧栏"
            className="sidebar-collapse btn-ghost shrink-0 px-2"
            onClick={() => setSidebarCollapsed(true)}
            title="收起侧栏"
            type="button"
          >
            «
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => (
            <button
              className={clsx(
                'rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm font-medium transition',
                activeView === item.id
                  ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]'
                  : 'theme-muted hover:bg-[color:var(--surface-inline)] hover:text-[color:var(--text-primary)]',
              )}
              key={item.id}
              onClick={() => setActiveView(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-[color:var(--sidebar-border)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={clsx(
                'inline-block h-2 w-2 rounded-full',
                hasFullConfig() ? 'bg-[color:var(--success)]' : 'bg-[color:var(--warning)]',
              )}
            />
            <span className="theme-muted text-xs">
              {hasFullConfig() ? '模型已就绪' : '待配置模型'}
            </span>
          </div>
          <p className="theme-title truncate text-sm font-medium">
            {user?.name || user?.email || '用户'}
          </p>
          <p className="theme-muted truncate text-xs">{user?.email}</p>
          <button
            className="btn-ghost mt-3 w-full justify-start px-0"
            onClick={() => void logout()}
            type="button"
          >
            退出登录
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <header className="app-bar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="sidebar-toggle btn-ghost px-2"
              onClick={() => setNavOpen(true)}
              type="button"
            >
              菜单
            </button>
            <button
              aria-label="展开侧栏"
              className="sidebar-expand btn-ghost px-2"
              onClick={() => setSidebarCollapsed(false)}
              title="展开侧栏"
              type="button"
            >
              »
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="theme-title truncate text-base font-semibold">
                  {titleMap[activeView]}
                </h2>
                {activeView === 'live' && isStreaming ? (
                  <span
                    className="status-badge"
                    data-tone={isPaused ? 'warning' : 'active'}
                  >
                    {isPaused ? '已暂停' : '监听中'}
                  </span>
                ) : null}
              </div>
              {activeView === 'live' ? (
                <p className="theme-muted text-xs tabular-nums">
                  计时 {elapsedLabel}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeView === 'live' ? (
              <>
                <button
                  className="btn-secondary"
                  onClick={() => setPrepOpen(true)}
                  type="button"
                >
                  会话准备
                </button>
                {isStreaming ? (
                  <>
                    <button
                      className={isPaused ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => void togglePause()}
                      type="button"
                    >
                      {isPaused ? '继续' : '暂停'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={stopStream}
                      type="button"
                    >
                      停止
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary"
                    disabled={!canStart}
                    onClick={() => void startStream()}
                    title={
                      !supportsLiveAssist
                        ? '实时转写服务未配置'
                        : !hasFullConfig()
                          ? '请先完成模型设置'
                          : undefined
                    }
                    type="button"
                  >
                    开始
                  </button>
                )}
                {liveSegments.length > 0 ? (
                  <>
                    <button
                      className="btn-ghost"
                      onClick={pinCurrentSegment}
                      type="button"
                    >
                      标记
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={saveCurrentSession}
                      type="button"
                    >
                      保存
                    </button>
                  </>
                ) : null}
              </>
            ) : null}
            <SystemStatusPopover />
          </div>
        </header>

        <main
          className={clsx(
            'min-h-0 flex-1 p-4 md:p-5',
            activeView === 'settings' ? 'overflow-auto' : 'overflow-auto xl:overflow-hidden',
          )}
        >
          {children}
        </main>
      </div>

      <SessionPrepDrawer open={prepOpen} onClose={() => setPrepOpen(false)} />
    </div>
  )
}
