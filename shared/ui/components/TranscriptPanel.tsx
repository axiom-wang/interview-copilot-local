import clsx from 'clsx'
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { PinnedSegment } from '../../meeting/types/session'
import type { SpeakerProfile } from '../../meeting/types/speaker'
import type { TranscriptSegment } from '../../meeting/types/transcript'
import { ActionMenu, type ActionMenuItem } from './ui/ActionMenu'

interface TranscriptPanelProps {
  title: string
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
  onTogglePin?: (segmentId: string) => void
  onExportAll?: () => void
}

interface SpeakerGroup {
  id: string
  speaker: string
  startedAt: number
  segments: TranscriptSegment[]
}

const GROUP_GAP_MS = 60_000

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
      <mark className="theme-mark rounded px-0.5" key={`${part}-${index}`}>
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

const groupBySpeaker = (segments: TranscriptSegment[]) =>
  segments.reduce<SpeakerGroup[]>((groups, segment) => {
    const last = groups.at(-1)
    const lastSegment = last?.segments.at(-1)

    if (
      last &&
      lastSegment &&
      last.speaker === segment.speaker &&
      segment.timestamp - lastSegment.timestamp <= GROUP_GAP_MS
    ) {
      last.segments.push(segment)
      return groups
    }

    groups.push({
      id: segment.id,
      speaker: segment.speaker,
      startedAt: segment.timestamp,
      segments: [segment],
    })
    return groups
  }, [])

