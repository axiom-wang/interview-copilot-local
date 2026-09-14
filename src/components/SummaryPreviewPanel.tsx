import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { resolveScenarioProfile, type MeetingScenarioId } from '../scenarios'
import { useAppStore } from '../store/useAppStore'
import type { MeetingMinutes, MeetingSummary } from '../types/analysis'

interface SummaryPreviewPanelProps {
  summary: MeetingSummary | null
  minutes?: MeetingMinutes | null
  className?: string
  isGenerating?: boolean
  isGeneratingMinutes?: boolean
  isStale?: boolean
  minutesStale?: boolean
  onGenerate?: () => Promise<boolean> | boolean | void
  onGenerateMinutes?: () => Promise<boolean> | boolean | void
  disableGenerate?: boolean
  scenarioId?: MeetingScenarioId
  /** Rendered inside a tab panel: the tab label already names the panel. */
  embedded?: boolean
  /** `launcher` renders only the action buttons plus the full-screen overlay. */
  presentation?: 'panel' | 'launcher'
}

type SummaryView = 'speech' | 'minutes'

const formatTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(timestamp)
    : '未生成'

const SectionList = ({
  title,
  items,
}: {
  title: string
  items: string[]
}) => (
  <section className="theme-inline-card rounded-[var(--radius-card)] p-4">
    <p className="theme-quiet text-[11px] font-semibold tracking-[0.08em] uppercase">
      {title}
    </p>
    {items.length > 0 ? (
      <ul className="theme-body mt-3 space-y-2 text-sm leading-7">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="theme-muted mt-3 text-sm">暂无</p>
    )}
  </section>
)

const SpeechContent = ({
  summary,
  spokenSummaryLabel,
}: {
  summary: MeetingSummary
  spokenSummaryLabel: string
}) => (
  <div className="space-y-4">
    <section className="sheet-accent p-5">
      <p className="text-[11px] font-semibold tracking-[0.08em] uppercase">
        {spokenSummaryLabel}
      </p>
      <p className="mt-3 text-sm leading-8">{summary.speech60s}</p>
    </section>
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionList items={summary.keyPoints} title="关键要点" />
      <SectionList items={summary.nextSteps} title="下一步动作" />
    </div>
  </div>
)

