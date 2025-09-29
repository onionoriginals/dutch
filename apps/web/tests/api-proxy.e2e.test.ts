import { beforeAll, afterAll, describe, test, expect } from 'bun:test'

let apiStop: (() => void) | undefined
let webStop: (() => void) | undefined
let apiOrigin = ''

async function startApi(): Promise<string> {
  const mod = await import('../../api/src/index.ts')
  const app = mod.createApp()
  const server = app.listen({ hostname: '127.0.0.1', port: 0 })
  const port = (server as any)?.port ?? (server as any)?.server?.port ?? 0
  apiStop = () => server.stop()
  return `http://127.0.0.1:${port}`
}

beforeAll(async () => {
  apiOrigin = await startApi()
})

afterAll(() => {
  if (webStop) webStop()
  if (apiStop) apiStop()
})

describe('api serves built web and endpoints', () => {
  test('GET /hello responds from API', async () => {
    const res = await fetch(`${apiOrigin}/hello`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(typeof json.message).toBe('string')
  })
})

