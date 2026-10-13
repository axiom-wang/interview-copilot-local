import { getUser } from '@netlify/identity'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const identityRequired = () => {
  const netlifyEnv = (
    globalThis as typeof globalThis & {
      Netlify?: { env?: { get?: (name: string) => string | undefined } }
    }
  ).Netlify?.env?.get?.('IDENTITY_REQUIRED')

  return (netlifyEnv ?? process.env.IDENTITY_REQUIRED)?.trim() === 'true'
}

export const unauthorizedResponse = async () => {
  if (!identityRequired()) return null

  try {
    const user = await getUser()
    if (user) return null
  } catch {
    // Identity is required, but the caller could not be resolved.
  }

  return json({ ok: false, error: 'Unauthorized.' }, 401)
}