const MinutesContent = ({ minutes }: { minutes: MeetingMinutes }) => (
  <div className="space-y-4">
    <section className="sheet-accent p-5">
      <p className="text-[11px] font-semibold tracking-[0.08em] uppercase">
        {minutes.title}
      </p>
      <p className="mt-3 text-sm leading-8">{minutes.overview}</p>
    </section>

    {minutes.topics.map((topic, index) => (
      <section
        className="theme-inline-card rounded-[var(--radius-card)] p-4"
        key={`${topic.topic}-${index}`}
      >
        <h4 className="theme-title font-semibold">{topic.topic}</h4>
        <ul className="theme-body mt-3 space-y-2 text-sm leading-7">
          {topic.points.map((point, pointIndex) => (
            <li key={`${topic.topic}-${pointIndex}`}>{point}</li>
          ))}
        </ul>
        {topic.conclusion ? (
          <p className="theme-muted mt-3 text-sm">结论：{topic.conclusion}</p>
        ) : null}
      </section>
    ))}

    <div className="grid gap-4 lg:grid-cols-2">
      <SectionList items={minutes.decisions} title="已定决策" />
      <SectionList items={minutes.openQuestions} title="待定问题" />
    </div>

    <section className="theme-inline-card overflow-x-auto rounded-[var(--radius-card)] p-4">
      <p className="theme-quiet text-[11px] uppercase tracking-[0.18em]">行动项</p>
      {minutes.actionItems.length > 0 ? (
        <table className="theme-body mt-3 w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="theme-divider border-b">
              <th className="px-2 py-2">负责人</th>
              <th className="px-2 py-2">任务</th>
              <th className="px-2 py-2">时间</th>
            </tr>
          </thead>
          <tbody>
            {minutes.actionItems.map((item, index) => (
              <tr className="theme-divider border-b" key={`${item.task}-${index}`}>
                <td className="px-2 py-3">{item.owner || '待定'}</td>
                <td className="px-2 py-3">{item.task}</td>
                <td className="px-2 py-3">{item.due || '待定'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="theme-muted mt-3 text-sm">暂无行动项</p>
      )}
    </section>
  </div>
)

export function SummaryPreviewPanel({
  summary,
  minutes = null,
  className,
  isGenerating = false,
  isGeneratingMinutes = false,
  isStale = false,
  minutesStale = false,
  onGenerate,
  onGenerateMinutes,
  disableGenerate = false,
  scenarioId,
  embedded = false,
  presentation = 'panel',
}: SummaryPreviewPanelProps) {
  const activeScenarioId = useAppStore((state) => state.scenarioId)
  const profile = resolveScenarioProfile(scenarioId ?? activeScenarioId)
  const [activeView, setActiveView] = useState<SummaryView>('speech')
  const [isExpanded, setIsExpanded] = useState(false)
  const activeResult = activeView === 'speech' ? summary : minutes
  const isActiveGenerating =
    activeView === 'speech' ? isGenerating : isGeneratingMinutes
  const isActiveStale = activeView === 'speech' ? isStale : minutesStale
  const activeGenerate = activeView === 'speech' ? onGenerate : onGenerateMinutes

  useEffect(() => {
    if (!isExpanded) return
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExpanded(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isExpanded])

  const handleGenerate = async () => {
    if (!activeGenerate || disableGenerate || isActiveGenerating) return
    const shouldOpen = await activeGenerate()
    if (shouldOpen !== false) setIsExpanded(true)
  }

  const statusBadges = activeResult ? (
    <>
      <span className="status-badge">
        生成于 {formatTimestamp(activeResult.updatedAt)}
      </span>
      {isActiveStale ? (
        <span className="status-badge" data-tone="warning">
          内容可能过期
        </span>
      ) : null}
    </>
  ) : null

  const generateButton = activeGenerate ? (
    <button
      className={clsx('btn-secondary', embedded && 'text-xs')}
      disabled={disableGenerate || isActiveGenerating}
      onClick={() => void handleGenerate()}
      type="button"
    >
      {isActiveGenerating ? '生成中...' : '生成 / 刷新并查看'}
    </button>
  ) : null

  const viewSwitcher = (
    <div className="tabs-list w-fit shrink-0">
      {([
        ['speech', '口播稿'],
        ['minutes', '结构化纪要'],
      ] as const).map(([id, label]) => (
        <button
          className="tabs-trigger"
          data-active={activeView === id}
          key={id}
          onClick={() => setActiveView(id)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  )

  const content = activeView === 'speech'
    ? summary && (
        <SpeechContent
          spokenSummaryLabel={profile.spokenSummaryLabel}
          summary={summary}
        />
      )
    : minutes && <MinutesContent minutes={minutes} />

  const overlay = isExpanded ? (
    <div
      className="theme-overlay fixed inset-0 z-[1200] flex items-center justify-center px-4 py-6"
      onClick={() => setIsExpanded(false)}
    >
      <div
        className="theme-overlay-card panel-card flex h-[88vh] w-[92vw] max-w-[1180px] flex-col overflow-hidden border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="theme-divider flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="theme-title text-lg font-semibold">
              {activeView === 'speech' ? profile.spokenSummaryLabel : '标准会议纪要'}
            </h3>
            {viewSwitcher}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadges}
            {generateButton}
            <button
              className="btn-ghost"
              onClick={() => setIsExpanded(false)}
              type="button"
            >
              关闭
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {content ?? (
            <div className="panel-empty theme-muted rounded-[var(--radius-card)] p-5 text-sm leading-7">
              {activeView === 'speech'
                ? '尚未生成口播总结，点击“生成 / 刷新并查看”。'
                : '尚未生成标准会议纪要，点击“生成 / 刷新并查看”。'}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null

  if (presentation === 'launcher') {
    return (
      <>
        <button
          className="btn-secondary text-xs"
          disabled={
            isActiveGenerating || (!activeResult && (disableGenerate || !activeGenerate))
          }
          onClick={() => {
            if (activeResult) {
              setIsExpanded(true)
              return
            }

            void handleGenerate()
          }}
          type="button"
        >
          {isActiveGenerating
            ? '生成中...'
            : activeResult
              ? '查看会议总结'
              : '生成会议总结'}
        </button>
        {activeResult && isActiveStale ? (
          <span className="status-badge" data-tone="warning">
            总结可能过期
          </span>
        ) : null}
        {overlay}
      </>
    )
  }

  return (
    <section
      className={clsx(
        'panel-card flex min-h-0 flex-col overflow-hidden',
        embedded ? 'p-4' : 'p-5',
        className,
      )}
    >
      {embedded ? null : (
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker theme-muted text-[11px]">会议总结</p>
            <h2 className="theme-title mt-2 text-2xl font-semibold">
              {activeView === 'speech' ? profile.spokenSummaryLabel : '标准会议纪要'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadges}
            {generateButton}
          </div>
        </div>
      )}

      <div
        className={clsx(
          'flex shrink-0 flex-wrap items-center justify-between gap-2',
          embedded ? 'mt-0' : 'mt-4',
        )}
      >
        {viewSwitcher}
        {embedded ? (
          <div className="flex flex-wrap items-center gap-2">{generateButton}</div>
        ) : null}
      </div>

      {embedded && statusBadges ? (
        <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2">
          {statusBadges}
        </div>
      ) : null}

      <div
        className={clsx(
          'min-h-0 flex-1 overflow-y-auto',
          embedded ? 'mt-3' : 'mt-5',
        )}
      >
        {isActiveGenerating && !activeResult ? (
          <div className="panel-skeleton h-40 rounded-[var(--radius-card)]" />
        ) : content ? (
          <div
            className="block w-full cursor-pointer text-left"
            onClick={() => setIsExpanded(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                setIsExpanded(true)
              }
            }}
            role="button"
            tabIndex={0}
          >
            {content}
          </div>
        ) : (
          <div className="panel-empty theme-muted rounded-[var(--radius-card)] p-5 text-sm">
            {activeView === 'speech'
              ? '尚未生成口播总结。'
              : '尚未生成标准会议纪要。'}
          </div>
        )}
      </div>

      {overlay}
    </section>
  )
}
