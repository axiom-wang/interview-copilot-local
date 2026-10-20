import type { CodexConfig } from '../../../../shared/meeting/types/desktopAnalysis'
import { CodexClient } from './codexClient'
import { createLocalAnalysis } from './localAnalysis'

let current: { key: string; client: CodexClient } | null = null
const probes = new Set<CodexClient>()

export const disposeCodexAnalysis = () => {
  current?.client.dispose()
  current = null
}

export const shutdownCodexAnalysis = () => {
  disposeCodexAnalysis()
  for (const client of probes) client.dispose()
  probes.clear()
}

const getClient = (config: CodexConfig) => {
  const key = JSON.stringify(config)
  if (current?.key !== key) {
    disposeCodexAnalysis()
    current = { key, client: new CodexClient(config) }
  }
  return current!.client
}

export const probeCodexConnection = async (config: CodexConfig) => {
  const client = new CodexClient(config)
  probes.add(client)
  try { return await client.probe() } finally {
    client.dispose()
    probes.delete(client)
  }
}

export const codexAnalysis = (config: CodexConfig) => createLocalAnalysis(getClient(config))
