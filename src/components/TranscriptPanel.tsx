import clsx from 'clsx'
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { PinnedSegment } from '../types/session'
import type { SpeakerProfile } from '../types/speaker'
import type { TranscriptSegment } from '../types/transcript'

interface TranscriptPanelProps {
  title: string
  description?: string
  segments: TranscriptSegment[]
  pinnedSegments?: PinnedSegment[]
  emptyMessage?: string
  searchTerm?: string
  headerControls?: ReactNode
  speakerProfiles?: Record<string, SpeakerProfile>
  className?: string
  density?: 'full' | 'compact'
  followLatest?: boolean
  onMarkAsMe?: (speakerId: string) => void
  onRenameSpeaker?: (speakerId: string, name?: string) => void
  onClearSpeakerBinding?: (speakerId: string) => void
  onDeleteSegment?: (segmentId: string) => void
  onExportAll?: () => void
}

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const renderHighlightedText = (text: string, searchTerm: string) => {
  const normalizedSearchTerm = searchTerm.trim()

  if (!normalizedSearchTerm) {
    return text
  }

  const matcher = new RegExp(`(${escapeRegExp(normalizedSearchTerm)})`, 'gi')
  const parts = text.split(matcher)

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark className="theme-mark rounded px-1" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    ),
  )
}

const getSpeakerLabel = (
  speakerId: string,
  speakerProfiles: Record<string, SpeakerProfile>,
) => {
  const profile = speakerProfiles[speakerId]

  if (!profile) {
    return speakerId
  }

  if (profile.isMe) {
    return profile.displayName ? `我 · ${profile.displayName}` : '我'
  }

  return profile.displayName ?? speakerId
}

const actionButtonClassName =
  'rounded-md border px-2.5 py-1 text-xs transition focus-visible:opacity-100'

