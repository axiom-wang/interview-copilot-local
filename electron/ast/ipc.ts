import { ipcMain } from 'electron'
import type { TranscriptSegment } from '../../src/types/transcript'
import {
  BYTEDANCE_AST_SEGMENT_CHANNEL,
  BYTEDANCE_AST_STATUS_CHANNEL,
  BYTEDANCE_AST_TURN_CHANNEL,
  SEND_BYTEDANCE_AST_AUDIO_CHANNEL,
  SMOKE_TEST_BYTEDANCE_AST_CHANNEL,
  START_BYTEDANCE_AST_SESSION_CHANNEL,
  STOP_BYTEDANCE_AST_SESSION_CHANNEL,
} from './channels'
import {
  ByteDanceAstSession,
  type ByteDanceAstSessionStatusPayload,
} from './bytedanceSession'
import { smokeTestByteDanceAstConnection } from './bytedanceSmokeTest'

type SmokeTestResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: string
    }

type StartSessionRequest = {
  mode?: 's2t' | 's2s'
  sourceLanguage?: string
  targetLanguage?: string
  credentials?: {
    appId?: string
    accessToken?: string
    resourceId?: string
    wsUrl?: string
  }
}

type StartSessionResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: string
    }

let activeSession: ByteDanceAstSession | null = null

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '未知的字节同传连接错误。'

const isTerminalAstStatus = (payload: ByteDanceAstSessionStatusPayload) =>
  payload.level === 'error' ||
  payload.message === 'ByteDance AST session finished.' ||
  payload.message.startsWith('ByteDance AST socket closed unexpectedly') ||
  payload.message.startsWith('ByteDance AST 音频发送已停止')

export const registerAstIpcHandlers = () => {
  ipcMain.removeHandler(SMOKE_TEST_BYTEDANCE_AST_CHANNEL)
  ipcMain.removeHandler(START_BYTEDANCE_AST_SESSION_CHANNEL)
  ipcMain.removeHandler(STOP_BYTEDANCE_AST_SESSION_CHANNEL)
  ipcMain.removeAllListeners(SEND_BYTEDANCE_AST_AUDIO_CHANNEL)

  ipcMain.handle(
    SMOKE_TEST_BYTEDANCE_AST_CHANNEL,
    async (
      _event,
      request?: {
        appId?: string
        accessToken?: string
        resourceId?: string
        wsUrl?: string
      },
    ): Promise<SmokeTestResult> => {
      try {
        await smokeTestByteDanceAstConnection(request)
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error: toErrorMessage(error),
        }
      }
    },
  )

  ipcMain.handle(
    START_BYTEDANCE_AST_SESSION_CHANNEL,
    async (event, request: StartSessionRequest): Promise<StartSessionResult> => {
      await activeSession?.stop()

      const emitSegment = (segment: TranscriptSegment) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(BYTEDANCE_AST_SEGMENT_CHANNEL, segment)
        }
      }

      const emitStatus = (payload: ByteDanceAstSessionStatusPayload) => {
        if (isTerminalAstStatus(payload) && activeSession === session) {
          const staleSession = activeSession

          if (staleSession) {
            activeSession = null
            void staleSession?.stop()
          }
        }

        if (!event.sender.isDestroyed()) {
          event.sender.send(BYTEDANCE_AST_STATUS_CHANNEL, payload)
        }
      }

      const emitTurn = (segment: TranscriptSegment) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(BYTEDANCE_AST_TURN_CHANNEL, segment)
        }
      }

      const session = new ByteDanceAstSession({
        emitSegment,
        emitTurn,
        emitStatus,
      })

      try {
        await session.start(request)
        activeSession = session
        return { ok: true }
      } catch (error) {
        await session.stop()
        activeSession = null
        return {
          ok: false,
          error: toErrorMessage(error),
        }
      }
    },
  )

  ipcMain.on(
    SEND_BYTEDANCE_AST_AUDIO_CHANNEL,
    (_event, chunk: Uint8Array | ArrayBuffer | number[]) => {
      if (!activeSession) {
        return
      }

      const normalizedChunk =
        chunk instanceof ArrayBuffer
          ? new Uint8Array(chunk)
          : Array.isArray(chunk)
            ? Uint8Array.from(chunk)
            : chunk

      try {
        const didAppend = activeSession.appendAudioChunk(normalizedChunk)

        if (!didAppend) {
          const staleSession = activeSession

          if (staleSession) {
            activeSession = null
            void staleSession?.stop()
          }
        }
      } catch {
        const staleSession = activeSession

        if (staleSession) {
          activeSession = null
          void staleSession?.stop()
        }
      }
    },
  )

  ipcMain.handle(STOP_BYTEDANCE_AST_SESSION_CHANNEL, async () => {
    await activeSession?.stop()
    activeSession = null
  })
}
