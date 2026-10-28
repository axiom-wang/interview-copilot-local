import { resolveScenarioProfile } from '../../meeting/scenarios'
import { useAppStore } from '../store/useAppStore'

const comparable = (value: string) => value.replace(/\r\n/g, '\n').trim()

/** True when any context draft differs from what analysis currently uses. */
export const useHasPendingContext = () => {
  const questionContextDraft = useAppStore((state) => state.questionContextDraft)
  const roleContextDraft = useAppStore((state) => state.roleContextDraft)
  const referenceContextDraft = useAppStore((state) => state.referenceContextDraft)
  const questionContext = useAppStore((state) => state.questionContext)
  const roleContext = useAppStore((state) => state.roleContext)
  const referenceContext = useAppStore((state) => state.referenceContext)
  const scenarioId = useAppStore((state) => state.scenarioId)
  const profile = resolveScenarioProfile(scenarioId)
  const showRoleContext = profile.roleContextEnabled !== false

  return (
    comparable(questionContextDraft) !== comparable(questionContext) ||
    (showRoleContext && comparable(roleContextDraft) !== comparable(roleContext)) ||
    (Boolean(profile.referenceContextEnabled) &&
      comparable(referenceContextDraft) !== comparable(referenceContext))
  )
}

export const applyPendingContext = () => {
  const state = useAppStore.getState()
  const profile = resolveScenarioProfile(state.scenarioId)
  state.applyQuestionContext()

  if (profile.roleContextEnabled !== false) {
    state.applyRoleContext()
  }

  if (profile.referenceContextEnabled) {
    state.applyReferenceContext()
  }
}
