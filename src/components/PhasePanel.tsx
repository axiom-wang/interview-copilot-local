import clsx from 'clsx'
import { useState } from 'react'
import { resolveScenarioProfile, type MeetingScenarioId } from '../scenarios'
import { useAppStore } from '../store/useAppStore'
import type { PhaseAnalysis } from '../types/analysis'

interface PhasePanelProps {
  phaseAnalysis: PhaseAnalysis | null
  isLoading?: boolean
  className?: string
  scenarioId?: MeetingScenarioId
  variant?: 'full' | 'compact'
}

export function PhasePanel({
  phaseAnalysis,
  isLoading = false,
  className,
  scenarioId,
  variant = 'full',
}: PhasePanelProps) {
  const [reasonOpen, setReasonOpen] = useState(false)
  const activeScenarioId = useAppStore((state) => state.scenarioId)
  const profile = resolveScenarioProfile(scenarioId ?? activeScenarioId)
  const nextAction =
    phaseAnalysis?.nextAction?.trim() ||
    phaseAnalysis?.nextBestAction?.trim() ||
    '继续围绕主线推进讨论，补齐最影响判断的信息。'

  const reason =
    phaseAnalysis?.reason?.trim() ||
    '当前证据还不够完整，建议继续补充高价值原话与关键约束。'

  if (variant === 'compact') {
    if (isLoading && !phaseAnalysis) {
      return (
        <section className={clsx('panel-card px-4 py-3', className)}>
          <div className="flex items-center gap-3">
            <div className="panel-skeleton h-6 w-20 rounded-[var(--radius-pill,999px)]" />
            <div className="panel-skeleton h-4 min-w-0 flex-1 rounded-[var(--radius-control)]" />
            <div className="panel-skeleton h-4 w-10 shrink-0 rounded-[var(--radius-control)]" />
          </div>
        </section>
      )
    }

    if (!phaseAnalysis) {
      return (
        <section className={clsx('panel-card px-4 py-3', className)}>
          <div className="flex items-center gap-3">
            <span className="status-badge shrink-0">阶段</span>
            <p className="theme-muted min-w-0 truncate text-sm">
              等待第一轮分析结果
            </p>
          </div>
        </section>
      )
    }

    return (
      <section
        className={clsx(
          'panel-card flex min-h-0 flex-col overflow-hidden px-4 py-3',
          className,
        )}
      >
        <div className="flex shrink-0 items-center gap-3">
          <span className="status-badge shrink-0" data-tone="primary">
            {profile.phaseLabels[phaseAnalysis.phase]}
          </span>
          <p className="theme-title min-w-0 flex-1 truncate text-sm">
            {nextAction}
          </p>
          <span className="theme-muted shrink-0 text-xs tabular-nums">
            {(phaseAnalysis.confidence * 100).toFixed(0)}%
          </span>
          <button
            aria-expanded={reasonOpen}
            aria-label={reasonOpen ? '收起判断依据' : '展开判断依据'}
            className="btn-ghost shrink-0 px-2 py-1"
            onClick={() => setReasonOpen((open) => !open)}
            type="button"
          >
            <svg
              aria-hidden="true"
              className={clsx(
                'h-4 w-4 text-[color:var(--text-muted)] transition-transform',
                reasonOpen && 'rotate-180',
              )}
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="M4 6.5 8 10.5 12 6.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>
        {reasonOpen ? (
          <p className="theme-body mt-3 min-h-0 flex-1 overflow-y-auto text-sm leading-6">
            {reason}
          </p>
        ) : null}
      </section>
    )
  }

  const fullShellClassName = clsx(
    'panel-card flex max-h-[40vh] min-h-0 flex-col overflow-hidden',
    className,
  )

  if (isLoading && !phaseAnalysis) {
    return (
      <section className={fullShellClassName}>
        <div className="shrink-0 px-5 pt-5">
          <p className="kicker theme-muted text-[11px]">阶段</p>
          <h2 className="theme-title mt-2 text-2xl font-semibold">当前阶段</h2>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-5">
          <div className="panel-skeleton h-8 w-28 rounded-[var(--radius-control)]" />
          <div className="panel-skeleton h-2 w-full rounded-[var(--radius-control)]" />
          <div className="panel-skeleton h-24 rounded-[var(--radius-card)]" />
          <div className="panel-skeleton h-20 rounded-[var(--radius-card)]" />
        </div>
      </section>
    )
  }

  return (
    <section className={fullShellClassName}>
      <div className="shrink-0 px-5 pt-5">
        <p className="kicker theme-muted text-[11px]">阶段</p>
        <h2 className="theme-title mt-2 text-2xl font-semibold">当前阶段</h2>
      </div>

      {phaseAnalysis ? (
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <span className="status-badge" data-tone="primary">
                {profile.phaseLabels[phaseAnalysis.phase]}
              </span>
              <p className="theme-muted text-sm">
                {profile.phaseDefinitions[phaseAnalysis.phase]}
              </p>
            </div>
            <div className="theme-inline-card min-w-[88px] rounded-[var(--radius-card)] px-4 py-3 text-right">
              <p className="theme-quiet text-[11px] font-semibold tracking-[0.08em] uppercase">
                置信度
              </p>
              <p className="theme-title mt-1 text-xl font-semibold tabular-nums">
                {(phaseAnalysis.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="theme-progress-track h-2 overflow-hidden rounded-[var(--radius-control)]">
              <div
                className="progress-fill h-full rounded-[var(--radius-control)]"
                style={{ width: `${Math.max(8, phaseAnalysis.confidence * 100)}%` }}
              />
            </div>
            <p className="theme-quiet text-xs">阶段置信度会随最新转写持续调整。</p>
          </div>

          <div className="sheet-accent">
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase">
              当前最佳动作
            </p>
            <p className="mt-3 text-sm leading-7">{nextAction}</p>
          </div>

          <div className="theme-inline-card rounded-[var(--radius-card)] p-4">
            <p className="theme-quiet text-[11px] font-semibold tracking-[0.08em] uppercase">
              判断依据
            </p>
            <p className="theme-body mt-3 text-sm leading-7">{reason}</p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
          <div className="panel-empty theme-muted rounded-[var(--radius-card)] p-5 text-sm leading-7">
            等待第一轮分析结果。开始转写后，这里会给出当前讨论所处阶段和最优动作。
          </div>
        </div>
      )}
    </section>
  )
}
