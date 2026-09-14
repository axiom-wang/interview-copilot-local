import clsx from 'clsx'
import { useState } from 'react'
import type { ConsensusAnalysis } from '../types/analysis'
import type { SpeakerProfile } from '../types/speaker'
import type { TranscriptSegment } from '../types/transcript'

interface ConsensusPanelProps {
  analysis: ConsensusAnalysis | null
  detailSegments?: TranscriptSegment[]
  speakerProfiles?: Record<string, SpeakerProfile>
  isLoading?: boolean
  className?: string
  /** Rendered inside a tab panel: the tab label already names the panel. */
  embedded?: boolean
}

type ConsensusSectionKey = 'consensus' | 'tensions' | 'missing'

const MAX_DETAIL_SEGMENTS = 3

const sectionMeta: Record<
  ConsensusSectionKey,
  {
    title: string
    emptyText: string
    containerClassName: string
    badgeTone?: 'active' | 'warning' | 'danger'
  }
> = {
  consensus: {
    title: '已形成共识',
    emptyText: '还没有明确共识。',
    containerClassName:
      'border-[color:var(--success-border)] bg-[color:var(--success-soft)]',
    badgeTone: 'active',
  },
  tensions: {
    title: '仍有分歧',
    emptyText: '当前没有明显分歧。',
    containerClassName:
      'border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]',
    badgeTone: 'warning',
  },
  missing: {
    title: '关键缺口',
    emptyText: '当前没有明显缺口。',
    containerClassName:
      'border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]',
    badgeTone: 'danger',
  },
}

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)

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

const normalizeComparableText = (value: string) =>
  value
    .toLowerCase()
    .replace(
      /[\s.,!?;:'"`~@#$%^&*_+=\-\\/|()[\]{}<>，。！？；：“”‘’、（）【】]+/g,
      '',
    )
    .trim()

const getStableSegments = (segments: TranscriptSegment[]) => {
  const latestById = new Map<string, TranscriptSegment>()

  for (const segment of segments) {
    if (!segment.text.trim()) {
      continue
    }

    const existing = latestById.get(segment.id)

    if (
      !existing ||
      segment.timestamp > existing.timestamp ||
      (segment.timestamp === existing.timestamp &&
        segment.isFinal &&
        !existing.isFinal)
    ) {
      latestById.set(segment.id, segment)
    }
  }

  return [...latestById.values()]
}

const getSearchChunks = (value: string) => {
  const normalized = normalizeComparableText(value)

  if (!normalized) {
    return []
  }

  if (normalized.length < 2) {
    return [normalized]
  }

  const sizes =
    normalized.length >= 4
      ? [4, 3, 2]
      : normalized.length === 3
        ? [3, 2]
        : [2]
  const chunks = new Set<string>()

  for (const size of sizes) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      chunks.add(normalized.slice(index, index + size))
    }
  }

  return [...chunks]
}

const getSegmentRelevanceScore = (item: string, segment: TranscriptSegment) => {
  const normalizedItem = normalizeComparableText(item)
  const normalizedSegmentText = normalizeComparableText(segment.text)

  if (!normalizedItem || !normalizedSegmentText) {
    return 0
  }

  let score = 0

  if (normalizedSegmentText.includes(normalizedItem)) {
    score += 400 + normalizedItem.length * 10
  }

  if (normalizedItem.includes(normalizedSegmentText)) {
    score += 180 + normalizedSegmentText.length * 4
  }

  for (const chunk of getSearchChunks(normalizedItem)) {
    if (chunk.length < 2 || !normalizedSegmentText.includes(chunk)) {
      continue
    }

    score += chunk.length >= 4 ? 40 : chunk.length === 3 ? 24 : 12
  }

  return score
}

const getDetailSegmentsForItem = (
  item: string,
  segments: TranscriptSegment[],
) => {
  const stableSegments = getStableSegments(segments)
  const finalSegments = stableSegments.filter((segment) => segment.isFinal)
  const candidates = finalSegments.length > 0 ? finalSegments : stableSegments

  return candidates
    .map((segment) => ({
      segment,
      score: getSegmentRelevanceScore(item, segment),
    }))
    .filter((itemWithScore) => itemWithScore.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.segment.timestamp - left.segment.timestamp,
    )
    .slice(0, MAX_DETAIL_SEGMENTS)
}

