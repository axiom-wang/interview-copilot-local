import { readPartialMeetingMemory } from '../../meeting/context/meetingMemory'
import type { MeetingMemory } from '../../meeting/types/meetingMemory'
import { getMeetingRuntime, type ConfiguredAstProvider } from '../runtime'
import { DEFAULT_MODEL_SETTINGS } from '../../meeting/settings/types'
import { create } from 'zustand'
import type { AstProvider } from '../../meeting/providers/ast/AstProvider'
import type { LlmProvider } from '../../meeting/providers/llm/LlmProvider'
import { MockLlmProvider } from '../../meeting/providers/llm/MockLlmProvider'
import {
  analyzeTranscriptWithFallback,
  answerInterviewQuestionWithFallback,
  generateMeetingMinutesWithFallback,
  generateMeetingSummaryWithFallback,
  generateSpeakingHintsWithFallback,
  generateMindMapWithFallback,
} from '../../meeting/services/analysisEngine'
import { normalizeFunctionType } from '../../meeting/services/analysisNormalization'
import {
  deleteSession as removeStoredSession,
  loadSessions,
  saveSession,
} from '../../meeting/services/sessionStore'
import { createPinnedSegment } from '../../meeting/services/transcriptBuffer'
import { joinQuestionText } from '../../meeting/services/interviewTurns'
import {
  DEFAULT_SCENARIO_ID,
  resolveScenarioProfile,
  type MeetingScenarioId,
} from '../../meeting/scenarios'
import type {
  ConsensusAnalysis,
  InterviewQaTurn,
  MeetingMinutes,
  MeetingSummary,
  PhaseAnalysis,
  RealtimeAnalysisBundle,
  SpeakingHints,
} from '../../meeting/types/analysis'
import type { MindMapSnapshot } from '../../meeting/types/mindmap'
import type { ModelSettings } from '../../meeting/settings/types'
import { useSettingsStore } from './useSettingsStore'
import {
  hintsAutoRefreshDelayMs,
  persistHintsAutoRefresh,
  readHintsAutoRefresh,
} from './hintsAutoRefresh'
import type { AnalysisPromptContext } from '../../meeting/types/promptContext'
import type { ReplaySnapshot, SessionRecord } from '../../meeting/types/session'
import type { SpeakerProfile } from '../../meeting/types/speaker'
import type { TranscriptSegment } from '../../meeting/types/transcript'

type AppMode = 'live' | 'replay'
type AppView = 'live' | 'replay' | 'settings'
type AstProviderId = 'volc-asr'
type RuntimeEnvironment = 'electron' | 'web'

// Push-to-talk question capture used by `qa` scenarios.
export type QuestionCaptureState = 'idle' | 'connecting' | 'recording' | 'transcribing'

interface AppState {
  mode: AppMode
  activeView: AppView
  runtimeEnvironment: RuntimeEnvironment
  isEmbedded: boolean
  supportsDesktopBridge: boolean
  supportsLiveAssist: boolean
  isStreaming: boolean
  isPaused: boolean
  isAnalyzing: boolean
  isRefreshingHints: boolean
  isGeneratingMindMap: boolean
  isGeneratingSummary: boolean
  isGeneratingMinutes: boolean
  isAnsweringQuestion: boolean
  questionCapture: QuestionCaptureState
  selectedAstProviderId: AstProviderId
  activeAstProviderId: AstProviderId
  astProviderLabel: string
  analysisProviderLabel: string
  inputSourceLabel: string
  listeningStatusLabel: string
  speakerStability: 'unknown' | 'stable' | 'unstable'
  currentSessionId: string | null
  currentSessionStartedAt: number | null
  currentSessionEndedAt: number | null
  liveSegments: TranscriptSegment[]
  speakerProfiles: Record<string, SpeakerProfile>
  speakerOrder: string[]
  pinnedSegmentIds: string[]
  phaseAnalysis: PhaseAnalysis | null
  meetingMemory?: MeetingMemory
  consensusAnalysis: ConsensusAnalysis | null
  speakingHints: SpeakingHints | null
  speakingHintsStale: boolean
  lastHintsUpdatedAt: number | null
  autoRefreshHints: boolean
  mindMap: MindMapSnapshot | null
  mindMapStale: boolean
  meetingSummary: MeetingSummary | null
  summaryStale: boolean
  lastSummaryUpdatedAt: number | null
  meetingMinutes: MeetingMinutes | null
  minutesStale: boolean
  analysisSnapshots: ReplaySnapshot[]
  savedSessions: SessionRecord[]
  selectedSessionId: string | null
  replayTimestamp: number | null
  questionContextDraft: string
  roleContextDraft: string
  aiQuestionDraft: string
  questionContext: string
  roleContext: string
  scenarioId: MeetingScenarioId
  aiQaHistory: InterviewQaTurn[]
  aiQaError: string | null
  errorMessage: string | null
  statusMessage: string | null
  lastUpdatedAt: number | null
  initialize: () => void
  applyModelSettings: (settings: ModelSettings) => void
  setActiveView: (view: AppView) => void
  setMode: (mode: AppMode) => void
  startStream: () => Promise<void>
  togglePause: () => Promise<void>
  stopStream: () => Promise<void>
  startNewMeeting: () => void
  setAutoRefreshHints: (enabled: boolean) => void
  bindSpeakerNameFromIntro: (
    speakerId: string,
    name: string,
    confidence: number,
  ) => void
  markSpeakerAsMe: (speakerId: string) => void
  renameSpeaker: (speakerId: string, name?: string) => void
  clearSpeakerBinding: (speakerId: string) => void
  deleteLiveSegment: (segmentId: string) => void
  pinCurrentSegment: () => void
  togglePinnedSegment: (segmentId: string) => void
  saveCurrentSession: (options?: { createIfMissing?: boolean }) => void
  deleteSession: (sessionId: string) => void
  selectSession: (sessionId: string) => void
  setReplayTimestamp: (timestamp: number) => void
  setQuestionContextDraft: (value: string) => void
  setRoleContextDraft: (value: string) => void
  setScenarioId: (scenarioId: MeetingScenarioId) => void
  setAiQuestionDraft: (value: string) => void
  applyQuestionContext: () => void
  applyRoleContext: () => void
  clearQuestionContext: () => void
  clearRoleContext: () => void
  askAiQuestion: (questionOverride?: string, options?: { recognitionMs?: number }) => Promise<void>
  startQuestionCapture: () => Promise<void>
  finishQuestionCapture: () => Promise<void>
  clearAiQaHistory: () => void
  refreshAnalysis: () => Promise<void>
  refreshSpeakingHints: () => Promise<void>
  generateMindMap: () => Promise<void>
  generateMeetingSummary: () => Promise<void>
  generateMeetingMinutes: () => Promise<void>
}

const astProviders: Record<AstProviderId, ConfiguredAstProvider> = {
  'volc-asr': getMeetingRuntime().createAstProvider(),
}

let llmProvider: LlmProvider = getMeetingRuntime().createLlmProvider(DEFAULT_MODEL_SETTINGS.llm)
const fallbackLlmProvider = new MockLlmProvider()
const getFallbackLlmProvider = () => getMeetingRuntime().environment === 'electron' ? null : fallbackLlmProvider

let analysisRunToken = 0
let speakingHintsRunToken = 0
let mindMapRunToken = 0
let summaryRunToken = 0
let minutesRunToken = 0
let aiQuestionRunToken = 0
let streamRunToken = 0
let questionCaptureSegmentIds: Set<string> | null = null
let questionCaptureStart: Promise<boolean> | null = null
// Upper bound for the last final results to arrive after the recognizer session closes.
const QUESTION_CAPTURE_SETTLE_MS = 300
const QUESTION_CAPTURE_POLL_MS = 20
let analysisTimeoutId: number | null = null
let hintsRefreshTimeoutId: number | null = null
let lastHintsRequestedAt: number | null = null
let queueAutoHintsRefresh = () => {}
let rememberPartialMeetingMemory: (error: unknown) => void = () => {}
const ignoredLiveSegmentIds = new Set<string>()

const ANALYSIS_DEBOUNCE_MS = 1500
const QUESTION_CONTEXT_STORAGE_KEY = 'interview-copilot-local/question-context'
const QUESTION_CONTEXT_DRAFT_KEY = 'interview-copilot-local/question-context-draft'
const ROLE_CONTEXT_STORAGE_KEY = 'interview-copilot-local/role-context'
const SCENARIO_ID_STORAGE_KEY = 'interview-copilot-local/scenario-id'
const MAX_QA_HISTORY_ITEMS = 6
const DUPLICATE_WINDOW_MS = 8_000
const SPEAKER_TURN_GAP_MS = 10_000
const AST_EXACT_DUPLICATE_WINDOW_MS = 5_000
const INTRO_BIND_CONFIDENCE_THRESHOLD = 0.85
const INTRO_REBIND_MIN_DELTA = 0.08
const INTRO_NOISE_WORDS_SAFE = new Set([
  '\u5927\u5bb6',
  '\u540c\u5b66',
  '\u8001\u5e08',
  '\u9762\u8bd5\u5b98',
  '\u5609\u5bbe',
  '\u670b\u53cb',
  '\u8bc4\u59d4',
  '\u7ec4\u5458',
  '\u4e3b\u6301\u4eba',
  '\u5404\u4f4d',
  '\u6211\u4eec',
  '\u8fd9\u91cc',
])
const INTRO_INVALID_NAME_WORDS_SAFE = new Set([
  '\u89c9\u5f97',
  '\u8ba4\u4e3a',
  '\u611f\u89c9',
  '\u53ef\u4ee5',
  '\u5e94\u8be5',
  '\u73b0\u5728',
  '\u4eca\u5929',
  '\u521a\u624d',
  '\u54b1\u4eec',
  '\u6211\u4eec',
  '\u5927\u5bb6',
  '\u8fd9\u4e2a',
  '\u90a3\u4e2a',
  '\u7136\u540e',
  '\u56e0\u4e3a',
])

const INTRO_NOISE_WORDS = new Set([
  '大家',
  '同学',
  '老师',
  '面试官',
  '嘉宾',
  '朋友',
  '评委',
  '组员',
  '主持人',
  '各位',
  '我们',
  '这里',
])

