import clsx from 'clsx'
import { useEffect, useState } from 'react'
import type { SpeakingHints } from '../../meeting/types/analysis'

interface HintsPanelProps {
  hints: SpeakingHints | null
  isRefreshing?: boolean
  isStale?: boolean
  lastUpdatedAt?: number | null
  onRefresh?: () => void
  showRefreshControl?: boolean
  autoRefresh?: boolean
  onToggleAutoRefresh?: (enabled: boolean) => void
  className?: string
  /** `live` is the glanceable in-meeting layout; `full` is for replay. */
  density?: 'full' | 'live'
  /** Rendered inside a tab panel: the tab label already names the panel. */
  embedded?: boolean
  /** Set while participants give opening statements in turn (live density only). */
  openingRound?: {
    label: string
    canDraft: boolean
    onEnd: () => void
  }
}

const FALLBACK_WHY_NOW = '结合现场讨论，选择适合的时机发言。'

const formatTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(timestamp)
    : '未刷新'

const formatAge = (timestamp: number, now: number) => {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 10) return '刚刚更新'
  if (seconds < 60) return `${seconds} 秒前更新`
  return `${Math.floor(seconds / 60)} 分钟前更新`
}

const useNow = (intervalMs: number, enabled: boolean) => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [enabled, intervalMs])

  return now
}

function HintNotes({ notes }: { notes?: SpeakingHints['notes'] }) {
  if (!notes?.length) return null

  return (
    <details className="mt-3">
      <summary className="theme-muted cursor-pointer text-xs font-semibold">
        依据与备选（{notes.length}）
      </summary>
      <ul className="mt-2 space-y-2">
        {notes.map((note, index) => (
          <li className="theme-body text-sm leading-6" key={`${note.kind}-${index}`}>
            <span className="status-badge mr-2">{note.kind}</span>
            {note.text}
          </li>
        ))}
      </ul>
    </details>
  )
}

