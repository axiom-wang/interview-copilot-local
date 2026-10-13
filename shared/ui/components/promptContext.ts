import { resolveScenarioProfile } from '../../meeting/scenarios'
import { useAppStore } from '../store/useAppStore'

const comparable = (value: string) => value.replace(/\r\n/g, '\n').trim()

/** True when either context draft differs from what analysis currently uses. */
export const useHasPendingContext = () => {
  const questionContextDraft = useAppStore((state) => state.questionContextDraft)
  const roleContextDraft = useAppStore((state) => state.roleContextDraft)
  const questionContext = useAppStore((state) => state.questionContext)
  const roleContext = useAppStore((state) => state.roleContext)
  const scenarioId = useAppStore((state) => state.scenarioId)
  const showRoleContext = resolveScenarioProfile(scenarioId).roleContextEnabled !== false

  return (
    comparable(questionContextDraft) !== comparable(questionContext) ||
    (showRoleContext && comparable(roleContextDraft) !== comparable(roleContext))
  )
}

export const applyPendingContext = () => {
  const state = useAppStore.getState()
  state.applyQuestionContext()

  if (resolveScenarioProfile(state.scenarioId).roleContextEnabled !== false) {
    state.applyRoleContext()
  }
}
