import { groundConsensusEvidence } from '../../../../shared/meeting/context/groundConsensus'
import type { CodexConfig } from '../../../../shared/meeting/types/desktopAnalysis'
import type { AnalysisPromptContext } from '../../../../shared/meeting/types/promptContext'
import type { TranscriptSegment } from '../../../../shared/meeting/types/transcript'
import { buildDetectPhasePrompt } from '../../../../shared/meeting/prompts/detectPhase'
import { buildExtractConsensusPrompt } from '../../../../shared/meeting/prompts/extractConsensus'
import { detectPhaseSchema } from '../../../../shared/meeting/schemas/detectPhase.schema.ts'
import { extractConsensusSchema } from '../../../../shared/meeting/schemas/extractConsensus.schema.ts'
import { parseConsensusAnalysis, parsePhaseAnalysis } from '../../../../shared/analysis/llm/responseParsing'
import { getRecentSegmentsByWindow } from '../../../../shared/analysis/llm/segmentWindows'
import { CodexClient } from './codexClient'
import {
  prepareAnalysisContext, answerInterviewQuestionOnly, generateMeetingMinutesOnly,
  generateMeetingSummaryOnly, generateSpeakingHintsOnly,
  generateTranscriptMindMap, type StructuredResponse,
} from '../../../../shared/analysis/llm/openaiAnalysisService'

let current: { key: string; client: CodexClient } | null = null
const probes = new Set<CodexClient>()

export const disposeCodexAnalysis = () => {
  current?.client.dispose()
  current = null
}

export const shutdownCodexAnalysis = () => {
  disposeCodexAnalysis()
  for (const client of probes) client.dispose()
  probes.clear()
}

const getClient = (config: CodexConfig) => {
  const key = JSON.stringify(config)
  if (current?.key !== key) {
    disposeCodexAnalysis()
    current = { key, client: new CodexClient(config) }
  }
  return current!.client
}

export const probeCodexConnection = async (config: CodexConfig) => {
  const client = new CodexClient(config)
  probes.add(client)
  try { return await client.probe() } finally {
    client.dispose()
    probes.delete(client)
  }
}

export const codexAnalysis = (config: CodexConfig) => {
  const client = getClient(config)
  const createResponse: StructuredResponse = async (prompt, _name, schema, parser) =>
    parser(await client.structured(prompt, schema))

  return {
    realtime: async (segments: TranscriptSegment[], context?: AnalysisPromptContext) => {
      context = await prepareAnalysisContext(segments, context, undefined, createResponse)
      const recent = getRecentSegmentsByWindow(segments, 90_000)
      const updatedAt = segments.at(-1)?.timestamp ?? Date.now()
      const prompt = `请完成以下两项会议分析，将结果分别放入 phaseAnalysis 和 consensusAnalysis，最终只输出一个 JSON 对象。\n\n阶段分析任务：\n${buildDetectPhasePrompt(recent, context)}\n\n共识分析任务：\n${buildExtractConsensusPrompt(recent, context)}`
      const result = await client.structured(prompt, {
        type: 'object',
        properties: { phaseAnalysis: detectPhaseSchema, consensusAnalysis: extractConsensusSchema },
        required: ['phaseAnalysis', 'consensusAnalysis'], additionalProperties: false,
      }) as Record<string, unknown>
      return {
        phaseAnalysis: parsePhaseAnalysis(result.phaseAnalysis, updatedAt),
        consensusAnalysis: { ...groundConsensusEvidence(parseConsensusAnalysis(result.consensusAnalysis, updatedAt), segments), meetingMemory: context.meetingMemory,
      contextCoverage: { segmentCount: segments.length, throughTimestamp: updatedAt } },
      }
    },
    hints: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateSpeakingHintsOnly(segments, context, undefined, createResponse),
    mindMap: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateTranscriptMindMap(segments, context, undefined, createResponse),
    summary: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateMeetingSummaryOnly(segments, context, undefined, createResponse),
    minutes: (segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      generateMeetingMinutesOnly(segments, context, undefined, createResponse),
    answer: (question: string, segments: TranscriptSegment[], context?: AnalysisPromptContext) =>
      answerInterviewQuestionOnly(question, segments, context, undefined, createResponse),
  }
}