const INTRO_INVALID_NAME_WORDS = new Set([
  '觉得',
  '认为',
  '感觉',
  '可以',
  '应该',
  '现在',
  '今天',
  '刚才',
  '咱们',
  '我们',
  '大家',
  '这个',
  '那个',
  '然后',
  '因为',
])

const isLikelyPersonName = (name: string) => {
  const normalized = name.trim()

  if (!normalized || normalized.length > 20) {
    return false
  }

  if (INTRO_NOISE_WORDS.has(normalized)) {
    return false
  }

  if (INTRO_NOISE_WORDS_SAFE.has(normalized)) {
    return false
  }

  if (INTRO_INVALID_NAME_WORDS.has(normalized)) {
    return false
  }

  if (INTRO_INVALID_NAME_WORDS_SAFE.has(normalized)) {
    return false
  }

  const chineseOnly = /^[\u4e00-\u9fa5]+$/.test(normalized)

  if (chineseOnly && (normalized.length < 2 || normalized.length > 4)) {
    return false
  }

  const englishOnly = /^[A-Za-z][A-Za-z\s-]*$/.test(normalized)

  if (englishOnly && normalized.length > 24) {
    return false
  }

  if (
    /(经理|总监|老师|同学|同事|工程师|产品|运营|职位|岗位|部门|公司|团队)/.test(
      normalized,
    )
  ) {
    return false
  }

  if (/[0-9@#$%^&*()[\]{}<>\\/]/.test(normalized)) {
    return false
  }

  if (
    /(\u7ecf\u7406|\u603b\u76d1|\u8001\u5e08|\u540c\u5b66|\u540c\u4e8b|\u5de5\u7a0b\u5e08|\u4ea7\u54c1|\u8fd0\u8425|\u804c\u4f4d|\u5c97\u4f4d|\u90e8\u95e8|\u516c\u53f8|\u56e2\u961f)/.test(
      normalized,
    )
  ) {
    return false
  }

  return true
}

const normalizeSpeakerName = (name: string) =>
  name
    .replace(/[。；，,.!?！？]/g, '')
    .replace(/\s+/g, '')
    .trim()

const deduplicateNearText = (text: string) => {
  const normalized = text.trim()

  if (!normalized) {
    return normalized
  }

  const compact = normalized.replace(/\s+/g, '')
  const halfLength = Math.floor(compact.length / 2)

  if (halfLength < 8 || compact.length % 2 !== 0) {
    return normalized
  }

  const first = compact.slice(0, halfLength)
  const second = compact.slice(halfLength)

  if (first === second) {
    return first
  }

  return normalized
}

const extractIntroName = (text: string) => {
  const normalizedText = deduplicateNearText(text)

  const chinesePatterns = [
    /(?:大家好[,，]?\s*)?我是([\u4e00-\u9fa5A-Za-z]{2,16})/,
    /我叫([\u4e00-\u9fa5A-Za-z]{2,16})/,
    /我叫做([\u4e00-\u9fa5A-Za-z]{2,16})/,
    /我的名字是([\u4e00-\u9fa5A-Za-z]{2,16})/,
  ]

  chinesePatterns.push(
    /(?:\u5927\u5bb6\u597d[,，]?\s*)?\u6211\u662f([\u4e00-\u9fa5A-Za-z]{2,16})/,
    /\u6211\u53eb([\u4e00-\u9fa5A-Za-z]{2,16})/,
    /\u6211\u53eb\u505a([\u4e00-\u9fa5A-Za-z]{2,16})/,
    /\u6211\u7684\u540d\u5b57\u662f([\u4e00-\u9fa5A-Za-z]{2,16})/,
  )

  for (const pattern of chinesePatterns) {
    const match = normalizedText.match(pattern)

    if (!match?.[1]) {
      continue
    }

    const candidate = normalizeSpeakerName(match[1])

    if (isLikelyPersonName(candidate)) {
      return {
        name: candidate,
        confidence: 0.9,
      }
    }
  }

  const englishMatch = normalizedText.match(
    /(?:my name is|i am|i'm)\s+([A-Za-z][A-Za-z\s-]{1,24})/i,
  )

  if (englishMatch?.[1]) {
    const candidate = englishMatch[1].replace(/\s+/g, ' ').trim()

    if (isLikelyPersonName(candidate)) {
      return {
        name: candidate,
        confidence: 0.86,
      }
    }
  }

  return null
}

const createDefaultSpeakerProfile = (
  speakerId: string,
  updatedAt = Date.now(),
): SpeakerProfile => ({
  speakerId,
  isMe: false,
  nameSource: 'manual',
  updatedAt,
})

const createFallbackSpeakingHints = (
  updatedAt: number,
  scenarioId: MeetingScenarioId = DEFAULT_SCENARIO_ID,
): SpeakingHints => {
  const profile = resolveScenarioProfile(scenarioId)

  return {
    functionType: normalizeFunctionType(undefined),
    whyNow: `点击“刷新建议”获取当前${profile.label}的实时发言建议。`,
    hint60s: '',
    hint120s: '',
    updatedAt,
  }
}

const buildReplaySnapshot = (
  bundle: RealtimeAnalysisBundle,
  timestamp: number,
  mindMapSnapshot: MindMapSnapshot | null,
): ReplaySnapshot => ({
  id: `snapshot-${timestamp}`,
  timestamp,
  phaseAnalysis: bundle.phaseAnalysis,
  consensusAnalysis: { ...bundle.consensusAnalysis, meetingMemory: undefined },
  speakingHints: bundle.speakingHints,
  mindMapSnapshot,
})

const upsertSnapshot = (
  snapshots: ReplaySnapshot[],
  snapshot: ReplaySnapshot,
): ReplaySnapshot[] => {
  const existingIndex = snapshots.findIndex((item) => item.id === snapshot.id)

  if (existingIndex === -1) {
    return [...snapshots, snapshot]
  }

  return snapshots.map((item, index) =>
    index === existingIndex ? snapshot : item,
  )
}

const normalizeComparableTranscriptText = (text: string) =>
  text.replace(/\s+/g, '').trim()

const getWhitespacePenalty = (text: string) => text.match(/\s+/g)?.length ?? 0

const getCommonPrefixLength = (left: string, right: string) => {
  const maxLength = Math.min(left.length, right.length)
  let index = 0

  while (index < maxLength && left[index] === right[index]) {
    index += 1
  }

  return index
}

const pickPreferredTranscriptText = (left: string, right: string) => {
  const leftComparable = normalizeComparableTranscriptText(left)
  const rightComparable = normalizeComparableTranscriptText(right)

  if (leftComparable.length !== rightComparable.length) {
    return leftComparable.length > rightComparable.length ? left : right
  }

  const leftPenalty = getWhitespacePenalty(left)
  const rightPenalty = getWhitespacePenalty(right)

  if (leftPenalty !== rightPenalty) {
    return leftPenalty < rightPenalty ? left : right
  }

  return left.length >= right.length ? left : right
}

const mergeTranscriptTexts = (
  previousText: string,
  nextText: string,
  options: {
    appendWhenDifferent: boolean
  },
) => {
  const trimmedPrevious = previousText.trim()
  const trimmedNext = nextText.trim()
  const comparablePrevious = normalizeComparableTranscriptText(trimmedPrevious)
  const comparableNext = normalizeComparableTranscriptText(trimmedNext)

  if (!trimmedPrevious) {
    return trimmedNext
  }

  if (!trimmedNext) {
    return trimmedPrevious
  }

  if (trimmedPrevious === trimmedNext || comparablePrevious === comparableNext) {
    return pickPreferredTranscriptText(trimmedPrevious, trimmedNext)
  }

  if (
    trimmedNext.startsWith(trimmedPrevious) ||
    comparableNext.includes(comparablePrevious)
  ) {
    return pickPreferredTranscriptText(trimmedPrevious, trimmedNext)
  }

  if (
    trimmedPrevious.endsWith(trimmedNext) ||
    comparablePrevious.includes(comparableNext)
  ) {
    return pickPreferredTranscriptText(trimmedPrevious, trimmedNext)
  }

  const commonPrefixLength = getCommonPrefixLength(
    comparablePrevious,
    comparableNext,
  )
  const minComparableLength = Math.min(
    comparablePrevious.length,
    comparableNext.length,
  )
  const commonPrefixRatio =
    minComparableLength > 0 ? commonPrefixLength / minComparableLength : 0

  // Streaming ASR often sends corrected versions that keep the same prefix.
  // In that case prefer the better full-text candidate instead of appending a duplicate copy.
  if (commonPrefixRatio >= 0.45) {
    return pickPreferredTranscriptText(trimmedPrevious, trimmedNext)
  }

  return options.appendWhenDifferent
    ? `${trimmedPrevious}\n${trimmedNext}`
    : trimmedNext
}

const areTranscriptTextsRelated = (left: string, right: string) => {
  const comparableLeft = normalizeComparableTranscriptText(left)
  const comparableRight = normalizeComparableTranscriptText(right)

  if (!comparableLeft || !comparableRight) {
    return false
  }

  return (
    comparableLeft === comparableRight ||
    comparableLeft.includes(comparableRight) ||
    comparableRight.includes(comparableLeft)
  )
}

const mergeOngoingTranscriptTexts = (previousText: string, nextText: string) =>
  mergeTranscriptTexts(previousText, nextText, {
    appendWhenDifferent: !areTranscriptTextsRelated(previousText, nextText),
  })

const shouldMergeConsecutiveSegments = (
  previousSegment: TranscriptSegment | undefined,
  nextSegment: TranscriptSegment,
) => {
  if (!previousSegment) {
    return false
  }

  if (
    previousSegment.speaker !== nextSegment.speaker ||
    previousSegment.source !== nextSegment.source
  ) {
    return false
  }

  return nextSegment.timestamp - previousSegment.timestamp <= SPEAKER_TURN_GAP_MS
}

const findRecentDuplicateIndex = (
  segments: TranscriptSegment[],
  nextSegment: TranscriptSegment,
) => {
  const nextComparable = normalizeComparableTranscriptText(nextSegment.text)

  if (!nextComparable) {
    return -1
  }

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]

    if (
      !segment ||
      segment.source !== nextSegment.source ||
      segment.speaker !== nextSegment.speaker
    ) {
      continue
    }

    if (nextSegment.timestamp - segment.timestamp > DUPLICATE_WINDOW_MS) {
      break
    }

    const comparable = normalizeComparableTranscriptText(segment.text)

    if (!comparable) {
      continue
    }

    if (comparable === nextComparable) {
      return index
    }
  }

  return -1
}

