import { createServer, type ServerResponse } from 'node:http'
import { URL } from 'node:url'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import { VOLC_ASR_SESSION_FINISHED_MESSAGE } from '../../../shared/meeting/providers/ast/AstProvider'
import type { TranscriptSegment } from '../../../shared/meeting/types/transcript'
import {
  VolcAsrSession,
  type VolcAsrStatusPayload,
} from '../../../shared/analysis/ast/volcAsrSession'

type StartMessage = {
  type: 'start'
  credentials?: {
    apiKey?: string
    resourceId?: string
    wsUrl?: string
  }
}

type StopMessage = {
  type: 'stop'
}

type ClientMessage = StartMessage | StopMessage

type ManagedWebSocket = WebSocket & {
  isAlive?: boolean
}

const port = Number(process.env.PORT ?? 8787)
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const isAllowedOrigin = (origin: string | undefined) => {
  if (allowedOrigins.length === 0) {
    return true
  }

  return Boolean(origin && allowedOrigins.includes(origin))
}

const sendJson = (socket: WebSocket, payload: unknown) => {
  if (socket.readyState !== WebSocket.OPEN) {
    return
  }

  socket.send(JSON.stringify(payload))
}

const normalizeAudioChunk = (data: RawData) => {
  if (data instanceof Buffer) {
    return new Uint8Array(data)
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }

  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data))
  }

  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

const parseClientMessage = (data: RawData): ClientMessage | null => {
  const text = data.toString('utf8')

  try {
    const value = JSON.parse(text) as Partial<ClientMessage>

    if (value.type === 'start' || value.type === 'stop') {
      return value as ClientMessage
    }
  } catch {
    return null
  }

  return null
}

const writeJsonResponse = (
  response: ServerResponse,
  status: number,
  body: unknown,
) => {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

const server = createServer((request, response) => {
  if (request.url === '/health' && request.method === 'GET') {
    writeJsonResponse(response, 200, {
      ok: true,
      service: 'interview-copilot-realtime',
    })
    return
  }

  writeJsonResponse(response, 404, { ok: false, error: 'Not found.' })
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost')

  if (requestUrl.pathname !== '/ws/ast') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
    socket.destroy()
    return
  }

  if (!isAllowedOrigin(request.headers.origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(request, socket, head, (webSocket) => {
    wss.emit('connection', webSocket, request)
  })
})

const attachAstSession = (socket: ManagedWebSocket) => {
  let activeSession: VolcAsrSession | null = null

  const emitSegment = (segment: TranscriptSegment) => {
    sendJson(socket, { type: 'segment', segment })
  }

  const emitStatus = (payload: VolcAsrStatusPayload) => {
    sendJson(socket, { type: 'status', payload })
  }

  const stopSession = async () => {
    const staleSession = activeSession
    activeSession = null
    await staleSession?.stop()
  }

  const startSession = async (message: StartMessage) => {
    await stopSession()

    const session = new VolcAsrSession({
      emitSegment,
      emitStatus,
    })

    try {
      await session.start({
        credentials: message.credentials,
      })
      activeSession = session
      emitStatus({ level: 'info', message: 'Volc ASR session started.' })
    } catch (error) {
      await session.stop()
      sendJson(socket, {
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Remote Volc ASR session failed to start.',
      })
    }
  }

  socket.isAlive = true
  socket.on('pong', () => {
    socket.isAlive = true
  })

  const heartbeatTimer = setInterval(() => {
    if (socket.isAlive === false) {
      socket.terminate()
      return
    }

    socket.isAlive = false
    socket.ping()
  }, 30_000)

  socket.on('message', (data, isBinary) => {
    if (isBinary) {
      if (!activeSession) {
        return
      }

      const didAppend = activeSession.appendAudioChunk(normalizeAudioChunk(data))

      if (!didAppend) {
        void stopSession()
      }
      return
    }

    const message = parseClientMessage(data)

    if (!message) {
      sendJson(socket, {
        type: 'error',
        message: 'Invalid realtime control message.',
      })
      return
    }

    if (message.type === 'stop') {
      void stopSession().then(() => {
        sendJson(socket, { type: 'status', payload: { level: 'info', message: VOLC_ASR_SESSION_FINISHED_MESSAGE } })
      })
      return
    }

    void startSession(message)
  })

  socket.on('close', () => {
    clearInterval(heartbeatTimer)
    void stopSession()
  })

  socket.on('error', () => {
    clearInterval(heartbeatTimer)
    void stopSession()
  })
}

wss.on('connection', (socket: WebSocket) => {
  attachAstSession(socket as ManagedWebSocket)
})

server.listen(port, () => {
  console.log(`Realtime AST server listening on :${port}`)
})
