import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Plugin, ViteDevServer } from 'vite'

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

const readHeader = (request: IncomingMessage, name: string) => {
  const value = request.headers[name]
  const text = Array.isArray(value) ? value[0] : value
  return text?.trim() || undefined
}

const analysisPath = /^\/api\/analysis\/([^/]+)$/

export const analysisDevPlugin = (): Plugin => ({
  name: 'analysis-dev',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = request.url?.split('?')[0] ?? ''
      const match = pathname.match(analysisPath)

      if (!match) {
        next()
        return
      }

      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'Method not allowed.' })
        return
      }

      void handleAnalysis(server, request, response, match[1])
    })
  },
})

const handleAnalysis = async (
  server: ViteDevServer,
  request: IncomingMessage,
  response: ServerResponse,
  action: string,
) => {
  try {
    const raw = await readBody(request)
    let body: unknown = {}

    if (raw.trim()) {
      try {
        body = JSON.parse(raw) as unknown
      } catch {
        sendJson(response, 400, {
          ok: false,
          error: 'Request body must be valid JSON.',
        })
        return
      }
    }

    const module = (await server.ssrLoadModule(
      fileURLToPath(new URL('../../../shared/analysis/llm/analysisRequest.ts', import.meta.url)),
    )) as {
      handleAnalysisRequest: (input: {
        action: string
        body: unknown
        configOverride: {
          apiKey?: string
          model?: string
          baseURL?: string
        }
      }) => Promise<{ status: number; body: unknown }>
    }

    const result = await module.handleAnalysisRequest({
      action,
      body,
      configOverride: {
        apiKey: readHeader(request, 'x-model-api-key'),
        model: readHeader(request, 'x-model-name'),
        baseURL: readHeader(request, 'x-model-base-url'),
      },
    })

    sendJson(response, result.status, result.body)
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown analysis error.',
    })
  }
}
