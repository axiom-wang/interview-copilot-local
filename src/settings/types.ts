export interface AstModelSettings {
  appId: string
  accessToken: string
  resourceId: string
  wsUrl: string
}

export interface LlmModelSettings {
  apiKey: string
  model: string
  baseURL: string
}

export interface ModelSettings {
  ast: AstModelSettings
  llm: LlmModelSettings
}

export const DEFAULT_AST_SETTINGS: AstModelSettings = {
  appId: '',
  accessToken: '',
  resourceId: 'volc.service_type.10053',
  wsUrl: 'wss://openspeech.bytedance.com/api/v4/ast/v2/translate',
}

export const DEFAULT_LLM_SETTINGS: LlmModelSettings = {
  apiKey: '',
  model: 'gpt-5.4-mini',
  baseURL: 'https://api.openai.com/v1',
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  ast: DEFAULT_AST_SETTINGS,
  llm: DEFAULT_LLM_SETTINGS,
}

export const isAstConfigured = (settings: AstModelSettings) =>
  Boolean(settings.appId.trim() && settings.accessToken.trim())

export const isLlmConfigured = (settings: LlmModelSettings) =>
  Boolean(settings.apiKey.trim() && settings.model.trim())

export const isModelConfigured = (settings: ModelSettings) =>
  isAstConfigured(settings.ast) && isLlmConfigured(settings.llm)

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
