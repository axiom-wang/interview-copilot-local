export const generateMeetingMinutesSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'overview',
    'topics',
    'decisions',
    'openQuestions',
    'actionItems',
  ],
  properties: {
    title: { type: 'string', minLength: 1 },
    overview: { type: 'string', minLength: 1 },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'points', 'conclusion'],
        properties: {
          topic: { type: 'string', minLength: 1 },
          points: {
            type: 'array',
            items: { type: 'string' },
          },
          conclusion: { type: 'string' },
        },
      },
    },
    decisions: {
      type: 'array',
      items: { type: 'string' },
    },
    openQuestions: {
      type: 'array',
      items: { type: 'string' },
    },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['owner', 'task', 'due'],
        properties: {
          owner: { type: 'string' },
          task: { type: 'string', minLength: 1 },
          due: { type: 'string' },
        },
      },
    },
  },
} as const
