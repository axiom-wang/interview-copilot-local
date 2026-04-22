import type { LlmProvider } from '../providers/llm/LlmProvider'
import type {
  InterviewQaAnswer,
  MeetingSummary,
  PhaseConsensusAnalysisBundle,
  SpeakingHints,
} from '../types/analysis'
import type { MindMapSnapshot } from '../types/mindmap'
import type { AnalysisPromptContext } from '../types/promptContext'
import type { TranscriptSegment } from '../types/transcript'

export interface PhaseConsensusAnalysisRunResult {
  bundle: PhaseConsensusAnalysisBundle
  providerLabel: string
  warning?: string
}

export interface SpeakingHintsRunResult {
  hints: SpeakingHints
  providerLabel: string
  warning?: string
}

export interface MindMapRunResult {
  snapshot: MindMapSnapshot
  providerLabel: string
  warning?: string
}

export interface MeetingSummaryRunResult {
  summary: MeetingSummary
  providerLabel: string
  warning?: string
}

export interface InterviewQaRunResult {
  answer: InterviewQaAnswer
  providerLabel: string
  warning?: string
}

const runPhaseConsensusAnalysis = async (
  provider: LlmProvider,
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
): Promise<PhaseConsensusAnalysisBundle> => {
  const [phaseAnalysis, consensusAnalysis] = await Promise.all([
    provider.detectPhase(segments, context),
    provider.extractConsensusAndTensions(segments, context),
  ])

  return {
    phaseAnalysis,
    consensusAnalysis,
  }
}

export const analyzeTranscriptWithFallback = async (
  primaryProvider: LlmProvider,
  fallbackProvider: LlmProvider,
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
): Promise<PhaseConsensusAnalysisRunResult> => {
  try {
    const bundle = await runPhaseConsensusAnalysis(
      primaryProvider,
      segments,
      context,
    )

    return {
      bundle,
      providerLabel: primaryProvider.label,
    }
  } catch (error) {
    const bundle = await runPhaseConsensusAnalysis(
      fallbackProvider,
      segments,
      context,
    )

    return {
      bundle,
      providerLabel: `${primaryProvider.label} -> ${fallbackProvider.label}`,
      warning:
        error instanceof Error
          ? error.message
          : '未知分析通道错误，已回退到模拟分析。',
    }
  }
}

export const generateSpeakingHintsWithFallback = async (
  primaryProvider: LlmProvider,
  fallbackProvider: LlmProvider,
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
): Promise<SpeakingHintsRunResult> => {
  try {
    const hints = await primaryProvider.generateSpeakingHints(segments, context)

    return {
      hints,
      providerLabel: primaryProvider.label,
    }
  } catch (error) {
    const hints = await fallbackProvider.generateSpeakingHints(segments, context)

    return {
      hints,
      providerLabel: `${primaryProvider.label} -> ${fallbackProvider.label}`,
      warning:
        error instanceof Error
          ? error.message
          : '未知建议通道错误，已回退到模拟建议。',
    }
  }
}

export const generateMindMapWithFallback = async (
  primaryProvider: LlmProvider,
  fallbackProvider: LlmProvider,
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
): Promise<MindMapRunResult> => {
  try {
    const snapshot = await primaryProvider.generateMindMap(segments, context)

    return {
      snapshot,
      providerLabel: primaryProvider.label,
    }
  } catch (error) {
    const snapshot = await fallbackProvider.generateMindMap(segments, context)

    return {
      snapshot,
      providerLabel: `${primaryProvider.label} -> ${fallbackProvider.label}`,
      warning:
        error instanceof Error
          ? error.message
          : '未知思维导图通道错误，已回退到模拟生成。',
    }
  }
}

export const generateMeetingSummaryWithFallback = async (
  primaryProvider: LlmProvider,
  fallbackProvider: LlmProvider,
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
): Promise<MeetingSummaryRunResult> => {
  try {
    const summary = await primaryProvider.generateMeetingSummary(segments, context)

    return {
      summary,
      providerLabel: primaryProvider.label,
    }
  } catch (error) {
    const summary = await fallbackProvider.generateMeetingSummary(segments, context)

    return {
      summary,
      providerLabel: `${primaryProvider.label} -> ${fallbackProvider.label}`,
      warning:
        error instanceof Error
          ? error.message
          : '未知总结通道错误，已回退到模拟总结。',
    }
  }
}

export const answerInterviewQuestionWithFallback = async (
  primaryProvider: LlmProvider,
  fallbackProvider: LlmProvider,
  question: string,
  segments: TranscriptSegment[],
  context?: AnalysisPromptContext,
): Promise<InterviewQaRunResult> => {
  try {
    const answer = await primaryProvider.answerInterviewQuestion(
      question,
      segments,
      context,
    )

    return {
      answer,
      providerLabel: primaryProvider.label,
    }
  } catch (error) {
    const answer = await fallbackProvider.answerInterviewQuestion(
      question,
      segments,
      context,
    )

    return {
      answer,
      providerLabel: `${primaryProvider.label} -> ${fallbackProvider.label}`,
      warning:
        error instanceof Error
          ? error.message
          : 'Unknown interview QA error, fallback provider was used.',
    }
  }
}
