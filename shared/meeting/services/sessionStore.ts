import mockAnalysis from '../sample/mockAnalysis.json'
import mockTranscript from '../sample/mockTranscript.json'
import { normalizeFunctionType } from './analysisNormalization'
import { normalizeMindMapSnapshot } from './mindMapTransform'
import { resolveScenarioProfile } from '../scenarios'
import type {
  ConsensusAnalysis,
  MeetingMinutes,
  MeetingSummary,
  PhaseAnalysis,
  PhaseType,
  SpeakingHints,
} from '../types/analysis'
import type { MindMapSnapshot } from '../types/mindmap'
import type { PinnedSegment, ReplaySnapshot, SessionRecord } from '../types/session'
import type { SpeakerNameSource, SpeakerProfile } from '../types/speaker'
import type { TranscriptSeed, TranscriptSegment } from '../types/transcript'

const SESSION_STORAGE_KEY = 'interview-copilot-local/saved-sessions'
const DEMO_SESSION_ID = 'session-demo'
const DEMO_SESSION_STARTED_AT = Date.UTC(2026, 3, 9, 14, 0, 0)

const PHASE_VALUES = new Set<PhaseType>([
  'problem-framing',
  'option-divergence',
  'alignment-building',
  'decision-lock',
])

type JsonRecord = Record<string, unknown>

interface DemoAnalysisScenario {
  minSegments: number
  phase?: JsonRecord
  consensus?: JsonRecord
  hints?: JsonRecord
  mindMap?: JsonRecord
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null

const asString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim()
  return normalized || fallback
}

const asFiniteNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback

const clampZeroToOne = (value: unknown, fallback: number) => {
  const candidate = asFiniteNumber(value, fallback)
  return Math.max(0, Math.min(1, candidate))
}

const uniqueStrings = (values: unknown, maxItems = Number.POSITIVE_INFINITY) => {
  const source = Array.isArray(values) ? values : []
  const result: string[] = []

  for (const value of source) {
    const normalized = asString(value)

    if (!normalized || result.includes(normalized)) {
      continue
    }

    result.push(normalized)

    if (result.length >= maxItems) {
      break
    }
  }

  return result
}

const buildDefaultSpeakerProfile = (
  speakerId: string,
  updatedAt: number,
  displayName?: string,
): SpeakerProfile => ({
  speakerId,
  displayName,
  isMe: false,
  nameSource: 'manual',
  updatedAt,
})

const normalizePhaseAnalysis = (
  value: unknown,
  updatedAt: number,
): PhaseAnalysis => {
  const record = isRecord(value) ? value : {}
  const phase = asString(record.phase, 'problem-framing')
  const nextAction = asString(
    record.nextAction ?? record.nextBestAction,
    '继续围绕当前主线推进讨论。',
  )
  const nextBestAction = asString(record.nextBestAction)

  return {
    phase: PHASE_VALUES.has(phase as PhaseType)
      ? (phase as PhaseType)
      : 'problem-framing',
    confidence: clampZeroToOne(record.confidence, 0.5),
    nextAction,
    nextBestAction: nextBestAction || undefined,
    reason: asString(record.reason, '当前证据有限，建议继续补充关键讨论信息。'),
    updatedAt,
  }
}

const normalizeConsensusAnalysis = (
  value: unknown,
  updatedAt: number,
): ConsensusAnalysis => {
  const record = isRecord(value) ? value : {}

  return {
    consensus: uniqueStrings(record.consensus, 4),
    tensions: uniqueStrings(record.tensions, 4),
    missing: uniqueStrings(record.missing, 4),
    updatedAt,
  }
}

const normalizeSpeakingHints = (
  value: unknown,
  updatedAt: number,
): SpeakingHints => {
  const record = isRecord(value) ? value : {}
  const hint15s = asString(
    record.hint15s,
    '我先帮大家把当前讨论收一下，再推进下一步。',
  )

  return {
    functionType: normalizeFunctionType(asString(record.functionType)),
    whyNow: asString(record.whyNow),
    hint15s,
    hint30s: asString(record.hint30s, hint15s),
    hint60s: asString(record.hint60s, hint15s),
    updatedAt,
  }
}

const normalizeMeetingSummary = (
  value: unknown,
  fallbackTimestamp: number,
): MeetingSummary | null => {
  const record = isRecord(value) ? value : null

  if (!record) {
    return null
  }

  const speech60s = asString(record.speech60s)
  const keyPoints = uniqueStrings(record.keyPoints, 6)
  const nextSteps = uniqueStrings(record.nextSteps, 6)

  if (!speech60s && keyPoints.length === 0 && nextSteps.length === 0) {
    return null
  }

  return {
    speech60s: speech60s || keyPoints[0] || '暂无总结发言',
    keyPoints: keyPoints.length > 0 ? keyPoints : ['待补充关键要点'],
    nextSteps: nextSteps.length > 0 ? nextSteps : ['待补充下一步动作'],
    updatedAt: asFiniteNumber(record.updatedAt, fallbackTimestamp),
  }
}

