import clsx from 'clsx'
import { ContextFields, ScenarioPicker } from '../../components/PromptContextInputs'
import { applyPendingContext } from '../../components/promptContext'
import { resolveScenarioProfile } from '../../../meeting/scenarios'
import { useAppStore } from '../../store/useAppStore'
import { useSettingsStore } from '../../store/useSettingsStore'

function ReadinessItem({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span
        className={clsx(
          'inline-block h-2 w-2 shrink-0 rounded-full',
          ready ? 'bg-[color:var(--success)]' : 'bg-[color:var(--warning)]',
        )}
      />
      <span className="theme-title shrink-0 font-medium">{label}</span>
      <span className="theme-muted min-w-0 truncate">{detail}</span>
    </div>
  )
}

export function LivePrepView() {
  const supportsLiveAssist = useAppStore((state) => state.supportsLiveAssist)
  const astProviderLabel = useAppStore((state) => state.astProviderLabel)
  const analysisProviderLabel = useAppStore((state) => state.analysisProviderLabel)
  const errorMessage = useAppStore((state) => state.errorMessage)
  const savedSessions = useAppStore((state) => state.savedSessions)
  const startStream = useAppStore((state) => state.startStream)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const selectSession = useAppStore((state) => state.selectSession)
  const hasAstConfig = useSettingsStore((state) => state.hasAstConfig)
  const hasLlmConfig = useSettingsStore((state) => state.hasLlmConfig)
  const scenarioId = useAppStore((state) => state.scenarioId)
  const questionContextDraft = useAppStore((state) => state.questionContextDraft)
  const profile = resolveScenarioProfile(scenarioId)
  const isQa = profile.interactionModel === 'qa'
  const missingRequiredTopic = Boolean(profile.topicContextRequired) && !questionContextDraft.trim()

  const astReady = hasAstConfig()
  const llmReady = hasLlmConfig()
  const canStart = astReady && llmReady && supportsLiveAssist && !missingRequiredTopic
  const lastSession = savedSessions.find((session) => session.id !== 'session-demo')

  const handleStart = () => {
    applyPendingContext()
    void startStream()
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-6 md:pt-4">
      <div>
        <h1 className="theme-title text-xl font-semibold">准备开始会议</h1>
        <p className="theme-muted mt-1 text-sm leading-6">
          选好场景、写清议题，AI 会跟随整场讨论，在有价值时补充观点或提出追问。
        </p>
      </div>

      <section className="panel-card divide-y divide-[color:var(--divider)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <ReadinessItem
              detail={astReady ? astProviderLabel : '未配置'}
              label="语音转写"
              ready={astReady}
            />
            <ReadinessItem
              detail={llmReady ? analysisProviderLabel : '未配置'}
              label="文本分析"
              ready={llmReady}
            />
          </div>
          {!astReady || !llmReady ? (
            <button
              className="btn-primary shrink-0"
              onClick={() => setActiveView('settings')}
              type="button"
            >
              前往模型设置
            </button>
          ) : (
            <button
              className="btn-ghost shrink-0 text-xs"
              onClick={() => setActiveView('settings')}
              type="button"
            >
              修改配置
            </button>
          )}
        </div>

        <div className="px-5 py-5">
          <ScenarioPicker />
        </div>

        <div className="px-5 py-5">
          <ContextFields />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <p className="theme-muted max-w-md text-xs leading-5">
            {!supportsLiveAssist
              ? '实时转写服务地址尚未配置，当前只能查看历史会话和修改设置。'
              : missingRequiredTopic
                ? `请先填写${profile.topicContextLabel}，再开始。`
                : isQa
                  ? profile.qa?.startNote ?? '开始后只在按住按键时收音。'
                  : '开始后持续收音：音频发送到你配置的火山引擎语音服务，转写文本发送到你配置的分析模型。会话只保存在本机。'}
          </p>
          <button
            className="btn-primary shrink-0 px-6 py-2.5 text-base"
            disabled={!canStart}
            onClick={handleStart}
            type="button"
          >
            {isQa ? profile.qa?.startLabel ?? '开始' : '开始会议'}
          </button>
        </div>
      </section>

      {errorMessage ? (
        <p
          className="rounded-[var(--radius-card)] border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--danger-text)]"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {lastSession ? (
        <button
          className="theme-muted self-start text-sm underline-offset-4 hover:text-[color:var(--text-primary)] hover:underline"
          onClick={() => {
            selectSession(lastSession.id)
            setActiveView('replay')
          }}
          type="button"
        >
          查看上一场会议：{lastSession.title}
        </button>
      ) : null}
    </div>
  )
}
