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

export const getByteDanceAstRuntimeConfig = (): ByteDanceAstRuntimeConfig => {
  const appId = process.env.BYTEDANCE_APP_ID?.trim()
  const accessToken = process.env.BYTEDANCE_ACCESS_TOKEN?.trim()
  const resourceId =
    process.env.BYTEDANCE_RESOURCE_ID?.trim() || DEFAULT_RESOURCE_ID
  const wsUrl = process.env.BYTEDANCE_WS_URL?.trim() || DEFAULT_WS_URL

  if (!appId) {
    throw new Error('缺少 BYTEDANCE_APP_ID，请先在 .env 中配置。')
  }

  if (!accessToken) {
    throw new Error('缺少 BYTEDANCE_ACCESS_TOKEN，请先在 .env 中配置。')
  }

  return {
    appId,
    accessToken,
    resourceId,
    wsUrl,
  }
}
