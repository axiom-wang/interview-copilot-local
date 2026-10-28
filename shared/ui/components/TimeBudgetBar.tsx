import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { WRAP_UP_MINUTES, type TimeBudget } from '../../meeting/context/timeBudget'

const formatClock = (ms: number) => {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** A single remaining-time chip; the full breakdown lives in the tooltip. */
export function TimeBudgetBar({ budget, className, endedAt, startedAt }: {
  budget: TimeBudget
  startedAt: number
  endedAt?: number | null
  className?: string
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (endedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [endedAt])

  const elapsed = Math.max(0, (endedAt ?? now) - startedAt)
  const remaining = budget.discussionMinutes * 60_000 - elapsed
  const tone = remaining < 0 ? 'danger' : remaining <= WRAP_UP_MINUTES * 60_000 ? 'warning' : 'normal'

  const remainingLabel = remaining < 0
    ? `已超时 ${formatClock(remaining)}`
    : `剩余 ${formatClock(remaining)}${tone === 'warning' ? ' · 该收口了' : ''}`

  return (
    <div
      className={clsx(
        'flex items-center gap-2 whitespace-nowrap rounded-[var(--radius-card)] border px-4 py-3 text-sm',
        tone === 'danger' && 'border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger-text)]',
        tone === 'warning' && 'border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning-text)]',
        tone === 'normal' && 'panel-card',
        className,
      )}
      role="timer"
      title={`已用 ${formatClock(elapsed)} / 计划 ${budget.discussionMinutes} 分钟${
        budget.reportMinutes ? `，之后汇报 ${budget.reportMinutes} 分钟` : ''
      }`}
    >
      <span className="font-semibold tabular-nums">{remainingLabel}</span>
      <span className="theme-muted text-xs tabular-nums">/ {budget.discussionMinutes} 分钟</span>
    </div>
  )
}
