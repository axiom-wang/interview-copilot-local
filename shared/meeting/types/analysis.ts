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
  | '推进结构'
  | '补齐信息'
  | '化解分歧'
  | '收敛结论'
  | '分工落地'
  | '汇报总结'

export interface ConsensusAnalysis {
  consensus: string[]
  tensions: string[]
  missing: string[]
  updatedAt: number
}

export interface SpeakingHints {
  functionType: SpeakingFunctionType
  whyNow: string
  hint15s: string
  hint30s: string
  hint60s: string
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

export interface InterviewQaAnswer {
  conclusion: string
  reasoning: string[]
  suggestedReply: string
  updatedAt: number
}

export interface InterviewQaTurn {
  id: string
  question: string
  answer: InterviewQaAnswer
  askedAt: number
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
    hint15s: string
    hint30s?: string
    hint60s?: string
  }
  mindMap: {
    topic: string
    nodes: LegacyMindMapNode[]
  }
}
