import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_RESOURCE_ID = 'volc.service_type.10053'
const DEFAULT_WS_URL =
  'wss://openspeech.bytedance.com/api/v4/ast/v2/translate'

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

export interface ByteDanceAstRuntimeConfig {
  appId: string
  accessToken: string
  resourceId: string
  wsUrl: string
}

export type ByteDanceAstRuntimeConfigOverride = Partial<ByteDanceAstRuntimeConfig>

export const getByteDanceAstRuntimeConfig = (
  override?: ByteDanceAstRuntimeConfigOverride,
): ByteDanceAstRuntimeConfig => {
  const appId = override?.appId?.trim() || process.env.BYTEDANCE_APP_ID?.trim()
  const accessToken =
    override?.accessToken?.trim() || process.env.BYTEDANCE_ACCESS_TOKEN?.trim()
  const resourceId =
    override?.resourceId?.trim() ||
    process.env.BYTEDANCE_RESOURCE_ID?.trim() ||
    DEFAULT_RESOURCE_ID
  const wsUrl =
    override?.wsUrl?.trim() ||
    process.env.BYTEDANCE_WS_URL?.trim() ||
    DEFAULT_WS_URL

  if (!appId) {
    throw new Error('缺少字节同传 App ID，请先在设置中配置语音转写模型。')
  }

  if (!accessToken) {
    throw new Error('缺少字节同传 Access Token，请先在设置中配置语音转写模型。')
  }

  return {
    appId,
    accessToken,
    resourceId,
    wsUrl,
  }
}