export function TranscriptPanel({
  title,
  description = '',
  segments,
  pinnedSegments = [],
  emptyMessage = '开始转写后，这里会显示实时滚动的内容。',
  searchTerm = '',
  headerControls = null,
  speakerProfiles = {},
  className,
  density = 'full',
  followLatest = false,
  onMarkAsMe,
  onRenameSpeaker,
  onClearSpeakerBinding,
  onDeleteSegment,
  onExportAll,
}: TranscriptPanelProps) {
  const pinnedIds = new Set(pinnedSegments.map((segment) => segment.segmentId))
  const [copiedSegmentId, setCopiedSegmentId] = useState<string | null>(null)
  const [stuckToBottom, setStuckToBottom] = useState(true)
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(
    null,
  )
  const [renameSegmentId, setRenameSegmentId] = useState<string | null>(null)
  const [renameSpeakerId, setRenameSpeakerId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const showDescription = description.trim().length > 0
  const compact = density === 'compact'
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const list = listRef.current

    if (!list || !followLatest) {
      return
    }

    const handleScroll = () => {
      const distanceFromBottom =
        list.scrollHeight - list.scrollTop - list.clientHeight
      const nextStuck = distanceFromBottom < 48
      stickToBottomRef.current = nextStuck
      setStuckToBottom(nextStuck)
    }

    handleScroll()
    list.addEventListener('scroll', handleScroll, { passive: true })
    return () => list.removeEventListener('scroll', handleScroll)
  }, [followLatest])

  useLayoutEffect(() => {
    if (!followLatest || !stickToBottomRef.current) {
      return
    }

    const list = listRef.current
    if (!list) {
      return
    }

    list.scrollTop = list.scrollHeight
  }, [followLatest, segments])

  useEffect(() => {
    if (!renameSegmentId) {
      return
    }

    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [renameSegmentId])

  const copySegmentText = async (segment: TranscriptSegment) => {
    try {
      await navigator.clipboard.writeText(segment.text)
      setCopiedSegmentId(segment.id)
      window.setTimeout(() => {
        setCopiedSegmentId((current) => (current === segment.id ? null : current))
      }, 1500)
    } catch {
      setCopiedSegmentId(null)
    }
  }

  const cancelRename = () => {
    setRenameSegmentId(null)
    setRenameSpeakerId(null)
    setRenameDraft('')
  }

  const commitRename = () => {
    if (!renameSpeakerId || !onRenameSpeaker) {
      cancelRename()
      return
    }

    const normalized = renameDraft.trim()
    onRenameSpeaker(renameSpeakerId, normalized ? normalized : undefined)
    cancelRename()
  }

  const jumpToLatest = () => {
    stickToBottomRef.current = true
    setStuckToBottom(true)
    const list = listRef.current
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  }

  const scrollToSegment = (segmentId: string) => {
    const target = document.getElementById(`transcript-segment-${segmentId}`)

    if (!target) {
      return
    }

    stickToBottomRef.current = false
    setStuckToBottom(false)
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setHighlightedSegmentId(segmentId)
    window.setTimeout(() => {
      setHighlightedSegmentId((current) => (current === segmentId ? null : current))
    }, 1600)
  }

  const showJumpToLatest =
    followLatest && !stuckToBottom && segments.length > 0

  return (
    <section
      className={clsx(
        'panel-card flex h-[70vh] min-h-0 flex-col overflow-hidden xl:h-full',
        className,
      )}
    >
      <div
        className={clsx(
          'theme-header-surface shrink-0 border-b',
          compact ? 'px-4 py-3' : 'px-5 py-4',
        )}
      >
        <div
          className={clsx(
            'flex flex-col gap-3 lg:flex-row lg:gap-4',
            compact
              ? 'lg:items-center lg:justify-between'
              : 'lg:items-start lg:justify-between',
          )}
        >
          <div className={clsx(compact && 'flex items-center gap-2')}>
            {compact ? null : (
              <p className="kicker theme-muted text-[11px]">Transcript</p>
            )}
            <h2
              className={clsx(
                'theme-title font-semibold',
                compact ? 'text-base' : 'mt-2 text-2xl',
              )}
            >
              {title}
            </h2>
            {showDescription ? (
              <p className="theme-muted mt-2 max-w-3xl text-sm leading-6">
                {description}
              </p>
            ) : null}
          </div>

          {headerControls ? (
            <div className="min-w-0 lg:max-w-sm lg:flex-1 lg:self-center">
              {headerControls}
            </div>
          ) : null}

          <div
            className={clsx(
              'flex flex-wrap items-center gap-2',
              headerControls && 'lg:self-center',
            )}
          >
            {onExportAll ? (
              <button
                className="btn-secondary text-xs"
                disabled={segments.length === 0}
                onClick={onExportAll}
                type="button"
              >
                导出转写
              </button>
            ) : null}
            <span className="status-badge">{segments.length} 条片段</span>
            <span className="status-badge">{pinnedSegments.length} 条标记</span>
          </div>
        </div>

        {pinnedSegments.length > 0 ? (
          <div className={clsx('flex flex-wrap gap-2', compact ? 'mt-3' : 'mt-4')}>
            {pinnedSegments.map((segment) => (
              <button
                className="status-badge hover:bg-[color:var(--surface-inline-hover)]"
                data-tone="warning"
                key={segment.id}
                onClick={() => scrollToSegment(segment.segmentId)}
                type="button"
              >
                {segment.note}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={clsx(
            'flex h-full min-h-0 flex-col overflow-y-auto',
            compact ? 'gap-2 px-4 py-3' : 'gap-3 px-5 py-4',
          )}
          ref={listRef}
        >
          {segments.length === 0 ? (
            <div className="panel-empty theme-muted flex h-full items-center justify-center rounded-[var(--radius-card)] p-8 text-center text-sm leading-7">
              {emptyMessage}
            </div>
          ) : null}

          {segments.map((segment) => {
            const profile = speakerProfiles[segment.speaker]
            const speakerLabel = getSpeakerLabel(segment.speaker, speakerProfiles)
            const isRenaming = renameSegmentId === segment.id

            return (
              <article
                className={clsx(
                  'group rounded-[var(--radius-card)] border px-3.5 py-2 transition',
                  highlightedSegmentId === segment.id
                    ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)]'
                    : pinnedIds.has(segment.id)
                      ? 'border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]'
                      : segment.isFinal
                        ? 'theme-inline-card'
                        : 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)]',
                )}
                id={`transcript-segment-${segment.id}`}
                key={segment.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="theme-muted flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="status-badge">{speakerLabel}</span>
                    <span>{formatTime(segment.timestamp)}</span>
                    <span
                      className="status-badge"
                      data-tone={segment.isFinal ? 'active' : 'primary'}
                    >
                      {segment.isFinal ? '已定稿' : '识别中'}
                    </span>
                    {pinnedIds.has(segment.id) ? (
                      <span className="status-badge" data-tone="warning">
                        已标记
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <button
                      className={clsx(actionButtonClassName, 'btn-secondary')}
                      onClick={() => {
                        void copySegmentText(segment)
                      }}
                      type="button"
                    >
                      {copiedSegmentId === segment.id ? '已复制' : '复制'}
                    </button>
                    {onDeleteSegment ? (
                      <button
                        className={clsx(actionButtonClassName, 'btn-danger')}
                        onClick={() => onDeleteSegment(segment.id)}
                        type="button"
                      >
                        删除
                      </button>
                    ) : null}
                    {onMarkAsMe && !profile?.isMe ? (
                      <button
                        className={clsx(actionButtonClassName, 'btn-secondary')}
                        onClick={() => onMarkAsMe(segment.speaker)}
                        type="button"
                      >
                        设为我
                      </button>
                    ) : null}
                    {onRenameSpeaker && !isRenaming ? (
                      <button
                        className={clsx(actionButtonClassName, 'btn-ghost')}
                        onClick={() => {
                          setRenameSegmentId(segment.id)
                          setRenameSpeakerId(segment.speaker)
                          setRenameDraft(profile?.displayName ?? '')
                        }}
                        type="button"
                      >
                        改名
                      </button>
                    ) : null}
                    {onClearSpeakerBinding && profile?.displayName ? (
                      <button
                        className={clsx(actionButtonClassName, 'btn-ghost')}
                        onClick={() => onClearSpeakerBinding(segment.speaker)}
                        type="button"
                      >
                        解绑
                      </button>
                    ) : null}
                  </div>
                </div>

                {isRenaming ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      aria-label="发言人名称"
                      className="theme-input min-w-[10rem] flex-1 px-3 py-1.5 text-sm"
                      onChange={(event) => setRenameDraft(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitRename()
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelRename()
                        }
                      }}
                      placeholder="发言人名称，留空则清除"
                      ref={renameInputRef}
                      value={renameDraft}
                    />
                    <button
                      className="btn-primary px-3 py-1.5 text-xs"
                      onClick={commitRename}
                      type="button"
                    >
                      确认
                    </button>
                    <button
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={cancelRename}
                      type="button"
                    >
                      取消
                    </button>
                  </div>
                ) : null}

                <p className="theme-title mt-1.5 text-[13px] leading-5">
                  {renderHighlightedText(segment.text, searchTerm)}
                </p>
              </article>
            )
          })}
        </div>

        {showJumpToLatest ? (
          <button
            className="btn-secondary absolute bottom-3 left-1/2 z-10 -translate-x-1/2 shadow-[var(--shadow-md)]"
            onClick={jumpToLatest}
            type="button"
          >
            回到最新
          </button>
        ) : null}
      </div>
    </section>
  )
}
