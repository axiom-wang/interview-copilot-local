import clsx from 'clsx'
import type { InterviewQaTurn } from '../types/analysis'

const QUICK_QUESTIONS = [
  '如果现在轮到我发言，我最稳妥的切入角度是什么？',
  '从业务判断看，当前方案最大的短板是什么？',
  '如果我是候选人，怎样表达会更专业、更有协作感？',
  '我应该怎么把这轮讨论推进到下一步？',
]

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
}: AiQaPanelProps) {
  return (
    <section className="panel-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker theme-muted text-[11px]">AI 问答</p>
          <h2 className="theme-title mt-2 font-heading text-2xl">问一句就能接着说</h2>
          <p className="theme-muted mt-2 text-sm">
            AI 只使用当前讨论转写和已应用的上下文，不会读取额外外部信息。
          </p>
        </div>
        <button
          className={clsx(
            'rounded-full border px-4 py-2 text-sm transition',
            history.length === 0
              ? 'theme-button-neutral border cursor-not-allowed'
              : 'theme-button-neutral border',
          )}
          disabled={history.length === 0}
          onClick={onClearHistory}
          type="button"
        >
          清空记录
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <textarea
          className="theme-input min-h-[132px] w-full rounded-[24px] px-4 py-3 text-sm leading-7 outline-none transition"
          onChange={(event) => onQuestionDraftChange(event.currentTarget.value)}
          placeholder="例如：如果现在轮到我发言，我应该怎么先承接前面的讨论，再给出一个有判断的观点？"
          value={questionDraft}
        />

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 px-1">
            {QUICK_QUESTIONS.map((item) => (
              <button
                className="theme-button-primary rounded-full border px-3 py-1.5 text-xs transition"
                key={item}
                onClick={() => onQuestionDraftChange(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            className={clsx(
              'rounded-full border px-4 py-2 text-sm transition',
              disableAsk || isAnswering
                ? 'theme-button-neutral cursor-not-allowed'
                : 'theme-button-primary',
            )}
            disabled={disableAsk || isAnswering}
            onClick={onAsk}
            type="button"
          >
            {isAnswering ? '回答中...' : '提问'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="theme-button-danger mt-4 rounded-[20px] border px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="mt-5 space-y-4">
          {history.map((item) => (
            <article
              className="theme-inline-card-strong rounded-[24px] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              key={item.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="theme-title text-sm font-semibold">Q: {item.question}</p>
                <span className="theme-muted text-xs">
                  {formatAskedAt(item.askedAt)}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="theme-button-primary rounded-[20px] border px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">
                    结论
                  </p>
                  <p className="mt-3 text-sm leading-7">
                    {item.answer.conclusion}
                  </p>
                </div>

                <div className="theme-inline-card rounded-[20px] px-4 py-4">
                  <p className="theme-quiet text-[11px] uppercase tracking-[0.18em]">
                    依据
                  </p>
                  <ul className="theme-body mt-3 space-y-2 text-sm leading-7">
                    {item.answer.reasoning.map((reason, index) => (
                      <li key={`${item.id}-reason-${index}`}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <div className="theme-button-warning rounded-[20px] border px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">
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
        <div className="panel-empty theme-muted mt-5 rounded-[24px] p-5 text-sm leading-7">
          输入问题后点击“提问”，这里会把 AI 的结论、依据和可直接说出口的话分层展示出来。
        </div>
      )}
    </section>
  )
}
