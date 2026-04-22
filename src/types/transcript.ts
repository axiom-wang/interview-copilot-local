export interface TranscriptSegment {
  id: string
  speaker: string
  text: string
  timestamp: number
  isFinal: boolean
  source: 'mock' | 'ast'
}

export interface TranscriptSeed {
  id: string
  speaker: string
  text: string
  relativeMs: number
  isFinal: boolean
}
