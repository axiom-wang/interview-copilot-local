import clsx from 'clsx'
import { useEffect, useState } from 'react'
import type { MeetingSummary } from '../types/analysis'

interface SummaryPreviewPanelProps {
  summary: MeetingSummary | null
  className?: string
  isGenerating?: boolean
  isStale?: boolean
  onGenerate?: () => Promise<boolean> | boolean | void
  disableGenerate?: boolean
}

const formatTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(timestamp)
    : '未生成'

export function SummaryPreviewPanel({
  summary,
  className,
  isGenerating = false,
  isStale = false,
  onGenerate,
  disableGenerate = false,
}: SummaryPreviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!isExpanded) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isExpanded])

  const handleGenerate = async () => {
    if (!onGenerate || disableGenerate || isGenerating) {
      return
    }

    const shouldOpen = await onGenerate()

    if (shouldOpen === false) {
      return
    }

    setIsExpanded(true)
  }

  return (
    <section className={clsx('panel-card p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker theme-muted text-[11px]">产出预览</p>
          <h2 className="theme-title mt-2 font-heading text-2xl">总结发言</h2>
          <p className="theme-muted mt-2 text-sm">
            默认在应用内查看 60 秒口播、关键要点和后续动作。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {summary ? (
            <span className="status-badge">生成于 {formatTimestamp(summary.updatedAt)}</span>
          ) : null}
          {isStale && summary ? (
            <span className="status-badge" data-tone="warning">
              内容可能过期
            </span>
          ) : null}
          {onGenerate ? (
            <button
              className={clsx(
                'rounded-full border px-4 py-2 text-sm transition',
                disableGenerate || isGenerating
                  ? 'theme-button-neutral cursor-not-allowed'
                  : 'theme-button-success',
              )}
              disabled={disableGenerate || isGenerating}
              onClick={() => {
                void handleGenerate()
              }}
              type="button"
            >
              {isGenerating ? '生成中...' : '生成 / 刷新并查看'}
            </button>
          ) : null}
        </div>
      </div>

      {isGenerating && !summary ? (
        <div className="mt-5 space-y-4">
          <div className="panel-skeleton h-30 rounded-[24px]" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel-skeleton h-28 rounded-[24px]" />
            <div className="panel-skeleton h-28 rounded-[24px]" />
          </div>
        </div>
      ) : summary ? (
        <button
          className="theme-inline-card-hover theme-inline-card mt-5 block w-full rounded-[24px] p-5 text-left"
          onClick={() => setIsExpanded(true)}
          type="button"
        >
          <div className="theme-button-primary rounded-[20px] border p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">
              60 秒口播
            </p>
            <p className="mt-3 text-sm leading-7">
              {summary.speech60s}
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="theme-inline-card rounded-[20px] p-4">
              <p className="theme-quiet text-[11px] uppercase tracking-[0.18em]">
                关键要点
              </p>
              <ul className="theme-body mt-3 space-y-2 text-sm leading-6">
                {summary.keyPoints.slice(0, 3).map((point, index) => (
                  <li key={`summary-point-${index}`}>{point}</li>
                ))}
              </ul>
            </div>
            <div className="theme-inline-card rounded-[20px] p-4">
              <p className="theme-quiet text-[11px] uppercase tracking-[0.18em]">
                下一步动作
              </p>
              <ul className="theme-body mt-3 space-y-2 text-sm leading-6">
                {summary.nextSteps.slice(0, 3).map((step, index) => (
                  <li key={`summary-step-${index}`}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        </button>
      ) : (
        <div className="panel-empty theme-muted mt-5 rounded-[24px] p-5 text-sm leading-7">
          {onGenerate
            ? '总结结果已从新窗口切到应用内预览。点击右上角按钮后，会直接生成并展示。'
            : '当前回放会话还没有保存总结发言。'}
        </div>
      )}

      {summary && isExpanded ? (
        <div
          className="theme-overlay fixed inset-0 z-[1200] flex items-center justify-center px-4 py-6"
          onClick={() => {
            setIsExpanded(false)
          }}
        >
          <div
            className="theme-overlay-card panel-card flex h-[88vh] w-[92vw] max-w-[1180px] flex-col overflow-hidden border"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className="theme-divider flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="kicker theme-muted text-[11px]">Full Preview</p>
                <h3 className="theme-title mt-2 text-lg font-semibold">
                  总结发言
                </h3>
              </div>
              <button
                className="theme-button-neutral rounded-full border px-3 py-1.5 text-sm transition"
                onClick={() => {
                  setIsExpanded(false)
                }}
                type="button"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="theme-button-primary rounded-[24px] border p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">
                  60 秒口播
                </p>
                <p className="mt-3 text-sm leading-8">
                  {summary.speech60s}
                </p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="theme-inline-card rounded-[24px] p-5">
                  <p className="theme-quiet text-[11px] uppercase tracking-[0.18em]">
                    关键要点
                  </p>
                  <ul className="theme-body mt-3 space-y-3 text-sm leading-7">
                    {summary.keyPoints.map((point, index) => (
                      <li key={`expanded-summary-point-${index}`}>{point}</li>
                    ))}
                  </ul>
                </div>

                <div className="theme-inline-card rounded-[24px] p-5">
                  <p className="theme-quiet text-[11px] uppercase tracking-[0.18em]">
                    下一步动作
                  </p>
                  <ul className="theme-body mt-3 space-y-3 text-sm leading-7">
                    {summary.nextSteps.map((step, index) => (
                      <li key={`expanded-summary-step-${index}`}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
