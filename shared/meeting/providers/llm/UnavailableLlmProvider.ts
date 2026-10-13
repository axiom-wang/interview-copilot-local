import type { LlmProvider } from './LlmProvider'

const unavailable = async (): Promise<never> => {
  throw new Error('本地 Codex 通道仅在桌面版可用，请在设置中切换到 API。')
}

export class UnavailableLlmProvider implements LlmProvider {
  readonly id = 'unavailable'
  readonly label = 'Codex（当前环境不可用）'
  detectPhase = unavailable
  extractConsensusAndTensions = unavailable
  generateSpeakingHints = unavailable
  generateMindMap = unavailable
  generateMeetingSummary = unavailable
  generateMeetingMinutes = unavailable
  answerInterviewQuestion = unavailable
}
