import clsx from 'clsx'
import { resolveScenarioProfile } from '../scenarios'
import type { ReplaySnapshot, SessionRecord } from '../types/session'

interface ReplayTimelineProps {
  sessions: SessionRecord[]
  selectedSessionId: string | null
  replayTimestamp: number | null
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onChangeTimestamp: (timestamp: number) => void
  onJumpToSnapshot: (snapshot: ReplaySnapshot) => void
}

const formatClock = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)

const formatOffset = (sessionStartAt: number, timestamp: number) => {
  const offsetSeconds = Math.max(0, Math.round((timestamp - sessionStartAt) / 1000))
  const minutes = Math.floor(offsetSeconds / 60)
  const seconds = offsetSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function ReplayTimeline({
  sessions,
  selectedSessionId,
  replayTimestamp,
  onSelectSession,
  onDeleteSession,
  onChangeTimestamp,
  onJumpToSnapshot,
}: ReplayTimelineProps) {
  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null

  return (
    <section className="panel-card flex h-full min-h-[520px] flex-col p-5 xl:min-h-[720px]">
      <div>
        <p className="kicker theme-muted text-[11px]">会话导航</p>
        <h2 className="theme-title mt-2 text-2xl font-semibold">回放时间导航</h2>
        <p className="theme-muted mt-2 text-sm leading-6">
          左侧保留会话列表，选中后可直接拖动时间、跳快照、查看摘要与导图。
        </p>
      </div>

      <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
        {sessions.map((session) => {
          const isDemoSession = session.id === 'session-demo'
          const isSelected = session.id === selectedSessionId
          const scenarioLabel = resolveScenarioProfile(session.scenarioId).label

          return (
            <article
              className={clsx(
                'rounded-[var(--radius-card)] border p-4 transition',
                isSelected
                  ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)]'
                  : 'theme-inline-card theme-inline-card-hover',
              )}
              key={session.id}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  className="flex-1 text-left"
                  onClick={() => onSelectSession(session.id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="theme-title text-base font-semibold">
                      {session.title}
                    </span>
                    {isDemoSession ? (
                      <span className="status-badge" data-tone="primary">
                        示例数据
                      </span>
                    ) : null}
                    <span className="status-badge">{scenarioLabel}</span>
                    {session.meetingSummary ? (
                      <span className="status-badge" data-tone="active">
                        有总结
                      </span>
                    ) : null}
                    {session.meetingMinutes ? (
                      <span className="status-badge" data-tone="active">
                        有纪要
                      </span>
                    ) : null}
                  </div>
                  <p className="theme-muted mt-2 text-xs">
                    {formatClock(session.startedAt)} - {formatClock(session.endedAt)}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="theme-inline-card-strong rounded-[var(--radius-card)] px-3 py-2">
                      <p className="theme-quiet text-[11px] font-semibold tracking-[0.08em] uppercase">
                        转写
                      </p>
                      <p className="theme-title mt-1 text-sm">
                        {session.transcriptSegments.length}
                      </p>
                    </div>
                    <div className="theme-inline-card-strong rounded-[var(--radius-card)] px-3 py-2">
                      <p className="theme-quiet text-[11px] font-semibold tracking-[0.08em] uppercase">
                        快照
                      </p>
                      <p className="theme-title mt-1 text-sm">
                        {session.analysisSnapshots.length}
                      </p>
                    </div>
                    <div className="theme-inline-card-strong rounded-[var(--radius-card)] px-3 py-2">
                      <p className="theme-quiet text-[11px] font-semibold tracking-[0.08em] uppercase">
                        标记
                      </p>
                      <p className="theme-title mt-1 text-sm">
                        {session.pinnedSegments.length}
                      </p>
                    </div>
                  </div>
                </button>

                {!isDemoSession ? (
                  <button
                    className="btn-danger text-xs"
                    onClick={() => onDeleteSession(session.id)}
                    type="button"
                  >
                    删除
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      {selectedSession ? (
        <div className="theme-inline-card-strong mt-5 rounded-[var(--radius-card)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="theme-title text-sm font-semibold">当前回放位置</p>
              <p className="theme-muted mt-1 text-xs">
                {replayTimestamp ? formatClock(replayTimestamp) : '未选择时间'}
              </p>
            </div>
            <span className="status-badge" data-tone="primary">
              {replayTimestamp
                ? formatOffset(selectedSession.startedAt, replayTimestamp)
                : '0:00'}
            </span>
          </div>

          <input
            className="theme-range mt-4 h-2 w-full cursor-pointer appearance-none rounded-md accent-[color:var(--accent)]"
            max={selectedSession.endedAt}
            min={selectedSession.startedAt}
            onChange={(event) => onChangeTimestamp(Number(event.currentTarget.value))}
            step={1000}
            type="range"
            value={replayTimestamp ?? selectedSession.endedAt}
          />

          <div className="theme-quiet mt-2 flex items-center justify-between text-xs">
            <span>{formatClock(selectedSession.startedAt)}</span>
            <span>{formatClock(selectedSession.endedAt)}</span>
          </div>

          <div className="mt-4">
            <p className="theme-title text-sm font-semibold">快照跳转</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSession.analysisSnapshots.map((snapshot) => (
                <button
                  className="btn-secondary text-xs"
                  key={snapshot.id}
                  onClick={() => onJumpToSnapshot(snapshot)}
                  type="button"
                >
                  {formatOffset(selectedSession.startedAt, snapshot.timestamp)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
