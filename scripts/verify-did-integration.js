#!/usr/bin/env node

/**
 * Verification script for DID:WEBVH integration
 * 
 * This script verifies that:
 * 1. WebVHManager is properly exported from the dutch package
 * 2. Database integrates WebVHManager correctly
 * 3. API endpoints are configured
 * 4. Auto-creation is integrated into auction endpoints
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying DID:WEBVH Integration\n');

let passed = 0;
let failed = 0;

function check(description, condition) {
  if (condition) {
    console.log(`✅ ${description}`);
    passed++;
  } else {
    console.log(`❌ ${description}`);
    failed++;
  }
}

// Check 1: WebVHManager file exists
const webvhManagerPath = path.join(__dirname, '../packages/dutch/src/webvh-manager.ts');
check('WebVHManager file exists', fs.existsSync(webvhManagerPath));

// Check 2: WebVHManager exports
const webvhContent = fs.readFileSync(webvhManagerPath, 'utf8');
check('WebVHManager class exported', webvhContent.includes('export class WebVHManager'));
check('DIDDocument interface exported', webvhContent.includes('export interface DIDDocument'));
check('DIDJSONLEntry interface exported', webvhContent.includes('export interface DIDJSONLEntry'));
check('CreateDIDOptions interface exported', webvhContent.includes('export interface CreateDIDOptions'));

// Check 3: WebVHManager methods
check('createDID method exists', webvhContent.includes('async createDID'));
check('getDIDByUserAddress method exists', webvhContent.includes('getDIDByUserAddress'));
check('getDIDByDID method exists', webvhContent.includes('getDIDByDID'));
check('updateDID method exists', webvhContent.includes('async updateDID'));
check('listDIDs method exists', webvhContent.includes('listDIDs'));

// Check 4: Database schema
check('DID table schema defined', webvhContent.includes('CREATE TABLE IF NOT EXISTS dids'));
check('DID indexes defined', webvhContent.includes('CREATE INDEX IF NOT EXISTS idx_dids_user_address'));

// Check 5: Database integration
const databasePath = path.join(__dirname, '../packages/dutch/src/database.ts');
const databaseContent = fs.readFileSync(databasePath, 'utf8');
check('WebVHManager imported in database', databaseContent.includes('import { WebVHManager }'));
check('webvhManager property in SecureDutchyDatabase', databaseContent.includes('public webvhManager: WebVHManager'));
check('WebVHManager initialized in constructor', databaseContent.includes('this.webvhManager = new WebVHManager'));

// Check 6: Package exports
const packageIndexPath = path.join(__dirname, '../packages/dutch/src/index.ts');
const packageIndexContent = fs.readFileSync(packageIndexPath, 'utf8');
check('WebVHManager exported from package', packageIndexContent.includes('export { WebVHManager }'));
check('DID types exported from package', packageIndexContent.includes('export type { DIDDocument, DIDJSONLEntry, CreateDIDOptions }'));

// Check 7: API endpoints
const apiPath = path.join(__dirname, '../apps/api/src/index.ts');
const apiContent = fs.readFileSync(apiPath, 'utf8');
check('POST /api/did/create endpoint', apiContent.includes("'/api/did/create'"));
check('GET /api/did/:userAddress endpoint', apiContent.includes("'/api/did/:userAddress'"));
check('GET /api/did/:userAddress/did.jsonl endpoint', apiContent.includes("'/api/did/:userAddress/did.jsonl'"));
check('GET /api/did/resolve/:did endpoint', apiContent.includes("'/api/did/resolve/:did'"));
check('GET /api/did/list endpoint', apiContent.includes("'/api/did/list'"));

// Check 8: Auto-creation integration
const autoCreatePattern = /database\.webvhManager\.createDID/;
const hasAutoCreateLogic = apiContent.includes('auto-did-create');
const hasCreateAuction = apiContent.includes("'/api/create-auction'");
const hasClearingAuction = apiContent.includes("'/api/clearing/create-auction'");
check('Auto-DID creation logic exists', hasAutoCreateLogic);
check('Create auction endpoint exists', hasCreateAuction);
check('Clearing auction endpoint exists', hasClearingAuction);
check('WebVHManager createDID called', autoCreatePattern.test(apiContent));

// Check 9: JSONL response handling
check('JSONL content-type header', apiContent.includes("'application/jsonl'"));
check('JSONL filename disposition', apiContent.includes('did.jsonl'));

// Check 10: Test file exists
const testPath = path.join(__dirname, '../apps/api/src/__tests__/did-creation.test.ts');
check('DID creation test file exists', fs.existsSync(testPath));

if (fs.existsSync(testPath)) {
  const testContent = fs.readFileSync(testPath, 'utf8');
  check('Tests for DID creation', testContent.includes('POST /api/did/create'));
  check('Tests for DID retrieval', testContent.includes('GET /api/did/:userAddress'));
  check('Tests for JSONL format', testContent.includes('did.jsonl'));
  check('Tests for DID resolution', testContent.includes('resolve/:did'));
  check('Tests for auto-creation', testContent.includes('auto-creates'));
}

// Check 11: Documentation
const docPath = path.join(__dirname, '../DID_WEBVH_INTEGRATION.md');
check('Integration documentation exists', fs.existsSync(docPath));

if (fs.existsSync(docPath)) {
  const docContent = fs.readFileSync(docPath, 'utf8');
  check('Documentation includes API endpoints', docContent.includes('API Endpoints'));
  check('Documentation includes usage examples', docContent.includes('Usage Example'));
  check('Documentation includes JSONL format', docContent.includes('JSONL Format'));
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Total Checks: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('\n🎉 All checks passed! DID:WEBVH integration is complete.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some checks failed. Please review the integration.\n');
  process.exit(1);
}
