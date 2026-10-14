import type { ParticipantView } from '../types/analysis'

export const normalizeParticipantView = (value: unknown): ParticipantView | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  const view = value as Record<string, unknown>
  if (typeof view.understanding !== 'string' || typeof view.contribution !== 'string' ||
    typeof view.reason !== 'string' || typeof view.intent !== 'string' ||
    !['contribute', 'clarify', 'challenge', 'listen'].includes(view.intent) ||
    !Array.isArray(view.evidenceIds) || !view.evidenceIds.every((id) => typeof id === 'string')) return undefined
  return {
    understanding: view.understanding,
    intent: view.intent as ParticipantView['intent'],
    contribution: view.intent === 'listen' ? '' : view.contribution,
    reason: view.reason,
    evidenceIds: view.evidenceIds,
  }
}