const normalizeMeetingMinutes = (
  value: unknown,
  fallbackTimestamp: number,
): MeetingMinutes | null => {
  const record = isRecord(value) ? value : null

  if (!record) {
    return null
  }

  const topics = (Array.isArray(record.topics) ? record.topics : [])
    .filter(isRecord)
    .map((topic) => ({
      topic: asString(topic.topic),
      points: uniqueStrings(topic.points),
      conclusion: asString(topic.conclusion),
    }))
    .filter((topic) => topic.topic || topic.points.length > 0)
  const actionItems = (
    Array.isArray(record.actionItems) ? record.actionItems : []
  )
    .filter(isRecord)
    .map((item) => ({
      owner: asString(item.owner),
      task: asString(item.task),
      due: asString(item.due),
    }))
    .filter((item) => item.task)

  return {
    title: asString(record.title, '会议纪要'),
    overview: asString(record.overview, '本次会议内容已整理。'),
    topics,
    decisions: uniqueStrings(record.decisions),
    openQuestions: uniqueStrings(record.openQuestions),
    actionItems,
    updatedAt: asFiniteNumber(record.updatedAt, fallbackTimestamp),
  }
}

const dedupeMindMapSnapshots = (snapshots: MindMapSnapshot[]) => {
  const seen = new Set<string>()
  const result: MindMapSnapshot[] = []

  for (const snapshot of snapshots) {
    const key = `${snapshot.id}|${snapshot.capturedAt}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(snapshot)
  }

  return result.sort((left, right) => left.capturedAt - right.capturedAt)
}

const pickLatestMindMapBefore = (
  snapshots: MindMapSnapshot[],
  timestamp: number,
) => {
  let latest: MindMapSnapshot | null = null

  for (const snapshot of snapshots) {
    if (snapshot.capturedAt <= timestamp) {
      latest = snapshot
    }
  }

  return latest ?? snapshots[0] ?? null
}

const normalizeTranscriptSegments = (
  value: unknown,
  startedAt: number,
): TranscriptSegment[] => {
  const source = Array.isArray(value) ? value : []

  return source
    .map((item, index): TranscriptSegment | null => {
      if (!isRecord(item)) {
        return null
      }

      const timestamp = (() => {
        if (typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)) {
          return item.timestamp
        }

        if (typeof item.relativeMs === 'number' && Number.isFinite(item.relativeMs)) {
          return startedAt + item.relativeMs
        }

        return startedAt + index * 1000
      })()

      return {
        id: asString(item.id, `segment-${index + 1}`),
        speaker: asString(item.speaker, `speaker-${index + 1}`),
        text: asString(item.text),
        timestamp,
        isFinal: asBoolean(item.isFinal, true),
        source: item.source === 'ast' ? 'ast' : 'mock',
      }
    })
    .filter((item): item is TranscriptSegment => item !== null)
    .sort((left, right) => left.timestamp - right.timestamp)
}

const normalizeSpeakerProfiles = (
  value: unknown,
  segments: TranscriptSegment[],
  updatedAt: number,
) => {
  const result: Record<string, SpeakerProfile> = {}

  if (isRecord(value)) {
    for (const [speakerId, rawProfile] of Object.entries(value)) {
      const profile = isRecord(rawProfile) ? rawProfile : {}
      const nameSource = asString(profile.nameSource, 'manual')

      result[speakerId] = {
        speakerId,
        displayName: asString(profile.displayName) || undefined,
        isMe: asBoolean(profile.isMe, false),
        nameSource:
          nameSource === 'intro' || nameSource === 'manual'
            ? (nameSource as SpeakerNameSource)
            : 'manual',
        confidence:
          typeof profile.confidence === 'number' && Number.isFinite(profile.confidence)
            ? profile.confidence
            : undefined,
        updatedAt: asFiniteNumber(profile.updatedAt, updatedAt),
      }
    }
  }

  for (const segment of segments) {
    if (!result[segment.speaker]) {
      result[segment.speaker] = buildDefaultSpeakerProfile(
        segment.speaker,
        segment.timestamp,
      )
    }
  }

  return result
}

const normalizeSpeakerOrder = (
  value: unknown,
  segments: TranscriptSegment[],
  speakerProfiles: Record<string, SpeakerProfile>,
) => {
  const provided = Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean)
    : []
  const result: string[] = []

  for (const speakerId of provided) {
    if (!result.includes(speakerId)) {
      result.push(speakerId)
    }
  }

  for (const segment of segments) {
    if (!result.includes(segment.speaker)) {
      result.push(segment.speaker)
    }
  }

  for (const speakerId of Object.keys(speakerProfiles)) {
    if (!result.includes(speakerId)) {
      result.push(speakerId)
    }
  }

  return result
}

const normalizePinnedSegments = (
  value: unknown,
  transcriptSegments: TranscriptSegment[],
  fallbackTimestamp: number,
) => {
  const source = Array.isArray(value) ? value : []
  const segmentIds = new Set(transcriptSegments.map((segment) => segment.id))

  return source
    .map((item, index): PinnedSegment | null => {
      if (!isRecord(item)) {
        return null
      }

      const segmentId = asString(item.segmentId)

      if (!segmentId || !segmentIds.has(segmentId)) {
        return null
      }

      return {
        id: asString(item.id, `pinned-${index + 1}`),
        segmentId,
        note: asString(item.note, '已标记片段'),
        pinnedAt: asFiniteNumber(item.pinnedAt, fallbackTimestamp),
      }
    })
    .filter((item): item is PinnedSegment => item !== null)
}

const normalizeStandaloneMindMaps = (
  value: unknown,
  fallbackTimestamp: number,
) => {
  const source = Array.isArray(value) ? value : []

  return source
    .map((item, index) =>
      normalizeMindMapSnapshot(item, fallbackTimestamp + index),
    )
    .sort((left, right) => left.capturedAt - right.capturedAt)
}

const normalizeReplaySnapshots = (
  value: unknown,
  transcriptSegments: TranscriptSegment[],
  standaloneMindMaps: MindMapSnapshot[],
  fallbackTimestamp: number,
) => {
  const source = Array.isArray(value) ? value : []

  return source
    .map((item, index): ReplaySnapshot | null => {
      if (!isRecord(item)) {
        return null
      }

      const timestamp = asFiniteNumber(
        item.timestamp,
        transcriptSegments[index]?.timestamp ?? fallbackTimestamp + index,
      )
      const embeddedMindMap =
        item.mindMapSnapshot !== undefined && item.mindMapSnapshot !== null
          ? normalizeMindMapSnapshot(item.mindMapSnapshot, timestamp)
          : null

      return {
        id: asString(item.id, `snapshot-${timestamp}`),
        timestamp,
        phaseAnalysis: normalizePhaseAnalysis(item.phaseAnalysis ?? item, timestamp),
        consensusAnalysis: normalizeConsensusAnalysis(
          item.consensusAnalysis ?? item,
          timestamp,
        ),
        speakingHints: normalizeSpeakingHints(item.speakingHints ?? item, timestamp),
        mindMapSnapshot:
          embeddedMindMap ?? pickLatestMindMapBefore(standaloneMindMaps, timestamp),
      }
    })
    .filter((item): item is ReplaySnapshot => item !== null)
    .sort((left, right) => left.timestamp - right.timestamp)
}

const normalizeSessionRecord = (
  value: unknown,
  index: number,
): SessionRecord | null => {
  if (!isRecord(value)) {
    return null
  }

  const startedAt = asFiniteNumber(
    value.startedAt,
    Date.now() - (index + 1) * 60_000,
  )
  const transcriptSegments = normalizeTranscriptSegments(
    value.transcriptSegments,
    startedAt,
  )
  const endedAt = asFiniteNumber(
    value.endedAt,
    transcriptSegments.at(-1)?.timestamp ?? startedAt,
  )
  const standaloneMindMaps = normalizeStandaloneMindMaps(
    value.mindMapSnapshots,
    endedAt,
  )
  const analysisSnapshots = normalizeReplaySnapshots(
    value.analysisSnapshots,
    transcriptSegments,
    standaloneMindMaps,
    endedAt,
  )
  const derivedMindMaps = analysisSnapshots
    .map((snapshot) => snapshot.mindMapSnapshot)
    .filter((snapshot): snapshot is MindMapSnapshot => snapshot !== null)
  const speakerProfiles = normalizeSpeakerProfiles(
    value.speakerProfiles,
    transcriptSegments,
    endedAt,
  )

  return {
    id: asString(value.id, `session-${index + 1}`),
    title: asString(value.title, `Session ${index + 1}`),
    startedAt,
    endedAt,
    transcriptSegments,
    pinnedSegments: normalizePinnedSegments(
      value.pinnedSegments,
      transcriptSegments,
      endedAt,
    ),
    analysisSnapshots,
    mindMapSnapshots: dedupeMindMapSnapshots([
      ...standaloneMindMaps,
      ...derivedMindMaps,
    ]),
    meetingSummary: normalizeMeetingSummary(value.meetingSummary, endedAt),
    meetingMinutes: normalizeMeetingMinutes(value.meetingMinutes, endedAt),
    scenarioId: resolveScenarioProfile(
      asString(value.scenarioId, 'group-interview'),
    ).id,
    speakerProfiles,
    speakerOrder: normalizeSpeakerOrder(
      value.speakerOrder,
      transcriptSegments,
      speakerProfiles,
    ),
  }
}

const buildDemoSession = (): SessionRecord => {
  const transcriptSeeds = mockTranscript as TranscriptSeed[]
  const analysisScenarios = (mockAnalysis as { snapshots?: DemoAnalysisScenario[] })
    .snapshots ?? []
  const transcriptSegments = transcriptSeeds.map((seed) => ({
    id: seed.id,
    speaker: seed.speaker,
    text: seed.text,
    timestamp: DEMO_SESSION_STARTED_AT + seed.relativeMs,
    isFinal: seed.isFinal,
    source: 'mock' as const,
  }))
  const speakerProfiles = transcriptSegments.reduce<Record<string, SpeakerProfile>>(
    (profiles, segment) => {
      profiles[segment.speaker] = buildDefaultSpeakerProfile(
        segment.speaker,
        segment.timestamp,
        segment.speaker,
      )
      return profiles
    },
    {},
  )
  const analysisSnapshots = analysisScenarios.map((scenario, index) => {
    const capturedAt =
      transcriptSegments[Math.min(scenario.minSegments, transcriptSegments.length) - 1]
        ?.timestamp ?? DEMO_SESSION_STARTED_AT + (index + 1) * 5000
    const mindMapSnapshot =
      scenario.mindMap && isRecord(scenario.mindMap)
        ? normalizeMindMapSnapshot(
            {
              topic: scenario.mindMap.topic,
              nodes: scenario.mindMap.nodes,
            },
            capturedAt,
          )
        : null

    return {
      id: `demo-snapshot-${index + 1}`,
      timestamp: capturedAt,
      phaseAnalysis: normalizePhaseAnalysis(scenario.phase, capturedAt),
      consensusAnalysis: normalizeConsensusAnalysis(scenario.consensus, capturedAt),
      speakingHints: normalizeSpeakingHints(scenario.hints, capturedAt),
      mindMapSnapshot,
    }
  })

  return {
    id: DEMO_SESSION_ID,
    title: '示例会话',
    startedAt: DEMO_SESSION_STARTED_AT,
    endedAt: transcriptSegments.at(-1)?.timestamp ?? DEMO_SESSION_STARTED_AT,
    transcriptSegments,
    pinnedSegments: [],
    analysisSnapshots,
    mindMapSnapshots: dedupeMindMapSnapshots(
      analysisSnapshots
        .map((snapshot) => snapshot.mindMapSnapshot)
        .filter((snapshot): snapshot is MindMapSnapshot => snapshot !== null),
    ),
    meetingSummary: null,
    meetingMinutes: null,
    scenarioId: 'group-interview',
    speakerProfiles,
    speakerOrder: Object.keys(speakerProfiles),
  }
}

const DEMO_SESSION = buildDemoSession()

const readStoredSessions = () => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item, index) => normalizeSessionRecord(item, index))
      .filter((item): item is SessionRecord => item !== null)
      .filter((session) => session.id !== DEMO_SESSION_ID)
      .sort((left, right) => right.endedAt - left.endedAt)
  } catch {
    return []
  }
}

const persistStoredSessions = (sessions: SessionRecord[]) => {
  if (typeof window === 'undefined') {
    return
  }

  const realSessions = sessions.filter((session) => session.id !== DEMO_SESSION_ID)
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(realSessions))
}

const withDemoSession = (sessions: SessionRecord[]) => {
  const realSessions = sessions
    .filter((session) => session.id !== DEMO_SESSION_ID)
    .sort((left, right) => right.endedAt - left.endedAt)

  return [...realSessions, DEMO_SESSION]
}

export const loadSessions = () => withDemoSession(readStoredSessions())

export const saveSession = (session: SessionRecord) => {
  const normalized = normalizeSessionRecord(session, 0)

  if (!normalized || normalized.id === DEMO_SESSION_ID) {
    return loadSessions()
  }

  const existing = readStoredSessions().filter(
    (storedSession) => storedSession.id !== normalized.id,
  )
  const nextSessions = [normalized, ...existing].sort(
    (left, right) => right.endedAt - left.endedAt,
  )

  persistStoredSessions(nextSessions)

  return withDemoSession(nextSessions)
}

export const deleteSession = (sessionId: string) => {
  if (sessionId === DEMO_SESSION_ID) {
    return loadSessions()
  }

  const nextSessions = readStoredSessions().filter(
    (session) => session.id !== sessionId,
  )

  persistStoredSessions(nextSessions)

  return withDemoSession(nextSessions)
}
