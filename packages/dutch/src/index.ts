export function helloDutch(name: string): string {
  return `Hallo, ${name}!`;
}

export const version = '0.1.0'

import { SecureDutchyDatabase as SecureDutchyDatabaseType } from './database'
// Note: Do not statically import the Postgres implementation here to avoid bundling it in browser builds
import { createRequire } from 'module'
export { computeSchedule, priceAtTime } from './schedule'
export type { DecayType, ScheduleInput, NormalizedSchedule, SchedulePoint } from './schedule'

// Simple singleton database for API/runtime usage
let _db: SecureDutchyDatabaseType | null = null
export function getDb(dbPath: string = ((globalThis as any).Bun?.env?.DATABASE_PATH ?? 'data/dutch.sqlite')) {
  if (_db) return _db
  const databaseUrl = (globalThis as any).Bun?.env?.DATABASE_URL ?? (globalThis as any).process?.env?.DATABASE_URL
  if (databaseUrl) {
    try {
      const require = createRequire(import.meta.url)
      const mod = require('./database.pg') as any
      if (mod?.PostgresDutchyDatabase) {
        const pg = new mod.PostgresDutchyDatabase(String(databaseUrl))
        Promise.resolve(pg.initialize?.()).catch(() => {})
        _db = pg as unknown as SecureDutchyDatabaseType
        return _db
      }
    } catch {}
  }
  _db = new SecureDutchyDatabaseType(dbPath)
  return _db
}

export const db = getDb()

// Re-exports for API consumers
export { SecureDutchyDatabase, getBitcoinNetwork } from './database'
