import {
  coerceString,
  coerceStringArray,
  normalizeFunctionType,
} from '../../src/services/analysisNormalization'
import { normalizeMindMapSnapshot } from '../../src/services/mindMapTransform'
import type {
  ConsensusAnalysis,
  InterviewQaAnswer,
  MeetingSummary,
  PhaseAnalysis,
  PhaseType,
  SpeakingHints,
} from '../../src/types/analysis'
import type { MindMapSnapshot } from '../../src/types/mindmap'

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

  const hint15s = coerceString(
    value.hint15s,
    '我先帮大家把讨论结构快速收一下，再看最关键的分歧点。',
  )

  return {
    functionType: normalizeFunctionType(coerceString(value.functionType)),
    whyNow: coerceString(value.whyNow),
    hint15s,
    hint30s: coerceString(value.hint30s, hint15s),
    hint60s: coerceString(value.hint60s, hint15s),
    updatedAt,
  }
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

export const parseInterviewQaAnswer = (
  value: unknown,
  updatedAt: number,
): InterviewQaAnswer => {
  if (!isObject(value)) {
    throw new Error('qa response format is invalid')
  }

  const conclusion = coerceString(
    value.conclusion,
    '当前更稳妥的做法，是先顺着题目目标和团队主线给出一个克制判断。',
  )
  const suggestedReply = coerceString(
    value.suggestedReply,
    '我觉得我们可以先顺着题目目标，把当前已经形成的共识说清楚，而不是急着再铺很多新点。基于刚才的讨论，我会更倾向于先给出一个稳妥判断，再补一句为什么我们这样取舍，这样既能体现思考，也能帮助团队收敛。然后如果大家认可，我们可以顺势把下一步要确认的结论或者分工一起推进掉。',
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
