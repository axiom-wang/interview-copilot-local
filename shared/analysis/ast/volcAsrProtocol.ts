import { gunzipSync, gzipSync } from 'node:zlib'

type AsrUtterance = {
  text?: string
  start_time?: number
  end_time?: number
  definite?: boolean
  additions?: { speaker_id?: string | number }
  speaker_id?: string | number
}

export type AsrResponse = {
  code?: number
  message?: string
  result?: { text?: string; utterances?: AsrUtterance[] }
}

const asrServiceError = (decoded: Buffer, fallbackCode?: number) => {
  const text = decoded.toString('utf8').trim()
  let code = fallbackCode
  let message = text

  try {
    const parsed = JSON.parse(text) as AsrResponse
    if (typeof parsed.code === 'number') code = parsed.code
    if (parsed.message?.trim()) message = parsed.message.trim()
  } catch {
    // Error frames may carry a plain-text reason instead of JSON.
  }

  return new Error(`火山引擎识别失败${code === undefined ? '' : `（${code}）`}: ${message || '请检查凭证、资源和服务权限。'}`)
}

const frame = (type: number, flags: number, serialization: number, data: Buffer) => {
  const header = Buffer.alloc(8)
  header[0] = 0x11
  header[1] = (type << 4) | flags
  header[2] = (serialization << 4) | 1
  header.writeUInt32BE(data.length, 4)
  return Buffer.concat([header, data])
}

export const createStartFrame = () => frame(
  1,
  0,
  1,
  gzipSync(Buffer.from(JSON.stringify({
    user: { uid: 'meeting-assistant' },
    audio: { format: 'pcm', codec: 'raw', rate: 16000, bits: 16, channel: 1 },
    request: {
      model_name: 'bigmodel',
      enable_nonstream: true,
      show_utterances: true,
      enable_speaker_info: true,
      ssd_version: '200',
      enable_ddc: false,
    },
  }))),
)

export const createAudioFrame = (audio: Uint8Array, isLast = false) =>
  frame(2, isLast ? 2 : 0, 0, gzipSync(audio))

export const parseAsrFrame = (raw: Buffer): { response: AsrResponse; isLast: boolean } => {
  if (raw.length < 8 || raw[0] >> 4 !== 1) {
    throw new Error('火山引擎返回了无效的协议帧。')
  }
  const headerSize = (raw[0] & 0x0f) * 4
  const type = raw[1] >> 4
  const flags = raw[1] & 0x0f
  const compression = raw[2] & 0x0f
  const hasSequence = (flags & 1) !== 0 || type === 15
  const sizeOffset = headerSize + (hasSequence ? 4 : 0)
  if (raw.length < sizeOffset + 4) {
    throw new Error('火山引擎返回的协议帧长度不足。')
  }
  const size = raw.readUInt32BE(sizeOffset)
  const payload = raw.subarray(sizeOffset + 4, sizeOffset + 4 + size)
  if (payload.length !== size) {
    throw new Error('火山引擎返回的识别结果不完整。')
  }
  const decoded = compression === 1 ? gunzipSync(payload) : payload
  if (type === 15) {
    const skippedCode = raw.readUInt32BE(headerSize)
    throw asrServiceError(decoded, skippedCode)
  }
  let response: AsrResponse
  try {
    response = JSON.parse(decoded.toString('utf8')) as AsrResponse
  } catch {
    throw new Error('火山引擎返回的识别结果不是有效 JSON。')
  }
  if (typeof response.code === 'number' && response.code !== 0) {
    throw new Error(`火山引擎识别失败（${response.code}）: ${response.message || '请检查凭证、资源和服务权限。'}`)
  }
  if (type !== 9) {
    throw new Error(`火山引擎返回了不支持的消息类型 ${type}。`)
  }
  return { response, isLast: (flags & 2) !== 0 }
}