const findRecentExactAstDuplicateIndex = (
  segments: TranscriptSegment[],
  nextSegment: TranscriptSegment,
) => {
  const nextComparable = normalizeComparableTranscriptText(nextSegment.text)

  if (!nextComparable) {
    return -1
  }

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]

    if (!segment || segment.source !== 'ast') {
      continue
    }

    if (
      segment.speaker !== nextSegment.speaker ||
      nextSegment.timestamp - segment.timestamp > AST_EXACT_DUPLICATE_WINDOW_MS
    ) {
      break
    }

    const comparable = normalizeComparableTranscriptText(segment.text)

    if (comparable === nextComparable) {
      return index
    }
  }

  return -1
}

const upsertAstSegment = (
  segments: TranscriptSegment[],
  nextSegment: TranscriptSegment,
) => {
  const existingIndex = segments.findIndex(
    (segment) => segment.id === nextSegment.id && segment.source === 'ast',
  )

  if (existingIndex !== -1) {
    return segments.map((segment, index) =>
      index === existingIndex
        ? {
            ...nextSegment,
            timestamp: Math.max(segment.timestamp, nextSegment.timestamp),
            isFinal: segment.isFinal || nextSegment.isFinal,
          }
        : segment,
    )
  }

  const recentExactDuplicateIndex = findRecentExactAstDuplicateIndex(
    segments,
    nextSegment,
  )

  if (recentExactDuplicateIndex !== -1) {
    return segments
  }

  return [...segments, nextSegment]
}

const upsertLiveSegment = (
  segments: TranscriptSegment[],
  nextSegment: TranscriptSegment,
) => {
  if (nextSegment.source === 'ast') {
    return upsertAstSegment(segments, nextSegment)
  }

  const recentDuplicateIndex = findRecentDuplicateIndex(segments, nextSegment)

  if (recentDuplicateIndex !== -1) {
    return segments.map((segment, index) =>
      index === recentDuplicateIndex
        ? {
            ...segment,
            text: mergeTranscriptTexts(segment.text, nextSegment.text, {
              appendWhenDifferent: false,
            }),
            timestamp: Math.max(segment.timestamp, nextSegment.timestamp),
            isFinal: segment.isFinal || nextSegment.isFinal,
          }
        : segment,
    )
  }

  const existingIndex = segments.findIndex(
    (segment) => segment.id === nextSegment.id,
  )

  if (existingIndex !== -1) {
    const existingSegment = segments[existingIndex]
    const hasLargeGap =
      nextSegment.timestamp - existingSegment.timestamp > SPEAKER_TURN_GAP_MS
    const isLikelyNewUtterance =
      !areTranscriptTextsRelated(existingSegment.text, nextSegment.text) &&
      (existingSegment.isFinal || hasLargeGap)

    if (isLikelyNewUtterance) {
      return [
        ...segments,
        {
          ...nextSegment,
          id: `${nextSegment.id}-cont-${nextSegment.timestamp}`,
        },
      ]
    }

    return segments.map((segment, index) =>
      index === existingIndex
        ? {
            ...segment,
            text: mergeOngoingTranscriptTexts(segment.text, nextSegment.text),
            timestamp: Math.max(segment.timestamp, nextSegment.timestamp),
            isFinal: segment.isFinal || nextSegment.isFinal,
          }
        : segment,
    )
  }

  const lastSegment = segments.at(-1)

  if (shouldMergeConsecutiveSegments(lastSegment, nextSegment)) {
    return segments.map((segment, index) =>
      index === segments.length - 1
        ? {
            ...segment,
            text: mergeOngoingTranscriptTexts(segment.text, nextSegment.text),
            timestamp: Math.max(segment.timestamp, nextSegment.timestamp),
            isFinal: segment.isFinal || nextSegment.isFinal,
          }
        : segment,
    )
  }

  return [...segments, nextSegment]
}

const formatSessionTitle = (timestamp: number) =>
  `实时会话 ${new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)}`

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '未知的分析错误。'

const getSelectedSession = (
  sessions: SessionRecord[],
  selectedSessionId: string | null,
) => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null

const clearAnalysisTimer = () => {
  if (analysisTimeoutId !== null) {
    window.clearTimeout(analysisTimeoutId)
    analysisTimeoutId = null
  }
}

const clearHintsRefreshTimer = () => {
  if (hintsRefreshTimeoutId !== null) {
    window.clearTimeout(hintsRefreshTimeoutId)
    hintsRefreshTimeoutId = null
  }
}

const latestFinalSegmentTimestamp = (segments: TranscriptSegment[]) => {
  let latest: number | null = null

  for (const segment of segments) {
    if (!segment.isFinal || !segment.text.trim()) {
      continue
    }

    if (latest === null || segment.timestamp > latest) {
      latest = segment.timestamp
    }
  }

  return latest
}

const scheduleAnalysis = (callback: () => void) => {
  if (llmProvider.automaticAnalysis) {
    if (analysisTimeoutId !== null) return
    analysisTimeoutId = window.setTimeout(() => {
      analysisTimeoutId = null
      callback()
    }, llmProvider.automaticAnalysis.intervalMs)
    return
  }
  clearAnalysisTimer()
  analysisTimeoutId = window.setTimeout(() => {
    analysisTimeoutId = null
    callback()
  }, ANALYSIS_DEBOUNCE_MS)
}

const stopAllAstProviders = () => {
  Object.values(astProviders).forEach((provider) => provider.stop())
}

const readStoredContext = (storageKey: string) =>
  window.localStorage.getItem(storageKey)?.trim() ?? ''

const normalizeContextInput = (value: string) => value.replace(/\r\n/g, '\n')

const getComparableContextValue = (value: string) =>
  normalizeContextInput(value).trim()

const persistContextValue = (storageKey: string, value: string) => {
  if (value) {
    window.localStorage.setItem(storageKey, value)
    return
  }

  window.localStorage.removeItem(storageKey)
}

const persistQuestionDraft = (value: string) => {
  persistContextValue(QUESTION_CONTEXT_STORAGE_KEY, value)
  persistContextValue(QUESTION_CONTEXT_DRAFT_KEY, value ? '1' : '')
}

const clearStoredQuestionDraft = () => {
  persistContextValue(QUESTION_CONTEXT_STORAGE_KEY, '')
  persistContextValue(QUESTION_CONTEXT_DRAFT_KEY, '')
}

/** Restore a question only while it still belongs to the meeting being prepared. */
const readQuestionDraft = (sessions: SessionRecord[]) => {
  if (readStoredContext(QUESTION_CONTEXT_DRAFT_KEY) === '1') {
    return readStoredContext(QUESTION_CONTEXT_STORAGE_KEY)
  }

  const stored = readStoredContext(QUESTION_CONTEXT_STORAGE_KEY)
  if (!stored) {
    return ''
  }

  const archived = sessions.some(
    (session) =>
      session.id !== 'session-demo' &&
      (session.questionContext ?? '').trim() === stored.trim(),
  )
  if (archived) {
    clearStoredQuestionDraft()
    return ''
  }

  persistQuestionDraft(stored)
  return stored
}

const buildPromptContext = (
  state: Pick<
    AppState,
    | 'scenarioId'
    | 'meetingMemory'
    | 'pinnedSegmentIds'
    | 'questionContext'
    | 'roleContext'
    | 'phaseAnalysis'
    | 'consensusAnalysis'
    | 'mindMap'
  >,
): AnalysisPromptContext => {
  const questionContext = state.questionContext.trim() || undefined
  const roleContext = resolveScenarioProfile(state.scenarioId).roleContextEnabled === false
    ? undefined
    : state.roleContext.trim() || undefined
  const phaseContext = state.phaseAnalysis?.phase || undefined
  const hasSummaryAssemblyContext = Boolean(
    phaseContext ||
      state.consensusAnalysis?.consensus.length ||
      state.consensusAnalysis?.tensions.length ||
      state.consensusAnalysis?.missing.length ||
      state.mindMap,
  )

  return {
    scenarioId: state.scenarioId,
    meetingMemory: state.meetingMemory,
    previousParticipantView: state.consensusAnalysis?.participantView,
    pinnedSegmentIds: state.pinnedSegmentIds,
    questionContext,
    roleContext,
    phaseContext,
    summaryAssemblyContext: hasSummaryAssemblyContext
      ? {
          phase: phaseContext,
          consensus: state.consensusAnalysis?.consensus,
          tensions: state.consensusAnalysis?.tensions,
          missing: state.consensusAnalysis?.missing,
          mindMap: state.mindMap ?? undefined,
        }
      : undefined,
  }
}

const buildQuestionAnswerPromptContext = (
  state: Pick<
    AppState,
    | 'scenarioId'
    | 'meetingMemory'
    | 'pinnedSegmentIds'
    | 'questionContext'
    | 'roleContext'
    | 'phaseAnalysis'
    | 'consensusAnalysis'
  >,
): AnalysisPromptContext => {
  const questionContext = state.questionContext.trim() || undefined
  const roleContext = resolveScenarioProfile(state.scenarioId).roleContextEnabled === false
    ? undefined
    : state.roleContext.trim() || undefined
  const phaseContext = state.phaseAnalysis?.phase || undefined
  const hasSummaryAssemblyContext = Boolean(
    phaseContext ||
      state.consensusAnalysis?.consensus.length ||
      state.consensusAnalysis?.tensions.length ||
      state.consensusAnalysis?.missing.length,
  )

  return {
    scenarioId: state.scenarioId,
    meetingMemory: state.meetingMemory,
    previousParticipantView: state.consensusAnalysis?.participantView,
    pinnedSegmentIds: state.pinnedSegmentIds,
    questionContext,
    roleContext,
    phaseContext,
    summaryAssemblyContext: hasSummaryAssemblyContext
      ? {
          phase: phaseContext,
          consensus: state.consensusAnalysis?.consensus,
          tensions: state.consensusAnalysis?.tensions,
          missing: state.consensusAnalysis?.missing,
        }
      : undefined,
  }
}

