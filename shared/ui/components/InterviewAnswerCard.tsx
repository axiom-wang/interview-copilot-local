import type {
  InterviewAnswerGrounding,
  InterviewQaTurn,
  InterviewQuestionType,
} from '../../meeting/types/analysis'

const QUESTION_TYPE_LABELS: Record<InterviewQuestionType, string> = {
  'self-intro': '自我介绍',
  behavioral: '行为题',
  technical: '专业题',
  motivation: '动机题',
  case: '案例题',
  'reverse-qa': '反问',
  other: '其他',
}

const GROUNDING_LABELS: Record<InterviewAnswerGrounding, { label: string; tone: string }> = {
  background: { label: '依据：我的经历', tone: 'active' },
  jd: { label: '依据：岗位 JD', tone: 'primary' },
  none: { label: '缺少背景依据', tone: 'warning' },
}

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`

const formatAskedAt = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)

export function InterviewAnswerCard({ turn }: { turn: InterviewQaTurn }) {
  const detail = turn.answer.interview

  if (!detail) {
    return null
  }

  const grounding = GROUNDING_LABELS[detail.grounding]
  const needsAnswer = detail.keyPoints.length > 0 || turn.answer.suggestedReply.length > 0

  return (
    <article className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="status-badge" data-tone="primary">
          {QUESTION_TYPE_LABELS[detail.questionType]}
        </span>
        {needsAnswer ? (
          <span className="status-badge" data-tone={grounding.tone}>
            {grounding.label}
          </span>
        ) : null}
        <span className="theme-muted ml-auto text-xs tabular-nums">
          {turn.timing ? (
            <span className="mr-2" title="识别：松开按键到拿到问题；生成：发出问题到收到回答">
              {turn.timing.recognitionMs !== undefined ? `识别 ${formatSeconds(turn.timing.recognitionMs)} · ` : ''}
              生成 {formatSeconds(turn.timing.answerMs)}
            </span>
          ) : null}
          {formatAskedAt(turn.askedAt)}
        </span>
      </div>

      <p className="theme-title text-sm font-semibold">问：{turn.question}</p>
      <p className="theme-muted text-sm leading-6">考察点：{turn.answer.conclusion}</p>

      {detail.keyPoints.length > 0 ? (
        <ol className="sheet-accent list-decimal space-y-1 pl-8 text-[15px] leading-7 font-medium">
          {detail.keyPoints.map((point, index) => (
            <li key={`${turn.id}-point-${index}`}>{point}</li>
          ))}
        </ol>
      ) : null}

      {turn.answer.suggestedReply ? (
        <div className="theme-inline-card rounded-[var(--radius-card)] px-4 py-3">
          <p className="theme-quiet text-[11px] font-semibold tracking-[0.08em]">可以这样说</p>
          <p className="theme-body mt-2 text-sm leading-7">{turn.answer.suggestedReply}</p>
        </div>
      ) : null}

      {detail.missingContext ? (
        <p className="sheet-warning text-sm leading-6">{detail.missingContext}</p>
      ) : null}
    </article>
  )
}
