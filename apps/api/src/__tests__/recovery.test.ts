import { app } from '../index'
import { __testUtils, db } from '../services/db'

const fetchApi = (path: string, init?: RequestInit) => app.handle(new Request(`http://localhost/api${path}`, init))

describe('Recovery endpoints', () => {
  beforeEach(() => {
    __testUtils.reset()
    db.importMasterSeed('test seed for recovery only')
  })

  it('verify recovery returns canRecover true with master seed present', async () => {
    const res = await fetchApi('/recovery/verify/auc-1')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.canRecover).toBe(true)
    expect(json.isRecovered).toBe(false)
  })

  it('recover auction and all endpoints respond', async () => {
    let res = await fetchApi('/recovery/auction/auc-1')
    expect(res.status).toBe(200)
    let json = await res.json()
    expect(json.recovered).toBe(true)

    res = await fetchApi('/recovery/all')
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.ok).toBe(true)

    res = await fetchApi('/recovery/simulate-disaster', { method: 'POST' })
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.simulated).toBe(true)

    res = await fetchApi('/recovery/status')
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.hasSeed).toBe(true)

    res = await fetchApi('/recovery/documentation')
    expect(res.status).toBe(200)
    json = await res.json()
    expect(json.title).toMatch(/Disaster Recovery/i)
  })
})

