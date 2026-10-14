import { normalizeParticipantView } from '../../meeting/context/participantView'
import { normalizeScenarioFocus } from '../../meeting/context/scenarioFocus'
import {
  coerceString,
  coerceStringArray,
  normalizeSpeakingHints,
} from '../../meeting/services/analysisNormalization'
import { normalizeMindMapSnapshot } from '../../meeting/services/mindMapTransform'
import type {
  ConsensusAnalysis,
  InterviewQaAnswer,
  MeetingMinutes,
  MeetingSummary,
  PhaseAnalysis,
  PhaseType,
  SpeakingHints,
} from '../../meeting/types/analysis'
import type { MindMapSnapshot } from '../../meeting/types/mindmap'

const PHASE_SET = new Set<PhaseType>([
  'problem-framing',
  'option-divergence',
  'alignment-building',
  'decision-lock',
])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getRequiredPhase = (value: unknown): PhaseType => {
  const phase = coerceString(value)

  if (!PHASE_SET.has(phase as PhaseType)) {
    throw new Error('phase is not in the allowed set')
  }

  return phase as PhaseType
}

const getNumberInRange = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return Math.max(0, Math.min(1, value))
}

export const parsePhaseAnalysis = (
  value: unknown,
  updatedAt: number,
): PhaseAnalysis => {
  if (!isObject(value)) {
    throw new Error('phase response format is invalid')
  }

  const nextAction = coerceString(
    value.nextAction ?? value.nextBestAction,
    '继续推进当前讨论主线',
  )

  return {
    phase: getRequiredPhase(value.phase),
    confidence: getNumberInRange(value.confidence, 0.5),
    nextAction,
    nextBestAction:
      typeof value.nextBestAction === 'string' && value.nextBestAction.trim()
        ? value.nextBestAction.trim()
        : undefined,
    reason: coerceString(value.reason, '当前证据有限，建议继续补充关键信息。'),
    updatedAt,
  }
}

export const parseConsensusAnalysis = (
  value: unknown,
  updatedAt: number,
): ConsensusAnalysis => {
  if (!isObject(value)) {
    throw new Error('consensus response format is invalid')
  }

  return {
    participantView: normalizeParticipantView(value.participantView),
    scenarioFocus: normalizeScenarioFocus(value.scenarioFocus),
    consensus: coerceStringArray(value.consensus, { maxItems: 4 }),
    tensions: coerceStringArray(value.tensions, { maxItems: 4 }),
    missing: coerceStringArray(value.missing, { maxItems: 4 }),
    updatedAt,
  }
}

export const parseSpeakingHints = (
  value: unknown,
  updatedAt: number,
): SpeakingHints => {
  if (!isObject(value)) {
    throw new Error('hints response format is invalid')
  }

  return normalizeSpeakingHints(value, updatedAt)
}

export const parseMeetingSummary = (
  value: unknown,
  updatedAt: number,
): MeetingSummary => {
  if (!isObject(value)) {
    throw new Error('summary response format is invalid')
  }

  const speech60s = coerceString(
    value.speech60s,
    '我们先统一当前阶段结论，再按风险和落地步骤补齐最终汇报口径。',
  )

  return {
    speech60s,
    keyPoints: coerceStringArray(value.keyPoints, { maxItems: 5 }),
    nextSteps: coerceStringArray(value.nextSteps, { maxItems: 4 }),
    updatedAt,
  }
}

export const parseMeetingMinutes = (
  value: unknown,
  updatedAt: number,
): MeetingMinutes => {
  if (!isObject(value)) {
    throw new Error('meeting minutes response format is invalid')
  }

  const topics = Array.isArray(value.topics)
    ? value.topics
        .filter(isObject)
        .map((topic) => ({
          topic: coerceString(topic.topic),
          points: coerceStringArray(topic.points),
          conclusion: coerceString(topic.conclusion),
        }))
        .filter((topic) => topic.topic || topic.points.length > 0)
    : []
  const actionItems = Array.isArray(value.actionItems)
    ? value.actionItems
        .filter(isObject)
        .map((item) => ({
          owner: coerceString(item.owner),
          task: coerceString(item.task),
          due: coerceString(item.due),
        }))
        .filter((item) => item.task)
    : []

  return {
    title: coerceString(value.title, '会议纪要'),
    overview: coerceString(value.overview, '本次会议内容已整理。'),
    topics,
    decisions: coerceStringArray(value.decisions),
    openQuestions: coerceStringArray(value.openQuestions),
    actionItems,
    updatedAt,
  }
}

export const parseInterviewQaAnswer = (
  value: unknown,
  updatedAt: number,
): InterviewQaAnswer => {
  if (!isObject(value)) {
    throw new Error('qa response format is invalid')
  }

  const conclusion = coerceString(
    value.conclusion,
    '当前信息不足，暂时无法给出明确判断。',
  )
  const suggestedReply = coerceString(
    value.suggestedReply,
    '',
  )
  const reasoning = coerceStringArray(value.reasoning, { maxItems: 4 })

  return {
    conclusion,
    reasoning:
      reasoning.length > 0
        ? reasoning
        : ['当前证据有限，建议优先基于题目目标和已形成共识做稳妥表达。'],
    suggestedReply,
    updatedAt,
  }
}

export const parseMindMapSnapshot = (
  value: unknown,
  capturedAt: number,
): MindMapSnapshot => normalizeMindMapSnapshot(value, capturedAt)
