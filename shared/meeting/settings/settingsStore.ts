import {
  DEFAULT_MODEL_SETTINGS,
  type AstModelSettings,
  type LlmModelSettings,
  type ModelSettings,
} from './types'

const storageKeyForUser = (userId: string) =>
  `meeting-assistant/model-settings/${userId}`

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

const normalizeAst = (value: Partial<AstModelSettings> | undefined): AstModelSettings => ({
  apiKey: asString(value?.apiKey),
  resourceId: value?.resourceId === 'volc.service_type.10053'
    ? DEFAULT_MODEL_SETTINGS.ast.resourceId
    : asString(value?.resourceId, DEFAULT_MODEL_SETTINGS.ast.resourceId),
  wsUrl: value?.wsUrl === 'wss://openspeech.bytedance.com/api/v4/ast/v2/translate'
    ? DEFAULT_MODEL_SETTINGS.ast.wsUrl
    : asString(value?.wsUrl, DEFAULT_MODEL_SETTINGS.ast.wsUrl),
})

const normalizeLlm = (value: Partial<LlmModelSettings> | undefined): LlmModelSettings => ({
  provider: value?.provider === 'codex' || value?.provider === 'claude' ? value.provider : 'api',
  autoFallbackEnabled: typeof value?.autoFallbackEnabled === 'boolean' ? value.autoFallbackEnabled : true,
  codex: {
    executablePath: asString(value?.codex?.executablePath),
    model: asString(value?.codex?.model),
  },
  claude: {
    executablePath: asString(value?.claude?.executablePath),
    model: asString(value?.claude?.model),
  },
  apiKey: asString(value?.apiKey),
  model: asString(value?.model, DEFAULT_MODEL_SETTINGS.llm.model),
  baseURL: asString(value?.baseURL, DEFAULT_MODEL_SETTINGS.llm.baseURL).replace(/\/$/, ''),
})

export const loadModelSettings = (userId: string): ModelSettings => {
  try {
    const raw = localStorage.getItem(storageKeyForUser(userId))
    if (!raw) {
      return structuredClone(DEFAULT_MODEL_SETTINGS)
    }

    const parsed = JSON.parse(raw) as Partial<ModelSettings>
    return {
      ast: normalizeAst(parsed.ast),
      llm: normalizeLlm(parsed.llm),
    }
  } catch {
    return structuredClone(DEFAULT_MODEL_SETTINGS)
  }
}

export const saveModelSettings = (userId: string, settings: ModelSettings) => {
  const normalized: ModelSettings = {
    ast: normalizeAst(settings.ast),
    llm: normalizeLlm(settings.llm),
  }

  localStorage.setItem(storageKeyForUser(userId), JSON.stringify(normalized))
  return normalized
}

export const clearModelSettings = (userId: string) => {
  localStorage.removeItem(storageKeyForUser(userId))
}
