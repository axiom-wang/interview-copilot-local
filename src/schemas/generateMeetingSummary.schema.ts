export const generateMeetingSummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['speech60s', 'keyPoints', 'nextSteps'],
  properties: {
    speech60s: {
      type: 'string',
      minLength: 1,
    },
    keyPoints: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    nextSteps: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
} as const
