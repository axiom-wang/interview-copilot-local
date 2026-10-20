import clsx from 'clsx'
import type { InterviewQaTurn } from '../../meeting/types/analysis'
import type { QuestionCaptureState } from '../store/useAppStore'
import { InterviewAnswerCard } from './InterviewAnswerCard'

const CAPTURE_LABELS: Record<QuestionCaptureState, string> = {
  idle: '按住提问',
  connecting: '连接中…',
  recording: '松开发送',
  transcribing: '识别中…',
}

interface InterviewAnswerPanelProps {
  latestTurn: InterviewQaTurn | null
  capture: QuestionCaptureState
  isAnswering: boolean
  error: string | null
  onCaptureStart: () => void
  onCaptureEnd: () => void
  captureHint?: string
  className?: string
}

export function InterviewAnswerPanel({
  latestTurn,
  capture,
  isAnswering,
  error,
  onCaptureStart,
  onCaptureEnd,
  captureHint = '按住空格或「按住提问」',
  className,
}: InterviewAnswerPanelProps) {
  const isCapturing = capture === 'connecting' || capture === 'recording'

  return (
    <section className={clsx('panel-card flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="theme-divider flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="theme-title text-sm font-semibold">回答要点</h2>
          {isAnswering ? (
            <span className="status-badge" data-tone="primary">生成中</span>
          ) : null}
        </div>
        <button
          aria-pressed={isCapturing}
          className={clsx(
            'select-none touch-none px-4 py-1.5 text-xs',
            capture === 'recording' ? 'btn-danger' : 'btn-primary',
          )}
          disabled={capture === 'transcribing'}
          onContextMenu={(event) => event.preventDefault()}
          onPointerCancel={onCaptureEnd}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            onCaptureStart()
          }}
          onPointerUp={onCaptureEnd}
          title="按住说出面试官的问题，松开后生成回答（也可按住空格）"
          type="button"
        >
          {CAPTURE_LABELS[capture]}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {error ? <div className="sheet-danger mb-3 text-sm">{error}</div> : null}

        {latestTurn?.answer.interview ? (
          <div className={clsx('transition-opacity duration-200', isAnswering && 'opacity-60')}>
            <InterviewAnswerCard turn={latestTurn} />
          </div>
        ) : isAnswering ? (
          <div className="space-y-4">
            <div className="panel-skeleton h-14 rounded-[var(--radius-card)]" />
            <div className="panel-skeleton h-24 rounded-[var(--radius-card)]" />
          </div>
        ) : (
          <div className="flex h-full min-h-32 flex-col items-start justify-center gap-1">
            <p className="theme-title text-sm font-medium">{captureHint}</p>
            <p className="theme-muted text-sm leading-6">
              只在按住期间收音。松开后识别问题，结合岗位 JD 给出考察点、三条以内的提词要点和一段口语回答；只引用你填写的经历，不编造。
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
