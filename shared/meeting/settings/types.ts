import type { CodexConfig, DesktopAnalysisConfig } from '../types/desktopAnalysis'

export interface AstModelSettings {
  apiKey: string
  resourceId: string
  wsUrl: string
}

export interface LlmModelSettings {
  provider: 'api' | 'codex'
  autoFallbackEnabled: boolean
  codex: CodexConfig
  apiKey: string
  model: string
  baseURL: string
}

export interface ModelSettings {
  ast: AstModelSettings
  llm: LlmModelSettings
}

export const DEFAULT_AST_SETTINGS: AstModelSettings = {
  apiKey: '',
  resourceId: 'volc.seedasr.sauc.duration',
  wsUrl: 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async',
}

export const DEFAULT_LLM_SETTINGS: LlmModelSettings = {
  provider: 'api',
  autoFallbackEnabled: true,
  codex: { executablePath: '', model: '' },
  apiKey: '',
  model: 'gpt-5.4-mini',
  baseURL: 'https://api.openai.com/v1',
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  ast: DEFAULT_AST_SETTINGS,
  llm: DEFAULT_LLM_SETTINGS,
}

export const isAstConfigured = (settings: AstModelSettings) =>
  Boolean(settings.apiKey.trim() && settings.resourceId.trim() && settings.wsUrl.trim())

export const isLlmConfigured = (
  settings: LlmModelSettings,
  supportsCodex = false,
) => settings.provider === 'codex'
  ? supportsCodex
  : Boolean(settings.apiKey.trim() && settings.model.trim())

export const isModelConfigured = (settings: ModelSettings, supportsCodex = false) =>
  isAstConfigured(settings.ast) && isLlmConfigured(settings.llm, supportsCodex)

export const maskSecret = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.length <= 8) {
    return '••••••••'
  }

  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`
}

export const toDesktopAnalysisConfig = (settings: LlmModelSettings): DesktopAnalysisConfig =>
  settings.provider === 'codex'
    ? { provider: 'codex', ...settings.codex }
    : { provider: 'api', apiKey: settings.apiKey, model: settings.model, baseURL: settings.baseURL }

export const toDesktopFallbackConfig = (settings: LlmModelSettings): DesktopAnalysisConfig | undefined =>
  settings.autoFallbackEnabled
    ? toDesktopAnalysisConfig({ ...settings, provider: settings.provider === 'api' ? 'codex' : 'api' })
    : undefined
