import clsx from 'clsx'
import type { TranscriptSegment } from '../../meeting/types/transcript'

/** One-line glimpse of the newest utterance while another tab covers the transcript. */
export function LatestTranscriptLine({
  segment,
  speakerName,
  onOpen,
  className,
}: {
  segment: TranscriptSegment | undefined
  speakerName?: string
  onOpen: () => void
  className?: string
}) {
  return (
    <button
      className={clsx(
        'theme-inline-card flex w-full min-w-0 items-center gap-2 rounded-[var(--radius-card)] px-3 py-2 text-left text-sm',
        className,
      )}
      onClick={onOpen}
      title="回到转写"
      type="button"
    >
      <span className="theme-muted shrink-0 text-xs">最新</span>
      {segment ? (
        <>
          <span className="theme-title shrink-0 font-medium">{speakerName ?? segment.speaker}</span>
          <span
            className={clsx('min-w-0 flex-1 truncate', segment.isFinal ? 'theme-body' : 'theme-muted')}
          >
            {segment.text}
          </span>
        </>
      ) : (
        <span className="theme-muted min-w-0 flex-1 truncate">还没有转写内容</span>
      )}
    </button>
  )
}
