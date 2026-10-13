import clsx from 'clsx'
import type { SessionRecord } from '../../meeting/types/session'

interface ReplayTransportBarProps {
  session: SessionRecord
  replayTimestamp: number
  onChangeTimestamp: (timestamp: number) => void
  className?: string
}

const formatOffset = (sessionStartAt: number, timestamp: number) => {
  const offsetSeconds = Math.max(0, Math.round((timestamp - sessionStartAt) / 1000))
  const minutes = Math.floor(offsetSeconds / 60)
  const seconds = offsetSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function ReplayTransportBar({
  session,
  replayTimestamp,
  onChangeTimestamp,
  className,
}: ReplayTransportBarProps) {
  const atEnd = replayTimestamp >= session.endedAt

  return (
    <div className={clsx('panel-card flex items-center gap-3 px-4 py-2.5', className)}>
      <span className="theme-title w-12 shrink-0 text-sm font-semibold tabular-nums">
        {formatOffset(session.startedAt, replayTimestamp)}
      </span>
      <input
        aria-label="回放时间"
        className="theme-range h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-md accent-[color:var(--accent)]"
        max={session.endedAt}
        min={session.startedAt}
        onChange={(event) => onChangeTimestamp(Number(event.currentTarget.value))}
        step={1000}
        type="range"
        value={replayTimestamp}
      />
      <span className="theme-muted shrink-0 text-xs tabular-nums">
        {formatOffset(session.startedAt, session.endedAt)}
      </span>
      <button
        className="btn-ghost shrink-0 px-2 py-1 text-xs"
        disabled={atEnd}
        onClick={() => onChangeTimestamp(session.endedAt)}
        type="button"
      >
        跳到结尾
      </button>
    </div>
  )
}
