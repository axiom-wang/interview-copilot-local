export const participantViewSchema = {
  type: 'object', additionalProperties: false,
  required: ['understanding', 'intent', 'contribution', 'reason', 'evidenceIds'],
  properties: {
    understanding: { type: 'string' },
    intent: { type: 'string', enum: ['contribute', 'clarify', 'challenge', 'listen'] },
    contribution: { type: 'string' },
    reason: { type: 'string' },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
} as const
