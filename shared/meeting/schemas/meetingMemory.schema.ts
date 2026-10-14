export const meetingMemorySchema = {
  type: 'object', additionalProperties: false, required: ['events'],
  properties: {
    events: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['topic', 'status', 'detail', 'evidenceIds'],
        properties: {
          topic: { type: 'string' },
          status: { type: 'string', enum: ['discussed', 'proposed', 'confirmed', 'disputed', 'resolved', 'rejected', 'superseded'] },
          detail: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}
