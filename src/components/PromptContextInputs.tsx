import { resolveScenarioProfile, SCENARIO_PROFILES } from '../scenarios'
import { useAppStore } from '../store/useAppStore'

interface PromptContextInputsProps {
  questionContextDraft: string
  roleContextDraft: string
  appliedQuestionContext: string
  appliedRoleContext: string
  collapsed: boolean
  onQuestionContextDraftChange: (value: string) => void
  onRoleContextDraftChange: (value: string) => void
  onApplyQuestionContext: () => void
  onApplyRoleContext: () => void
  onClearQuestionContext: () => void
  onClearRoleContext: () => void
  onToggleCollapsed: () => void
}

const contextCardClassName =
  'theme-inline-card-strong rounded-[var(--radius-card)] p-4'

const getComparableContextValue = (value: string) =>
  value.replace(/\r\n/g, '\n').trim()

const summarizeContext = (value: string) => {
  const normalized = getComparableContextValue(value)

  if (!normalized) {
    return '未设置'
  }

  return normalized.length > 40 ? `${normalized.slice(0, 40)}…` : normalized
}

export function PromptContextInputs({
  questionContextDraft,
  roleContextDraft,
  appliedQuestionContext,
  appliedRoleContext,
  collapsed,
  onQuestionContextDraftChange,
  onRoleContextDraftChange,
  onApplyQuestionContext,
  onApplyRoleContext,
  onClearQuestionContext,
  onClearRoleContext,
  onToggleCollapsed,
}: PromptContextInputsProps) {
  const scenarioId = useAppStore((state) => state.scenarioId)
  const setScenarioId = useAppStore((state) => state.setScenarioId)
  const profile = resolveScenarioProfile(scenarioId)
  const isQuestionApplyDisabled =
    !getComparableContextValue(questionContextDraft) ||
    getComparableContextValue(questionContextDraft) ===
      getComparableContextValue(appliedQuestionContext)
  const isRoleApplyDisabled =
    !getComparableContextValue(roleContextDraft) ||
    getComparableContextValue(roleContextDraft) ===
      getComparableContextValue(appliedRoleContext)
  const hasAppliedContext =
    Boolean(getComparableContextValue(appliedQuestionContext)) ||
    Boolean(getComparableContextValue(appliedRoleContext))

  return (
    <section className="theme-divider mt-5 border-t pt-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="kicker theme-muted text-[11px]">分析上下文</p>
          <h3 className="theme-title mt-2 text-lg font-semibold">
            背景与角色信息
          </h3>
          <p className="theme-muted mt-1 text-sm">
            应用后会参与阶段分析、发言建议、AI 问答与总结生成。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="status-badge" data-tone={hasAppliedContext ? 'active' : undefined}>
            {profile.topicContextLabel}：{summarizeContext(appliedQuestionContext)}
          </span>
          <span className="status-badge" data-tone={hasAppliedContext ? 'primary' : undefined}>
            {profile.roleContextLabel}：{summarizeContext(appliedRoleContext)}
          </span>
          <button
            className="btn-secondary"
            onClick={onToggleCollapsed}
            type="button"
          >
            {collapsed ? '展开编辑' : '收起上下文'}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className={`${contextCardClassName} xl:col-span-2`}>
            <label className="theme-title text-sm font-semibold" htmlFor="meeting-scenario">
              会议场景
            </label>
            <select
              className="theme-input mt-3 w-full px-4 py-3 text-sm"
              id="meeting-scenario"
              onChange={(event) => {
                setScenarioId(event.currentTarget.value as typeof scenarioId)
              }}
              value={scenarioId}
            >
              {Object.values(SCENARIO_PROFILES).map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label} · {scenario.description}
                </option>
              ))}
            </select>
          </div>
          <div className={contextCardClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h4 className="theme-title text-sm font-semibold">
                  {profile.topicContextLabel}
                </h4>
                <p className="theme-muted mt-1 text-xs">
                  填写主题、背景、目标与约束。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-primary text-xs"
                  disabled={isQuestionApplyDisabled}
                  onClick={onApplyQuestionContext}
                  type="button"
                >
                  应用
                </button>
                <button
                  className="btn-ghost text-xs"
                  onClick={onClearQuestionContext}
                  type="button"
                >
                  清空
                </button>
              </div>
            </div>
            <textarea
              className="theme-input h-32 w-full resize-none rounded-xl px-4 py-3 text-sm leading-6"
              onChange={(event) =>
                onQuestionContextDraftChange(event.currentTarget.value)
              }
              placeholder={profile.topicPlaceholder}
              value={questionContextDraft}
            />
            <div className="theme-muted mt-3 flex items-center justify-between gap-3 text-xs">
              <span>
                {getComparableContextValue(appliedQuestionContext)
                  ? '已应用到后续分析'
                  : '尚未应用'}
              </span>
              <span>{questionContextDraft.trim().length} 字</span>
            </div>
          </div>

          <div className={contextCardClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h4 className="theme-title text-sm font-semibold">
                  {profile.roleContextLabel}
                </h4>
                <p className="theme-muted mt-1 text-xs">
                  说明当前身份、职责边界与表达风格。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-primary text-xs"
                  disabled={isRoleApplyDisabled}
                  onClick={onApplyRoleContext}
                  type="button"
                >
                  应用
                </button>
                <button
                  className="btn-ghost text-xs"
                  onClick={onClearRoleContext}
                  type="button"
                >
                  清空
                </button>
              </div>
            </div>
            <textarea
              className="theme-input h-32 w-full resize-none rounded-xl px-4 py-3 text-sm leading-6"
              onChange={(event) => onRoleContextDraftChange(event.currentTarget.value)}
              placeholder={profile.rolePlaceholder}
              value={roleContextDraft}
            />
            <div className="theme-muted mt-3 flex items-center justify-between gap-3 text-xs">
              <span>
                {getComparableContextValue(appliedRoleContext)
                  ? '已应用到后续分析'
                  : '尚未应用'}
              </span>
              <span>{roleContextDraft.trim().length} 字</span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