function LiveHints({
  hints,
  isRefreshing,
  isStale,
  lastUpdatedAt,
  onRefresh,
  autoRefresh,
  onToggleAutoRefresh,
  className,
  openingRound,
}: HintsPanelProps) {
  const now = useNow(5000, Boolean(lastUpdatedAt))
  const statusText = isRefreshing
    ? '正在更新…'
    : lastUpdatedAt
      ? formatAge(lastUpdatedAt, now)
      : autoRefresh && !openingRound
        ? '等待第一段定稿发言'
        : '尚未生成'
  const refreshLabel = openingRound ? (hints ? '按前面发言更新' : '生成') : '刷新'

  return (
    <section className={clsx('panel-card flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="theme-divider flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="theme-title text-sm font-semibold">发言建议</h2>
          {openingRound ? (
            <span className="status-badge" data-tone="primary">
              {openingRound.label}
            </span>
          ) : hints?.functionType ? (
            <span className="status-badge" data-tone="primary">
              {hints.functionType}
            </span>
          ) : null}
          {isStale && hints && !isRefreshing ? (
            <span className="status-badge" data-tone="warning">
              有新发言
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span aria-live="polite" className="theme-muted mr-1 text-xs tabular-nums">
            {statusText}
          </span>
          {openingRound ? (
            <button
              className="btn-ghost px-2 py-1 text-xs"
              onClick={openingRound.onEnd}
              title={`${openingRound.label}结束后，恢复自动跟随讨论的发言建议`}
              type="button"
            >
              进入自由讨论
            </button>
          ) : null}
          {onToggleAutoRefresh && !openingRound ? (
            <button
              aria-pressed={autoRefresh}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-2 py-1 text-xs transition',
                autoRefresh
                  ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]'
                  : 'border-[color:var(--panel-border)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-inline-hover)]',
              )}
              onClick={() => onToggleAutoRefresh(!autoRefresh)}
              title={autoRefresh ? '有新发言时自动更新（最快 20 秒一次），点击关闭' : '点击开启自动更新'}
              type="button"
            >
              <span
                className={clsx(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  autoRefresh ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--text-quiet)]',
                )}
              />
              自动更新
            </button>
          ) : null}
          <button
            className="btn-secondary px-2.5 py-1 text-xs"
            disabled={isRefreshing || !onRefresh || (openingRound && !openingRound.canDraft)}
            onClick={() => onRefresh?.()}
            title={openingRound ? '快轮到你时点一下，按前面的陈述避开重复（快捷键 R）' : '立即刷新（快捷键 R）'}
            type="button"
          >
            {refreshLabel}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {isRefreshing && !hints ? (
          <div className="space-y-4">
            <div className="panel-skeleton h-14 rounded-[var(--radius-card)]" />
            <div className="panel-skeleton h-24 rounded-[var(--radius-card)]" />
          </div>
        ) : hints ? (
          <div className={clsx('transition-opacity duration-200', isRefreshing && 'opacity-60')}>
            <p className="text-xs font-semibold text-[color:var(--accent-text)]">
              {openingRound ? '轮到你时可以这样说' : hints.functionType === '倾听观察' ? '先听一听' : '可以这样接话'}
            </p>
            <p className="theme-title mt-1.5 text-lg leading-8 font-medium text-pretty">
              {hints.whyNow || FALLBACK_WHY_NOW}
            </p>
            {hints.functionType !== '倾听观察' ? <p className="theme-divider theme-title mt-4 whitespace-pre-line border-t pt-3 text-[15px] leading-7">{hints.script || '未保存发言建议'}</p> : null}
            <HintNotes notes={hints.notes} />
          </div>
        ) : openingRound ? (
          <div className="flex h-full min-h-32 flex-col items-start justify-center gap-1">
            <p className="theme-title text-sm font-medium">
              {openingRound.canDraft ? `读完题后点「生成」，准备你的${openingRound.label}` : '先填写面试题背景'}
            </p>
            <p className="theme-muted text-sm leading-6">
              根据题目、参考资料和你的角色写一段完整陈述。前面有人发言后，快轮到你时点「按前面发言更新」，避开已被说过的观点。
            </p>
          </div>
        ) : (
          <div className="flex h-full min-h-32 flex-col items-start justify-center gap-1">
            <p className="theme-title text-sm font-medium">
              {autoRefresh ? '听到第一段完整发言后自动生成' : '自动更新已关闭'}
            </p>
            <p className="theme-muted text-sm leading-6">
              有值得补充的内容时，给出可以直接说的话；没有新贡献时，会建议继续倾听。也可以按 R 立即生成。
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

export function HintsPanel(props: HintsPanelProps) {
  const {
    hints,
    isRefreshing = false,
    isStale = false,
    lastUpdatedAt = null,
    onRefresh,
    showRefreshControl = false,
    className,
    density = 'full',
    embedded = false,
  } = props

  if (density === 'live') {
    return <LiveHints {...props} isRefreshing={isRefreshing} isStale={isStale} />
  }

  const refreshButton = showRefreshControl ? (
    <button
      className="btn-secondary text-xs"
      disabled={isRefreshing || !onRefresh}
      onClick={() => onRefresh?.()}
      type="button"
    >
      {isRefreshing ? '刷新中…' : '生成建议'}
    </button>
  ) : null

  return (
    <section
      className={clsx(
        'panel-card flex min-h-0 flex-col overflow-hidden',
        embedded ? 'p-4' : 'h-full p-5',
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
        {embedded ? null : (
          <h2 className="theme-title mr-1 text-base font-semibold">发言建议</h2>
        )}
        {hints ? (
          <>
            <span className="status-badge" data-tone="primary">
              {hints.functionType}
            </span>
            <span className="status-badge">更新于 {formatTimestamp(lastUpdatedAt)}</span>
          </>
        ) : null}
        {isStale && hints ? (
          <span className="status-badge" data-tone="warning">
            基于旧上下文
          </span>
        ) : null}
        {refreshButton}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto mt-4">
        {isRefreshing && !hints ? (
          <div className="panel-skeleton h-40 rounded-[var(--radius-card)]" />
        ) : hints ? (
          <div>
            <p className="text-xs font-semibold text-[color:var(--accent-text)]">{hints.functionType === '倾听观察' ? '先听一听' : '可以这样接话'}</p>
            <p className="theme-title mt-1.5 text-base leading-7 font-medium">
              {hints.whyNow || FALLBACK_WHY_NOW}
            </p>
            {hints.functionType !== '倾听观察' ? <p className="theme-divider theme-body mt-4 whitespace-pre-line border-t pt-3 text-sm leading-7">{hints.script || '未保存发言建议'}</p> : null}
            <HintNotes notes={hints.notes} />
          </div>
        ) : (
          <div className="panel-empty theme-muted rounded-[var(--radius-card)] p-5 text-sm leading-7">
            {showRefreshControl
              ? '点击“生成建议”后，这里会给出适合当前讨论阶段的接话脚本。'
              : '这个时间点还没有发言建议。'}
          </div>
        )}
      </div>
    </section>
  )
}
