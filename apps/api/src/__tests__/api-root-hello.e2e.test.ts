import { beforeAll, expect, test, describe } from 'bun:test'
import { createApp } from '../index'

let app: ReturnType<typeof createApp>

beforeAll(() => {
  ;(globalThis as any).process ||= { env: {} as any }
  ;(globalThis as any).process.env.BITCOIN_NETWORK = 'mainnet'
  app = createApp()
})

describe('API health and hello', () => {
  test('GET / returns ok and version; network override works', async () => {
    const res = await app.handle(new Request('http://localhost/?network=regtest'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.version).toBeDefined()
    expect(json.network).toBe('regtest')
  })

  test('GET /hello returns greeting', async () => {
    const res = await app.handle(new Request('http://localhost/hello'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(typeof json.message).toBe('string')
    expect(json.message.length).toBeGreaterThan(0)
  })
})

