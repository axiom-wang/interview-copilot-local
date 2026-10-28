import clsx from 'clsx'
import { resolveScenarioProfile, SCENARIO_PROFILES } from '../../meeting/scenarios'
import { useAppStore } from '../store/useAppStore'

const SCENARIO_OPTIONS = Object.values(SCENARIO_PROFILES)

export function ScenarioPicker({ disabled = false }: { disabled?: boolean }) {
  const scenarioId = useAppStore((state) => state.scenarioId)
  const setScenarioId = useAppStore((state) => state.setScenarioId)
  const profile = resolveScenarioProfile(scenarioId)

  return (
    <fieldset disabled={disabled}>
      <legend className="theme-title text-sm font-semibold">会议场景</legend>
      <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup">
        {SCENARIO_OPTIONS.map((scenario) => {
          const selected = scenario.id === scenarioId

          return (
            <button
              aria-checked={selected}
              className={clsx(
                'rounded-[var(--radius-control)] border px-3 py-1.5 text-sm transition',
                selected
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] font-medium text-[color:var(--accent-text)]'
                  : 'border-[color:var(--panel-border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-inline-hover)]',
              )}
              key={scenario.id}
              onClick={() => setScenarioId(scenario.id)}
              role="radio"
              type="button"
            >
              {scenario.label}
            </button>
          )
        })}
      </div>
      <p className="theme-muted mt-2 text-xs leading-5">
        {profile.preparationNote ?? profile.description}
      </p>
    </fieldset>
  )
}

export function ContextFields({ compact = false }: { compact?: boolean }) {
  const questionContextDraft = useAppStore((state) => state.questionContextDraft)
  const roleContextDraft = useAppStore((state) => state.roleContextDraft)
  const setQuestionContextDraft = useAppStore((state) => state.setQuestionContextDraft)
  const setRoleContextDraft = useAppStore((state) => state.setRoleContextDraft)
  const scenarioId = useAppStore((state) => state.scenarioId)
  const profile = resolveScenarioProfile(scenarioId)
  const showRoleContext = profile.roleContextEnabled !== false

  return (
    <div className={clsx('grid gap-4', !compact && showRoleContext && 'md:grid-cols-[3fr_2fr]')}>
      <label className="block">
        <span className="flex items-baseline justify-between gap-3">
          <span className="theme-title text-sm font-semibold">
            {profile.topicContextLabel}
            {profile.topicContextRequired ? (
              <span className="ml-1 text-[color:var(--danger-text)]">*</span>
            ) : null}
          </span>
          <span className="theme-quiet text-xs tabular-nums">
            {questionContextDraft.trim().length} 字
          </span>
        </span>
        <span className="theme-muted mt-1 block text-xs leading-5">
          {profile.topicHelp ?? '主题、背景、目标与约束，填得越具体建议越贴合。'}
        </span>
        <textarea
          className={clsx(
            'theme-input mt-2 w-full resize-y px-3 py-2.5 text-sm leading-6',
            showRoleContext ? 'h-36' : 'h-52',
          )}
          onChange={(event) => setQuestionContextDraft(event.currentTarget.value)}
          placeholder={profile.topicPlaceholder}
          value={questionContextDraft}
        />
      </label>

      {showRoleContext ? (
        <label className="block">
          <span className="flex items-baseline justify-between gap-3">
            <span className="theme-title text-sm font-semibold">
              {profile.roleContextLabel}
            </span>
            <span className="theme-quiet text-xs tabular-nums">
              {roleContextDraft.trim().length} 字
            </span>
          </span>
          <span className="theme-muted mt-1 block text-xs leading-5">
            你的身份、职责边界和希望的表达风格。
          </span>
          <textarea
            className="theme-input mt-2 h-36 w-full resize-y px-3 py-2.5 text-sm leading-6"
            onChange={(event) => setRoleContextDraft(event.currentTarget.value)}
            placeholder={profile.rolePlaceholder}
            value={roleContextDraft}
          />
        </label>
      ) : null}
    </div>
  )
}
