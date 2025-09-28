import { describe, it, expect, beforeAll } from 'bun:test';
import { SecureDutchyDatabase } from '../database';

describe('Encryption and Seed management', () => {
  let db: SecureDutchyDatabase;

  beforeAll(() => {
    process.env.BITCOIN_NETWORK = 'testnet';
    db = new SecureDutchyDatabase(':memory:');
  });

  it('encrypts and decrypts text round-trip', async () => {
    const secret = 'sensitive-data-123';
    const pw = 'strong-password';
    const enc = await db.encryptUtf8(secret, pw);
    const dec = await db.decryptToUtf8(enc, pw);
    expect(dec).toBe(secret);
  });

  it('creates/imports/rotates master mnemonic', async () => {
    const pw1 = 'pw1';
    const m1 = await db.getOrCreateMasterMnemonic(pw1);
    expect(m1.split(' ').length).toBeGreaterThan(11);

    const db2 = new SecureDutchyDatabase(':memory:');
    await db2.importMasterMnemonic(m1, pw1);
    const m2 = await db2.getOrCreateMasterMnemonic(pw1);
    expect(m2).toBe(m1);

    await db2.rotateMasterMnemonic('pw2', 'pw1');
    const m3 = await db2.getOrCreateMasterMnemonic('pw2');
    expect(m3).toBe(m1);
    db2.close();
  });

  it('rejects invalid mnemonic on import', async () => {
    const db3 = new SecureDutchyDatabase(':memory:');
    let threw = false;
    try {
      await db3.importMasterMnemonic('not-a-valid-mnemonic', 'pw');
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    db3.close();
  });
});

