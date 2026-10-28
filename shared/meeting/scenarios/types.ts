import type { PhaseType } from '../types/analysis'

export type MeetingScenarioId =
  | 'general'
  | 'group-interview'
  | 'one-on-one-interview'
  | 'design-review'
  | 'brainstorm'
  | 'team-sync'

// discussion: continuous listening with discussion analysis;
// qa: push-to-talk questions answered on demand, no continuous listening.
export type ScenarioInteractionModel = 'discussion' | 'qa'

// Copy for scenarios with the `qa` interaction model (push-to-talk questions).
export interface QaScenarioCopy {
  assistantRole: string
  transcriptRule: string
  askerLabel: string
  transcriptTitle: string
  captureStatus: string
  emptyTranscript: string
  startLabel: string
  startNote: string
  questionPlaceholder: string
  captureHint: string
}

// Copy for an opening round where each participant gives a prepared statement in turn.
export interface OpeningRoundCopy {
  label: string
  rule: string
  statementGuide: string
  lengthHint: string
}

export interface MeetingScenarioProfile {
  id: MeetingScenarioId
  label: string
  description: string
  interactionModel: ScenarioInteractionModel
  roleContextEnabled?: boolean
  // Reusable background material (e.g. job description, prep notes) kept across sessions.
  referenceContextEnabled?: boolean
  referenceContextLabel?: string
  // Tells the model how to treat the reference material; shown only in prompts.
  referencePromptNote?: string
  referenceHelp?: string
  referencePlaceholder?: string
  topicContextRequired?: boolean
  qa?: QaScenarioCopy
  openingRound?: OpeningRoundCopy
  contextTitle?: string
  topicHelp?: string
  preparationNote?: string
  analysisRules?: string[]
  analystRole: string
  domainHint: string
  valueDimensions: string[]
  analystTone: string
  phaseLabels: Record<PhaseType, string>
  phaseDefinitions: Record<PhaseType, string>
  phaseSignals: string[]
  participantPersona: string
  hintStyleRules: string[]
  spokenSummaryLabel: string
  spokenSummaryLengthHint: string
  summaryPurpose: string
  minutesFocus: string[]
  topicContextLabel: string
  roleContextLabel: string
  topicPlaceholder: string
  rolePlaceholder: string
  quickQuestions: string[]
}
