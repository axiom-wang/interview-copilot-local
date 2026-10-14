import type { ConsensusAnalysis } from '../types/analysis'
import type { TranscriptSegment } from '../types/transcript'

const knownIds = (ids: string[], source: Set<string>) => [...new Set(ids.filter((id) => source.has(id)))]

export const groundConsensusEvidence = (analysis: ConsensusAnalysis, segments: TranscriptSegment[]) => {
  const ids = new Set(segments.map((segment) => segment.id))
  return {
    ...analysis,
    participantView: analysis.participantView
      ? { ...analysis.participantView, evidenceIds: knownIds(analysis.participantView.evidenceIds, ids) }
      : undefined,
    scenarioFocus: analysis.scenarioFocus?.map((item) => ({
      ...item,
      evidenceIds: knownIds(item.evidenceIds, ids),
    })),
  }
}
