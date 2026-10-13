export const answerInterviewQuestionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['conclusion', 'reasoning', 'suggestedReply'],
  properties: {
    conclusion: {
      type: 'string',
      minLength: 1,
    },
    reasoning: {
      type: 'array',
      items: {
        type: 'string',
      },
      minItems: 1,
    },
    suggestedReply: {
      type: 'string',
      minLength: 60,
    },
  },
} as const
