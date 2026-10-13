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
  scenarioId?: MeetingScenarioId
  questionContext?: string
  roleContext?: string
  phaseContext?: string
  summaryAssemblyContext?: SummaryAssemblyContext
}

