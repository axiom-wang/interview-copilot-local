import clsx from 'clsx'

interface ActionButtonsPanelProps {
  disableMindMap: boolean
  disableSummary: boolean
  hasMindMap: boolean
  hasSummary: boolean
  isGeneratingMindMap: boolean
  isGeneratingSummary: boolean
  mindMapStale: boolean
  summaryStale: boolean
  onOpenMindMap: () => void
  onOpenSummary: () => void
}

const cardButtonClassName =
  'rounded-[22px] border px-4 py-4 text-left transition disabled:cursor-not-allowed'

export function ActionButtonsPanel({
  disableMindMap,
  disableSummary,
  hasMindMap,
  hasSummary,
  isGeneratingMindMap,
  isGeneratingSummary,
  mindMapStale,
  summaryStale,
  onOpenMindMap,
  onOpenSummary,
}: ActionButtonsPanelProps) {
  return (
    <section className="panel-card p-5">
      <h2 className="theme-title font-heading text-2xl">会议动作</h2>
      <p className="theme-muted mt-2 text-sm">
        这里保留动作为入口卡片，视觉会自动跟随系统深浅色；结果展示优先在应用内预览。
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <button
          className={clsx(
            cardButtonClassName,
            disableMindMap ? 'theme-button-neutral' : 'theme-button-primary',
          )}
          disabled={disableMindMap || isGeneratingMindMap}
          onClick={onOpenMindMap}
          type="button"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-semibold">思维导图</span>
            <span className="status-badge">
              {isGeneratingMindMap
                ? '生成中...'
                : hasMindMap
                  ? '查看预览'
                  : '立即生成'}
            </span>
          </div>
          <p className="theme-body mt-2 text-xs">
            {hasMindMap
              ? mindMapStale
                ? '当前导图可能已过期，建议刷新后再查看。'
                : '导图已可用，可直接进入应用内预览。'
              : '暂未生成导图，点击后会基于当前会话内容生成。'}
          </p>
        </button>

        <button
          className={clsx(
            cardButtonClassName,
            disableSummary ? 'theme-button-neutral' : 'theme-button-success',
          )}
          disabled={disableSummary || isGeneratingSummary}
          onClick={onOpenSummary}
          type="button"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-semibold">总结发言</span>
            <span className="status-badge">
              {isGeneratingSummary
                ? '生成中...'
                : hasSummary
                  ? '查看预览'
                  : '立即生成'}
            </span>
          </div>
          <p className="theme-body mt-2 text-xs">
            {hasSummary
              ? summaryStale
                ? '当前总结可能已过期，建议刷新后再查看。'
                : '总结已可用，可直接进入应用内预览。'
              : '暂未生成总结，点击后会生成 60 秒口播与关键要点。'}
          </p>
        </button>
      </div>
    </section>
  )
}