export function TranscriptPanel({
  title,
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
  onTogglePin,
  onExportAll,
}: TranscriptPanelProps) {
  const pinnedIds = new Set(pinnedSegments.map((segment) => segment.segmentId))
  const [copiedSegmentId, setCopiedSegmentId] = useState<string | null>(null)
  const [stuckToBottom, setStuckToBottom] = useState(true)
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null)
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null)
  const [renameSpeakerId, setRenameSpeakerId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const compact = density === 'compact'
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const groups = groupBySpeaker(segments)

  useEffect(() => {
    const list = listRef.current

    if (!list || !followLatest) {
      return
    }

    const handleScroll = () => {
      const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight
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
    if (list) {
      list.scrollTop = list.scrollHeight
    }
  }, [followLatest, segments])

  useEffect(() => {
    if (!renameGroupId) {
      return
    }

    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [renameGroupId])

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
    setRenameGroupId(null)
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

  const showJumpToLatest = followLatest && !stuckToBottom && segments.length > 0

  const speakerMenuItems = (group: SpeakerGroup): ActionMenuItem[] => {
    const profile = speakerProfiles[group.speaker]
    const items: ActionMenuItem[] = []

    if (onMarkAsMe && !profile?.isMe) {
      items.push({ label: '这是我', onSelect: () => onMarkAsMe(group.speaker) })
    }
    if (onRenameSpeaker) {
      items.push({
        label: '改名',
        onSelect: () => {
          setRenameGroupId(group.id)
          setRenameSpeakerId(group.speaker)
          setRenameDraft(profile?.displayName ?? '')
        },
      })
    }
    if (onClearSpeakerBinding && (profile?.displayName || profile?.isMe)) {
      items.push({ label: '解除绑定', onSelect: () => onClearSpeakerBinding(group.speaker) })
    }

    return items
  }

  const segmentMenuItems = (segment: TranscriptSegment): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [
      {
        label: copiedSegmentId === segment.id ? '已复制' : '复制',
        onSelect: () => void copySegmentText(segment),
      },
    ]

    if (onTogglePin) {
      items.push({
        label: pinnedIds.has(segment.id) ? '取消标记' : '标记',
        onSelect: () => onTogglePin(segment.id),
      })
    }
    if (onDeleteSegment) {
      items.push({ label: '删除', onSelect: () => onDeleteSegment(segment.id), tone: 'danger' })
    }

    return items
  }

  return (
    <section
      className={clsx(
        'panel-card flex h-[70vh] min-h-0 flex-col overflow-hidden lg:h-full',
        className,
      )}
    >
      <div
        className={clsx(
          'theme-header-surface shrink-0 border-b',
          compact ? 'px-4 py-3' : 'px-5 py-3.5',
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="theme-title text-sm font-semibold">{title}</h2>
          <span className="theme-muted text-xs tabular-nums">
            {segments.length} 段
            {pinnedSegments.length > 0 ? ` · ${pinnedSegments.length} 处标记` : ''}
          </span>
          {headerControls ? (
            <div className="order-last w-full min-w-0 md:order-none md:ml-auto md:w-auto md:max-w-xs md:flex-1">
              {headerControls}
            </div>
          ) : null}
          {onExportAll ? (
            <button
              className={clsx('btn-ghost px-2 py-1 text-xs', !headerControls && 'ml-auto')}
              disabled={segments.length === 0}
              onClick={onExportAll}
              type="button"
            >
              导出
            </button>
          ) : null}
        </div>

        {pinnedSegments.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {pinnedSegments.map((segment) => (
              <button
                className="status-badge hover:brightness-95"
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
            compact ? 'gap-3 px-4 py-3' : 'gap-4 px-5 py-4',
          )}
          ref={listRef}
        >
          {segments.length === 0 ? (
            <div className="panel-empty theme-muted flex h-full items-center justify-center rounded-[var(--radius-card)] p-8 text-center text-sm leading-7">
              {emptyMessage}
            </div>
          ) : null}

          {groups.map((group) => {
            const profile = speakerProfiles[group.speaker]
            const isRenaming = renameGroupId === group.id
            const speakerItems = speakerMenuItems(group)

            return (
              <article className="min-w-0" key={group.id}>
                <div className="group/speaker flex items-center gap-2">
                  <span
                    className={clsx(
                      'truncate text-xs font-semibold',
                      profile?.isMe ? 'text-[color:var(--accent-text)]' : 'theme-title',
                    )}
                  >
                    {getSpeakerLabel(group.speaker, speakerProfiles)}
                  </span>
                  <span className="theme-quiet text-[11px] tabular-nums">
                    {formatTime(group.startedAt)}
                  </span>
                  <ActionMenu
                    className="opacity-100 transition md:opacity-0 md:group-hover/speaker:opacity-100 md:focus-within:opacity-100 md:data-[open=true]:opacity-100"
                    items={speakerItems}
                    label="说话人操作"
                  />
                </div>

                {isRenaming ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input
                      aria-label="发言人名称"
                      className="theme-input min-w-[10rem] flex-1 px-2.5 py-1 text-sm"
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
                    <button className="btn-primary px-2.5 py-1 text-xs" onClick={commitRename} type="button">
                      确认
                    </button>
                    <button className="btn-ghost px-2.5 py-1 text-xs" onClick={cancelRename} type="button">
                      取消
                    </button>
                  </div>
                ) : null}

                <div className="mt-1 space-y-0.5">
                  {group.segments.map((segment) => {
                    const pinned = pinnedIds.has(segment.id)

                    return (
                      <div
                        className={clsx(
                          'group/segment -mx-2 flex items-start gap-1 rounded-[var(--radius-control)] px-2 py-1 transition-colors',
                          highlightedSegmentId === segment.id
                            ? 'bg-[color:var(--accent-soft)]'
                            : pinned
                              ? 'bg-[color:var(--warning-soft)]'
                              : 'hover:bg-[color:var(--surface-inline)]',
                        )}
                        id={`transcript-segment-${segment.id}`}
                        key={segment.id}
                      >
                        <p
                          className={clsx(
                            'min-w-0 flex-1 text-sm leading-6',
                            segment.isFinal ? 'theme-body' : 'theme-muted',
                          )}
                        >
                          {renderHighlightedText(segment.text, searchTerm)}
                          {!segment.isFinal ? (
                            <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[11px] text-[color:var(--accent-text)]">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                              识别中
                            </span>
                          ) : null}
                        </p>
                        <ActionMenu
                          className="shrink-0 opacity-100 transition md:opacity-0 md:group-hover/segment:opacity-100 md:focus-within:opacity-100 md:data-[open=true]:opacity-100"
                          items={segmentMenuItems(segment)}
                          label="片段操作"
                        />
                      </div>
                    )
                  })}
                </div>
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
