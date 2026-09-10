import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { HttpOpenAiLlmProvider } from '../providers/llm/HttpOpenAiLlmProvider'
import { maskSecret } from '../settings/types'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string }

export function SettingsPage() {
  const draft = useSettingsStore((state) => state.draft)
  const dirty = useSettingsStore((state) => state.dirty)
  const updateAstDraft = useSettingsStore((state) => state.updateAstDraft)
  const updateLlmDraft = useSettingsStore((state) => state.updateLlmDraft)
  const saveDraft = useSettingsStore((state) => state.saveDraft)
  const resetDraft = useSettingsStore((state) => state.resetDraft)
  const applyModelSettings = useAppStore((state) => state.applyModelSettings)
  const [showAstSecrets, setShowAstSecrets] = useState(false)
  const [showLlmSecrets, setShowLlmSecrets] = useState(false)
  const [astTest, setAstTest] = useState<TestState>({ status: 'idle' })
  const [llmTest, setLlmTest] = useState<TestState>({ status: 'idle' })

  const handleSave = () => {
    const settings = saveDraft()
    applyModelSettings(settings)
  }

  const testAstConnection = async () => {
    setAstTest({ status: 'testing' })

    try {
      if (window.interviewCopilot?.smokeTestByteDanceAstConnection) {
        const result = await window.interviewCopilot.smokeTestByteDanceAstConnection({
          appId: draft.ast.appId,
          accessToken: draft.ast.accessToken,
          resourceId: draft.ast.resourceId,
          wsUrl: draft.ast.wsUrl,
        })

        if (!result.ok) {
          throw new Error(result.error)
        }
      } else {
        const response = await fetch('/api/ast/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft.ast),
        })
        const payload = (await response.json()) as {
          ok: boolean
          error?: string
        }

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || '语音转写连接测试失败。')
        }
      }

      setAstTest({ status: 'ok', message: '语音转写连接成功。' })
    } catch (error) {
      setAstTest({
        status: 'error',
        message: error instanceof Error ? error.message : '语音转写连接测试失败。',
      })
    }
  }

  const testLlmConnection = async () => {
    setLlmTest({ status: 'testing' })

    try {
      const provider = new HttpOpenAiLlmProvider()
      provider.setModelConfig(draft.llm)
      const result = await provider.probeConnection()
      setLlmTest({
        status: 'ok',
        message: `文本分析连接成功（${result.model}）。`,
      })
    } catch (error) {
      setLlmTest({
        status: 'error',
        message: error instanceof Error ? error.message : '文本分析连接测试失败。',
      })
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <section className="panel-card p-5">
        <div className="mb-4">
          <p className="kicker theme-muted text-[11px]">Providers</p>
          <h2 className="theme-title mt-1 text-2xl font-semibold">模型配置</h2>
          <p className="theme-muted mt-2 text-sm leading-6">
            密钥仅保存在当前浏览器本地，请求时透传给服务端代理，服务端不持久化。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="theme-inline-card rounded-[var(--radius-card)] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="theme-title font-semibold">语音转写</h3>
                <p className="theme-muted mt-1 text-xs">字节同传 AST 2.0</p>
              </div>
              <button
                className="btn-ghost text-xs"
                onClick={() => setShowAstSecrets((value) => !value)}
                type="button"
              >
                {showAstSecrets ? '隐藏' : '显示'}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5 text-sm">
                <span className="theme-muted">App ID</span>
                <input
                  className="theme-input w-full px-3 py-2"
                  onChange={(event) =>
                    updateAstDraft({ appId: event.currentTarget.value })
                  }
                  placeholder="应用 ID"
                  type="text"
                  value={draft.ast.appId}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="theme-muted">Access Token</span>
                <input
                  className="theme-input w-full px-3 py-2"
                  onChange={(event) =>
                    updateAstDraft({ accessToken: event.currentTarget.value })
                  }
                  placeholder={
                    draft.ast.accessToken && !showAstSecrets
                      ? maskSecret(draft.ast.accessToken)
                      : '访问令牌'
                  }
                  type={showAstSecrets ? 'text' : 'password'}
                  value={draft.ast.accessToken}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="theme-muted">Resource ID</span>
                <input
                  className="theme-input w-full px-3 py-2"
                  onChange={(event) =>
                    updateAstDraft({ resourceId: event.currentTarget.value })
                  }
                  type="text"
                  value={draft.ast.resourceId}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="theme-muted">WebSocket URL</span>
                <input
                  className="theme-input w-full px-3 py-2"
                  onChange={(event) =>
                    updateAstDraft({ wsUrl: event.currentTarget.value })
                  }
                  type="text"
                  value={draft.ast.wsUrl}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="btn-secondary"
                disabled={astTest.status === 'testing'}
                onClick={() => void testAstConnection()}
                type="button"
              >
                {astTest.status === 'testing' ? '测试中…' : '测试连接'}
              </button>
              {astTest.status === 'ok' ? (
                <span className="status-badge" data-tone="active">
                  {astTest.message}
                </span>
              ) : null}
              {astTest.status === 'error' ? (
                <span className="status-badge" data-tone="danger">
                  {astTest.message}
                </span>
              ) : null}
            </div>
          </div>

          <div className="theme-inline-card rounded-[var(--radius-card)] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="theme-title font-semibold">文本分析</h3>
                <p className="theme-muted mt-1 text-xs">OpenAI Responses API</p>
              </div>
              <button
                className="btn-ghost text-xs"
                onClick={() => setShowLlmSecrets((value) => !value)}
                type="button"
              >
                {showLlmSecrets ? '隐藏' : '显示'}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5 text-sm">
                <span className="theme-muted">API Key</span>
                <input
                  className="theme-input w-full px-3 py-2"
                  onChange={(event) =>
                    updateLlmDraft({ apiKey: event.currentTarget.value })
                  }
                  placeholder={
                    draft.llm.apiKey && !showLlmSecrets
                      ? maskSecret(draft.llm.apiKey)
                      : 'sk-...'
                  }
                  type={showLlmSecrets ? 'text' : 'password'}
                  value={draft.llm.apiKey}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="theme-muted">模型</span>
                <input
                  className="theme-input w-full px-3 py-2"
                  onChange={(event) =>
                    updateLlmDraft({ model: event.currentTarget.value })
                  }
                  placeholder="gpt-5.4-mini"
                  type="text"
                  value={draft.llm.model}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="theme-muted">Base URL</span>
                <input
                  className="theme-input w-full px-3 py-2"
                  onChange={(event) =>
                    updateLlmDraft({ baseURL: event.currentTarget.value })
                  }
                  placeholder="https://api.openai.com/v1"
                  type="text"
                  value={draft.llm.baseURL}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="btn-secondary"
                disabled={llmTest.status === 'testing'}
                onClick={() => void testLlmConnection()}
                type="button"
              >
                {llmTest.status === 'testing' ? '测试中…' : '测试连接'}
              </button>
              {llmTest.status === 'ok' ? (
                <span className="status-badge" data-tone="active">
                  {llmTest.message}
                </span>
              ) : null}
              {llmTest.status === 'error' ? (
                <span className="status-badge" data-tone="danger">
                  {llmTest.message}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            disabled={!dirty}
            onClick={handleSave}
            type="button"
          >
            保存配置
          </button>
          <button
            className="btn-secondary"
            disabled={!dirty}
            onClick={resetDraft}
            type="button"
          >
            撤销更改
          </button>
        </div>
      </section>
    </div>
  )
}
