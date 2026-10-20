import type { MeetingScenarioId } from './types'

interface ScenarioAssistance {
  title: string
  dimensions: string[]
  guidance: string
}

export const SCENARIO_ASSISTANCE: Record<MeetingScenarioId, ScenarioAssistance> = {
  general: {
    title: '会议推进重点', dimensions: ['当前议题', '有效决定', '下一步行动'],
    guidance: '优先说明当前议题、仍有效的决定和下一步；区分团队已确认行动与 AI 建议。根据个人职责帮助参与，不默认用户主持会议。',
  },
  'group-interview': {
    title: '我的贡献机会', dimensions: ['可补充观点', '衔接与切入', '团队结论'],
    guidance: '优先寻找未被覆盖但有依据的贡献、衔接队友的切入点和团队结论。不要重复他人观点或鼓励争抢发言；没有新增价值时可以建议倾听。',
  },
  'jd-tet': {
    title: '群面讨论重点', dimensions: ['题目要求', '判断依据', '贡献机会'],
    guidance: '围绕题目要求、判断依据和当前可贡献的内容组织重点，依据实际任务调整分析方式。',
  },
  'one-on-one-interview': {
    title: '回答要点', dimensions: ['问题意图', '岗位要求', '可用经历'],
    guidance: '优先识别面试官问题在考察什么、对应岗位 JD 的哪项要求、可用哪段真实经历回答；不编造经历、公司或数字。',
  },
  'design-review': {
    title: '评审关注点', dimensions: ['证据与验收', '风险与取舍', '通过条件'],
    guidance: '优先识别缺失证据、方案取舍、风险依赖和通过条件；明确已通过、待修改、待验证，不把提出方案当作评审通过。',
  },
  brainstorm: {
    title: '创意探索方向', dimensions: ['创意聚类', '未探索方向', '组合与验证'],
    guidance: '发散阶段保留少数观点，允许没有共识，不将尚未收敛本身列为缺口或催促定案。区分已有创意与 AI 新建议；聚合或筛选阶段再提出组合、评价标准和验证动作。',
  },
  'team-sync': {
    title: '需要协调的事项', dimensions: ['阻塞与变化', '依赖与支持', '责任与时间'],
    guidance: '优先呈现进展变化、阻塞、依赖、所需支持、负责人和时间。未提及的负责人或期限标为待确认；无阻塞时不强行发散或制造争议。',
  },
}

export const resolveScenarioAssistance = (id?: MeetingScenarioId) =>
  SCENARIO_ASSISTANCE[id ?? 'general'] ?? SCENARIO_ASSISTANCE.general
