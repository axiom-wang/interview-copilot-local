import clsx from 'clsx'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { PromptContextInputs } from './PromptContextInputs'

const buttonClassName =
  'inline-flex items-center justify-center rounded-full border px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-45'

const formatTimestamp = (timestamp: number | null) =>
  timestamp
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(timestamp)
    : '等待更新'

const getComparableContextValue = (value: string) =>
  value.replace(/\r\n/g, '\n').trim()

export function TopBar() {
  const mode = useAppStore((state) => state.mode)
  const runtimeEnvironment = useAppStore((state) => state.runtimeEnvironment)
  const isEmbedded = useAppStore((state) => state.isEmbedded)
  const supportsLiveAssist = useAppStore((state) => state.supportsLiveAssist)
  const isStreaming = useAppStore((state) => state.isStreaming)
  const isPaused = useAppStore((state) => state.isPaused)
  const isAnalyzing = useAppStore((state) => state.isAnalyzing)
  const liveSegments = useAppStore((state) => state.liveSegments)
  const astProviderLabel = useAppStore((state) => state.astProviderLabel)
  const analysisProviderLabel = useAppStore((state) => state.analysisProviderLabel)
  const inputSourceLabel = useAppStore((state) => state.inputSourceLabel)
  const listeningStatusLabel = useAppStore((state) => state.listeningStatusLabel)
  const speakerStability = useAppStore((state) => state.speakerStability)
  const speakerProfiles = useAppStore((state) => state.speakerProfiles)
  const questionContextDraft = useAppStore((state) => state.questionContextDraft)
  const roleContextDraft = useAppStore((state) => state.roleContextDraft)
  const questionContext = useAppStore((state) => state.questionContext)
  const roleContext = useAppStore((state) => state.roleContext)
  const lastUpdatedAt = useAppStore((state) => state.lastUpdatedAt)
  const startStream = useAppStore((state) => state.startStream)
  const togglePause = useAppStore((state) => state.togglePause)
  const stopStream = useAppStore((state) => state.stopStream)
  const pinCurrentSegment = useAppStore((state) => state.pinCurrentSegment)
  const saveCurrentSession = useAppStore((state) => state.saveCurrentSession)
  const setMode = useAppStore((state) => state.setMode)
  const setQuestionContextDraft = useAppStore(
    (state) => state.setQuestionContextDraft,
  )
  const setRoleContextDraft = useAppStore((state) => state.setRoleContextDraft)
  const applyQuestionContext = useAppStore((state) => state.applyQuestionContext)
  const applyRoleContext = useAppStore((state) => state.applyRoleContext)
  const clearQuestionContext = useAppStore((state) => state.clearQuestionContext)
  const clearRoleContext = useAppStore((state) => state.clearRoleContext)
  const [contextVisibility, setContextVisibility] = useState<
    'auto' | 'collapsed' | 'expanded'
  >('auto')

  const hasSegments = liveSegments.length > 0
  const hasAppliedContext =
    Boolean(getComparableContextValue(questionContext)) ||
    Boolean(getComparableContextValue(roleContext))
  const draftsMatchApplied =
    getComparableContextValue(questionContextDraft) ===
      getComparableContextValue(questionContext) &&
    getComparableContextValue(roleContextDraft) ===
      getComparableContextValue(roleContext)
  const contextCollapsed =
    contextVisibility === 'collapsed' ||
    (contextVisibility === 'auto' && hasAppliedContext && draftsMatchApplied)
  const currentMeProfile =
    Object.values(speakerProfiles).find((profile) => profile.isMe) ?? null
  const currentMeLabel = currentMeProfile
    ? currentMeProfile.displayName
      ? `我 / ${currentMeProfile.displayName}`
      : '我'
    : '未设置'
  const streamStateLabel = isStreaming
    ? isPaused
      ? '已暂停'
      : '监听中'
    : '未开始'
  const stabilityTone =
    speakerStability === 'unstable'
      ? 'warning'
      : speakerStability === 'stable'
        ? 'primary'
        : undefined
  const stabilityLabel =
    speakerStability === 'unstable'
      ? '识别不稳定'
      : speakerStability === 'stable'
        ? '识别稳定'
        : '等待识别'
  const environmentLabel =
    runtimeEnvironment === 'electron'
      ? 'Electron Desktop'
      : isEmbedded
        ? 'Web Embed'
        : 'Web Preview'
  const startButtonLabel = supportsLiveAssist ? '开始' : '网页展示'

  return (
    <header className="hero-toolbar px-5 py-5 md:px-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="status-badge" data-tone="primary">
                Interview Copilot Local
              </span>
              <span
                className="status-badge"
                data-tone={isStreaming && !isPaused ? 'active' : undefined}
              >
                {listeningStatusLabel}
              </span>
              <span
                className="status-badge"
                data-tone={runtimeEnvironment === 'electron' ? 'active' : 'warning'}
              >
                {environmentLabel}
              </span>
              <span className="status-badge" data-tone={stabilityTone}>
                {stabilityLabel}
              </span>
            </div>
            <div>
              <h1 className="theme-title font-heading text-3xl md:text-[2.6rem]">
                会议智能助手
              </h1>
              <p className="theme-body mt-2 max-w-3xl text-sm leading-6">
                把实时转写、阶段分析、发言建议和结果预览放在同一块面板里。
                在网页环境下默认用于展示 UI 与 Replay 示例会话，在桌面环境下再启用实时采集与桥接能力。
              </p>
            </div>
          </div>

          <div className="theme-inline-card rounded-[24px] p-1.5">
            <div className="flex flex-wrap gap-1.5">
              <button
                className={clsx(
                  buttonClassName,
                  mode === 'live' ? 'theme-button-primary' : 'theme-button-neutral',
                )}
                onClick={() => setMode('live')}
                type="button"
              >
                Live Assist
              </button>
              <button
                className={clsx(
                  buttonClassName,
                  mode === 'replay' ? 'theme-button-primary' : 'theme-button-neutral',
                )}
                onClick={() => setMode('replay')}
                type="button"
              >
                Replay
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={clsx(buttonClassName, 'theme-button-success')}
            disabled={isStreaming || !supportsLiveAssist}
            onClick={() => void startStream()}
            title={
              supportsLiveAssist
                ? undefined
                : '网页模式需要配置 VITE_REALTIME_WS_URL 后才能启用实时转写。'
            }
            type="button"
          >
            {startButtonLabel}
          </button>
          <button
            className={clsx(buttonClassName, 'theme-button-info')}
            disabled={!isStreaming}
            onClick={() => void togglePause()}
            type="button"
          >
            {isPaused ? '继续' : '暂停'}
          </button>
          <button
            className={clsx(buttonClassName, 'theme-button-warning')}
            disabled={!isStreaming}
            onClick={stopStream}
            type="button"
          >
            停止
          </button>
          <button
            className={clsx(buttonClassName, 'theme-button-primary')}
            disabled={!hasSegments}
            onClick={pinCurrentSegment}
            type="button"
          >
            标记
          </button>
          <button
            className={clsx(buttonClassName, 'theme-button-magenta')}
            disabled={!hasSegments}
            onClick={saveCurrentSession}
            type="button"
          >
            保存
          </button>
        </div>

        <div className="-mb-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="status-badge">运行环境: {environmentLabel}</span>
          <span className="status-badge">AST: {astProviderLabel}</span>
          <span className="status-badge">分析引擎: {analysisProviderLabel}</span>
          <span className="status-badge">输入源: {inputSourceLabel}</span>
          <span className="status-badge">识别稳定度: {stabilityLabel}</span>
          <span className="status-badge">最近更新: {formatTimestamp(lastUpdatedAt)}</span>
          <span className="status-badge">当前状态: {streamStateLabel}</span>
          <span className="status-badge">
            {liveSegments.length} 条片段 / {currentMeLabel}
          </span>
          <span
            className="status-badge"
            data-tone={isAnalyzing ? 'primary' : undefined}
          >
            {isAnalyzing ? '分析刷新中' : '分析待命'}
          </span>
        </div>

        {mode === 'live' ? (
          <PromptContextInputs
            appliedQuestionContext={questionContext}
            appliedRoleContext={roleContext}
            collapsed={contextCollapsed}
            onApplyQuestionContext={() => {
              applyQuestionContext()
              setContextVisibility('collapsed')
            }}
            onApplyRoleContext={() => {
              applyRoleContext()
              setContextVisibility('collapsed')
            }}
            onClearQuestionContext={() => {
              clearQuestionContext()

              if (!getComparableContextValue(roleContext)) {
                setContextVisibility('expanded')
              }
            }}
            onClearRoleContext={() => {
              clearRoleContext()

              if (!getComparableContextValue(questionContext)) {
                setContextVisibility('expanded')
              }
            }}
            onQuestionContextDraftChange={setQuestionContextDraft}
            onRoleContextDraftChange={setRoleContextDraft}
            onToggleCollapsed={() =>
              setContextVisibility((current) =>
                contextCollapsed && current !== 'collapsed' ? 'expanded' : 'collapsed',
              )
            }
            questionContextDraft={questionContextDraft}
            roleContextDraft={roleContextDraft}
          />
        ) : null}
      </div>
    </header>
  )
}
