import { ipcMain } from 'electron'
import { isTerminalAstStatus } from '../../../../shared/meeting/providers/ast/AstProvider'
import type { TranscriptSegment } from '../../../../shared/meeting/types/transcript'
import {
  VOLC_ASR_SEGMENT_CHANNEL,
  VOLC_ASR_STATUS_CHANNEL,
  SEND_VOLC_ASR_AUDIO_CHANNEL,
  SMOKE_TEST_VOLC_ASR_CHANNEL,
  START_VOLC_ASR_SESSION_CHANNEL,
  STOP_VOLC_ASR_SESSION_CHANNEL,
} from './channels'
import {
  VolcAsrSession,
  type VolcAsrStatusPayload,
} from '../../../../shared/analysis/ast/volcAsrSession'
import { smokeTestVolcAsrConnection } from '../../../../shared/analysis/ast/volcAsrSmokeTest'

type SmokeTestResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: string
    }

type StartSessionRequest = {
  credentials?: {
    apiKey?: string
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

let activeSession: VolcAsrSession | null = null

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '未知的流式语音识别连接错误。'

export const registerAstIpcHandlers = () => {
  ipcMain.removeHandler(SMOKE_TEST_VOLC_ASR_CHANNEL)
  ipcMain.removeHandler(START_VOLC_ASR_SESSION_CHANNEL)
  ipcMain.removeHandler(STOP_VOLC_ASR_SESSION_CHANNEL)
  ipcMain.removeAllListeners(SEND_VOLC_ASR_AUDIO_CHANNEL)

  ipcMain.handle(
    SMOKE_TEST_VOLC_ASR_CHANNEL,
    async (
      _event,
      request?: {
        apiKey?: string
        resourceId?: string
        wsUrl?: string
      },
    ): Promise<SmokeTestResult> => {
      try {
        await smokeTestVolcAsrConnection(request)
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
    START_VOLC_ASR_SESSION_CHANNEL,
    async (event, request: StartSessionRequest): Promise<StartSessionResult> => {
      await activeSession?.stop()

      const emitSegment = (segment: TranscriptSegment) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(VOLC_ASR_SEGMENT_CHANNEL, segment)
        }
      }

      const emitStatus = (payload: VolcAsrStatusPayload) => {
        if (isTerminalAstStatus(payload) && activeSession === session) {
          const staleSession = activeSession

          if (staleSession) {
            activeSession = null
            void staleSession?.stop()
          }
        }

        if (!event.sender.isDestroyed()) {
          event.sender.send(VOLC_ASR_STATUS_CHANNEL, payload)
        }
      }

      const session = new VolcAsrSession({
        emitSegment,
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
    SEND_VOLC_ASR_AUDIO_CHANNEL,
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

  ipcMain.handle(STOP_VOLC_ASR_SESSION_CHANNEL, async () => {
    await activeSession?.stop()
    activeSession = null
  })
}
