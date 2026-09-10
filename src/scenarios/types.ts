import type { PhaseType } from '../types/analysis'

export type MeetingScenarioId =
  | 'general'
  | 'group-interview'
  | 'design-review'
  | 'brainstorm'
  | 'team-sync'

export interface MeetingScenarioProfile {
  id: MeetingScenarioId
  label: string
  description: string
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
