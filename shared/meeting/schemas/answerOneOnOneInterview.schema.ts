export const INTERVIEW_QUESTION_TYPES = [
  'self-intro',
  'behavioral',
  'technical',
  'motivation',
  'case',
  'reverse-qa',
  'other',
] as const

export const INTERVIEW_ANSWER_GROUNDINGS = ['background', 'jd', 'none'] as const

export const answerOneOnOneInterviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questionType', 'questionIntent', 'keyPoints', 'suggestedReply', 'grounding', 'missingContext'],
  properties: {
    questionType: {
      type: 'string',
      enum: INTERVIEW_QUESTION_TYPES,
    },
    questionIntent: {
      type: 'string',
      minLength: 1,
    },
    keyPoints: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    suggestedReply: {
      type: 'string',
    },
    grounding: {
      type: 'string',
      enum: INTERVIEW_ANSWER_GROUNDINGS,
    },
    missingContext: {
      type: 'string',
    },
  },
} as const
