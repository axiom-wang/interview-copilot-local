import type {
  ConsensusAnalysis,
  InterviewQaAnswer,
  MeetingMinutes,
  MeetingSummary,
  PhaseAnalysis,
  SpeakingHints,
} from '../../types/analysis'
import type { MindMapSnapshot } from '../../types/mindmap'
import type { AnalysisPromptContext } from '../../types/promptContext'
import type { TranscriptSegment } from '../../types/transcript'

export interface LlmProvider {
  readonly id: string
  readonly label: string
  detectPhase(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<PhaseAnalysis>
  extractConsensusAndTensions(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<ConsensusAnalysis>
  generateSpeakingHints(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<SpeakingHints>
  generateMindMap(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<MindMapSnapshot>
  generateMeetingSummary(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<MeetingSummary>
  generateMeetingMinutes(
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<MeetingMinutes>
  answerInterviewQuestion(
    question: string,
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<InterviewQaAnswer>
}
