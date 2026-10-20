import type { MeetingMemory } from './meetingMemory'
import type { LegacyMindMapNode, MindMapSnapshot } from './mindmap'

export type PhaseType =
  | 'problem-framing'
  | 'option-divergence'
  | 'alignment-building'
  | 'decision-lock'

export interface PhaseAnalysis {
  phase: PhaseType
  confidence: number
  nextAction: string
  // Deprecated: kept for replay/backward compatibility reads.
  nextBestAction?: string
  reason: string
  updatedAt: number
}

export type SpeakingFunctionType =
  | '倾听观察'
  | '提出观点'
  | '检验推理'
  | '推进结构'
  | '补齐信息'
  | '化解分歧'
  | '收敛结论'
  | '分工落地'
  | '汇报总结'

export interface ScenarioFocusItem {
  label: string
  detail: string
  evidenceIds: string[]
}

export interface ParticipantView {
  understanding: string
  intent: 'contribute' | 'clarify' | 'challenge' | 'listen'
  contribution: string
  reason: string
  evidenceIds: string[]
}

export interface ConsensusAnalysis {
  participantView?: ParticipantView
  scenarioFocus?: ScenarioFocusItem[]
  contextCoverage?: { segmentCount: number; throughTimestamp: number }
  meetingMemory?: MeetingMemory
  consensus: string[]
  tensions: string[]
  missing: string[]
  updatedAt: number
}

export interface SpeakingHints {
  functionType: SpeakingFunctionType
  whyNow: string
  hint60s: string
  hint120s: string
  updatedAt: number
}

export interface MeetingSummary {
  speech60s: string
  keyPoints: string[]
  nextSteps: string[]
  updatedAt: number
}

export interface MeetingMinutesTopic {
  topic: string
  points: string[]
  conclusion: string
}

export interface MeetingMinutesActionItem {
  owner: string
  task: string
  due: string
}

export interface MeetingMinutes {
  title: string
  overview: string
  topics: MeetingMinutesTopic[]
  decisions: string[]
  openQuestions: string[]
  actionItems: MeetingMinutesActionItem[]
  updatedAt: number
}

export type InterviewQuestionType =
  | 'self-intro'
  | 'behavioral'
  | 'technical'
  | 'motivation'
  | 'case'
  | 'reverse-qa'
  | 'other'

// background: the candidate's own experience; jd: the job description only; none: no grounding.
export type InterviewAnswerGrounding = 'background' | 'jd' | 'none'

export interface InterviewAnswerDetail {
  questionType: InterviewQuestionType
  keyPoints: string[]
  grounding: InterviewAnswerGrounding
  missingContext: string
}

export interface InterviewQaAnswer {
  conclusion: string
  reasoning: string[]
  suggestedReply: string
  // Present only for scenarios with the `qa` interaction model.
  interview?: InterviewAnswerDetail
  updatedAt: number
}

export interface InterviewQaTiming {
  // From releasing the capture key until the question text was ready.
  recognitionMs?: number
  // From sending the question until the answer arrived.
  answerMs: number
}

export interface InterviewQaTurn {
  id: string
  question: string
  answer: InterviewQaAnswer
  askedAt: number
  timing?: InterviewQaTiming
}

export interface RealtimeAnalysisBundle {
  phaseAnalysis: PhaseAnalysis
  consensusAnalysis: ConsensusAnalysis
  speakingHints: SpeakingHints
}

export interface PhaseConsensusAnalysisBundle {
  phaseAnalysis: PhaseAnalysis
  consensusAnalysis: ConsensusAnalysis
}

export interface AnalysisBundle extends RealtimeAnalysisBundle {
  mindMapSnapshot: MindMapSnapshot
}

export interface MockAnalysisScenario {
  minSegments: number
  phase: {
    phase: PhaseType
    confidence: number
    nextAction?: string
    nextBestAction?: string
    reason?: string
  }
  consensus: Omit<ConsensusAnalysis, 'updatedAt'>
  hints: {
    functionType: string
    whyNow?: string
    hint60s: string
    hint120s: string
  }
  mindMap: {
    topic: string
    nodes: LegacyMindMapNode[]
  }
}
