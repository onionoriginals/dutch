import { app } from '../index'
import { __testUtils } from '../services/db'

const fetchApi = (path: string, init?: RequestInit) => app.handle(new Request(`http://localhost/api${path}`, init))

describe('Seed lifecycle endpoints', () => {
  beforeEach(() => {
    __testUtils.reset()
  })

  it('validate/import/rotate/status/backup happy paths', async () => {
    let res = await fetchApi('/seed/validate', { method: 'POST', body: JSON.stringify({ seed: 'one two three four five six seven eight nine ten eleven twelve' }) })
    expect(res.status).toBe(200)
    let json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.valid).toBe(true)

    res = await fetchApi('/seed/import', { method: 'POST', body: JSON.stringify({ seed: 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu' }) })
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.imported).toBe(true)
    expect(typeof json.data.version).toBe('number')

    res = await fetchApi('/seed/status')
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.hasSeed).toBe(true)

    res = await fetchApi('/seed/backup-with-warnings')
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.maskedSeed === null || String(json.data.maskedSeed).includes('********')).toBe(true)

    res = await fetchApi('/seed/rotate', { method: 'POST', body: JSON.stringify({ newSeed: 'nu xi omicron pi rho sigma tau upsilon phi chi psi omega' }) })
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.rotated).toBe(true)
  })
})

