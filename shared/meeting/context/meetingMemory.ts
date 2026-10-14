import type { MeetingMemory, MeetingMemoryChunk, MeetingMemoryEvent, MemoryEventStatus } from '../types/meetingMemory'
import type { TranscriptSegment } from '../types/transcript'

export const MEMORY_CHUNK_CHARS = 6000
export const FULL_TRANSCRIPT_CHARS = 18000
export const MAX_HISTORY_CHARS = 100000
const statuses = new Set<string>(['discussed', 'proposed', 'confirmed', 'disputed', 'resolved', 'rejected', 'superseded'])
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const evidenceIdsFor = (value: unknown, sourceIds: Set<string>) => {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && sourceIds.has(id)))]
}

const readMemoryEvent = (event: unknown, sourceIds: Set<string>): MeetingMemoryEvent | undefined => {
  if (!isObject(event) || typeof event.topic !== 'string' || !event.topic.trim() ||
    typeof event.detail !== 'string' || !event.detail.trim() || typeof event.status !== 'string' ||
    !statuses.has(event.status)) return undefined
  const evidenceIds = evidenceIdsFor(event.evidenceIds, sourceIds)
  if (!evidenceIds.length) return undefined
  return {
    topic: event.topic.trim(),
    detail: event.detail.trim(),
    status: event.status as MemoryEventStatus,
    evidenceIds,
  }
}

export const parseMemoryEvents = (value: unknown, sourceIds: string[]): MeetingMemoryEvent[] => {
  if (!isObject(value) || !Array.isArray(value.events)) throw new Error('会议记忆格式无效。')
  const ids = new Set(sourceIds)
  return value.events.map((event: unknown) => {
    const parsed = readMemoryEvent(event, ids)
    const evidenceIds = isObject(event) ? event.evidenceIds : undefined
    if (!parsed || !Array.isArray(evidenceIds) || !evidenceIds.length ||
      !evidenceIds.every((id: unknown) => typeof id === 'string' && ids.has(id))) {
      throw new Error('会议记忆缺少有效的原话出处。')
    }
    return parsed
  })
}

/** Model output may cite missing ids. Keep grounded events and drop the rest. */
export const acceptMemoryEvents = (value: unknown, sourceIds: string[]): MeetingMemoryEvent[] => {
  if (!isObject(value) || !Array.isArray(value.events)) throw new Error('会议记忆格式无效。')
  const ids = new Set(sourceIds)
  return value.events.flatMap((event) => {
    const parsed = readMemoryEvent(event, ids)
    return parsed ? [parsed] : []
  })
}

export class MeetingContextCapacityError extends Error {
  readonly code = 'meeting-context-capacity' as const
  readonly meetingMemory: MeetingMemory

  constructor(meetingMemory: MeetingMemory) {
    super('会议上下文超出当前分析容量，请分段整理会议后再继续；没有只截取最近内容。')
    this.name = 'MeetingContextCapacityError'
    this.meetingMemory = meetingMemory
  }
}

export const isMeetingContextCapacityError = (error: unknown): error is MeetingContextCapacityError =>
  error instanceof MeetingContextCapacityError ||
  (typeof error === 'object' && error !== null &&
    (error as { code?: unknown }).code === 'meeting-context-capacity')

export const readPartialMeetingMemory = (error: unknown): MeetingMemory | undefined => {
  if (error instanceof MeetingContextCapacityError) return error.meetingMemory
  if (typeof error !== 'object' || error === null || !('meetingMemory' in error)) return undefined
  return normalizeMeetingMemory((error as { meetingMemory: unknown }).meetingMemory)
}

export const normalizeMeetingMemory = (value: unknown): MeetingMemory | undefined => {
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.chunks)) return undefined
  try {
    const chunks = value.chunks.map((chunk: unknown): MeetingMemoryChunk => {
      if (!isObject(chunk) || !Array.isArray(chunk.sourceIds) || !chunk.sourceIds.length ||
        !chunk.sourceIds.every((id: unknown) => typeof id === 'string') ||
        typeof chunk.sourceDigest !== 'string' || typeof chunk.startedAt !== 'number' ||
        typeof chunk.endedAt !== 'number') throw new Error('Invalid memory chunk')
      return { sourceIds: chunk.sourceIds, sourceDigest: chunk.sourceDigest,
        startedAt: chunk.startedAt, endedAt: chunk.endedAt,
        events: parseMemoryEvents(chunk, chunk.sourceIds) }
    })
    return { version: 1, chunks }
  } catch { return undefined }
}

export const stableTranscript = (segments: TranscriptSegment[]) => {
  const byId = new Map<string, TranscriptSegment>()
  for (const segment of segments) {
    const existing = byId.get(segment.id)
    if (!existing || segment.isFinal || !existing.isFinal) byId.set(segment.id, segment)
  }
  return [...byId.values()].filter((s) => s.text.trim()).sort((a, b) => a.timestamp - b.timestamp)
}