const getInputSourceLabel = (
  providerId: AstProviderId,
  runtimeEnvironment: RuntimeEnvironment = getRuntimeEnvironment(),
) =>
  runtimeEnvironment === 'web'
    ? '浏览器麦克风'
    : providerId === 'volc-asr'
      ? '麦克风'
      : '模拟音频'

const getRuntimeEnvironment = (): RuntimeEnvironment => getMeetingRuntime().environment

const configureProvidersForRuntime = () => {
  // Login rebuilds the providers after settings were applied, because child
  // effects run first. Re-read the saved settings here or the new speech
  // provider starts with an empty API key.
  const settings = useSettingsStore.getState().settings
  astProviders['volc-asr'] = getMeetingRuntime().createAstProvider()
  astProviders['volc-asr'].setCredentials(settings.ast)
  llmProvider = getMeetingRuntime().createLlmProvider(settings.llm)
}

const getIsEmbedded = () => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

const getWebStatusMessage = (isEmbedded: boolean) =>
  isEmbedded
    ? '当前为网页嵌入模式。请先在设置中配置模型，并确保实时转写服务可用。'
    : '请先在设置中配置语音转写与文本分析模型，再开始实时辅助。'

const applyModelSettingsToProviders = (settings: ModelSettings) => {
  astProviders['volc-asr'].setCredentials(settings.ast)
  llmProvider = getMeetingRuntime().createLlmProvider(settings.llm)
}

const getSegmentsForAnalysis = (segments: TranscriptSegment[]) => {
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

  return [...latestById.values()].sort((left, right) => left.timestamp - right.timestamp)
}

// Returns as soon as every captured segment is final, instead of always sleeping the full window.
const waitForCapturedSegmentsFinal = async (read: () => Pick<AppState, 'liveSegments'>) => {
  const deadline = Date.now() + QUESTION_CAPTURE_SETTLE_MS

  for (;;) {
    const captured = getSegmentsForAnalysis(read().liveSegments).filter((segment) =>
      questionCaptureSegmentIds?.has(segment.id),
    )

    if (captured.length > 0 && captured.every((segment) => segment.isFinal)) {
      return
    }

    if (Date.now() >= deadline) {
      return
    }

    await new Promise((resolve) => window.setTimeout(resolve, QUESTION_CAPTURE_POLL_MS))
  }
}

const getSegmentsForSummary = (segments: TranscriptSegment[]) => {
  const stableSegments = getSegmentsForAnalysis(segments)
  const finalSegments = stableSegments.filter((segment) => segment.isFinal)

  return finalSegments.length > 0 ? finalSegments : stableSegments
}

