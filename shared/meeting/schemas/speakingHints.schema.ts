import { SPEAKING_FUNCTION_TYPES, SPEAKING_HINT_NOTE_KINDS } from '../types/analysis'

export const speakingHintsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['functionType', 'whyNow', 'script', 'notes'],
  properties: {
    functionType: {
      type: 'string',
      enum: SPEAKING_FUNCTION_TYPES,
    },
    whyNow: {
      type: 'string',
    },
    script: {
      type: 'string',
    },
    notes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'text'],
        properties: {
          kind: { type: 'string', enum: SPEAKING_HINT_NOTE_KINDS },
          text: { type: 'string' },
        },
      },
    },
  },
} as const