const ConsensusSection = ({
  sectionKey,
  items,
  detailSegments,
  speakerProfiles,
  expandedItemKey,
  onToggleItem,
}: {
  sectionKey: ConsensusSectionKey
  items: string[]
  detailSegments?: TranscriptSegment[]
  speakerProfiles: Record<string, SpeakerProfile>
  expandedItemKey: string | null
  onToggleItem: (itemKey: string) => void
}) => {
  const meta = sectionMeta[sectionKey]

  return (
    <div
      className={clsx(
        'rounded-[var(--radius-card)] border p-4',
        meta.containerClassName,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="theme-title text-sm font-semibold">{meta.title}</p>
        <span className="status-badge" data-tone={meta.badgeTone}>
          {items.length} 条
        </span>
      </div>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const itemKey = `${sectionKey}:${item}`
            const isInteractive = Boolean(detailSegments?.length)
            const isExpanded = expandedItemKey === itemKey
            const matchedSegments =
              isInteractive && isExpanded && detailSegments
                ? getDetailSegmentsForItem(item, detailSegments)
                : []

            return (
              <li className="space-y-3" key={itemKey}>
                {isInteractive ? (
                  <button
                    className={clsx(
                      'flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-left text-sm transition',
                      isExpanded
                        ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]'
                        : 'theme-inline-card-hover theme-inline-card theme-body',
                    )}
                    onClick={() => onToggleItem(itemKey)}
                    type="button"
                  >
                    <span className="min-w-0 leading-6">{item}</span>
                    <span className="theme-muted shrink-0 whitespace-nowrap text-xs">
                      {isExpanded ? '收起' : '证据'}
                    </span>
                  </button>
                ) : (
                  <div className="theme-inline-card theme-body rounded-[var(--radius-card)] px-4 py-3 text-sm leading-6">
                    {item}
                  </div>
                )}

                {isInteractive && isExpanded ? (
                  <div className="theme-inline-card-strong rounded-[var(--radius-card)] p-3">
                    {matchedSegments.length > 0 ? (
                      <div className="space-y-3">
                        {matchedSegments.map(({ segment }) => (
                          <article
                            className="theme-inline-card rounded-[var(--radius-card)] px-4 py-3"
                            key={`${itemKey}-${segment.id}`}
                          >
                            <div className="theme-muted flex flex-wrap items-center gap-2 text-xs">
                              <span className="status-badge">
                                {getSpeakerLabel(segment.speaker, speakerProfiles)}
                              </span>
                              <span>{formatTime(segment.timestamp)}</span>
                            </div>
                            <p className="theme-title mt-3 text-sm leading-7">
                              {segment.text}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="theme-muted text-sm">
                        暂时没有定位到足够直接的原文证据。
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="theme-body mt-4 text-sm leading-7">{meta.emptyText}</p>
      )}
    </div>
  )
}

export function ConsensusPanel({
  analysis,
  detailSegments,
  speakerProfiles = {},
  isLoading = false,
  className,
  embedded = false,
}: ConsensusPanelProps) {
  const [expandedItemKey, setExpandedItemKey] = useState<string | null>(null)
  const shellClassName = clsx(
    'panel-card flex min-h-0 flex-col overflow-hidden',
    embedded ? 'p-4' : 'p-5',
    className,
  )
  const header = embedded ? null : (
    <>
      <p className="kicker theme-muted shrink-0 text-[11px]">共识 / 分歧</p>
      <h2 className="theme-title mt-2 shrink-0 text-2xl font-semibold">讨论快照</h2>
    </>
  )
  const bodyClassName = clsx(
    'min-h-0 flex-1 overflow-y-auto',
    embedded ? 'mt-0' : 'mt-5',
  )

  if (isLoading && !analysis) {
    return (
      <section className={shellClassName}>
        {header}
        <div className={clsx(bodyClassName, 'space-y-4')}>
          <div className="panel-skeleton h-28 rounded-[var(--radius-card)]" />
          <div className="panel-skeleton h-28 rounded-[var(--radius-card)]" />
          <div className="panel-skeleton h-28 rounded-[var(--radius-card)]" />
        </div>
      </section>
    )
  }

  return (
    <section className={shellClassName}>
      {header}

      {analysis ? (
        <div className={clsx(bodyClassName, 'space-y-4')}>
          <ConsensusSection
            detailSegments={detailSegments}
            expandedItemKey={expandedItemKey}
            items={analysis.consensus}
            onToggleItem={(itemKey) =>
              setExpandedItemKey((current) => (current === itemKey ? null : itemKey))
            }
            sectionKey="consensus"
            speakerProfiles={speakerProfiles}
          />
          <ConsensusSection
            detailSegments={detailSegments}
            expandedItemKey={expandedItemKey}
            items={analysis.tensions}
            onToggleItem={(itemKey) =>
              setExpandedItemKey((current) => (current === itemKey ? null : itemKey))
            }
            sectionKey="tensions"
            speakerProfiles={speakerProfiles}
          />
          <ConsensusSection
            detailSegments={detailSegments}
            expandedItemKey={expandedItemKey}
            items={analysis.missing}
            onToggleItem={(itemKey) =>
              setExpandedItemKey((current) => (current === itemKey ? null : itemKey))
            }
            sectionKey="missing"
            speakerProfiles={speakerProfiles}
          />
        </div>
      ) : (
        <div
          className={clsx(
            bodyClassName,
            'panel-empty theme-muted rounded-[var(--radius-card)] p-5 text-sm leading-7',
          )}
        >
          这里会在转写推进后持续汇总当前已达成的共识、尚未解决的分歧，以及缺失的信息。
        </div>
      )}
    </section>
  )
}