const getSpeakerDisplayName = (
  speakerProfiles: Record<string, SpeakerProfile>,
  speakerId: string,
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

const createFallbackMeetingSummary = (
  updatedAt: number,
  scenarioId: MeetingScenarioId = DEFAULT_SCENARIO_ID,
): MeetingSummary => {
  const profile = resolveScenarioProfile(scenarioId)

  return {
    speech60s: `当前还没有可用的${profile.spokenSummaryLabel}。建议先继续转写，再生成贴合本场讨论的口播总结。`,
    keyPoints: ['先补充更多有效转写内容，再生成会议总结。'],
    nextSteps: ['点击生成按钮获取最新总结。'],
    updatedAt,
  }
}

const createFallbackMeetingMinutes = (updatedAt: number): MeetingMinutes => ({
  title: '会议纪要',
  overview: '当前还没有可用的会议纪要。建议先继续转写，再生成结构化纪要。',
  topics: [],
  decisions: [],
  openQuestions: ['待补充有效转写后再生成纪要'],
  actionItems: [],
  updatedAt,
})

const buildInterviewQaTurn = (
  question: string,
  answer: InterviewQaTurn['answer'],
  askedAt: number,
  timing?: InterviewQaTurn['timing'],
): InterviewQaTurn => ({
  id: `qa-${askedAt}-${crypto.randomUUID()}`,
  question,
  answer,
  askedAt,
  ...(timing ? { timing } : {}),
})

const isMindMapSnapshot = (
  snapshot: MindMapSnapshot | null,
): snapshot is MindMapSnapshot => snapshot !== null

export const useAppStore = create<AppState>((set, get) => ({
  mode: 'live',
  activeView: 'live',
  runtimeEnvironment: 'web',
  isEmbedded: false,
  supportsDesktopBridge: false,
  supportsLiveAssist: false,
  isStreaming: false,
  isPaused: false,
  isAnalyzing: false,
  isRefreshingHints: false,
  isGeneratingMindMap: false,
  isGeneratingSummary: false,
  isGeneratingMinutes: false,
  isAnsweringQuestion: false,
  questionCapture: 'idle',
  selectedAstProviderId: 'volc-asr',
  activeAstProviderId: 'volc-asr',
  astProviderLabel: astProviders['volc-asr'].label,
  analysisProviderLabel: llmProvider.label,
  inputSourceLabel: getInputSourceLabel('volc-asr'),
  listeningStatusLabel: '未监听',
  speakerStability: 'unknown',
  currentSessionId: null,
  currentSessionStartedAt: null,
  currentSessionEndedAt: null,
  liveSegments: [],
  speakerProfiles: {},
  speakerOrder: [],
  pinnedSegmentIds: [],
  phaseAnalysis: null,
  meetingMemory: undefined,
  consensusAnalysis: null,
  speakingHints: null,
  speakingHintsStale: false,
  lastHintsUpdatedAt: null,
  autoRefreshHints: true,
  mindMap: null,
  mindMapStale: false,
  meetingSummary: null,
  summaryStale: false,
  lastSummaryUpdatedAt: null,
  meetingMinutes: null,
  minutesStale: false,
  analysisSnapshots: [],
  savedSessions: [],
  selectedSessionId: null,
  replayTimestamp: null,
  questionContextDraft: '',
  roleContextDraft: '',
  aiQuestionDraft: '',
  questionContext: '',
  roleContext: '',
  scenarioId: DEFAULT_SCENARIO_ID,
  aiQaHistory: [],
  aiQaError: null,
  errorMessage: null,
  statusMessage: null,
  lastUpdatedAt: null,
  initialize: () => {
    const sessions = loadSessions()
    const runtimeEnvironment = getRuntimeEnvironment()
    configureProvidersForRuntime()
    const isEmbedded = getIsEmbedded()
    const supportsDesktopBridge = runtimeEnvironment === 'electron'
    const supportsLiveAssist =
      getMeetingRuntime().supportsLiveAssist
    const selectedSession = supportsLiveAssist
      ? sessions[0] ?? null
      : sessions.at(-1) ?? sessions[0] ?? null
    const questionContext = readQuestionDraft(sessions)
    const roleContext = readStoredContext(ROLE_CONTEXT_STORAGE_KEY)
    const scenarioId = resolveScenarioProfile(
      readStoredContext(SCENARIO_ID_STORAGE_KEY),
    ).id

    set({
      mode: supportsLiveAssist ? 'live' : 'replay',
      activeView: supportsLiveAssist ? 'live' : 'replay',
      runtimeEnvironment,
      isEmbedded,
      supportsDesktopBridge,
      supportsLiveAssist,
      selectedAstProviderId: 'volc-asr',
      activeAstProviderId: 'volc-asr',
      astProviderLabel: astProviders['volc-asr'].label,
      analysisProviderLabel: llmProvider.label,
      inputSourceLabel: supportsLiveAssist
        ? getInputSourceLabel('volc-asr', runtimeEnvironment)
        : '浏览器展示',
      listeningStatusLabel: supportsLiveAssist ? '未监听' : '展示模式',
      questionContextDraft: questionContext,
      roleContextDraft: roleContext,
      aiQuestionDraft: '',
      questionContext,
      roleContext,
      scenarioId,
      autoRefreshHints: readHintsAutoRefresh(),
      aiQaHistory: [],
      aiQaError: null,
      savedSessions: sessions,
      selectedSessionId: selectedSession?.id ?? null,
      replayTimestamp: selectedSession?.endedAt ?? null,
      statusMessage: supportsLiveAssist ? null : getWebStatusMessage(isEmbedded),
      errorMessage: null,
    })
  },
  applyModelSettings: (settings) => {
    analysisRunToken += 1
    speakingHintsRunToken += 1
    mindMapRunToken += 1
    summaryRunToken += 1
    minutesRunToken += 1
    aiQuestionRunToken += 1
    clearAnalysisTimer()
    void getMeetingRuntime().resetAnalysisSession()
    applyModelSettingsToProviders(settings)
    set({
      analysisProviderLabel: llmProvider.label,
      isAnalyzing: false, isRefreshingHints: false, isGeneratingMindMap: false,
      isGeneratingSummary: false, isGeneratingMinutes: false, isAnsweringQuestion: false,
    })
    if (get().liveSegments.length) scheduleAnalysis(() => { void get().refreshAnalysis() })
  },
  setActiveView: (view) => {
    if (view === 'settings') {
      set({ activeView: 'settings' })
      return
    }

    get().setMode(view)
    set({ activeView: view })
  },
  setMode: (mode) => {
    const sessions = get().savedSessions
    const selectedSession = getSelectedSession(sessions, get().selectedSessionId)

    set({
      mode,
      activeView: mode,
      selectedSessionId: selectedSession?.id ?? null,
      replayTimestamp: selectedSession?.endedAt ?? null,
    })
  },
  startStream: async () => {
    if (!useSettingsStore.getState().hasAstConfig()) {
      set({ errorMessage: '请先在设置中完成火山引擎流式语音识别 2.0 配置，再开始实时转写。' })
      return
    }
    if (!useSettingsStore.getState().hasLlmConfig()) {
      set({ errorMessage: '请先在设置中选择并配置可用的文本分析通道。' })
      return
    }
    if (!get().supportsLiveAssist) {
      set({
        mode: 'live',
        errorMessage: '实时辅助不可用：请先配置实时转写服务地址，并在设置中填写模型信息。',
        statusMessage: getWebStatusMessage(get().isEmbedded),
      })
      return
    }
    const startProfile = resolveScenarioProfile(get().scenarioId)
    if (startProfile.topicContextRequired && !get().questionContext.trim()) {
      set({ errorMessage: `请先填写${startProfile.topicContextLabel}，再开始。` })
      return
    }
    const isQa = startProfile.interactionModel === 'qa'

    streamRunToken += 1
    analysisRunToken += 1
    speakingHintsRunToken += 1
    mindMapRunToken += 1
    summaryRunToken += 1
    minutesRunToken += 1
    aiQuestionRunToken += 1
    const activeToken = streamRunToken
    const sessionStartedAt = Date.now()
    const selectedProviderId = get().selectedAstProviderId
    const selectedProvider = astProviders[selectedProviderId]
    const runtimeEnvironment = get().runtimeEnvironment
    selectedProvider.setCredentials(useSettingsStore.getState().settings.ast)

    stopAllAstProviders()
    void getMeetingRuntime().resetAnalysisSession()
    clearAnalysisTimer()
    clearHintsRefreshTimer()
    ignoredLiveSegmentIds.clear()
    lastHintsRequestedAt = null
    questionCaptureSegmentIds = null
    questionCaptureStart = null

    set({
      mode: 'live',
      isStreaming: true,
      questionCapture: 'idle',
      isPaused: false,
      isAnalyzing: false,
      isRefreshingHints: false,
      isGeneratingMindMap: false,
      isGeneratingSummary: false,
      isGeneratingMinutes: false,
      isAnsweringQuestion: false,
      activeAstProviderId: selectedProviderId,
      astProviderLabel: selectedProvider.label,
      analysisProviderLabel: llmProvider.label,
      inputSourceLabel: getInputSourceLabel(selectedProviderId, runtimeEnvironment),
      listeningStatusLabel: '连接中',
      speakerStability: 'unknown',
      currentSessionId: `session-${crypto.randomUUID()}`,
      currentSessionStartedAt: sessionStartedAt,
      currentSessionEndedAt: null,
      liveSegments: [],
      speakerProfiles: {},
      speakerOrder: [],
      pinnedSegmentIds: [],
      phaseAnalysis: null,
      meetingMemory: undefined,
      consensusAnalysis: null,
      speakingHints: null,
      speakingHintsStale: false,
      lastHintsUpdatedAt: null,
      mindMap: null,
      mindMapStale: false,
      meetingSummary: null,
      summaryStale: false,
      meetingMinutes: null,
      minutesStale: false,
      aiQaHistory: [],
      aiQaError: null,
      lastSummaryUpdatedAt: null,
      analysisSnapshots: [],
      errorMessage: null,
      statusMessage: null,
      lastUpdatedAt: null,
    })

    const onSegment = (incoming: TranscriptSegment) => {
      if (activeToken !== streamRunToken) {
        return
      }

      if (ignoredLiveSegmentIds.has(incoming.id)) {
        return
      }

      // qa scenarios only keep what was said while the capture key is held.
      if (isQa && !questionCaptureSegmentIds) {
        return
      }
      questionCaptureSegmentIds?.add(incoming.id)
      const segment = isQa ? { ...incoming, speaker: startProfile.qa?.askerLabel ?? incoming.speaker } : incoming

      set((state) => {
        const speakerProfiles = { ...state.speakerProfiles }
        const existingProfile = speakerProfiles[segment.speaker]

        if (!existingProfile) {
          speakerProfiles[segment.speaker] = createDefaultSpeakerProfile(
            segment.speaker,
            segment.timestamp,
          )
        }

        if (segment.isFinal) {
          const intro = extractIntroName(segment.text)

          if (intro && intro.confidence >= INTRO_BIND_CONFIDENCE_THRESHOLD) {
            const currentProfile = speakerProfiles[segment.speaker]
            const currentConfidence = currentProfile?.confidence ?? 0
            const hasDisplayName = Boolean(currentProfile?.displayName?.trim())
            const allowOverride =
              !hasDisplayName ||
              (currentProfile?.nameSource !== 'manual' &&
                intro.confidence >= currentConfidence + INTRO_REBIND_MIN_DELTA)

            if (allowOverride) {
              speakerProfiles[segment.speaker] = {
                speakerId: segment.speaker,
                displayName: intro.name,
                isMe: currentProfile?.isMe ?? false,
                nameSource: 'intro',
                confidence: intro.confidence,
                updatedAt: segment.timestamp,
              }
            }
          }
        }

        return {
          liveSegments: upsertLiveSegment(state.liveSegments, segment),
          speakerProfiles,
          speakerOrder: state.speakerOrder.includes(segment.speaker)
            ? state.speakerOrder
            : [...state.speakerOrder, segment.speaker],
          speakingHintsStale:
            Boolean(state.speakingHints) && segment.isFinal
              ? true
              : state.speakingHintsStale,
          mindMapStale:
            Boolean(state.mindMap) && segment.isFinal
              ? true
              : state.mindMapStale,
          summaryStale:
            Boolean(state.meetingSummary) && segment.isFinal
              ? true
              : state.summaryStale,
          minutesStale:
            Boolean(state.meetingMinutes) && segment.isFinal
              ? true
              : state.minutesStale,
          lastUpdatedAt: segment.timestamp,
        }
      })

      if (isQa || (llmProvider.automaticAnalysis?.finalOnly && !segment.isFinal)) return
      scheduleAnalysis(() => {
        void get().refreshAnalysis()
      })
    }

    const onStatus = ({
      level,
      message,
      speakerStability,
    }: Parameters<NonNullable<Parameters<AstProvider['start']>[1]>>[0]) => {
      if (activeToken !== streamRunToken) {
        return
      }

      if (level === 'error') {
        set({
          errorMessage: message,
          ...(speakerStability ? { speakerStability } : {}),
        })
        return
      }

      set({
        statusMessage: message,
        ...(speakerStability ? { speakerStability } : {}),
      })
    }

    try {
      await selectedProvider.start(onSegment, onStatus)

      if (activeToken !== streamRunToken) {
        return
      }

      // qa scenarios keep the microphone ready but only listen while the capture key is held.
      if (isQa) {
        void llmProvider.prewarm?.(buildQuestionAnswerPromptContext(get())).catch(() => {})
        await selectedProvider.pause?.()

        if (activeToken !== streamRunToken) {
          return
        }
      }

      set({
        activeAstProviderId: selectedProviderId,
        listeningStatusLabel: isQa ? '待提问' : '监听中',
      })
    } catch (error) {
      if (activeToken !== streamRunToken) {
        return
      }

      set({
        isStreaming: false,
        listeningStatusLabel: '启动失败',
        errorMessage:
          error instanceof Error ? error.message : '启动转写失败，请重试。',
      })
    }
  },
  togglePause: async () => {
    const state = get()

    if (!state.isStreaming) {
      return
    }

    const activeProvider = astProviders[state.activeAstProviderId]

    if (state.isPaused) {
      try {
        await activeProvider.resume?.()
        set({
          isPaused: false,
          listeningStatusLabel: '监听中',
          errorMessage: null,
          statusMessage: '已继续收音，转写连接已重建并恢复。',
        })
        if (get().liveSegments.length && !get().consensusAnalysis) {
          void get().refreshAnalysis()
        }
        queueAutoHintsRefresh()
      } catch (error) {
        set({
          isPaused: true,
          listeningStatusLabel: '已暂停',
          errorMessage: toErrorMessage(error),
          statusMessage: '继续收音失败，请重试。',
        })
      }
      return
    }

    try {
      await activeProvider.pause?.()
      clearAnalysisTimer()
      clearHintsRefreshTimer()
      set({
        isPaused: true,
        listeningStatusLabel: '已暂停',
        errorMessage: null,
        statusMessage: '已暂停收音，恢复时会重连转写会话，当前内容会保留。',
      })
    } catch (error) {
      set({
        errorMessage: toErrorMessage(error),
        statusMessage: '暂停收音失败，请重试。',
      })
    }
  },
  stopStream: async () => {
    await astProviders[get().activeAstProviderId].stop()
    streamRunToken += 1
    questionCaptureSegmentIds = null
    questionCaptureStart = null
    analysisRunToken += 1
    speakingHintsRunToken += 1
    mindMapRunToken += 1
    summaryRunToken += 1
    minutesRunToken += 1
    aiQuestionRunToken += 1
    clearAnalysisTimer()
    clearHintsRefreshTimer()
    void getMeetingRuntime().resetAnalysisSession({ preserveRouting: true })
    ignoredLiveSegmentIds.clear()
    set({
      isStreaming: false,
      isPaused: false,
      isAnalyzing: false,
      isRefreshingHints: false,
      isGeneratingMindMap: false,
      isGeneratingSummary: false,
      isGeneratingMinutes: false,
      isAnsweringQuestion: false,
      questionCapture: 'idle',
      activeAstProviderId: get().selectedAstProviderId,
      listeningStatusLabel: '未监听',
      speakerStability: 'unknown',
      speakingHintsStale: false,
      mindMapStale: false,
      summaryStale: false,
      minutesStale: false,
      currentSessionEndedAt: Date.now(),
      statusMessage: '转写已停止。',
    })
    get().saveCurrentSession()
    clearStoredQuestionDraft()
  },
  startNewMeeting: () => {
    const state = get()

    if (state.isStreaming) {
      return
    }

    // Persist edits made after stopping, but never resurrect a session the user deleted.
    if (state.savedSessions.some((session) => session.id === state.currentSessionId)) {
      state.saveCurrentSession()
    }
    void getMeetingRuntime().resetAnalysisSession()
    clearStoredQuestionDraft()
    clearAnalysisTimer()
    clearHintsRefreshTimer()
    ignoredLiveSegmentIds.clear()
    lastHintsRequestedAt = null
    aiQuestionRunToken += 1
    analysisRunToken += 1
    speakingHintsRunToken += 1
    mindMapRunToken += 1
    summaryRunToken += 1
    minutesRunToken += 1
    set({
      analysisProviderLabel: llmProvider.label,
      isAnalyzing: false,
      isRefreshingHints: false,
      isGeneratingMindMap: false,
      isGeneratingSummary: false,
      isGeneratingMinutes: false,
      currentSessionId: null,
      currentSessionStartedAt: null,
      currentSessionEndedAt: null,
      liveSegments: [],
      speakerProfiles: {},
      speakerOrder: [],
      pinnedSegmentIds: [],
      phaseAnalysis: null,
      meetingMemory: undefined,
      consensusAnalysis: null,
      speakingHints: null,
      speakingHintsStale: false,
      lastHintsUpdatedAt: null,
      mindMap: null,
      mindMapStale: false,
      meetingSummary: null,
      summaryStale: false,
      lastSummaryUpdatedAt: null,
      meetingMinutes: null,
      minutesStale: false,
      analysisSnapshots: [],
      questionContextDraft: '',
      questionContext: '',
      aiQaHistory: [],
      aiQaError: null,
      isAnsweringQuestion: false,
      errorMessage: null,
      statusMessage: null,
      lastUpdatedAt: null,
    })
  },
  setAutoRefreshHints: (enabled) => {
    persistHintsAutoRefresh(enabled)
    set({ autoRefreshHints: enabled })

    if (enabled) {
      queueAutoHintsRefresh()
      return
    }

    clearHintsRefreshTimer()
  },
  bindSpeakerNameFromIntro: (speakerId, name, confidence) => {
    const normalizedName = normalizeSpeakerName(name)

    if (
      !speakerId.trim() ||
      !normalizedName ||
      confidence < INTRO_BIND_CONFIDENCE_THRESHOLD ||
      !isLikelyPersonName(normalizedName)
    ) {
      return
    }

    set((state) => {
      const currentProfile =
        state.speakerProfiles[speakerId] ??
        createDefaultSpeakerProfile(speakerId, Date.now())
      const currentConfidence = currentProfile.confidence ?? 0
      const hasDisplayName = Boolean(currentProfile.displayName?.trim())
      const allowOverride =
        !hasDisplayName ||
        (currentProfile.nameSource !== 'manual' &&
          confidence >= currentConfidence + INTRO_REBIND_MIN_DELTA)

      if (!allowOverride) {
        return state
      }

      return {
        speakerProfiles: {
          ...state.speakerProfiles,
          [speakerId]: {
            ...currentProfile,
            speakerId,
            displayName: normalizedName,
            nameSource: 'intro',
            confidence,
            updatedAt: Date.now(),
          },
        },
        speakerOrder: state.speakerOrder.includes(speakerId)
          ? state.speakerOrder
          : [...state.speakerOrder, speakerId],
      }
    })
  },
  markSpeakerAsMe: (speakerId) => {
    if (!speakerId.trim()) {
      return
    }

    set((state) => {
      const nextProfiles: Record<string, SpeakerProfile> = {}

      for (const [id, profile] of Object.entries(state.speakerProfiles)) {
        nextProfiles[id] = {
          ...profile,
          isMe: id === speakerId,
          updatedAt: id === speakerId ? Date.now() : profile.updatedAt,
        }
      }

      if (!nextProfiles[speakerId]) {
        nextProfiles[speakerId] = {
          ...createDefaultSpeakerProfile(speakerId, Date.now()),
          isMe: true,
        }
      }

      return {
        speakerProfiles: nextProfiles,
        speakerOrder: state.speakerOrder.includes(speakerId)
          ? state.speakerOrder
          : [...state.speakerOrder, speakerId],
        statusMessage: `已将 ${getSpeakerDisplayName(nextProfiles, speakerId)} 设为我`,
      }
    })
  },
  renameSpeaker: (speakerId, name) => {
    if (!speakerId.trim()) {
      return
    }

    set((state) => {
      const baseProfile =
        state.speakerProfiles[speakerId] ??
        createDefaultSpeakerProfile(speakerId, Date.now())
      const normalizedName = name ? normalizeSpeakerName(name) : ''

      return {
        speakerProfiles: {
          ...state.speakerProfiles,
          [speakerId]: {
            ...baseProfile,
            speakerId,
            displayName: normalizedName || undefined,
            nameSource: 'manual',
            confidence: undefined,
            updatedAt: Date.now(),
          },
        },
        speakerOrder: state.speakerOrder.includes(speakerId)
          ? state.speakerOrder
          : [...state.speakerOrder, speakerId],
      }
    })
  },
  clearSpeakerBinding: (speakerId) => {
    if (!speakerId.trim()) {
      return
    }

    set((state) => {
      const currentProfile = state.speakerProfiles[speakerId]

      if (!currentProfile) {
        return state
      }

      return {
        speakerProfiles: {
          ...state.speakerProfiles,
          [speakerId]: {
            ...currentProfile,
            displayName: undefined,
            nameSource: 'manual',
            confidence: undefined,
            updatedAt: Date.now(),
          },
        },
      }
    })
  },
  deleteLiveSegment: (segmentId) => {
    const normalizedSegmentId = segmentId.trim()

    if (!normalizedSegmentId) {
      return
    }

    const currentState = get()

    if (!currentState.liveSegments.some((segment) => segment.id === normalizedSegmentId)) {
      return
    }

    ignoredLiveSegmentIds.add(normalizedSegmentId)
    speakingHintsRunToken += 1
    mindMapRunToken += 1
    summaryRunToken += 1
    minutesRunToken += 1
    aiQuestionRunToken += 1
    analysisRunToken += 1
    clearAnalysisTimer()

    let nextSegments: TranscriptSegment[] = []
    let shouldRefreshAnalysis = false

    set((state) => {
      nextSegments = state.liveSegments.filter(
        (segment) => segment.id !== normalizedSegmentId,
      )

      const hasRemainingSegments = nextSegments.length > 0
      shouldRefreshAnalysis = hasRemainingSegments && !state.isPaused

      return {
        liveSegments: nextSegments,
        meetingMemory: undefined,
        isRefreshingHints: false,
        isGeneratingMindMap: false,
        isGeneratingSummary: false,
        isGeneratingMinutes: false,
        isAnsweringQuestion: false,
        pinnedSegmentIds: state.pinnedSegmentIds.filter(
          (id) => id !== normalizedSegmentId,
        ),
        phaseAnalysis: null,
        consensusAnalysis: null,
        speakingHints: hasRemainingSegments ? state.speakingHints : null,
        speakingHintsStale: hasRemainingSegments
          ? Boolean(state.speakingHints)
          : false,
        lastHintsUpdatedAt: hasRemainingSegments ? state.lastHintsUpdatedAt : null,
        mindMap: null,
        mindMapStale: hasRemainingSegments ? Boolean(state.mindMap) : false,
        meetingSummary: hasRemainingSegments ? state.meetingSummary : null,
        summaryStale: hasRemainingSegments
          ? Boolean(state.meetingSummary)
          : false,
        meetingMinutes: hasRemainingSegments ? state.meetingMinutes : null,
        minutesStale: hasRemainingSegments
          ? Boolean(state.meetingMinutes)
          : false,
        lastSummaryUpdatedAt: hasRemainingSegments
          ? state.lastSummaryUpdatedAt
          : null,
        analysisSnapshots: hasRemainingSegments ? state.analysisSnapshots : [],
        isAnalyzing: false,
        lastUpdatedAt: nextSegments.at(-1)?.timestamp ?? null,
        errorMessage: null,
        statusMessage: !hasRemainingSegments
          ? '已删除该转写片段，当前实时转写已清空。'
          : state.isPaused
            ? '已删除该转写片段，阶段与共识已清除。继续会议后会按最新转写重新分析。'
            : '已删除该转写片段，阶段与共识分析将按最新转写重新刷新。',
      }
    })

    if (shouldRefreshAnalysis) {
      scheduleAnalysis(() => {
        void get().refreshAnalysis()
      })
    }
  },
  pinCurrentSegment: () => {
    const segment = get().liveSegments.at(-1)

    if (!segment) {
      return
    }

    const pinned = createPinnedSegment(segment)

    set((state) => ({
      pinnedSegmentIds: state.pinnedSegmentIds.includes(segment.id)
        ? state.pinnedSegmentIds
        : [...state.pinnedSegmentIds, pinned.segmentId],
    }))
  },
  togglePinnedSegment: (segmentId) => {
    if (!get().liveSegments.some((segment) => segment.id === segmentId)) {
      return
    }

    set((state) => ({
      pinnedSegmentIds: state.pinnedSegmentIds.includes(segmentId)
        ? state.pinnedSegmentIds.filter((id) => id !== segmentId)
        : [...state.pinnedSegmentIds, segmentId],
    }))
  },
  saveCurrentSession: (options) => {
    const state = get()

    if (!state.liveSegments.length || !state.currentSessionId) {
      return
    }

    const alreadySaved = state.savedSessions.some(
      (session) => session.id === state.currentSessionId,
    )

    if (!alreadySaved && options?.createIfMissing === false) {
      return
    }

    const endedAt =
      state.currentSessionEndedAt ?? state.liveSegments.at(-1)?.timestamp ?? Date.now()
    const pinnedSegments = state.liveSegments
      .filter((segment) => state.pinnedSegmentIds.includes(segment.id))
      .map((segment) => createPinnedSegment(segment, '实时辅助中标记'))

    const session: SessionRecord = {
      id: state.currentSessionId,
      title: formatSessionTitle(state.currentSessionStartedAt ?? endedAt),
      startedAt: state.currentSessionStartedAt ?? state.liveSegments[0].timestamp,
      endedAt,
      transcriptSegments: state.liveSegments,
      speakerProfiles: state.speakerProfiles,
      speakerOrder: state.speakerOrder,
      pinnedSegments,
      analysisSnapshots: state.analysisSnapshots,
      mindMapSnapshots: state.analysisSnapshots
        .map((snapshot) => snapshot.mindMapSnapshot)
        .filter(isMindMapSnapshot),
      meetingSummary: state.meetingSummary,
      meetingMinutes: state.meetingMinutes,
      scenarioId: state.scenarioId,
      meetingMemory: state.meetingMemory,
      questionContext: state.questionContext,
      roleContext: state.roleContext,
    }

    const savedSessions = saveSession(session)

    set({
      savedSessions,
      selectedSessionId: session.id,
      replayTimestamp: session.endedAt,
      ...(alreadySaved ? {} : { statusMessage: '会话已保存到本地回放库。' }),
    })
  },
  deleteSession: (sessionId) => {
    if (sessionId === 'session-demo') {
      return
    }

    const nextSessions = removeStoredSession(sessionId)
    const nextSelectedSession = getSelectedSession(
      nextSessions,
      get().selectedSessionId === sessionId ? null : get().selectedSessionId,
    )

    set({
      savedSessions: nextSessions,
      selectedSessionId: nextSelectedSession?.id ?? null,
      replayTimestamp: nextSelectedSession?.endedAt ?? null,
      statusMessage: '已删除保存的会话。',
    })
  },
  selectSession: (sessionId) => {
    const session = get().savedSessions.find((item) => item.id === sessionId)

    if (!session) {
      return
    }

    set({
      mode: 'replay',
      selectedSessionId: session.id,
      replayTimestamp: session.endedAt,
    })
  },
  setReplayTimestamp: (timestamp) => {
    set({ replayTimestamp: timestamp })
  },
  setQuestionContextDraft: (value) => {
    set({ questionContextDraft: normalizeContextInput(value) })
  },
  setRoleContextDraft: (value) => {
    set({ roleContextDraft: normalizeContextInput(value) })
  },
  setScenarioId: (scenarioId) => {
    const resolvedScenarioId = resolveScenarioProfile(scenarioId).id
    const shouldRefresh =
      get().liveSegments.length > 0 && !get().isPaused
    persistContextValue(SCENARIO_ID_STORAGE_KEY, resolvedScenarioId)
    set({
      scenarioId: resolvedScenarioId,
      speakingHintsStale: Boolean(get().speakingHints),
      mindMapStale: Boolean(get().mindMap),
      summaryStale: Boolean(get().meetingSummary),
      minutesStale: Boolean(get().meetingMinutes),
      statusMessage: `已切换为${resolveScenarioProfile(resolvedScenarioId).label}。`,
    })

    if (shouldRefresh) {
      scheduleAnalysis(() => {
        void get().refreshAnalysis()
      })
    }
  },
  setAiQuestionDraft: (value) => {
    set({
      aiQuestionDraft: normalizeContextInput(value),
      aiQaError: null,
    })
  },
  applyQuestionContext: () => {
    const state = get()
    const nextValue = normalizeContextInput(state.questionContextDraft)

    if (
      getComparableContextValue(nextValue) ===
      getComparableContextValue(state.questionContext)
    ) {
      return
    }

    if (!state.currentSessionEndedAt) {
      persistQuestionDraft(nextValue)
    }
    set({
      questionContext: nextValue,
      errorMessage: null,
      statusMessage: 'questionContext 已应用到后续分析。',
    })
  },
  applyRoleContext: () => {
    const state = get()
    const nextValue = normalizeContextInput(state.roleContextDraft)

    if (
      getComparableContextValue(nextValue) ===
      getComparableContextValue(state.roleContext)
    ) {
      return
    }

    persistContextValue(ROLE_CONTEXT_STORAGE_KEY, nextValue)
    set({
      roleContext: nextValue,
      errorMessage: null,
      statusMessage: 'roleContext 已应用到后续分析。',
    })
  },
  clearQuestionContext: () => {
    clearStoredQuestionDraft()
    set({
      questionContextDraft: '',
      questionContext: '',
      errorMessage: null,
      statusMessage: 'questionContext 已清空。',
    })
  },
  clearRoleContext: () => {
    persistContextValue(ROLE_CONTEXT_STORAGE_KEY, '')
    set({
      roleContextDraft: '',
      roleContext: '',
      errorMessage: null,
      statusMessage: 'roleContext 已清空。',
    })
  },
  askAiQuestion: async (questionOverride, options) => {
    const state = get()
    const question = normalizeContextInput(questionOverride ?? state.aiQuestionDraft).trim()
    const segments = getSegmentsForAnalysis(state.liveSegments)
    const promptContext = buildQuestionAnswerPromptContext(state)
    // qa scenarios answer from the JD alone, so a first question needs no transcript.
    const needsTranscript = resolveScenarioProfile(state.scenarioId).interactionModel !== 'qa'

    if (!question || (needsTranscript && !segments.length)) {
      return
    }

    aiQuestionRunToken += 1
    const activeToken = aiQuestionRunToken
    const askedAt = Date.now()

    set({
      isAnsweringQuestion: true,
      aiQaError: null,
      statusMessage: '正在回答当前问题...',
    })

    try {
      const result = await answerInterviewQuestionWithFallback(
        llmProvider,
        getFallbackLlmProvider(),
        question,
        segments,
        promptContext,
      )

      if (activeToken !== aiQuestionRunToken) {
        return
      }

      set((currentState) => ({
        isAnsweringQuestion: false,
        aiQaError: null,
        aiQaHistory: [
          buildInterviewQaTurn(question, result.answer, askedAt, {
            recognitionMs: options?.recognitionMs,
            answerMs: Date.now() - askedAt,
          }),
          ...currentState.aiQaHistory,
        ].slice(0, MAX_QA_HISTORY_ITEMS),
        analysisProviderLabel: result.providerLabel,
        errorMessage: result.warning ?? currentState.errorMessage,
        statusMessage: 'AI 问答已更新。',
      }))
    } catch (error) {
      if (activeToken !== aiQuestionRunToken) {
        return
      }

      rememberPartialMeetingMemory(error)
      set({
        isAnsweringQuestion: false,
        aiQaError: toErrorMessage(error),
        statusMessage: 'AI 问答失败，请稍后重试。',
      })
    }
  },
  startQuestionCapture: async () => {
    const state = get()

    if (
      !state.isStreaming ||
      state.questionCapture !== 'idle' ||
      resolveScenarioProfile(state.scenarioId).interactionModel !== 'qa'
    ) {
      return
    }

    const token = streamRunToken
    const provider = astProviders[state.activeAstProviderId]
    questionCaptureSegmentIds = new Set()
    set({ questionCapture: 'connecting', listeningStatusLabel: '连接中', aiQaError: null })

    questionCaptureStart = (async () => {
      try {
        await provider.resume?.()
      } catch (error) {
        if (token === streamRunToken) {
          questionCaptureSegmentIds = null
          set({ questionCapture: 'idle', listeningStatusLabel: '待提问', aiQaError: toErrorMessage(error) })
        }
        return false
      }

      if (token !== streamRunToken) {
        return false
      }

      if (get().questionCapture === 'connecting') {
        set({ questionCapture: 'recording', listeningStatusLabel: '收音中' })
      }
      return true
    })()
    await questionCaptureStart
  },
  finishQuestionCapture: async () => {
    const state = get()

    if (state.questionCapture !== 'connecting' && state.questionCapture !== 'recording') {
      return
    }

    const token = streamRunToken
    const provider = astProviders[state.activeAstProviderId]
    const releasedAt = Date.now()
    set({ questionCapture: 'transcribing', listeningStatusLabel: '识别中' })

    const started = await (questionCaptureStart ?? Promise.resolve(false))
    questionCaptureStart = null

    if (!started || token !== streamRunToken) {
      return
    }

    try {
      await provider.pause?.()
    } catch (error) {
      set({ aiQaError: toErrorMessage(error) })
    }
    await waitForCapturedSegmentsFinal(get)

    if (token !== streamRunToken) {
      return
    }

    const capturedIds = questionCaptureSegmentIds ?? new Set<string>()
    questionCaptureSegmentIds = null
    const question = joinQuestionText(
      getSegmentsForAnalysis(get().liveSegments).filter((segment) => capturedIds.has(segment.id)),
    )
    set({ questionCapture: 'idle', listeningStatusLabel: '待提问' })

    if (!question) {
      set({ aiQaError: '没有识别到问题，请按住后完整说一遍。' })
      return
    }

    await get().askAiQuestion(question, { recognitionMs: Date.now() - releasedAt })
  },
  clearAiQaHistory: () => {
    aiQuestionRunToken += 1
    set({
      isAnsweringQuestion: false,
      aiQaHistory: [],
      aiQaError: null,
      statusMessage: '已清空当前会话中的 AI 问答记录。',
    })
  },
  refreshAnalysis: async () => {
    const state = get()
    const segments = getSegmentsForAnalysis(state.liveSegments)
    const promptContext = buildPromptContext(state)

    // qa scenarios only record questions; discussion analysis does not apply.
    if (!segments.length || state.isPaused || resolveScenarioProfile(state.scenarioId).interactionModel === 'qa') {
      return
    }
    if (llmProvider.automaticAnalysis?.singleFlight && state.isAnalyzing) {
      scheduleAnalysis(() => { void get().refreshAnalysis() })
      return
    }

    analysisRunToken += 1
    const activeToken = analysisRunToken

    set({
      isAnalyzing: true,
    })

    try {
      const result = await analyzeTranscriptWithFallback(
        llmProvider,
        getFallbackLlmProvider(),
        segments,
        promptContext,
      )

      if (activeToken !== analysisRunToken) {
        return
      }

      const timestamp = segments.at(-1)?.timestamp ?? Date.now()

      set((currentState) => ({
        phaseAnalysis: result.bundle.phaseAnalysis,
        meetingMemory: result.bundle.consensusAnalysis.meetingMemory ?? currentState.meetingMemory,
        consensusAnalysis: result.bundle.consensusAnalysis,
        analysisSnapshots: upsertSnapshot(
          currentState.analysisSnapshots,
          buildReplaySnapshot(
            {
              phaseAnalysis: result.bundle.phaseAnalysis,
              consensusAnalysis: result.bundle.consensusAnalysis,
              speakingHints:
                currentState.speakingHints ??
                createFallbackSpeakingHints(timestamp, state.scenarioId),
            },
            timestamp,
            currentState.mindMap,
          ),
        ),
        analysisProviderLabel: result.providerLabel,
        errorMessage: result.warning ?? currentState.errorMessage,
        isAnalyzing: false,
        lastUpdatedAt: timestamp,
      }))

      get().saveCurrentSession({ createIfMissing: false })
      queueAutoHintsRefresh()
    } catch (error) {
      if (activeToken !== analysisRunToken) {
        return
      }

      rememberPartialMeetingMemory(error)
      set({
        isAnalyzing: false,
        errorMessage: toErrorMessage(error),
        analysisProviderLabel: llmProvider.label,
      })
    }
  },
  refreshSpeakingHints: async () => {
    const state = get()
    const segments = getSegmentsForAnalysis(state.liveSegments)
    const promptContext = buildPromptContext(state)

    if (!segments.length || state.isPaused) {
      return
    }

    clearHintsRefreshTimer()
    speakingHintsRunToken += 1
    const activeToken = speakingHintsRunToken
    lastHintsRequestedAt = Date.now()

    set({
      isRefreshingHints: true,
      errorMessage: null,
      statusMessage: '正在刷新发言建议...',
    })

    try {
      const result = await generateSpeakingHintsWithFallback(
        llmProvider,
        getFallbackLlmProvider(),
        segments,
        promptContext,
      )

      if (activeToken !== speakingHintsRunToken) {
        return
      }

      const timestamp = segments.at(-1)?.timestamp ?? Date.now()
      const hintsBasedOnSegmentAt = latestFinalSegmentTimestamp(segments) ?? timestamp

      set((currentState) => ({
        speakingHints: result.hints,
        speakingHintsStale: false,
        lastHintsUpdatedAt: hintsBasedOnSegmentAt,
        analysisProviderLabel: result.providerLabel,
        analysisSnapshots: upsertSnapshot(
          currentState.analysisSnapshots,
          buildReplaySnapshot(
            {
              phaseAnalysis:
                currentState.phaseAnalysis ?? {
                  phase: 'problem-framing',
                  confidence: 0.5,
                  nextAction: '手动刷新阶段分析',
                  reason: '当前尚无自动阶段分析结果',
                  updatedAt: timestamp,
                },
              consensusAnalysis:
                currentState.consensusAnalysis ?? {
                  consensus: [],
                  tensions: [],
                  missing: [],
                  updatedAt: timestamp,
                },
              speakingHints: result.hints,
            },
            timestamp,
            currentState.mindMap,
          ),
        ),
        errorMessage: result.warning ?? currentState.errorMessage,
        isRefreshingHints: false,
        statusMessage: '发言建议已刷新。',
      }))
      get().saveCurrentSession({ createIfMissing: false })
      queueAutoHintsRefresh()
    } catch (error) {
      if (activeToken !== speakingHintsRunToken) {
        return
      }

      rememberPartialMeetingMemory(error)
      set({
        isRefreshingHints: false,
        errorMessage: toErrorMessage(error),
      })
      queueAutoHintsRefresh()
    }
  },
  generateMindMap: async () => {
    const currentState = get()
    const segments = getSegmentsForAnalysis(currentState.liveSegments)
    const promptContext = buildPromptContext(currentState)

    if (!segments.length) {
      return
    }

    mindMapRunToken += 1
    const activeToken = mindMapRunToken

    let latestBundle: {
      phaseAnalysis: PhaseAnalysis
      consensusAnalysis: ConsensusAnalysis
    } | null = null
    let latestWarning: string | undefined

    set({
      isGeneratingMindMap: true,
      errorMessage: null,
      statusMessage: '正在生成思维导图...',
    })

    try {
      const latestState = get()

      if (!latestState.phaseAnalysis || !latestState.consensusAnalysis) {
        const analysisResult = await analyzeTranscriptWithFallback(
          llmProvider,
          getFallbackLlmProvider(),
          segments,
          promptContext,
        )

        if (activeToken !== mindMapRunToken) {
          return
        }

        latestBundle = analysisResult.bundle
        latestWarning = analysisResult.warning
      }

      const result = await generateMindMapWithFallback(
        llmProvider,
        getFallbackLlmProvider(),
        segments,
        promptContext,
      )

      if (activeToken !== mindMapRunToken) {
        return
      }

      const timestamp = segments.at(-1)?.timestamp ?? Date.now()

      set((state) => {
        const phaseAnalysis = latestBundle?.phaseAnalysis ?? state.phaseAnalysis
        const consensusAnalysis =
          latestBundle?.consensusAnalysis ?? state.consensusAnalysis
        const speakingHints =
          state.speakingHints ??
          createFallbackSpeakingHints(timestamp, state.scenarioId)

        if (!phaseAnalysis || !consensusAnalysis) {
          return {
            isGeneratingMindMap: false,
            errorMessage: '思维导图生成前缺少分析上下文，请稍后重试。',
            statusMessage: '思维导图生成失败，请稍后重试。',
          }
        }

          return {
            phaseAnalysis,
            consensusAnalysis,
            meetingMemory: consensusAnalysis.meetingMemory ?? state.meetingMemory,
            speakingHints,
            mindMap: result.snapshot,
            mindMapStale: false,
            analysisSnapshots: upsertSnapshot(
              state.analysisSnapshots,
              buildReplaySnapshot(
              {
                phaseAnalysis,
                consensusAnalysis,
                speakingHints,
              },
              timestamp,
              result.snapshot,
            ),
          ),
          analysisProviderLabel:
            result.providerLabel,
          isGeneratingMindMap: false,
          lastUpdatedAt: timestamp,
          errorMessage: result.warning ?? latestWarning ?? state.errorMessage,
          statusMessage: '思维导图已更新。',
        }
      })
      get().saveCurrentSession({ createIfMissing: false })
    } catch (error) {
      if (activeToken !== mindMapRunToken) {
        return
      }

      rememberPartialMeetingMemory(error)
      set({
        isGeneratingMindMap: false,
        errorMessage: toErrorMessage(error),
        statusMessage: '思维导图生成失败，请稍后重试。',
      })
    }
  },
  generateMeetingSummary: async () => {
    const state = get()
    const segments = getSegmentsForSummary(state.liveSegments)
    const promptContext = buildPromptContext(state)

    if (!segments.length || state.isPaused) {
      return
    }

    summaryRunToken += 1
    const activeToken = summaryRunToken

    set({
      isGeneratingSummary: true,
      errorMessage: null,
      statusMessage: '正在生成总结发言...',
    })

    try {
      const result = await generateMeetingSummaryWithFallback(
        llmProvider,
        getFallbackLlmProvider(),
        segments,
        promptContext,
      )

      if (activeToken !== summaryRunToken) {
        return
      }

      const timestamp = segments.at(-1)?.timestamp ?? Date.now()

      set((currentState) => ({
        meetingSummary: result.summary,
        summaryStale: false,
        lastSummaryUpdatedAt: timestamp,
        analysisProviderLabel: result.providerLabel,
        errorMessage: result.warning ?? currentState.errorMessage,
        isGeneratingSummary: false,
        statusMessage: '总结发言已更新。',
      }))
      get().saveCurrentSession({ createIfMissing: false })
    } catch (error) {
      if (activeToken !== summaryRunToken) {
        return
      }

      rememberPartialMeetingMemory(error)
      set((currentState) => ({
        isGeneratingSummary: false,
        meetingSummary: currentState.meetingSummary ?? (getRuntimeEnvironment() === 'electron'
          ? null : createFallbackMeetingSummary(Date.now(), currentState.scenarioId)),
        errorMessage: toErrorMessage(error),
        statusMessage: '总结发言生成失败，请稍后重试。',
      }))
    }
  },
  generateMeetingMinutes: async () => {
    const state = get()
    const segments = getSegmentsForSummary(state.liveSegments)
    const promptContext = buildPromptContext(state)

    if (!segments.length || state.isPaused) {
      return
    }

    minutesRunToken += 1
    const activeToken = minutesRunToken

    set({
      isGeneratingMinutes: true,
      errorMessage: null,
      statusMessage: '正在生成会议纪要...',
    })

    try {
      const result = await generateMeetingMinutesWithFallback(
        llmProvider,
        getFallbackLlmProvider(),
        segments,
        promptContext,
      )

      if (activeToken !== minutesRunToken) {
        return
      }

      set((currentState) => ({
        meetingMinutes: result.minutes,
        minutesStale: false,
        analysisProviderLabel: result.providerLabel,
        errorMessage: result.warning ?? currentState.errorMessage,
        isGeneratingMinutes: false,
        statusMessage: '会议纪要已更新。',
      }))
      get().saveCurrentSession({ createIfMissing: false })
    } catch (error) {
      if (activeToken !== minutesRunToken) {
        return
      }

      rememberPartialMeetingMemory(error)
      set((currentState) => ({
        isGeneratingMinutes: false,
        meetingMinutes: currentState.meetingMinutes ?? (getRuntimeEnvironment() === 'electron'
          ? null : createFallbackMeetingMinutes(Date.now())),
        errorMessage: toErrorMessage(error),
        statusMessage: '会议纪要生成失败，请稍后重试。',
      }))
    }
  },
}))

rememberPartialMeetingMemory = (error: unknown) => {
  const memory = readPartialMeetingMemory(error)
  if (!memory?.chunks.length) return
  useAppStore.setState({ meetingMemory: memory })
  useAppStore.getState().saveCurrentSession({ createIfMissing: false })
}

queueAutoHintsRefresh = () => {
  clearHintsRefreshTimer()
  const latest = useAppStore.getState()
  const delay = hintsAutoRefreshDelayMs({
    // qa scenarios answer on demand instead of producing speaking hints.
    enabled:
      latest.autoRefreshHints &&
      resolveScenarioProfile(latest.scenarioId).interactionModel !== 'qa',
    isStreaming: latest.isStreaming,
    isPaused: latest.isPaused,
    isRefreshing: latest.isRefreshingHints,
    latestFinalSegmentAt: latestFinalSegmentTimestamp(latest.liveSegments),
    hintsBasedOnSegmentAt: latest.speakingHints ? latest.lastHintsUpdatedAt : null,
    lastRequestedAt: lastHintsRequestedAt,
    now: Date.now(),
  })

  if (delay === null) {
    return
  }

  if (delay === 0) {
    void useAppStore.getState().refreshSpeakingHints()
    return
  }

  hintsRefreshTimeoutId = window.setTimeout(() => {
    hintsRefreshTimeoutId = null
    queueAutoHintsRefresh()
  }, delay)
}
