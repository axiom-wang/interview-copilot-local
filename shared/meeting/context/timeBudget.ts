export interface TimeBudget {
  discussionMinutes: number
  reportMinutes?: number
}

export interface TimingContext extends TimeBudget {
  elapsedMinutes: number
}

export const WRAP_UP_MINUTES = 5

const isMinutes = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export const normalizeTimeBudget = (value: unknown): TimeBudget | null => {
  if (typeof value !== 'object' || value === null) return null
  const { discussionMinutes, reportMinutes } = value as Record<string, unknown>
  if (!isMinutes(discussionMinutes) || discussionMinutes === 0) return null
  return {
    discussionMinutes,
    ...(isMinutes(reportMinutes) && reportMinutes > 0 ? { reportMinutes } : {}),
  }
}

export const isTimingContext = (value: unknown): value is TimingContext => {
  if (!normalizeTimeBudget(value)) return false
  const { elapsedMinutes, reportMinutes } = value as Record<string, unknown>
  return isMinutes(elapsedMinutes) && (reportMinutes === undefined || isMinutes(reportMinutes))
}

export const buildTimingContext = (
  budget: TimeBudget | null,
  startedAt: number | null,
  now = Date.now(),
): TimingContext | undefined => budget && startedAt
  ? { ...budget, elapsedMinutes: Math.max(0, Math.floor((now - startedAt) / 60_000)) }
  : undefined

export const formatTimingContext = (timing: TimingContext | undefined) => {
  if (!timing) return ''
  const { elapsedMinutes, discussionMinutes, reportMinutes } = timing
  const remaining = discussionMinutes - elapsedMinutes
  const status = remaining < 0
    ? `已超时 ${-remaining} 分钟`
    : `剩余约 ${remaining} 分钟${remaining <= WRAP_UP_MINUTES ? '，已进入收口时间' : ''}`
  const report = reportMinutes ? `；之后汇报 ${reportMinutes} 分钟` : ''
  return `时间预算：讨论已进行约 ${elapsedMinutes} 分钟 / 计划 ${discussionMinutes} 分钟（${status}）${report}`
}
