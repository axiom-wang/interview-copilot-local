import assert from 'node:assert/strict'
import test from 'node:test'
import { answerInterviewQuestionOnly, type StructuredResponse } from '../shared/analysis/llm/openaiAnalysisService'
import { buildGlobalSystemPrompt } from '../shared/meeting/prompts/promptUtils'
import { MockLlmProvider } from '../shared/meeting/providers/llm/MockLlmProvider'
import { resolveScenarioProfile } from '../shared/meeting/scenarios'
import { joinQuestionText } from '../shared/meeting/services/interviewTurns'
import type { TranscriptSegment } from '../shared/meeting/types/transcript'

const segment = (id: string, speaker: string, text: string, timestamp: number, isFinal = true): TranscriptSegment => ({
  id, speaker, text, timestamp, isFinal, source: 'ast',
})

test('captured question segments join without spaces between Chinese text', () => {
  assert.equal(
    joinQuestionText([segment('a', 'S1', '说说你最有挑战的项目，', 0), segment('b', 'S1', '你在里面具体负责什么？', 1)]),
    '说说你最有挑战的项目，你在里面具体负责什么？',
  )
  assert.equal(joinQuestionText([segment('x', 'S1', 'Tell me', 0), segment('y', 'S1', 'about Redis.', 1)]), 'Tell me about Redis.')
})

test('qa scenarios use the interview answer schema while discussion scenarios keep the original one', async () => {
  const names: string[] = []
  const prompts: string[] = []
  const responder: StructuredResponse = async (prompt, name, _schema, parser) => {
    names.push(name)
    prompts.push(prompt)
    return parser(name === 'answer_one_on_one_interview'
      ? { questionType: 'behavioral', questionIntent: '考察项目中的个人贡献', keyPoints: ['一', '二', '三', '四'], suggestedReply: '我负责……', grounding: 'jd', missingContext: '' }
      : { conclusion: '待确认', reasoning: ['检查原话'], suggestedReply: '' })
  }
  const input = [segment('q', '面试官', '说说你最有挑战的项目。', 0)]

  const answer = await answerInterviewQuestionOnly('说说你最有挑战的项目。', input, {
    scenarioId: 'one-on-one-interview',
    questionContext: 'JD_MARKER：负责增长实验',
    roleContext: 'RESUME_MARKER：做过推荐系统',
  }, undefined, responder)
  assert.equal(names[0], 'answer_one_on_one_interview')
  assert.equal(answer.conclusion, '考察项目中的个人贡献')
  assert.deepEqual(answer.interview?.keyPoints, ['一', '二', '三'])
  assert.equal(answer.interview?.grounding, 'jd')
  for (const text of ['JD_MARKER', 'RESUME_MARKER', '一对一面试中的 AI 助手', '不编造']) assert.ok(prompts[0].includes(text), text)
  assert.ok(!prompts[0].includes('AI 参会者'))

  const discussion = await answerInterviewQuestionOnly('当前有哪些分歧？', input, { scenarioId: 'general' }, undefined, responder)
  assert.equal(names[1], 'answer_interview_question')
  assert.equal(discussion.interview, undefined)
})

test('invalid enum values from the model fall back to safe defaults', async () => {
  const responder: StructuredResponse = async (_prompt, _name, _schema, parser) =>
    parser({ questionType: 'riddle', questionIntent: '', keyPoints: [], suggestedReply: '', grounding: 'guess', missingContext: '' })
  const answer = await answerInterviewQuestionOnly('你好', [segment('q', 'S1', '你好', 0)], { scenarioId: 'one-on-one-interview' }, undefined, responder)
  assert.equal(answer.interview?.questionType, 'other')
  assert.equal(answer.interview?.grounding, 'none')
})

test('global system prompt follows the interaction model', () => {
  assert.ok(buildGlobalSystemPrompt(resolveScenarioProfile('one-on-one-interview')).includes('一对一面试中的 AI 助手'))
  assert.ok(buildGlobalSystemPrompt(resolveScenarioProfile('general')).includes('AI 参会者'))
})

test('mock provider returns interview detail and flags missing background', async () => {
  const provider = new MockLlmProvider()
  const answer = await provider.answerInterviewQuestion('为什么想来我们公司？', [], {
    scenarioId: 'one-on-one-interview',
    questionContext: '岗位：增长产品经理',
  })
  assert.equal(answer.interview?.grounding, 'jd')
  assert.ok(answer.interview?.missingContext)
})

test('one-on-one interview requires a JD before starting', () => {
  assert.equal(resolveScenarioProfile('one-on-one-interview').topicContextRequired, true)
  assert.ok(!resolveScenarioProfile('general').topicContextRequired)
})
