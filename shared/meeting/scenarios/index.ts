import {
  DEFAULT_SCENARIO_ID,
  SCENARIO_PROFILES,
} from './profiles'
import type { MeetingScenarioId } from './types'

export type { MeetingScenarioId, MeetingScenarioProfile } from './types'
export { DEFAULT_SCENARIO_ID, SCENARIO_PROFILES } from './profiles'

export const resolveScenarioProfile = (id?: string) =>
  SCENARIO_PROFILES[id as MeetingScenarioId] ??
  SCENARIO_PROFILES[DEFAULT_SCENARIO_ID]
