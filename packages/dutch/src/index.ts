export function helloDutch(name: string): string {
  return `Hallo, ${name}!`;
}

export const version = '0.1.0'

export { SecureDutchyDatabase, getBitcoinNetwork } from './database'

// Export a default SQLite-backed singleton for convenience
import { SecureDutchyDatabase as _SecureDutchyDatabase } from './database'
export const db = new _SecureDutchyDatabase((globalThis as any).Bun?.env?.DUTCH_DB_PATH || ':memory:')
