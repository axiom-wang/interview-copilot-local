import { MeetingContextCapacityError } from '../../meeting/context/meetingMemory'
import type { MeetingMemory } from '../../meeting/types/meetingMemory'

export type AnalysisErrorResult = {
  ok: false
  error: string
  code?: 'meeting-context-capacity'
  meetingMemory?: MeetingMemory
}

export const toAnalysisFailure = (error: unknown, fallback: string): AnalysisErrorResult => {
  if (error instanceof MeetingContextCapacityError) {
    return {
      ok: false,
      error: error.message,
      code: error.code,
      meetingMemory: error.meetingMemory,
    }
  }
  return { ok: false, error: error instanceof Error ? error.message : fallback }
}
