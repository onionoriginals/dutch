/**
 * WebVHManager - Manages did:webvh DIDs with JSONL storage
 * 
 * This manager handles:
 * - Creating new did:webvh DIDs for users
 * - Storing DID documents in JSONL format
 * - Retrieving DID documents
 * - Version history management
 */

import { Database } from 'bun:sqlite'
import * as bip39 from 'bip39'
import { BIP32Factory } from 'bip32'
import * as tinySecp256k1 from 'tiny-secp256k1'

const bip32 = BIP32Factory(tinySecp256k1 as any)

export interface DIDDocument {
  '@context': string[]
  id: string
  controller?: string[]
  verificationMethod: VerificationMethod[]
  authentication?: string[]
  assertionMethod?: string[]
  keyAgreement?: string[]
  capabilityInvocation?: string[]
  capabilityDelegation?: string[]
  service?: ServiceEndpoint[]
}

export interface VerificationMethod {
  id: string
  type: string
  controller: string
  publicKeyMultibase?: string
  publicKeyJwk?: Record<string, any>
}

export interface ServiceEndpoint {
  id: string
  type: string
  serviceEndpoint: string | Record<string, any>
}

export interface DIDJSONLEntry {
  versionId: string
  versionTime: string
  parameters: {
    method?: string
    scid?: string
    updateKeys?: string[]
    nextKeyHashes?: string[]
    [key: string]: any
  }
  state: DIDDocument
}

export interface CreateDIDOptions {
  userAddress: string
  publicKeyMultibase?: string
  serviceEndpoints?: ServiceEndpoint[]
}

/**
 * WebVHManager handles did:webvh DID creation and management
 */
export class WebVHManager {
  private db: Database

  constructor(db: Database) {
    this.db = db
    this.initialize()
  }

  private initialize(): void {
    // Create tables for DID storage
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dids (
        id TEXT PRIMARY KEY,
        user_address TEXT NOT NULL,
        did TEXT NOT NULL UNIQUE,
        jsonl TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dids_user_address ON dids(user_address);
      CREATE INDEX IF NOT EXISTS idx_dids_did ON dids(did);
    `)
  }

  /**
   * Creates a new did:webvh DID for a user
   */
  async createDID(options: CreateDIDOptions): Promise<{
    did: string
    didDocument: DIDDocument
    jsonl: string
  }> {
    const { userAddress, publicKeyMultibase, serviceEndpoints = [] } = options

    // Check if user already has a DID
    const existing = this.getDIDByUserAddress(userAddress)
    if (existing) {
      return {
        did: existing.did,
        didDocument: existing.didDocument,
        jsonl: existing.jsonl,
      }
    }

    // Generate a unique DID identifier
    const didId = this.generateDIDIdentifier(userAddress)
    const did = `did:webvh:${didId}`

    // Create verification method
    const verificationMethodId = `${did}#key-1`
    const verificationMethod: VerificationMethod = {
      id: verificationMethodId,
      type: 'Multikey',
      controller: did,
      publicKeyMultibase: publicKeyMultibase || this.generatePublicKey(userAddress),
    }

    // Create DID document
    const didDocument: DIDDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ],
      id: did,
      verificationMethod: [verificationMethod],
      authentication: [verificationMethodId],
      assertionMethod: [verificationMethodId],
      capabilityInvocation: [verificationMethodId],
      service: serviceEndpoints,
    }

    // Create JSONL entry
    const now = new Date().toISOString()
    const versionId = '1-' + this.generateVersionHash(didDocument)
    
    const jsonlEntry: DIDJSONLEntry = {
      versionId,
      versionTime: now,
      parameters: {
        method: 'did:webvh:0.1',
      },
      state: didDocument,
    }

    const jsonl = JSON.stringify(jsonlEntry)

