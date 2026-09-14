import clsx from 'clsx'
import { resolveScenarioProfile, type MeetingScenarioId } from '../scenarios'
import { useAppStore } from '../store/useAppStore'
import type { InterviewQaTurn } from '../types/analysis'

const formatAskedAt = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)

interface AiQaPanelProps {
  questionDraft: string
  history: InterviewQaTurn[]
  isAnswering: boolean
  error: string | null
  disableAsk: boolean
  onQuestionDraftChange: (value: string) => void
  onAsk: () => void
  onClearHistory: () => void
  scenarioId?: MeetingScenarioId
  className?: string
  /** Rendered inside a tab panel: the tab label already names the panel. */
  embedded?: boolean
  density?: 'full' | 'compact'
}

export function AiQaPanel({
  questionDraft,
  history,
  isAnswering,
  error,
  disableAsk,
  onQuestionDraftChange,
  onAsk,
  onClearHistory,
  scenarioId,
  className,
  embedded = false,
  density = 'full',
}: AiQaPanelProps) {
  const activeScenarioId = useAppStore((state) => state.scenarioId)
  const profile = resolveScenarioProfile(scenarioId ?? activeScenarioId)
  const compact = density === 'compact'

  return (
    <section
      className={clsx(
        'panel-card flex min-h-0 flex-col overflow-hidden',
        embedded || compact ? 'p-4' : 'p-5',
        className,
      )}
    >
      {embedded ? null : compact ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h2 className="theme-title text-base font-semibold">AI 问答</h2>
          <button
            className="btn-ghost px-3 py-1.5 text-xs"
            disabled={history.length === 0}
            onClick={onClearHistory}
            type="button"
          >
            清空记录
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker theme-muted text-[11px]">AI 问答</p>
            <h2 className="theme-title mt-2 text-2xl font-semibold">问一句就能接着说</h2>
            <p className="theme-muted mt-2 text-sm">
              AI 只使用当前讨论转写和已应用的上下文，不会读取额外外部信息。
            </p>
          </div>
          <button
            className="btn-ghost"
            disabled={history.length === 0}
            onClick={onClearHistory}
            type="button"
          >
            清空记录
          </button>
        </div>
      )}

      <div
        className={clsx(
          'shrink-0 space-y-3',
          embedded ? 'mt-0' : compact ? 'mt-3' : 'mt-5 space-y-4',
        )}
      >
        <textarea
          className={clsx(
            'theme-input w-full rounded-[var(--radius-card)] px-4 py-3 text-sm leading-6 outline-none transition',
            embedded || compact ? 'min-h-[64px]' : 'min-h-[88px] leading-7',
          )}
          onChange={(event) => onQuestionDraftChange(event.currentTarget.value)}
          placeholder="例如：如果现在轮到我发言，我应该怎么先承接前面的讨论，再给出一个有判断的观点？"
          value={questionDraft}
        />

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 px-1">
            {profile.quickQuestions.map((item) => (
              <button
                className="btn-secondary text-xs"
                key={item}
                onClick={() => onQuestionDraftChange(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {embedded ? (
            <button
              className="btn-ghost text-xs"
              disabled={history.length === 0}
              onClick={onClearHistory}
              type="button"
            >
              清空记录
            </button>
          ) : null}
          <button
            className={clsx('btn-primary', compact && 'px-3 py-1.5 text-xs')}
            disabled={disableAsk || isAnswering}
            onClick={onAsk}
            type="button"
          >
            {isAnswering ? '回答中...' : '提问'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="sheet-danger mt-4 shrink-0 text-sm">
          {error}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div
          className={clsx(
            'min-h-0 flex-1 space-y-4 overflow-y-auto',
            embedded || compact ? 'mt-3' : 'mt-5',
          )}
        >
          {history.map((item) => (
            <article
              className="theme-inline-card-strong rounded-[var(--radius-card)] p-4"
              key={item.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="theme-title text-sm font-semibold">Q: {item.question}</p>
                <span className="theme-muted text-xs">
                  {formatAskedAt(item.askedAt)}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="sheet-accent">
                  <p className="text-[11px] font-semibold tracking-[0.08em] uppercase">
                    结论
                  </p>
                  <p className="mt-3 text-sm leading-7">
                    {item.answer.conclusion}
                  </p>
                </div>

                <div className="theme-inline-card rounded-[var(--radius-card)] px-4 py-4">
                  <p className="theme-quiet text-[11px] font-semibold tracking-[0.08em] uppercase">
                    依据
                  </p>
                  <ul className="theme-body mt-3 space-y-2 text-sm leading-7">
                    {item.answer.reasoning.map((reason, index) => (
                      <li key={`${item.id}-reason-${index}`}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <div className="theme-inline-card rounded-[var(--radius-card)] px-4 py-4">
                  <p className="theme-quiet text-[11px] font-semibold tracking-[0.08em] uppercase">
                    可以直接这么说
                  </p>
                  <p className="mt-3 text-sm leading-7">
                    {item.answer.suggestedReply}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div
          className={clsx(
            'panel-empty theme-muted min-h-0 flex-1 overflow-y-auto rounded-[var(--radius-card)] p-5 text-sm leading-7',
            embedded || compact ? 'mt-3' : 'mt-5',
          )}
        >
          输入问题后点击“提问”，这里会把 AI 的结论、依据和可直接说出口的话分层展示出来。
        </div>
      )}
    </section>
  )
}
