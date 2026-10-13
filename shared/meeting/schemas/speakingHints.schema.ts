export const speakingHintsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['functionType', 'whyNow', 'hint15s', 'hint30s', 'hint60s'],
  properties: {
    functionType: {
      type: 'string',
      minLength: 1,
    },
    whyNow: {
      type: 'string',
    },
    hint15s: {
      type: 'string',
      minLength: 1,
    },
    hint30s: {
      type: 'string',
    },
    hint60s: {
      type: 'string',
    },
  },
} as const
