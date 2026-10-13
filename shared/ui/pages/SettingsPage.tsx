import { getMeetingRuntime } from '../runtime'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { maskSecret, type LlmModelSettings } from '../../meeting/settings/types'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string }

export function SettingsPage() {
  const draft = useSettingsStore((state) => state.draft)
  const supportsCodex = getMeetingRuntime().supportsCodex
  const usesCodex = draft.llm.provider === 'codex'
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

  const updateLlm = (patch: Partial<LlmModelSettings>) => {
    updateLlmDraft(patch)
    setLlmTest({ status: 'idle' })
  }

  const handleSave = () => {
    const settings = saveDraft()
    applyModelSettings(settings)
  }

  const testAstConnection = async () => {
    setAstTest({ status: 'testing' })

    try {
      await getMeetingRuntime().probeAstConnection(draft.ast)

      setAstTest({ status: 'ok', message: '流式语音识别 2.0 连接与识别请求成功。' })
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
      const result = await getMeetingRuntime().probeLlmConnection(draft.llm)
      setLlmTest({
        status: 'ok',
        message: usesCodex
          ? `Codex 分析请求成功（${result.model}，${result.authMethod === 'chatgpt' ? 'ChatGPT 账号' : result.authMethod === 'apiKey' ? 'Codex API Key 登录' : 'Codex 当前登录方式'}）。`
          : `文本分析连接成功（${result.model}）。`,
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
            模型配置保存在当前设备。API 通道使用你填写的密钥；桌面版也可使用本机已登录的 Codex。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="theme-inline-card rounded-[var(--radius-card)] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="theme-title font-semibold">语音转写</h3>
                <p className="theme-muted mt-1 text-xs">火山引擎流式语音识别 2.0 · 中文原话 · 说话人分离</p>
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
                <span className="theme-muted">API Key</span>
                <input
                  className="theme-input w-full px-3 py-2"
                  onChange={(event) =>
                    updateAstDraft({ apiKey: event.currentTarget.value })
                  }
                  placeholder={
                    draft.ast.apiKey && !showAstSecrets
                      ? maskSecret(draft.ast.apiKey)
                      : '火山引擎语音控制台 API Key'
                  }
                  type={showAstSecrets ? 'text' : 'password'}
                  value={draft.ast.apiKey}
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
                <p className="theme-muted mt-1 text-xs">{usesCodex ? '本机 Codex · 云端模型分析' : 'OpenAI Responses API'}</p>
              </div>
              {!usesCodex ? (
                <button
                  className="btn-ghost text-xs"
                  onClick={() => setShowLlmSecrets((value) => !value)}
                  type="button"
                >
                  {showLlmSecrets ? '隐藏' : '显示'}
                </button>
              ) : null}
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5 text-sm">
                <span className="theme-muted">分析通道</span>
                <select
                  className="theme-input w-full px-3 py-2"
                  disabled={llmTest.status === 'testing'}
                  value={draft.llm.provider}
                  onChange={(event) => updateLlm({ provider: event.currentTarget.value === 'codex' ? 'codex' : 'api' })}
                >
                  <option value="api">API（线上与桌面版）</option>
                  <option value="codex" disabled={!supportsCodex}>本地 Codex（仅桌面版）</option>
                </select>
              </label>
              {usesCodex ? (
                <>
                  <p className="theme-muted text-sm leading-6">
                    {supportsCodex
                      ? '先安装 Codex CLI 并运行 codex login 登录，再测试连接。无需在这里填写文本分析 API Key；使用当前 Codex 登录方式与额度。'
                      : '当前浏览器无法启动本地 Codex。请打开桌面版，或切换到 API 通道。'}
                  </p>
                  <p className="theme-muted text-sm leading-6">
                    会议文本仍会发送至 Codex 配置的模型服务，需要联网。自动阶段分析约每 8 秒处理最新定稿文本。
                  </p>
                  <label className="block space-y-1.5 text-sm">
                    <span className="theme-muted">Codex 模型（可选）</span>
                    <input
                      className="theme-input w-full px-3 py-2"
                      disabled={llmTest.status === 'testing'}
                      value={draft.llm.codex.model}
                      placeholder="留空使用 Codex 默认模型"
                      onChange={(event) => updateLlm({ codex: { ...draft.llm.codex, model: event.currentTarget.value } })}
                    />
                  </label>
                  <label className="block space-y-1.5 text-sm">
                    <span className="theme-muted">Codex 程序路径（可选）</span>
                    <input
                      className="theme-input w-full px-3 py-2"
                      disabled={llmTest.status === 'testing'}
                      value={draft.llm.codex.executablePath}
                      placeholder="留空自动查找，或填写绝对路径"
                      onChange={(event) => updateLlm({ codex: { ...draft.llm.codex, executablePath: event.currentTarget.value } })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block space-y-1.5 text-sm">
                    <span className="theme-muted">API Key</span>
                    <input
                      className="theme-input w-full px-3 py-2"
                      disabled={llmTest.status === 'testing'}
                      onChange={(event) =>
                        updateLlm({ apiKey: event.currentTarget.value })
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
                      disabled={llmTest.status === 'testing'}
                      onChange={(event) =>
                        updateLlm({ model: event.currentTarget.value })
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
                      disabled={llmTest.status === 'testing'}
                      onChange={(event) =>
                        updateLlm({ baseURL: event.currentTarget.value })
                      }
                      placeholder="https://api.openai.com/v1"
                      type="text"
                      value={draft.llm.baseURL}
                    />
                  </label>
                </>

              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="btn-secondary"
                disabled={llmTest.status === 'testing' || (usesCodex && !supportsCodex)}
                onClick={() => void testLlmConnection()}
                type="button"
              >
                {llmTest.status === 'testing' ? '测试中…' : '测试连接'}
              </button>
              <div aria-live="polite" className="w-full break-words text-sm leading-6">
                {llmTest.status === 'ok' ? <p className="text-[color:var(--success-ink)]">{llmTest.message}</p> : null}
                {llmTest.status === 'error' ? <p className="text-[color:var(--danger-ink)]">{llmTest.message}</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            disabled={!dirty || llmTest.status === 'testing'}
            onClick={handleSave}
            type="button"
          >
            保存配置
          </button>
          <button
            className="btn-secondary"
            disabled={!dirty || llmTest.status === 'testing'}
            onClick={() => { resetDraft(); setLlmTest({ status: 'idle' }) }}
            type="button"
          >
            撤销更改
          </button>
        </div>
      </section>
    </div>
  )
}
