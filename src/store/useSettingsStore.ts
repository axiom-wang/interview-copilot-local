import { create } from 'zustand'
import {
  clearModelSettings,
  loadModelSettings,
  saveModelSettings,
} from '../settings/settingsStore'
import {
  DEFAULT_MODEL_SETTINGS,
  isAstConfigured,
  isLlmConfigured,
  isModelConfigured,
  type ModelSettings,
} from '../settings/types'

interface SettingsState {
  userId: string | null
  settings: ModelSettings
  draft: ModelSettings
  dirty: boolean
  loadForUser: (userId: string) => void
  updateAstDraft: (patch: Partial<ModelSettings['ast']>) => void
  updateLlmDraft: (patch: Partial<ModelSettings['llm']>) => void
  saveDraft: () => ModelSettings
  resetDraft: () => void
  clearForUser: () => void
  hasAstConfig: () => boolean
  hasLlmConfig: () => boolean
  hasFullConfig: () => boolean
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  userId: null,
  settings: structuredClone(DEFAULT_MODEL_SETTINGS),
  draft: structuredClone(DEFAULT_MODEL_SETTINGS),
  dirty: false,
  loadForUser: (userId) => {
    const settings = loadModelSettings(userId)
    set({
      userId,
      settings,
      draft: structuredClone(settings),
      dirty: false,
    })
  },
  updateAstDraft: (patch) => {
    set((state) => ({
      draft: {
        ...state.draft,
        ast: {
          ...state.draft.ast,
          ...patch,
        },
      },
      dirty: true,
    }))
  },
  updateLlmDraft: (patch) => {
    set((state) => ({
      draft: {
        ...state.draft,
        llm: {
          ...state.draft.llm,
          ...patch,
        },
      },
      dirty: true,
    }))
  },
  saveDraft: () => {
    const { userId, draft } = get()
    if (!userId) {
      throw new Error('未登录，无法保存模型配置。')
    }

    const settings = saveModelSettings(userId, draft)
    set({
      settings,
      draft: structuredClone(settings),
      dirty: false,
    })
    return settings
  },
  resetDraft: () => {
    set((state) => ({
      draft: structuredClone(state.settings),
      dirty: false,
    }))
  },
  clearForUser: () => {
    const { userId } = get()
    if (userId) {
      clearModelSettings(userId)
    }

    set({
      settings: structuredClone(DEFAULT_MODEL_SETTINGS),
      draft: structuredClone(DEFAULT_MODEL_SETTINGS),
      dirty: false,
    })
  },
  hasAstConfig: () => isAstConfigured(get().settings.ast),
  hasLlmConfig: () => isLlmConfigured(get().settings.llm),
  hasFullConfig: () => isModelConfigured(get().settings),
}))
