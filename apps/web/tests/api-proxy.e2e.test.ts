import { beforeAll, afterAll, describe, test, expect } from 'bun:test'

let apiStop: (() => void) | undefined
let webStop: (() => void) | undefined
let webOrigin = ''

async function startApi(): Promise<string> {
  const mod = await import('../../api/src/index.ts')
  const app = mod.createApp()
  const server = app.listen({ hostname: '127.0.0.1', port: 0 })
  const port = (server as any)?.port ?? (server as any)?.server?.port ?? 0
  apiStop = () => server.stop()
  return `http://127.0.0.1:${port}`
}

async function startWeb(apiOrigin: string): Promise<string> {
  const PORT = 44555
  webOrigin = `http://127.0.0.1:${PORT}`
  ;(globalThis as any).process ||= { env: {} as any }
  ;(globalThis as any).process.env.HOST = '127.0.0.1'
  ;(globalThis as any).process.env.PORT = String(PORT)
  ;(globalThis as any).process.env.API_INTERNAL_ORIGIN = apiOrigin
  const mod: any = await import('../src/server.ts')
  const srv = mod.server
  webStop = () => srv?.stop?.()

  const startedAt = Date.now()
  let lastErr: any
  while (Date.now() - startedAt < 8000) {
    try {
      const r = await fetch(`${webOrigin}/api/hello`)
      if (r.ok) return webOrigin
    } catch (err) {
      lastErr = err
    }
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('web server failed to start: ' + String(lastErr || 'timeout'))
}

beforeAll(async () => {
  const apiOrigin = await startApi()
  await startWeb(apiOrigin)
})

afterAll(() => {
  if (webStop) webStop()
  if (apiStop) apiStop()
})

describe('web reverse proxy', () => {
  test('GET /api/hello proxies to API /hello', async () => {
    const res = await fetch(`${webOrigin}/api/hello`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(typeof json.message).toBe('string')
  })
})

