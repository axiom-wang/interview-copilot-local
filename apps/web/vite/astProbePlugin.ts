import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const readBody = (request: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []

    request.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

export const astProbeDevPlugin = (): Plugin => ({
  name: 'ast-probe-dev',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = request.url?.split('?')[0]

      if (pathname !== '/api/ast/probe') {
        next()
        return
      }

      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'Method not allowed.' })
        return
      }

      void (async () => {
        try {
          const raw = await readBody(request)
          const body = (
            raw
              ? JSON.parse(raw)
              : {}
          ) as {
            apiKey?: string
            resourceId?: string
            wsUrl?: string
          }
          const module = (await server.ssrLoadModule(
            fileURLToPath(new URL('../../../shared/analysis/ast/volcAsrSmokeTest.ts', import.meta.url)),
          )) as {
            smokeTestVolcAsrConnection: (override?: {
              apiKey?: string
              resourceId?: string
              wsUrl?: string
            }) => Promise<void>
          }

          await module.smokeTestVolcAsrConnection({
            apiKey: body.apiKey,
            resourceId: body.resourceId,
            wsUrl: body.wsUrl,
          })
          sendJson(response, 200, { ok: true })
        } catch (error) {
          sendJson(response, 400, {
            ok: false,
            error:
              error instanceof Error ? error.message : '语音转写连接测试失败。',
          })
        }
      })()
    })
  },
})
