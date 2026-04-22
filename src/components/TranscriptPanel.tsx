import clsx from 'clsx'
import { Fragment, useState, type ReactNode } from 'react'
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
  'rounded-full border px-2.5 py-1 text-xs transition focus-visible:opacity-100'

export function TranscriptPanel({
  title,
  description = '',
  segments,
  pinnedSegments = [],
  emptyMessage = '开始转写后，这里会显示实时滚动的内容。',
  searchTerm = '',
  headerControls = null,
  speakerProfiles = {},
  onMarkAsMe,
  onRenameSpeaker,
  onClearSpeakerBinding,
  onDeleteSegment,
  onExportAll,
}: TranscriptPanelProps) {
  const pinnedIds = new Set(pinnedSegments.map((segment) => segment.segmentId))
  const [copiedSegmentId, setCopiedSegmentId] = useState<string | null>(null)
  const showDescription = description.trim().length > 0

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

  return (
    <section className="panel-card flex h-full min-h-[520px] flex-col overflow-hidden">
      <div className="theme-header-surface sticky top-0 z-10 border-b px-5 py-4 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="kicker theme-muted text-[11px]">Transcript</p>
            <h2 className="theme-title mt-2 font-heading text-2xl">{title}</h2>
            {showDescription ? (
              <p className="theme-muted mt-2 max-w-3xl text-sm leading-6">
                {description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onExportAll ? (
              <button
                className="theme-button-primary rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
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

        {headerControls ? <div className="mt-4">{headerControls}</div> : null}

        {pinnedSegments.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {pinnedSegments.map((segment) => (
              <span
                className="status-badge"
                data-tone="warning"
                key={segment.id}
              >
                {segment.note}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {segments.length === 0 ? (
          <div className="panel-empty theme-muted flex h-full items-center justify-center rounded-[24px] p-8 text-center text-sm leading-7">
            {emptyMessage}
          </div>
        ) : null}

        {segments.map((segment) => {
          const profile = speakerProfiles[segment.speaker]
          const speakerLabel = getSpeakerLabel(segment.speaker, speakerProfiles)

          return (
            <article
              className={clsx(
                'group rounded-[20px] border px-3.5 py-2 transition',
                pinnedIds.has(segment.id)
                  ? 'border-amber-300/24 bg-amber-300/8'
                  : segment.isFinal
                    ? 'theme-inline-card'
                    : 'border-cyan-300/14 bg-cyan-300/8',
              )}
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
                    className={clsx(
                      actionButtonClassName,
                      'theme-button-primary',
                    )}
                    onClick={() => {
                      void copySegmentText(segment)
                    }}
                    type="button"
                  >
                    {copiedSegmentId === segment.id ? '已复制' : '复制'}
                  </button>
                  {onDeleteSegment ? (
                    <button
                      className={clsx(
                        actionButtonClassName,
                        'theme-button-danger',
                      )}
                      onClick={() => onDeleteSegment(segment.id)}
                      type="button"
                    >
                      删除
                    </button>
                  ) : null}
                  {onMarkAsMe && !profile?.isMe ? (
                    <button
                      className={clsx(
                        actionButtonClassName,
                        'theme-button-success',
                      )}
                      onClick={() => onMarkAsMe(segment.speaker)}
                      type="button"
                    >
                      设为我
                    </button>
                  ) : null}
                  {onRenameSpeaker ? (
                    <button
                      className={clsx(
                        actionButtonClassName,
                        'theme-button-magenta',
                      )}
                      onClick={() => {
                        const nextName = window.prompt(
                          '请输入发言人名称（留空则清除名称）',
                          profile?.displayName ?? '',
                        )

                        if (nextName === null) {
                          return
                        }

                        const normalized = nextName.trim()
                        onRenameSpeaker(
                          segment.speaker,
                          normalized ? normalized : undefined,
                        )
                      }}
                      type="button"
                    >
                      改名
                    </button>
                  ) : null}
                  {onClearSpeakerBinding && profile?.displayName ? (
                    <button
                      className={clsx(
                        actionButtonClassName,
                        'theme-button-neutral',
                      )}
                      onClick={() => onClearSpeakerBinding(segment.speaker)}
                      type="button"
                    >
                      解绑
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="theme-title mt-1.5 text-[13px] leading-5">
                {renderHighlightedText(segment.text, searchTerm)}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
