import clsx from 'clsx'
import type { SpeakingHints } from '../types/analysis'

interface HintsPanelProps {
  hints: SpeakingHints | null
  isRefreshing?: boolean
  isStale?: boolean
  lastUpdatedAt?: number | null
  onRefresh?: () => void
  showRefreshControl?: boolean
  className?: string
  density?: 'full' | 'compact'
  /** Rendered inside a tab panel: the tab label already names the panel. */
  embedded?: boolean
}

const formatTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(timestamp)
    : '未刷新'

const HintCard = ({
  label,
  value,
  compact = false,
}: {
  label: string
  value: string
  compact?: boolean
}) => (
  <div
    className={clsx(
      'theme-inline-card-strong rounded-[var(--radius-card)]',
      compact ? 'px-3 py-2' : 'p-4',
    )}
  >
    <p className="theme-quiet text-[11px] font-semibold tracking-[0.08em] uppercase">
      {label}
    </p>
    <p
      className={clsx(
        'theme-title text-sm',
        compact ? 'mt-1 leading-5' : 'mt-3 leading-7',
      )}
    >
      {value}
    </p>
  </div>
)

export function HintsPanel({
  hints,
  isRefreshing = false,
  isStale = false,
  lastUpdatedAt = null,
  onRefresh,
  showRefreshControl = false,
  className,
  density = 'full',
  embedded = false,
}: HintsPanelProps) {
  const shouldShowLoading = isRefreshing && !hints
  const compact = density === 'compact'
  const refreshButton = showRefreshControl ? (
    <button
      className={clsx('btn-secondary', compact && 'px-3 py-1.5 text-xs')}
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
        compact || embedded ? 'p-4' : 'h-full p-5',
        className,
      )}
    >
      {compact ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {embedded ? null : (
              <h2 className="theme-title text-base font-semibold">下一轮怎么说</h2>
            )}
            <span className="status-badge" data-tone="primary">
              {hints?.functionType ?? '待生成'}
            </span>
            {isStale && hints ? (
              <span className="status-badge" data-tone="warning">
                需刷新
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="theme-quiet text-xs tabular-nums">
              {formatTimestamp(lastUpdatedAt)}
            </span>
            {refreshButton}
          </div>
        </div>
      ) : (
        <>
          {embedded ? null : (
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
              <div>
                <p className="kicker theme-muted text-[11px]">发言建议</p>
                <h2 className="theme-title mt-2 text-2xl font-semibold">
                  下一轮怎么说
                </h2>
                <p className="theme-muted mt-2 text-sm">
                  把 15 / 30 / 60 秒表达拆成等权建议卡，优先保证你随时能接得住讨论。
                </p>
              </div>

              {refreshButton}
            </div>
          )}

          <div
            className={clsx(
              'flex shrink-0 flex-wrap items-center gap-2 text-xs',
              embedded ? 'mt-0' : 'mt-3',
            )}
          >
            <span className="status-badge" data-tone="primary">
              动作类型：{hints?.functionType ?? '待生成'}
            </span>
            <span className="status-badge">
              最近更新：{formatTimestamp(lastUpdatedAt)}
            </span>
            {isStale && hints ? (
              <span className="status-badge" data-tone="warning">
                建议基于旧上下文，需要刷新
              </span>
            ) : null}
            {embedded ? refreshButton : null}
          </div>
        </>
      )}

      <div
        className={clsx(
          '@container min-h-0 flex-1 overflow-y-auto',
          compact ? 'mt-2.5' : 'mt-5',
        )}
      >
        {shouldShowLoading ? (
          <div className="space-y-3">
            <div className="panel-skeleton h-16 rounded-[var(--radius-card)]" />
            <div
              className={clsx(
                'grid gap-3',
                compact ? 'grid-cols-1' : '@lg:grid-cols-3',
              )}
            >
              <div className="panel-skeleton h-24 rounded-[var(--radius-card)]" />
              <div className="panel-skeleton h-24 rounded-[var(--radius-card)]" />
              <div className="panel-skeleton h-24 rounded-[var(--radius-card)]" />
            </div>
          </div>
        ) : hints ? (
          <div className={clsx(compact ? 'space-y-2.5' : 'space-y-4')}>
            {compact ? (
              <p className="text-sm leading-5 text-[color:var(--accent-text)]">
                <span className="mr-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
                  现在开口
                </span>
                <span className="theme-body">
                  {hints.whyNow ||
                    '建议优先承接当前主线，避免在关键收束点重新发散。'}
                </span>
              </p>
            ) : (
              <div className="sheet-accent">
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase">
                  现在开口
                </p>
                <p className="mt-3 text-sm leading-7">
                  {hints.whyNow ||
                    '建议优先承接当前主线，避免在关键收束点重新发散。'}
                </p>
              </div>
            )}

            <div
              className={clsx(
                'grid',
                compact ? 'grid-cols-1 gap-2' : 'gap-3 @lg:grid-cols-3',
              )}
            >
              <HintCard compact={compact} label="15 秒" value={hints.hint15s} />
              <HintCard compact={compact} label="30 秒" value={hints.hint30s} />
              <HintCard compact={compact} label="60 秒" value={hints.hint60s} />
            </div>
          </div>
        ) : (
          <div className="panel-empty theme-muted rounded-[var(--radius-card)] p-5 text-sm leading-7">
            {showRefreshControl
              ? '点击“生成建议”后，这里会给出适合当前讨论阶段的接话脚本。'
              : '当前回放快照还没有可用建议。'}
          </div>
        )}
      </div>
    </section>
  )
}
