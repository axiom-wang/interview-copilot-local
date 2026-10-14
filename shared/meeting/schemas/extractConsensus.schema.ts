import { participantViewSchema } from './participantView.schema'

export const extractConsensusSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['consensus', 'tensions', 'missing', 'scenarioFocus', 'participantView'],
  properties: {
    participantView: participantViewSchema,
    scenarioFocus: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['label', 'detail', 'evidenceIds'],
        properties: {
          label: { type: 'string' }, detail: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
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
