import { groundConsensusEvidence } from '../../../../shared/meeting/context/groundConsensus'
import type { AnalysisPromptContext } from '../../../../shared/meeting/types/promptContext'
import type { TranscriptSegment } from '../../../../shared/meeting/types/transcript'
import { buildRealtimeAnalysisPrompt } from '../../../../shared/meeting/prompts/realtimeAnalysis'
import { detectPhaseSchema } from '../../../../shared/meeting/schemas/detectPhase.schema.ts'
import { extractConsensusSchema } from '../../../../shared/meeting/schemas/extractConsensus.schema.ts'
import { parseConsensusAnalysis, parsePhaseAnalysis } from '../../../../shared/analysis/llm/responseParsing'
import { stableTranscript } from '../../../../shared/meeting/context/meetingMemory'
import { resolveScenarioProfile } from '../../../../shared/meeting/scenarios'
import {
  prepareAnalysisContext, answerInterviewQuestionOnly, generateMeetingMinutesOnly,
  generateMeetingSummaryOnly, generateSpeakingHintsOnly,
  generateTranscriptMindMap, type StructuredResponse,
} from '../../../../shared/analysis/llm/openaiAnalysisService'

export interface LocalAnalysisClient {
  structured(prompt: string, schema: Record<string, unknown>, effort?: 'low' | 'medium'): Promise<unknown>
}

export interface LocalAnalysisOptions {
  // Replaces the phase schema in the combined realtime request.
  phaseSchema?: Record<string, unknown>
  // Appended to the realtime prompt, e.g. to constrain output length.
  realtimePromptSuffix?: string
  // Use the low-effort path for answers in `qa` scenarios, where latency matters most.
  fastQaAnswers?: boolean
}

// Analysis surface shared by the local CLI channels (Codex, Claude).
export const createLocalAnalysis = (client: LocalAnalysisClient, options: LocalAnalysisOptions = {}) => {
  const createResponse: StructuredResponse = async (prompt, _name, schema, parser) =>
    parser(await client.structured(prompt, schema))
  const createLiveResponse: StructuredResponse = async (prompt, name, schema, parser) =>
    parser(await client.structured(prompt, schema, name === 'meeting_memory' ? 'medium' : 'low'))

  return {
    realtime: async (segments: TranscriptSegment[], context?: AnalysisPromptContext) => {
      context = await prepareAnalysisContext(segments, context, undefined, createResponse)
      const recent = stableTranscript(segments)
      const updatedAt = segments.at(-1)?.timestamp ?? Date.now()
      const prompt = buildRealtimeAnalysisPrompt(recent, context) + (options.realtimePromptSuffix ?? '')
      const result = await client.structured(prompt, {
        type: 'object',
        properties: { phaseAnalysis: options.phaseSchema ?? detectPhaseSchema, consensusAnalysis: extractConsensusSchema },
        required: ['phaseAnalysis', 'consensusAnalysis'], additionalProperties: false,
      }, 'low') as Record<string, unknown>
      return {
        phaseAnalysis: parsePhaseAnalysis(result.phaseAnalysis, updatedAt),
        consensusAnalysis: {
          ...groundConsensusEvidence(parseConsensusAnalysis(result.consensusAnalysis, updatedAt), segments),
          meetingMemory: context.meetingMemory,
          contextCoverage: { segmentCount: segments.length, throughTimestamp: updatedAt },
        },
      }
    },
    hints: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateSpeakingHintsOnly(segments, context, undefined, createLiveResponse),
    mindMap: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateTranscriptMindMap(segments, context, undefined, createResponse),
    summary: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateMeetingSummaryOnly(segments, context, undefined, createResponse),
    minutes: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateMeetingMinutesOnly(segments, context, undefined, createResponse),
    answer: (question: string, segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      answerInterviewQuestionOnly(question, segments, context, undefined,
        options.fastQaAnswers && resolveScenarioProfile(context?.scenarioId).interactionModel === 'qa'
          ? createLiveResponse : createResponse),
  }
}
