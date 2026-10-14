export type MemoryEventStatus = 'discussed' | 'proposed' | 'confirmed' | 'disputed' | 'resolved' | 'rejected' | 'superseded'

export interface MeetingMemoryEvent {
  topic: string
  status: MemoryEventStatus
  detail: string
  evidenceIds: string[]
}

export interface MeetingMemoryChunk {
  sourceIds: string[]
  sourceDigest: string
  startedAt: number
  endedAt: number
  events: MeetingMemoryEvent[]
}

export interface MeetingMemory {
  version: 1
  chunks: MeetingMemoryChunk[]
}
