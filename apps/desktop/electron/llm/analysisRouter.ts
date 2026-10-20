import { isMeetingContextCapacityError } from '../../../../shared/meeting/context/meetingMemory'
import type { AnalysisErrorResult } from '../../../../shared/analysis/llm/analysisFailure'
import { toAnalysisFailure } from '../../../../shared/analysis/llm/analysisFailure'
import type { AnalysisRoutingMetadata, AnalysisSessionReset, DesktopAnalysisConfig, DesktopTranscriptRequest } from '../../../../shared/meeting/types/desktopAnalysis'

type Provider = DesktopAnalysisConfig['provider']
const PROVIDER_LABELS: Record<Provider, string> = { api: 'API', codex: 'Codex', claude: 'Claude' }
const label = (provider: Provider) => PROVIDER_LABELS[provider]

export const redactAnalysisError = (error: unknown, configs: Array<DesktopAnalysisConfig | undefined>) => {
  let message = error instanceof Error ? error.message : '分析渠道调用失败。'
  for (const config of configs) {
    if (config?.provider === 'api' && typeof config.apiKey === 'string' && config.apiKey.trim()) {
      for (const secret of [config.apiKey, config.apiKey.trim()]) message = message.split(secret).join('[已隐藏密钥]')
    }
  }
  return message.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [已隐藏密钥]').replace(/\bsk-[\w-]{12,}/g, '[已隐藏密钥]')
}

class RoutingError extends Error {
  readonly result: AnalysisErrorResult
  constructor(result: AnalysisErrorResult) {
    super(result.error)
    this.result = result
  }
}

export const toDesktopAnalysisFailure = (error: unknown, request: DesktopTranscriptRequest): AnalysisErrorResult => {
  if (error instanceof RoutingError) return error.result
  const result = toAnalysisFailure(error, '分析失败。')
  return { ...result, error: redactAnalysisError(new Error(result.error), [request?.analysisConfig, request?.fallbackAnalysisConfig]) }
}

// Serialize desktop tasks so every operation observes a committed channel switch.
export class AnalysisRouter {
  private epoch = 0
  private sessionId: string | undefined
  private queue: Promise<unknown> = Promise.resolve()
  private configKey: string | undefined
  private activeProvider: Provider | undefined
  private fallbackReason: string | undefined
  private channelFailures: AnalysisRoutingMetadata['channelFailures']

  reset(options?: AnalysisSessionReset) {
    this.epoch += 1
    this.sessionId = options?.analysisSessionId
    this.queue = Promise.resolve()
    if (!options?.preserveRouting) {
      this.configKey = undefined
      this.activeProvider = undefined
      this.fallbackReason = undefined
      this.channelFailures = undefined
    }
  }

  run<T>(request: DesktopTranscriptRequest, invoke: (config?: DesktopAnalysisConfig) => Promise<T>): Promise<{ value: T; routing: AnalysisRoutingMetadata }> {
    const epoch = this.epoch
    const checkCurrent = () => {
      if (epoch !== this.epoch || (this.sessionId !== undefined && request.analysisSessionId !== this.sessionId)) {
        throw new RoutingError({ ok: false, code: 'analysis-cancelled', error: '分析会话已重置，已忽略旧请求。' })
      }
    }
    const work = async () => {
      checkCurrent()
      this.sessionId ??= request.analysisSessionId
      const primary = request.analysisConfig
      const backup = request.fallbackAnalysisConfig
      const key = JSON.stringify([primary, backup])
      if (this.configKey !== undefined && this.configKey !== key) {
        throw new RoutingError({ ok: false, code: 'analysis-cancelled', error: '分析配置已改变，请重新开始分析。' })
      }
      this.configKey = key
      const selected = backup && this.activeProvider === backup.provider ? backup : primary
      const configs = [primary, backup]
      const metadata = (): AnalysisRoutingMetadata => ({
        actualProvider: this.activeProvider ?? primary?.provider ?? 'api',
        fallbackReason: this.fallbackReason,
        channelFailures: this.channelFailures,
      })
      const call = async (config?: DesktopAnalysisConfig) => {
        try {
          const value = await invoke(config)
          checkCurrent()
          return value
        } catch (error) {
          checkCurrent()
          throw error
        }
      }
      try {
        const value = await call(selected)
        return { value, routing: metadata() }
      } catch (error) {
        if (error instanceof RoutingError || isMeetingContextCapacityError(error) || (error instanceof Error && error.name === 'AbortError')) throw error
        const firstError = redactAnalysisError(error, configs)
        const provider = selected?.provider ?? 'api'
        const failures = { ...this.channelFailures, [provider]: firstError }
        const fail = (message: string): never => {
          throw new RoutingError({ ok: false, code: 'analysis-channel-failure', ...metadata(), channelFailures: failures, error: message })
        }
        if (!backup || this.activeProvider === backup.provider) return fail(`${label(provider)} 分析失败：${firstError}`)
        if (backup.provider === 'api' && (!backup.apiKey.trim() || !backup.model.trim())) {
          failures.api = '备用 API 未配置，请填写 API Key 和模型。'
          return fail(`${label(provider)} 分析失败：${firstError}；${failures.api}`)
        }
        try {
          const value = await call(backup)
          this.activeProvider = backup.provider
          this.channelFailures = failures
          this.fallbackReason = `已从 ${label(provider)} 切换至 ${label(backup.provider)}，本场会议继续使用 ${label(backup.provider)}。原因：${firstError}`
          return { value, routing: metadata() }
        } catch (backupError) {
          if (backupError instanceof RoutingError || isMeetingContextCapacityError(backupError) || (backupError instanceof Error && backupError.name === 'AbortError')) throw backupError
          failures[backup.provider] = redactAnalysisError(backupError, configs)
          return fail(`两种分析渠道均失败：${label(provider)}：${firstError}；${label(backup.provider)}：${failures[backup.provider]}`)
        }
      }
    }
    const result = this.queue.then(work)
    this.queue = result.catch(() => {})
    return result
  }
}
