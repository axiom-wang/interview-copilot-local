import { MeetingContextDetails } from './MeetingContextDetails'
import type { MeetingMemory } from '../../meeting/types/meetingMemory'
import type { MeetingScenarioId } from '../../meeting/scenarios'
import clsx from 'clsx'
import { useState } from 'react'
import type { ConsensusAnalysis } from '../../meeting/types/analysis'
import type { SpeakerProfile } from '../../meeting/types/speaker'
import type { TranscriptSegment } from '../../meeting/types/transcript'

interface ConsensusPanelProps {
  meetingMemory?: MeetingMemory
  scenarioId?: MeetingScenarioId
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
    dotClassName: string
  }
> = {
  consensus: {
    title: '已形成共识',
    emptyText: '还没有明确共识。',
    dotClassName: 'bg-[color:var(--success)]',
  },
  tensions: {
    title: '仍有分歧',
    emptyText: '当前没有明显分歧。',
    dotClassName: 'bg-[color:var(--warning)]',
  },
  missing: {
    title: '关键缺口',
    emptyText: '当前没有明显缺口。',
    dotClassName: 'bg-[color:var(--danger)]',
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
    <div>
      <div className="flex items-center gap-2">
        <span className={clsx('inline-block h-2 w-2 rounded-full', meta.dotClassName)} />
        <p className="theme-title text-sm font-semibold">{meta.title}</p>
        <span className="theme-muted text-xs tabular-nums">{items.length}</span>
      </div>

      {items.length > 0 ? (
        <ul className="mt-1.5">
          {items.map((item) => {
            const itemKey = `${sectionKey}:${item}`
            const isInteractive = Boolean(detailSegments?.length)
            const isExpanded = expandedItemKey === itemKey
            const matchedSegments =
              isInteractive && isExpanded && detailSegments
                ? getDetailSegmentsForItem(item, detailSegments)
                : []

            return (
              <li key={itemKey}>
                {isInteractive ? (
                  <button
                    aria-expanded={isExpanded}
                    className={clsx(
                      '-mx-2 flex w-[calc(100%+1rem)] items-start justify-between gap-3 rounded-[var(--radius-control)] px-2 py-1.5 text-left text-sm transition',
                      isExpanded
                        ? 'bg-[color:var(--surface-inline-hover)] text-[color:var(--text-primary)]'
                        : 'theme-body hover:bg-[color:var(--surface-inline)]',
                    )}
                    onClick={() => onToggleItem(itemKey)}
                    type="button"
                  >
                    <span className="min-w-0 leading-6">{item}</span>
                    <span className="theme-quiet shrink-0 pt-0.5 whitespace-nowrap text-xs">
                      {isExpanded ? '收起' : '相关原话'}
                    </span>
                  </button>
                ) : (
                  <p className="theme-body py-1.5 text-sm leading-6">{item}</p>
                )}

                {isInteractive && isExpanded ? (
                  <div className="theme-divider mt-1 mb-2 ml-1 space-y-2.5 border-l pl-3">
                    {matchedSegments.length > 0 ? (
                      matchedSegments.map(({ segment }) => (
                        <blockquote key={`${itemKey}-${segment.id}`}>
                          <p className="theme-muted text-xs">
                            {getSpeakerLabel(segment.speaker, speakerProfiles)} ·{' '}
                            <span className="tabular-nums">{formatTime(segment.timestamp)}</span>
                          </p>
                          <p className="theme-title mt-0.5 text-sm leading-6">{segment.text}</p>
                        </blockquote>
                      ))
                    ) : (
                      <p className="theme-muted text-sm">暂时没有定位到足够直接的原文。</p>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="theme-muted mt-1.5 text-sm leading-6">{meta.emptyText}</p>
      )}
    </div>
  )
}

export function ConsensusPanel({
  analysis,
  meetingMemory,
  scenarioId,
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
    <h2 className="theme-title shrink-0 text-base font-semibold">共识与分歧</h2>
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
        <div className={clsx(bodyClassName, 'space-y-5')}>
          <MeetingContextDetails analysis={analysis} memory={meetingMemory} scenarioId={scenarioId}
            segments={detailSegments} speakerProfiles={speakerProfiles} />
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
          讨论推进后，这里会汇总已经达成的共识、还没解决的分歧和缺少的信息。点开任一条可以查找相关原话。
        </div>
      )}
    </section>
  )
}
