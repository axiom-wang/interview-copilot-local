import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const requireUi = createRequire(new URL('../shared/ui/package.json', import.meta.url))
const React = requireUi('react')
const { renderToStaticMarkup } = requireUi('react-dom/server')
import { createDesktopRuntime } from '../apps/desktop/renderer/runtime'
import { configureMeetingRuntime } from '../shared/ui/runtime'
import { DEFAULT_MODEL_SETTINGS } from '../shared/meeting/settings/types'

test('settings page offers Claude only on desktop, with path, model and a connection test', async (t) => {
  const memory = new Map<string, string>()
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) }
  for (const [name, value] of Object.entries({ React, window: { interviewCopilot: { probeAnalysisConnection: async () => ({ ok: true }) }, localStorage: storage }, localStorage: storage })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else Reflect.deleteProperty(globalThis, name) })
  }
  const desktop = createDesktopRuntime()
  configureMeetingRuntime(desktop)
  // Server rendering reads the store's initial state, so seed it before the store is created.
  DEFAULT_MODEL_SETTINGS.llm.provider = 'claude'
  const { SettingsPage } = await import('../shared/ui/pages/SettingsPage')
  assert.equal(desktop.createLlmProvider(DEFAULT_MODEL_SETTINGS.llm).label, '本地 Claude')
  const html = renderToStaticMarkup(React.createElement(SettingsPage))
  for (const text of ['本地 Claude（仅桌面版）', 'Claude 配置（首选）', 'Claude 程序路径（可选）', 'Claude 模型（可选）', '测试连接', 'API 配置（备用）']) assert.ok(html.includes(text), text)
  assert.ok(!html.includes('Codex 配置'))

  configureMeetingRuntime({ ...desktop, environment: 'web', supportsCodex: false })
  const web = renderToStaticMarkup(React.createElement(SettingsPage))
  assert.ok(!web.includes('本地 Claude') && !web.includes('Claude 配置'))
})
