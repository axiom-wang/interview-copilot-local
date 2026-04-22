import clsx from 'clsx'
import type { PhaseAnalysis } from '../types/analysis'

interface PhasePanelProps {
  phaseAnalysis: PhaseAnalysis | null
  isLoading?: boolean
  className?: string
}

const phaseLabels: Record<PhaseAnalysis['phase'], string> = {
  'problem-framing': '问题框定',
  'option-divergence': '方案发散',
  'alignment-building': '共识对齐',
  'decision-lock': '结论收束',
}

const phaseDescriptions: Record<PhaseAnalysis['phase'], string> = {
  'problem-framing': '先确认问题范围、目标和限制条件。',
  'option-divergence': '正在比较备选方案，关键是拉开差异。',
  'alignment-building': '讨论进入取舍与对齐阶段，需要明确共识。',
  'decision-lock': '已经接近收口，需要沉淀结论和后续动作。',
}

export function PhasePanel({
  phaseAnalysis,
  isLoading = false,
  className,
}: PhasePanelProps) {
  const nextAction =
    phaseAnalysis?.nextAction?.trim() ||
    phaseAnalysis?.nextBestAction?.trim() ||
    '继续围绕主线推进讨论，补齐最影响判断的信息。'

  const reason =
    phaseAnalysis?.reason?.trim() ||
    '当前证据还不够完整，建议继续补充高价值原话与关键约束。'

  if (isLoading && !phaseAnalysis) {
    return (
      <section className={clsx('panel-card h-full p-5', className)}>
        <p className="kicker theme-muted text-[11px]">阶段</p>
        <h2 className="theme-title mt-2 font-heading text-2xl">当前阶段</h2>
        <div className="mt-5 space-y-4">
          <div className="panel-skeleton h-8 w-28 rounded-full" />
          <div className="panel-skeleton h-2 w-full rounded-full" />
          <div className="panel-skeleton h-24 rounded-[22px]" />
          <div className="panel-skeleton h-20 rounded-[22px]" />
        </div>
      </section>
    )
  }

  return (
    <section className={clsx('panel-card h-full p-5', className)}>
      <p className="kicker theme-muted text-[11px]">阶段</p>
      <h2 className="theme-title mt-2 font-heading text-2xl">当前阶段</h2>

      {phaseAnalysis ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <span className="status-badge" data-tone="primary">
                {phaseLabels[phaseAnalysis.phase]}
              </span>
              <p className="theme-muted text-sm">
                {phaseDescriptions[phaseAnalysis.phase]}
              </p>
            </div>
            <div className="theme-button-primary rounded-[20px] border px-4 py-3 text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">
                Confidence
              </p>
              <p className="mt-2 text-xl font-semibold">
                {(phaseAnalysis.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="theme-progress-track h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-300"
                style={{ width: `${Math.max(8, phaseAnalysis.confidence * 100)}%` }}
              />
            </div>
            <p className="theme-quiet text-xs">阶段置信度会随最新转写持续调整。</p>
          </div>

          <div className="theme-button-primary rounded-[24px] border p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">
              当前最佳动作
            </p>
            <p className="mt-3 text-sm leading-7">{nextAction}</p>
          </div>

          <div className="theme-inline-card rounded-[24px] p-4">
            <p className="theme-quiet text-[11px] uppercase tracking-[0.18em]">
              判断依据
            </p>
            <p className="theme-body mt-3 text-sm leading-7">{reason}</p>
          </div>
        </div>
      ) : (
        <div className="panel-empty theme-muted mt-5 rounded-[24px] p-5 text-sm leading-7">
          等待第一轮分析结果。开始转写后，这里会给出当前讨论所处阶段和最优动作。
        </div>
      )}
    </section>
  )
}
