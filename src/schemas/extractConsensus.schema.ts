export const extractConsensusSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['consensus', 'tensions', 'missing'],
  properties: {
    consensus: {
      type: 'array',
      items: { type: 'string' },
    },
    tensions: {
      type: 'array',
      items: { type: 'string' },
    },
    missing: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const
