export function helloDutch(name: string): string {
  return `Hallo, ${name}!`;
}

export const version = '0.1.0'

import { SecureDutchyDatabase as SecureDutchyDatabaseType } from './database'

// Simple singleton database for API/runtime usage
let _db: SecureDutchyDatabaseType | null = null
export function getDb(dbPath: string = ((globalThis as any).Bun?.env?.DATABASE_PATH ?? 'data/dutch.sqlite')) {
  if (!_db) _db = new SecureDutchyDatabaseType(dbPath)
  return _db
}

export const db = getDb()

// Re-exports for API consumers
export { SecureDutchyDatabase, getBitcoinNetwork } from './database'
