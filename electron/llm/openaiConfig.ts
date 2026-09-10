import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

const loadEnvFromFile = () => {
  const envPath = resolve(process.cwd(), '.env')

  if (!existsSync(envPath)) {
    return
  }

  const content = readFileSync(envPath, 'utf8')

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')

    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFromFile()

export interface OpenAiRuntimeConfig {
  apiKey: string
  model: string
  baseURL: string
}

export type OpenAiRuntimeConfigOverride = Partial<OpenAiRuntimeConfig>

const readRuntimeEnv = (key: string) => {
  const netlifyEnv = (
    globalThis as typeof globalThis & {
      Netlify?: { env?: { get?: (name: string) => string | undefined } }
    }
  ).Netlify?.env?.get?.(key)

  return netlifyEnv?.trim() || process.env[key]?.trim()
}

export const getOpenAiRuntimeConfig = (
  override?: OpenAiRuntimeConfigOverride,
): OpenAiRuntimeConfig => {
  const apiKey = override?.apiKey?.trim() || readRuntimeEnv('OPENAI_API_KEY')
  const model =
    override?.model?.trim() || readRuntimeEnv('OPENAI_MODEL') || 'gpt-5.4-mini'
  const baseURL =
    override?.baseURL?.trim().replace(/\/$/, '') ||
    readRuntimeEnv('OPENAI_BASE_URL')?.replace(/\/$/, '') ||
    DEFAULT_OPENAI_BASE_URL

  if (!apiKey) {
    throw new Error('缺少 OpenAI API Key，请先在设置中配置文本分析模型。')
  }

  return {
    apiKey,
    model,
    baseURL,
  }
}
