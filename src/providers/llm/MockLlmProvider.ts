import mockAnalysis from '../../sample/mockAnalysis.json'
import { normalizeFunctionType } from '../../services/analysisNormalization'
import { legacyMindMapToFlowMap } from '../../services/mindMapTransform'
import type {
  ConsensusAnalysis,
  InterviewQaAnswer,
  MeetingSummary,
  MockAnalysisScenario,
  PhaseAnalysis,
  SpeakingHints,
} from '../../types/analysis'
import type { MindMapSnapshot } from '../../types/mindmap'
import type { AnalysisPromptContext } from '../../types/promptContext'
import type { TranscriptSegment } from '../../types/transcript'
import type { LlmProvider } from './LlmProvider'

const scenarios = mockAnalysis.snapshots as MockAnalysisScenario[]

const pickScenario = (segments: TranscriptSegment[]) => {
  const fallback = scenarios[0]

  return scenarios.reduce<MockAnalysisScenario>((current, scenario) => {
    if (segments.length >= scenario.minSegments) {
      return scenario
    }

    return current
  }, fallback)
}

export class MockLlmProvider implements LlmProvider {
  readonly id = 'mock-llm'
  readonly label = '模拟分析'

  async detectPhase(
    segments: TranscriptSegment[],
    _context?: AnalysisPromptContext,
  ): Promise<PhaseAnalysis> {
    void _context
    const scenario = pickScenario(segments)
    const updatedAt = segments.at(-1)?.timestamp ?? Date.now()
    const nextAction =
      scenario.phase.nextAction?.trim() ||
      scenario.phase.nextBestAction?.trim() ||
      '继续推进当前讨论主线'

    return {
      phase: scenario.phase.phase,
      confidence: Math.max(0, Math.min(1, scenario.phase.confidence)),
      nextAction,
      nextBestAction: scenario.phase.nextBestAction?.trim() || undefined,
      reason: scenario.phase.reason?.trim() || '根据当前讨论上下文给出的阶段判断。',
      updatedAt,
    }
  }

  async extractConsensusAndTensions(
    segments: TranscriptSegment[],
    _context?: AnalysisPromptContext,
  ): Promise<ConsensusAnalysis> {
    void _context
    const scenario = pickScenario(segments)
    const updatedAt = segments.at(-1)?.timestamp ?? Date.now()

    return {
      consensus: scenario.consensus.consensus.slice(0, 4),
      tensions: scenario.consensus.tensions.slice(0, 4),
      missing: scenario.consensus.missing.slice(0, 4),
      updatedAt,
    }
  }

  async generateSpeakingHints(
    segments: TranscriptSegment[],
    _context?: AnalysisPromptContext,
  ): Promise<SpeakingHints> {
    void _context
    const scenario = pickScenario(segments)
    const updatedAt = segments.at(-1)?.timestamp ?? Date.now()
    const hint15s =
      scenario.hints.hint15s?.trim() || '我先帮大家把讨论结构收一下。'

    return {
      functionType: normalizeFunctionType(scenario.hints.functionType),
      whyNow:
        scenario.hints.whyNow?.trim() || '当前最需要的是先把讨论推进到下一步。',
      hint15s,
      hint30s: scenario.hints.hint30s?.trim() || hint15s,
      hint60s: scenario.hints.hint60s?.trim() || hint15s,
      updatedAt,
    }
  }

  async generateMindMap(
    segments: TranscriptSegment[],
    _context?: AnalysisPromptContext,
  ): Promise<MindMapSnapshot> {
    void _context
    const scenario = pickScenario(segments)
    const capturedAt = segments.at(-1)?.timestamp ?? Date.now()
    const converted = legacyMindMapToFlowMap({
      topic: scenario.mindMap.topic,
      nodes: scenario.mindMap.nodes,
      capturedAt,
    })

    return {
      id: `mindmap-${capturedAt}`,
      topic: converted.topic,
      nodes: converted.nodes,
      edges: converted.edges,
      capturedAt,
    }
  }

  async generateMeetingSummary(
    segments: TranscriptSegment[],
    _context?: AnalysisPromptContext,
  ): Promise<MeetingSummary> {
    void _context
    const updatedAt = segments.at(-1)?.timestamp ?? Date.now()
    const candidateLines = segments
      .filter((segment) => segment.text.trim().length > 0)
      .map((segment) => segment.text.replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    const uniqueLines: string[] = []
    for (const line of candidateLines) {
      if (!uniqueLines.includes(line)) {
        uniqueLines.push(line)
      }
      if (uniqueLines.length >= 8) {
        break
      }
    }

    const keyPoints =
      uniqueLines.slice(0, 4).map((line, index) => `要点${index + 1}：${line}`) || []

    return {
      speech60s:
        '我们刚刚围绕题目完成了观点梳理、分歧对齐和结论收敛。我的总结是：先明确核心结论，再用关键依据支撑，最后给出可执行的下一步分工与时间点。',
      keyPoints:
        keyPoints.length > 0
          ? keyPoints
          : [
              '先统一目标与评价标准',
              '对分歧点做结构化对齐',
              '形成可执行结论与行动项',
            ],
      nextSteps: ['确认最终口径', '分配汇报角色', '补齐风险与预案'],
      updatedAt,
    }
  }

  async answerInterviewQuestion(
    question: string,
    segments: TranscriptSegment[],
    context?: AnalysisPromptContext,
  ): Promise<InterviewQaAnswer> {
    const updatedAt = segments.at(-1)?.timestamp ?? Date.now()
    const normalizedQuestion = question.trim() || '当前应该怎么回答'
    const latestLines = segments
      .filter((segment) => segment.text.trim().length > 0)
      .slice(-3)
      .map((segment) => segment.text.replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    const reasoning = [
      context?.questionContext?.trim()
        ? '已结合当前题目信息来判断回答方向。'
        : '当前没有额外题目信息，因此优先依据讨论主线作答。',
      context?.phaseContext?.trim()
        ? `当前讨论阶段是 ${context.phaseContext.trim()}，回答需要贴合这个推进节奏。`
        : '当前阶段信息有限，建议采用更稳妥的推进式表达。',
      latestLines[0]
        ? `最近讨论重点提到了：${latestLines[0]}`
        : '当前转写证据有限，因此建议先说结论再补依据。',
    ]

    return {
      conclusion: `针对“${normalizedQuestion}”，当前更稳妥的做法是顺着团队主线给出克制判断，并主动帮助团队往下一步推进。`,
      reasoning,
      suggestedReply:
        '我理解我们现在更重要的是先把题目目标和当前已经形成的共识讲清楚，而不是急着补很多新点。基于刚才的讨论，我会先给出一个更稳妥的判断，再补一句为什么我们这样取舍，这样会更像在帮助团队收敛。然后如果大家认可，我们可以顺势把下一步要确认的结论或者分工一起推进掉。',
      updatedAt,
    }
  }
}
