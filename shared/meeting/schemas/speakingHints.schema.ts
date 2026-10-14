export const speakingHintsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['functionType', 'whyNow', 'hint60s', 'hint120s'],
  properties: {
    functionType: {
      type: 'string',
      minLength: 1,
    },
    whyNow: {
      type: 'string',
    },
    hint120s: {
      type: 'string',
    },
    hint60s: {
      type: 'string',
    },
  },
} as const
