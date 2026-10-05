import type { IncomingMessage } from 'node:http'
import WebSocket, { type ErrorEvent } from 'ws'
import {
  getByteDanceAstAuthHeaders,
  getByteDanceAstRuntimeConfig,
  type ByteDanceAstRuntimeConfigOverride,
} from './bytedanceConfig'

const CONNECTION_TIMEOUT_MS = 5000

export const smokeTestByteDanceAstConnection = async (
  override?: ByteDanceAstRuntimeConfigOverride,
) => {
  const config = getByteDanceAstRuntimeConfig(override)

  return new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(config.wsUrl, {
      headers: getByteDanceAstAuthHeaders(config),
      handshakeTimeout: CONNECTION_TIMEOUT_MS,
    })
    let settled = false

    const stopSocket = () => {
      socket.removeAllListeners()
      socket.on('error', () => {})
      socket.terminate()
    }

    const succeed = () => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      stopSocket()
      resolve()
    }

    const fail = (error: Error) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      stopSocket()
      reject(error)
    }

    const timeout = setTimeout(() => {
      fail(new Error('字节同传 WebSocket 连接超时。'))
    }, CONNECTION_TIMEOUT_MS)

    socket.once('open', () => {
      succeed()
    })

    socket.once('error', (error: ErrorEvent) => {
      fail(error instanceof Error ? error : new Error('字节同传 WebSocket 连接失败。'))
    })

    socket.once(
      'unexpected-response',
      (_request: IncomingMessage, response: IncomingMessage) => {
        if (response.statusCode === 401 || response.statusCode === 403) {
          fail(
            new Error(
              `字节同传握手返回 ${response.statusCode}。通常表示 API Key 无效、AST 2.0 服务未开通，或 Resource ID 与已开通服务不匹配。`,
            ),
          )
          return
        }

        fail(
          new Error(
            `字节同传握手失败：${response.statusCode ?? 'unknown'} ${response.statusMessage ?? ''}`.trim(),
          ),
        )
      },
    )
  })
}