export const transcriptDigest = async (segments: TranscriptSegment[]) => {
  const text = JSON.stringify(segments.map(({ id, text, speaker, timestamp, isFinal }) => ({ id, text, speaker, timestamp, isFinal })))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const formatEvidence = (segments: TranscriptSegment[]) =>
  segments.map(({ id, speaker, timestamp, text, isFinal }) =>
    JSON.stringify({ id, speaker, timestamp, text, provisional: !isFinal })).join('\n')

export const formatMemory = (memory?: MeetingMemory) => memory?.chunks.map((chunk) =>
  JSON.stringify({ from: chunk.startedAt, to: chunk.endedAt, events: chunk.events })).join('\n') ?? ''

export type SummarizeChunk = (segments: TranscriptSegment[]) => Promise<MeetingMemoryEvent[]>

type HistoryPiece =
  | { kind: 'chunk'; chunk: MeetingMemoryChunk }
  | { kind: 'raw'; segments: TranscriptSegment[] }

const matchesChunk = async (source: TranscriptSegment[], chunk: MeetingMemoryChunk) =>
  source.length === chunk.sourceIds.length &&
  source.every((segment, index) => segment.isFinal && segment.id === chunk.sourceIds[index]) &&
  await transcriptDigest(source) === chunk.sourceDigest

const renderHistory = (pieces: HistoryPiece[]) => {
  const body = pieces.flatMap((piece) => {
    if (piece.kind === 'chunk') {
      const text = formatMemory({ version: 1, chunks: [piece.chunk] })
      return text ? [text] : []
    }
    if (!piece.segments.length) return []
    return [`尚未压缩的原话：\n${formatEvidence(piece.segments)}`]
  }).join('\n')
  return `全程会议记录（按时间顺序）：\n${body}`
}

export const prepareMeetingHistory = async (
  input: TranscriptSegment[], previous: MeetingMemory | undefined, summarize: SummarizeChunk,
) => {
  const segments = stableTranscript(input)
  const pieces: HistoryPiece[] = []
  let cursor = 0
  // A correction, deletion or insertion invalidates this checkpoint and all following checkpoints.
  for (const chunk of normalizeMeetingMemory(previous)?.chunks ?? []) {
    const hole = cursor
    while (cursor < segments.length && !segments[cursor].isFinal) cursor += 1
    if (cursor > hole) pieces.push({ kind: 'raw', segments: segments.slice(hole, cursor) })
    const source = segments.slice(cursor, cursor + chunk.sourceIds.length)
    if (!(await matchesChunk(source, chunk))) break
    pieces.push({ kind: 'chunk', chunk })
    cursor += source.length
  }

  while (formatEvidence(segments.slice(cursor)).length > FULL_TRANSCRIPT_CHARS) {
    if (!segments[cursor]?.isFinal) {
      const hole = cursor
      while (cursor < segments.length && !segments[cursor].isFinal) cursor += 1
      if (cursor > hole) pieces.push({ kind: 'raw', segments: segments.slice(hole, cursor) })
      if (cursor >= segments.length) break
      continue
    }
    const source: TranscriptSegment[] = []
    let size = 0
    let scan = cursor
    while (scan < segments.length && segments[scan].isFinal) {
      const length = formatEvidence([segments[scan]]).length
      if (source.length && size + length > MEMORY_CHUNK_CHARS) break
      source.push(segments[scan])
      size += length
      scan += 1
    }
    if (!source.length) break
    let events: MeetingMemoryEvent[]
    try {
      events = await summarize(source)
    } catch {
      break
    }
    if (!events.length) break
    pieces.push({
      kind: 'chunk',
      chunk: {
        sourceIds: source.map((segment) => segment.id),
        sourceDigest: await transcriptDigest(source),
        startedAt: source[0].timestamp,
        endedAt: source.at(-1)!.timestamp,
        events,
      },
    })
    cursor = scan
  }
  if (cursor < segments.length) pieces.push({ kind: 'raw', segments: segments.slice(cursor) })

  const chunks = pieces.flatMap((piece) => piece.kind === 'chunk' ? [piece.chunk] : [])
  const remaining = pieces.flatMap((piece) => piece.kind === 'raw' ? piece.segments : [])
  const memory: MeetingMemory = { version: 1, chunks }
  const history = renderHistory(pieces)
  if (history.length > MAX_HISTORY_CHARS) throw new MeetingContextCapacityError(memory)
  return { memory, history, segments, remaining }
}

export const findHistoricalEvidence = (segments: TranscriptSegment[], question: string, pinnedIds: string[] = []) => {
  const terms = new Set(question.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]{2}/g) ?? [])
  // Overlapping Chinese pairs also match phrases that start at a different position.
  for (const phrase of question.match(/[\u4e00-\u9fff]+/g) ?? []) {
    for (let i = 0; i < phrase.length - 1; i++) terms.add(phrase.slice(i, i + 2))
  }
  const pinned = new Set(pinnedIds)
  const ranked = segments.map((segment, index) => ({ segment, index,
    score: [...terms].filter((term) => segment.text.toLowerCase().includes(term)).length,
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || b.index - a.index).slice(0, 8)
  const selected = new Set<number>()
  for (const { index } of ranked) {
    for (let i = Math.max(0, index - 1); i <= Math.min(segments.length - 1, index + 1); i++) selected.add(i)
  }
  return segments.filter((segment, index) => pinned.has(segment.id) || selected.has(index))
}
