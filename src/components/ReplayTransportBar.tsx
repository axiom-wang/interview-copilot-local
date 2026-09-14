import clsx from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'
import { resolveScenarioProfile } from '../scenarios'
import type { SessionRecord } from '../types/session'

interface ReplayTransportBarProps {
  className?: string
  sessions: SessionRecord[]
  selectedSessionId: string | null
  replayTimestamp: number | null
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onChangeTimestamp: (timestamp: number) => void
  onExportJson: () => void
  onExportMarkdown: () => void
  onResetLayout: () => void
}

const formatClock = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)

const formatDayTime = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)

const formatDay = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp)

const formatOffset = (sessionStartAt: number, timestamp: number) => {
  const offsetSeconds = Math.max(0, Math.round((timestamp - sessionStartAt) / 1000))
  const minutes = Math.floor(offsetSeconds / 60)
  const seconds = offsetSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function ReplayTransportBar({
  className,
  sessions,
  selectedSessionId,
  replayTimestamp,
  onSelectSession,
  onDeleteSession,
  onChangeTimestamp,
  onExportJson,
  onExportMarkdown,
  onResetLayout,
}: ReplayTransportBarProps) {
  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!pickerOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPickerOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pickerOpen])

  if (!selectedSession) {
    return null
  }

  const selectedScenario = resolveScenarioProfile(selectedSession.scenarioId).label
  const activeTimestamp = replayTimestamp ?? selectedSession.endedAt

  return (
    <section
      className={clsx(
        'panel-card h-full min-h-0 overflow-y-auto px-4 py-3 md:px-5',
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        <div className="relative lg:w-64 lg:shrink-0" ref={pickerRef}>
          <button
            aria-controls={listId}
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
            className="theme-input flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
            onClick={() => setPickerOpen((open) => !open)}
            type="button"
          >
            <span className="min-w-0">
              <span className="theme-title block truncate text-sm font-semibold">
                {selectedSession.title}
              </span>
              <span className="theme-muted mt-0.5 block truncate text-xs">
                {selectedScenario} · {formatDay(selectedSession.startedAt)}
                {selectedSession.id === 'session-demo' ? ' · 示例数据' : ''}
              </span>
            </span>
            <svg
              aria-hidden="true"
              className={clsx(
                'h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition-transform',
                pickerOpen && 'rotate-180',
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

          {pickerOpen ? (
            <div
              className="panel-card absolute left-0 z-20 mt-2 w-full min-w-[18rem] p-2 shadow-[var(--shadow-md)]"
              id={listId}
              role="listbox"
            >
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {sessions.map((session) => {
                  const isDemoSession = session.id === 'session-demo'
                  const isSelected = session.id === selectedSession.id
                  const scenarioLabel = resolveScenarioProfile(session.scenarioId).label

                  return (
                    <div className="flex items-start gap-1" key={session.id}>
                      <button
                        aria-selected={isSelected}
                        className={clsx(
                          'min-w-0 flex-1 rounded-[var(--radius-control)] px-3 py-2 text-left transition',
                          isSelected
                            ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]'
                            : 'theme-muted hover:bg-[color:var(--surface-inline)] hover:text-[color:var(--text-primary)]',
                        )}
                        onClick={() => {
                          onSelectSession(session.id)
                          setPickerOpen(false)
                        }}
                        role="option"
                        type="button"
                      >
                        <span className="theme-title block truncate text-sm font-semibold">
                          {session.title}
                        </span>
                        <span className="mt-1 block text-xs">
                          {formatDayTime(session.startedAt)} –{' '}
                          {formatDayTime(session.endedAt)}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          <span className="status-badge">{scenarioLabel}</span>
                          {isDemoSession ? (
                            <span className="status-badge" data-tone="primary">
                              示例数据
                            </span>
                          ) : null}
                        </span>
                      </button>
                      {!isDemoSession ? (
                        <button
                          className="btn-danger mt-1 shrink-0 text-xs"
                          onClick={() => {
                            onDeleteSession(session.id)
                            setPickerOpen(false)
                          }}
                          type="button"
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="theme-muted">回放位置</span>
            <span className="theme-title font-semibold tabular-nums">
              {formatClock(activeTimestamp)}
            </span>
            <span className="status-badge" data-tone="primary">
              {formatOffset(selectedSession.startedAt, activeTimestamp)} /{' '}
              {formatOffset(selectedSession.startedAt, selectedSession.endedAt)}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2.5">
            <span className="theme-quiet shrink-0 text-[11px] tabular-nums">
              {formatClock(selectedSession.startedAt)}
            </span>
            <input
              aria-label="回放时间"
              className="theme-range h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-md accent-[color:var(--accent)]"
              max={selectedSession.endedAt}
              min={selectedSession.startedAt}
              onChange={(event) => onChangeTimestamp(Number(event.currentTarget.value))}
              step={1000}
              type="range"
              value={activeTimestamp}
            />
            <span className="theme-quiet shrink-0 text-[11px] tabular-nums">
              {formatClock(selectedSession.endedAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            className="btn-ghost text-xs"
            onClick={onResetLayout}
            title="恢复默认分栏比例"
            type="button"
          >
            重置布局
          </button>
          <button
            className="btn-secondary text-xs"
            onClick={onExportJson}
            type="button"
          >
            导出 JSON
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={onExportMarkdown}
            type="button"
          >
            导出 Markdown
          </button>
        </div>
      </div>
    </section>
  )
}
