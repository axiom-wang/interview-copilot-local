import type { IncomingMessage } from 'node:http'
import WebSocket, { type ErrorEvent } from 'ws'
import {
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
      headers: {
        'X-Api-App-Key': config.appId,
        'X-Api-Access-Key': config.accessToken,
        'X-Api-Resource-Id': config.resourceId,
      },
      handshakeTimeout: CONNECTION_TIMEOUT_MS,
    })

    const timeout = setTimeout(() => {
      socket.terminate()
      reject(new Error('字节同传 WebSocket 连接超时。'))
    }, CONNECTION_TIMEOUT_MS)

    const cleanup = () => {
      clearTimeout(timeout)
      socket.removeAllListeners()
    }

    socket.once('open', () => {
      cleanup()
      socket.close()
      resolve()
    })

    socket.once('error', (error: ErrorEvent) => {
      cleanup()
      socket.terminate()
      reject(error)
    })

    socket.once(
      'unexpected-response',
      (_request: IncomingMessage, response: IncomingMessage) => {
        cleanup()
        socket.terminate()

        if (response.statusCode === 403) {
          reject(
            new Error(
              '字节同传握手返回 403 Forbidden。通常表示 AST 2.0 服务未开通、当前 Access Token 未获授权，或 Resource ID 与已开通服务不匹配。',
            ),
          )
          return
        }

        reject(
          new Error(
            `字节同传握手失败：${response.statusCode ?? 'unknown'} ${response.statusMessage ?? ''}`.trim(),
          ),
        )
      },
    )

    socket.once('close', (code: number) => {
      if (code !== 1000) {
        cleanup()
      }
    })
  })
}