    // Store in database
    const timestamp = Math.floor(Date.now() / 1000)
    this.db
      .query(
        `INSERT INTO dids (id, user_address, did, jsonl, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(didId, userAddress, did, jsonl, timestamp, timestamp)

    return {
      did,
      didDocument,
      jsonl,
    }
  }

  /**
   * Retrieves DID information by user address
   */
  getDIDByUserAddress(userAddress: string): {
    id: string
    did: string
    didDocument: DIDDocument
    jsonl: string
  } | null {
    const row = this.db
      .query(`SELECT id, did, jsonl FROM dids WHERE user_address = ?`)
      .get(userAddress) as { id: string; did: string; jsonl: string } | undefined

    if (!row) return null

    const jsonlEntry = JSON.parse(row.jsonl) as DIDJSONLEntry
    return {
      id: row.id,
      did: row.did,
      didDocument: jsonlEntry.state,
      jsonl: row.jsonl,
    }
  }

  /**
   * Retrieves DID information by DID string
   */
  getDIDByDID(did: string): {
    id: string
    did: string
    didDocument: DIDDocument
    jsonl: string
  } | null {
    const row = this.db
      .query(`SELECT id, did, jsonl FROM dids WHERE did = ?`)
      .get(did) as { id: string; did: string; jsonl: string } | undefined

    if (!row) return null

    const jsonlEntry = JSON.parse(row.jsonl) as DIDJSONLEntry
    return {
      id: row.id,
      did: row.did,
      didDocument: jsonlEntry.state,
      jsonl: row.jsonl,
    }
  }

  /**
   * Updates a DID document (creates a new version in JSONL)
   */
  async updateDID(
    did: string,
    updates: Partial<DIDDocument>
  ): Promise<{
    did: string
    didDocument: DIDDocument
    jsonl: string
  }> {
    const existing = this.getDIDByDID(did)
    if (!existing) {
      throw new Error(`DID ${did} not found`)
    }

    // Merge updates with existing document
    const updatedDocument: DIDDocument = {
      ...existing.didDocument,
      ...updates,
    }

    // Create new JSONL entry
    const now = new Date().toISOString()
    const existingEntries = existing.jsonl.split('\n').filter(Boolean)
    const versionNum = existingEntries.length + 1
    const versionId = `${versionNum}-` + this.generateVersionHash(updatedDocument)

    const jsonlEntry: DIDJSONLEntry = {
      versionId,
      versionTime: now,
      parameters: {
        method: 'did:webvh:0.1',
      },
      state: updatedDocument,
    }

    const newJsonl = existing.jsonl + '\n' + JSON.stringify(jsonlEntry)

    // Update in database
    const timestamp = Math.floor(Date.now() / 1000)
    this.db
      .query(`UPDATE dids SET jsonl = ?, updated_at = ? WHERE did = ?`)
      .run(newJsonl, timestamp, did)

    return {
      did,
      didDocument: updatedDocument,
      jsonl: newJsonl,
    }
  }

  /**
   * Generates a deterministic DID identifier from user address
   */
  private generateDIDIdentifier(userAddress: string): string {
    // Use first 16 chars of SHA-256 hash of address for a short, unique ID
    const encoder = new TextEncoder()
    const data = encoder.encode(userAddress + Date.now().toString())
    const hashBuffer = crypto.subtle.digestSync('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex.substring(0, 16)
  }

  /**
   * Generates a version hash for a DID document
   */
  private generateVersionHash(didDocument: DIDDocument): string {
    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify(didDocument))
    const hashBuffer = crypto.subtle.digestSync('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex.substring(0, 12)
  }

  /**
   * Generates a public key for a user (placeholder - in production, this would use actual key derivation)
   */
  private generatePublicKey(userAddress: string): string {
    // For now, generate a deterministic key from the address
    // In production, this should use proper key derivation from a user's wallet
    const encoder = new TextEncoder()
    const data = encoder.encode(userAddress)
    const hashBuffer = crypto.subtle.digestSync('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    // Return as multibase (z prefix = base58btc)
    return 'z' + hashHex
  }

  /**
   * Lists all DIDs
   */
  listDIDs(): Array<{
    id: string
    did: string
    userAddress: string
    createdAt: number
    updatedAt: number
  }> {
    const rows = this.db
      .query(`SELECT id, did, user_address, created_at, updated_at FROM dids ORDER BY created_at DESC`)
      .all() as Array<{
        id: string
        did: string
        user_address: string
        created_at: number
        updated_at: number
      }>

    return rows.map(row => ({
      id: row.id,
      did: row.did,
      userAddress: row.user_address,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }
}
