export type SpeakerNameSource = 'intro' | 'manual'

export interface SpeakerProfile {
  speakerId: string
  displayName?: string
  isMe: boolean
  nameSource: SpeakerNameSource
  confidence?: number
  updatedAt: number
}
