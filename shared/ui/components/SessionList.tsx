import clsx from 'clsx'
import { useState } from 'react'
import { resolveScenarioProfile } from '../../meeting/scenarios'
import type { SessionRecord } from '../../meeting/types/session'
import { formatSessionDuration } from './sessionFormat'

interface SessionListProps {
  sessions: SessionRecord[]
  selectedSessionId: string | null
  onSelect: (sessionId: string) => void
  className?: string
}

const formatDayTime = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)

export function SessionList({ sessions, selectedSessionId, onSelect, className }: SessionListProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const visibleSessions = normalizedQuery
    ? sessions.filter((session) =>
        [
          session.title,
          resolveScenarioProfile(session.scenarioId).label,
          session.meetingSummary?.speech60s ?? '',
          session.meetingMinutes?.title ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : sessions

  return (
    <aside className={clsx('panel-card flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="theme-divider shrink-0 border-b p-3">
        <label className="block">
          <span className="sr-only">搜索会话</span>
          <input
            className="theme-input w-full px-3 py-1.5 text-sm"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={`搜索 ${sessions.length} 场会话`}
            type="search"
            value={query}
          />
        </label>
      </div>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {visibleSessions.map((session) => {
          const selected = session.id === selectedSessionId

          return (
            <li key={session.id}>
              <button
                aria-current={selected ? 'true' : undefined}
                className={clsx(
                  'block w-full rounded-[var(--radius-control)] px-3 py-2.5 text-left transition',
                  selected
                    ? 'bg-[color:var(--accent-soft)]'
                    : 'hover:bg-[color:var(--surface-inline)]',
                )}
                onClick={() => onSelect(session.id)}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'min-w-0 flex-1 truncate text-sm font-medium',
                      selected ? 'text-[color:var(--accent-text)]' : 'theme-title',
                    )}
                  >
                    {session.title}
                  </span>
                  {session.id === 'session-demo' ? (
                    <span className="theme-quiet shrink-0 text-[11px]">示例</span>
                  ) : null}
                </span>
                <span className="theme-muted mt-0.5 block truncate text-xs">
                  {resolveScenarioProfile(session.scenarioId).label} ·{' '}
                  {formatDayTime(session.startedAt)} · {formatSessionDuration(session)}
                </span>
              </button>
            </li>
          )
        })}
        {visibleSessions.length === 0 ? (
          <li className="theme-muted px-3 py-6 text-center text-sm">没有匹配的会话</li>
        ) : null}
      </ul>
    </aside>
  )
}
