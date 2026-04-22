import type { SpeakingFunctionType } from '../types/analysis'

const FUNCTION_TYPE_BY_KEYWORD: Array<{
  keywords: string[]
  value: SpeakingFunctionType
}> = [
  { keywords: ['结构', '框架', '顺序'], value: '推进结构' },
  { keywords: ['信息', '补充', '补齐', '缺口', '约束', '风险'], value: '补齐信息' },
  { keywords: ['分歧', '冲突', '争论', '口径'], value: '化解分歧' },
  { keywords: ['收敛', '结论', '定案', '拍板'], value: '收敛结论' },
  { keywords: ['分工', '落地', '执行', '推进'], value: '分工落地' },
  { keywords: ['汇报', '总结', '结尾', '陈述'], value: '汇报总结' },
]

export const normalizeFunctionType = (
  input: string | undefined | null,
): SpeakingFunctionType => {
  const text = (input ?? '').trim()

  if (!text) {
    return '推进结构'
  }

  const exactValues: SpeakingFunctionType[] = [
    '推进结构',
    '补齐信息',
    '化解分歧',
    '收敛结论',
    '分工落地',
    '汇报总结',
  ]

  if (exactValues.includes(text as SpeakingFunctionType)) {
    return text as SpeakingFunctionType
  }

  const normalized = text.toLowerCase()

  for (const item of FUNCTION_TYPE_BY_KEYWORD) {
    if (item.keywords.some((keyword) => normalized.includes(keyword))) {
      return item.value
    }
  }

  return '推进结构'
}

export const coerceString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim()
  return normalized || fallback
}

export const coerceStringArray = (
  value: unknown,
  options: {
    maxItems?: number
  } = {},
) => {
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY

  const fromArray = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : []

  return fromArray
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems)
}

