import type { Config } from '@netlify/functions'
import { smokeTestByteDanceAstConnection } from '../../electron/ast/bytedanceSmokeTest'

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, { status: 405 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      appId?: string
      accessToken?: string
      resourceId?: string
      wsUrl?: string
    }

    await smokeTestByteDanceAstConnection({
      appId: body.appId,
      accessToken: body.accessToken,
      resourceId: body.resourceId,
      wsUrl: body.wsUrl,
    })

    return json({ ok: true })
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : '语音转写连接测试失败。',
      },
      { status: 400 },
    )
  }
}

export const config: Config = {
  path: '/api/ast/probe',
  method: ['POST'],
}
