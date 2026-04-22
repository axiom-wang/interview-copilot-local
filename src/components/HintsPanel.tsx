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
}: {
  label: string
  value: string
}) => (
  <div className="theme-inline-card-strong rounded-[24px] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <div className="flex items-center justify-between gap-3">
      <p className="theme-quiet text-[11px] uppercase tracking-[0.18em]">
        {label}
      </p>
      <span className="status-badge">建议卡</span>
    </div>
    <p className="theme-title mt-3 text-sm leading-7">{value}</p>
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
}: HintsPanelProps) {
  const shouldShowLoading = isRefreshing && !hints

  return (
    <section className={clsx('panel-card h-full p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker theme-muted text-[11px]">发言建议</p>
          <h2 className="theme-title mt-2 font-heading text-2xl">下一轮怎么说</h2>
          <p className="theme-muted mt-2 text-sm">
            把 15 / 30 / 60 秒表达拆成等权建议卡，优先保证你随时能接得住讨论。
          </p>
        </div>

        {showRefreshControl ? (
          <button
            className={clsx(
              'rounded-full border px-4 py-2 text-sm transition',
              isRefreshing
                ? 'theme-button-neutral cursor-not-allowed'
                : 'theme-button-primary',
            )}
            disabled={isRefreshing || !onRefresh}
            onClick={() => onRefresh?.()}
            type="button"
          >
            {isRefreshing ? '刷新中...' : '生成 / 刷新建议'}
          </button>
        ) : null}
      </div>

      <div className="theme-muted mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="status-badge" data-tone="primary">
          动作类型：{hints?.functionType ?? '待生成'}
        </span>
        <span className="status-badge">最近更新：{formatTimestamp(lastUpdatedAt)}</span>
        {isStale && hints ? (
          <span className="status-badge" data-tone="warning">
            建议基于旧上下文，需要刷新
          </span>
        ) : null}
      </div>

      {shouldShowLoading ? (
        <div className="mt-5 space-y-4">
          <div className="panel-skeleton h-24 rounded-[24px]" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="panel-skeleton h-36 rounded-[24px]" />
            <div className="panel-skeleton h-36 rounded-[24px]" />
            <div className="panel-skeleton h-36 rounded-[24px]" />
          </div>
        </div>
      ) : hints ? (
        <div className="mt-5 space-y-4">
          <div className="theme-button-success rounded-[24px] border p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">
              Why Now
            </p>
            <p className="mt-3 text-sm leading-7">
              {hints.whyNow || '建议优先承接当前主线，避免在关键收敛点重新发散。'}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <HintCard label="15 秒" value={hints.hint15s} />
            <HintCard label="30 秒" value={hints.hint30s} />
            <HintCard label="60 秒" value={hints.hint60s} />
          </div>
        </div>
      ) : (
        <div className="panel-empty theme-muted mt-5 rounded-[24px] p-5 text-sm leading-7">
          {showRefreshControl
            ? '点击“生成 / 刷新建议”后，这里会给出适合当前讨论阶段的接话脚本。'
            : '当前回放快照还没有可用建议。'}
        </div>
      )}
    </section>
  )
}
