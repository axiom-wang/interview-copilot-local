import type { Config, Context } from '@netlify/functions'
import { handleAnalysisRequest } from '../../../../shared/analysis/llm/analysisRequest'
import type { OpenAiRuntimeConfigOverride } from '../../../../shared/analysis/llm/openaiConfig'
import { unauthorizedResponse } from './identityGate'

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

const readModelConfigFromHeaders = (
  request: Request,
): OpenAiRuntimeConfigOverride => {
  const apiKey = request.headers.get('x-model-api-key')?.trim()
  const model = request.headers.get('x-model-name')?.trim()
  const baseURL = request.headers.get('x-model-base-url')?.trim()

  return {
    apiKey: apiKey || undefined,
    model: model || undefined,
    baseURL: baseURL || undefined,
  }
}

const readJsonBody = async (request: Request) => {
  const raw = await request.text()

  if (!raw.trim()) {
    return {}
  }

  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new Error('Request body must be valid JSON.')
  }
}

export default async (request: Request, context: Context) => {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, { status: 405 })
  }

  const unauthorized = await unauthorizedResponse()
  if (unauthorized) return unauthorized

  try {
    const result = await handleAnalysisRequest({
      action: context.params.action,
      body: await readJsonBody(request),
      configOverride: readModelConfigFromHeaders(request),
    })

    return json(result.body, { status: result.status })
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown analysis error.',
      },
      { status: 400 },
    )
  }
}

export const config: Config = {
  path: '/api/analysis/:action',
  method: ['POST'],
}
