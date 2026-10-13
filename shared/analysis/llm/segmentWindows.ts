import type { TranscriptSegment } from '../../meeting/types/transcript'

export const getRecentSegmentsByWindow = (
  segments: TranscriptSegment[],
  windowMs: number,
) => {
  const newestTimestamp = segments.at(-1)?.timestamp

  if (!newestTimestamp) {
    return []
  }

  return segments.filter(
    (segment) => newestTimestamp - segment.timestamp <= windowMs,
  )
}
