import { SPEAKING_FUNCTION_TYPES, SPEAKING_HINT_NOTE_KINDS } from '../types/analysis'
import type { SpeakingFunctionType, SpeakingHintNote, SpeakingHints } from '../types/analysis'

const FUNCTION_TYPE_BY_KEYWORD: Array<{
  keywords: string[]
  value: SpeakingFunctionType
}> = [
  { keywords: ['倾听'], value: '倾听观察' },
  { keywords: ['拉回', '偏题', '跑题', '主线'], value: '拉回主线' },
  { keywords: ['追问', '落地细节'], value: '追问落地' },
  { keywords: ['观点', '创意', '新方案'], value: '提出观点' },
  { keywords: ['推理', '计算', '反例', '论证'], value: '检验推理' },
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

  if ((SPEAKING_FUNCTION_TYPES as readonly string[]).includes(text)) {
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

const normalizeHintNotes = (value: unknown): SpeakingHintNote[] =>
  (Array.isArray(value) ? value : []).flatMap((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const kind = coerceString(record.kind) as SpeakingHintNote['kind']
    const text = coerceString(record.text)
    return text && SPEAKING_HINT_NOTE_KINDS.includes(kind) ? [{ kind, text }] : []
  })

export const normalizeSpeakingHints = (
  record: Record<string, unknown>,
  updatedAt: number,
): SpeakingHints => {
  const functionType = normalizeFunctionType(coerceString(record.functionType))
  const isListening = functionType === '倾听观察'

  return {
    functionType,
    whyNow: coerceString(record.whyNow, isListening ? '先听完当前发言。' : ''),
    // Older sessions stored fixed-duration scripts; keep their longest one.
    script: isListening ? '' : [record.script, record.hint120s, record.hint60s, record.hint30s, record.hint15s]
      .map((value) => coerceString(value))
      .find(Boolean) ?? '',
    notes: isListening ? [] : normalizeHintNotes(record.notes),
    updatedAt,
  }
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

