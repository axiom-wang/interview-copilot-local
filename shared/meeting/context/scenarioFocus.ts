import type { ScenarioFocusItem } from '../types/analysis'

export const normalizeScenarioFocus = (value: unknown): ScenarioFocusItem[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ScenarioFocusItem =>
    typeof item === 'object' && item !== null &&
    typeof item.label === 'string' && typeof item.detail === 'string' &&
    item.label.trim().length > 0 && item.detail.trim().length > 0 &&
    Array.isArray(item.evidenceIds) && item.evidenceIds.every((id: unknown) => typeof id === 'string'),
  ).slice(0, 3).map((item) => ({ label: item.label, detail: item.detail, evidenceIds: item.evidenceIds }))
}
