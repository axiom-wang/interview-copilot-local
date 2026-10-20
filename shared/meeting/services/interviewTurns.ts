import type { TranscriptSegment } from '../types/transcript'

const CJK_BOUNDARY = /([\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])\s+(?=[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])/g

// Joins the segments recognized during one push-to-talk capture into a single question.
export const joinQuestionText = (segments: TranscriptSegment[]) =>
  segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(CJK_BOUNDARY, '$1')
