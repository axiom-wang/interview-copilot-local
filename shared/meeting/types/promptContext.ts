import type { MeetingMemory } from './meetingMemory'
import type { MindMapSnapshot } from './mindmap'
import type { MeetingScenarioId } from '../scenarios'
import type { TranscriptSegment } from './transcript'

export interface SummaryAssemblyContext {
  phase?: string
  consensus?: string[]
  tensions?: string[]
  missing?: string[]
  mindMap?: MindMapSnapshot | null
  transcript?: TranscriptSegment[]
}

export interface AnalysisPromptContext {
  previousParticipantView?: import('./analysis').ParticipantView
  meetingMemory?: MeetingMemory
  pinnedSegmentIds?: string[]
  // Prepared inside the analysis service, never trusted from an HTTP/IPC request.
  meetingHistory?: string
  scenarioId?: MeetingScenarioId
  questionContext?: string
  roleContext?: string
  referenceContext?: string
  timing?: import('../context/timeBudget').TimingContext
  // Set while participants give their opening statements in turn.
  openingRound?: boolean
  phaseContext?: string
  summaryAssemblyContext?: SummaryAssemblyContext
}

