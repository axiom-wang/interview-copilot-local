export interface VolcAsrConfig {
  apiKey: string
  resourceId: string
  wsUrl: string
}

export type VolcAsrConfigOverride = Partial<VolcAsrConfig>

export const DEFAULT_RESOURCE_ID = 'volc.seedasr.sauc.duration'
export const DEFAULT_WS_URL =
  'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async'

export const getVolcAsrConfig = (override?: VolcAsrConfigOverride): VolcAsrConfig => {
  const apiKey = override?.apiKey?.trim() ?? ''
  const resourceId = override?.resourceId?.trim() || DEFAULT_RESOURCE_ID
  const wsUrl = override?.wsUrl?.trim() || DEFAULT_WS_URL

  if (!apiKey) {
    throw new Error('请先在设置中填写火山引擎流式语音识别 2.0 的 API Key。')
  }
  if (!['volc.seedasr.sauc.duration', 'volc.seedasr.sauc.concurrent'].includes(resourceId)) {
    throw new Error('Resource ID 必须是流式语音识别 2.0 的小时版或并发版资源。')
  }
  if (wsUrl !== DEFAULT_WS_URL) {
    throw new Error('WebSocket URL 必须使用支持实时出字和说话人分离的 bigmodel_async 接口。')
  }

  return { apiKey, resourceId, wsUrl }
}

export const getVolcAsrHeaders = (config: VolcAsrConfig) => ({
  'X-Api-Key': config.apiKey,
  'X-Api-Resource-Id': config.resourceId,
  'X-Api-Request-Id': crypto.randomUUID(),
})
