import { shutdownCodexAnalysis } from './llm/codexAnalysisService'
import { app, BrowserWindow, globalShortcut } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerAstIpcHandlers } from './ast/ipc'
import { registerLlmIpcHandlers } from './llm/ipc'

app.setName('interview-copilot-local')
const legacyDataDirectory = join(app.getPath('appData'), 'interview-copilot-local')
mkdirSync(legacyDataDirectory, { recursive: true })
app.setPath('userData', legacyDataDirectory)
app.setPath('sessionData', legacyDataDirectory)

const devServerUrl = process.env.VITE_DEV_SERVER_URL
const __dirname = dirname(fileURLToPath(import.meta.url))

const resolvePreloadPath = () => {
  const preloadMjs = join(__dirname, 'preload.mjs')
  const preloadJs = join(__dirname, 'preload.js')

  if (existsSync(preloadMjs)) {
    return preloadMjs
  }

  return preloadJs
}

const registerDevtoolsShortcut = (window: BrowserWindow) => {
  globalShortcut.unregister('CommandOrControl+Shift+I')
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (window.isDestroyed()) {
      return
    }

    window.webContents.toggleDevTools()
  })
}

const createWindow = async () => {
  const window = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#08111f',
    title: '会议智能助手',
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (devServerUrl) {
    await window.loadURL(devServerUrl)
    registerDevtoolsShortcut(window)
    return
  }

  await window.loadFile(join(__dirname, '../dist/index.html'))
  registerDevtoolsShortcut(window)
}

app.whenReady().then(() => {
  registerAstIpcHandlers()
  registerLlmIpcHandlers()
  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  shutdownCodexAnalysis()
  globalShortcut.unregisterAll()
})
