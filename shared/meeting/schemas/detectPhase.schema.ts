export const detectPhaseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['phase', 'confidence', 'nextAction', 'nextBestAction', 'reason'],
  properties: {
    phase: {
      type: 'string',
      enum: [
        'problem-framing',
        'option-divergence',
        'alignment-building',
        'decision-lock',
      ],
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    nextAction: {
      type: 'string',
    },
    nextBestAction: {
      type: 'string',
    },
    reason: {
      type: 'string',
    },
  },
} as const
