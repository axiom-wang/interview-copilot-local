import type {
  ConsensusAnalysis,
  MeetingMinutes,
  MeetingSummary,
  PhaseAnalysis,
  SpeakingHints,
} from './analysis'
import type { MeetingScenarioId } from '../scenarios'
import type { MindMapSnapshot } from './mindmap'
import type { SpeakerProfile } from './speaker'
import type { TranscriptSegment } from './transcript'

export interface PinnedSegment {
  id: string
  segmentId: string
  note: string
  pinnedAt: number
}

export interface ReplaySnapshot {
  id: string
  timestamp: number
  phaseAnalysis: PhaseAnalysis
  consensusAnalysis: ConsensusAnalysis
  speakingHints: SpeakingHints
  mindMapSnapshot: MindMapSnapshot | null
}

export interface SessionRecord {
  id: string
  title: string
  startedAt: number
  endedAt: number
  transcriptSegments: TranscriptSegment[]
  pinnedSegments: PinnedSegment[]
  analysisSnapshots: ReplaySnapshot[]
  mindMapSnapshots: MindMapSnapshot[]
  meetingSummary: MeetingSummary | null
  meetingMinutes: MeetingMinutes | null
  scenarioId: MeetingScenarioId
  speakerProfiles: Record<string, SpeakerProfile>
  speakerOrder: string[]
}
