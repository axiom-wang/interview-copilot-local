import WebSocket from 'ws'
import { getVolcAsrConfig, getVolcAsrHeaders, type VolcAsrConfigOverride } from './volcAsrConfig'
import { createAudioFrame, createStartFrame, parseAsrFrame } from './volcAsrProtocol'

export const smokeTestVolcAsrConnection = async (override?: VolcAsrConfigOverride) => {
  const config = getVolcAsrConfig(override)
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(config.wsUrl, {
      headers: getVolcAsrHeaders(config),
      handshakeTimeout: 8_000,
    })
    let settled = false
    const timeout = setTimeout(() => fail(new Error('连接测试超时：服务端没有确认识别请求。')), 8_000)
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket.removeAllListeners()
      socket.on('error', () => {})
      socket.terminate()
      if (error) reject(error)
      else resolve()
    }
    const fail = (error: Error) => finish(error)
    socket.once('open', () => {
      try {
        socket.send(createStartFrame())
        socket.send(createAudioFrame(new Uint8Array(3200), true))
      } catch (error) {
        fail(error instanceof Error ? error : new Error('无法发送识别测试请求。'))
      }
    })
    socket.on('message', (data) => {
      try {
        parseAsrFrame(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer))
        finish()
      } catch (error) {
        fail(error instanceof Error ? error : new Error('识别测试响应无效。'))
      }
    })
    socket.once('unexpected-response', (_request, response) => {
      fail(new Error(`握手失败（HTTP ${response.statusCode ?? '未知'}）：请检查 API Key、Resource ID 是否匹配已开通的流式语音识别 2.0 服务。`))
    })
    socket.once('error', (error) => fail(new Error(`连接失败：${error.message}`)))
    socket.once('close', (code) => fail(new Error(`服务端在确认识别请求前关闭连接（${code}）。`)))
  })
}
