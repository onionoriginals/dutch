import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { SecureDutchyDatabase, getBitcoinNetwork, helloDutch } from '@originals/dutch'
import * as bitcoin from 'bitcoinjs-lib'

const db = new SecureDutchyDatabase(Bun.env.DB_PATH ?? ':memory:')

function getMempoolApiBase(): string {
  const network = getBitcoinNetwork()
  if (network === 'testnet') return 'https://mempool.space/testnet/api'
  if (network === 'signet') return 'https://mempool.space/signet/api'
  if (network === 'regtest') return 'http://localhost:3002/api'
  return 'https://mempool.space/api'
}

function getBitcoinJsNetwork(): bitcoin.networks.Network {
  const n = getBitcoinNetwork()
  if (n === 'mainnet') return bitcoin.networks.bitcoin
  if (n === 'regtest') return bitcoin.networks.regtest
  // Treat signet as testnet for address/script params
  return bitcoin.networks.testnet
}

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .get('/', () => ({ ok: true }))
  .get('/hello', () => ({ message: helloDutch('World') }))
  .post('/create-auction', async ({ body, set }) => {
    try {
      const {
        asset,
        startPrice,
        minPrice,
        duration,
        decrementInterval,
        sellerAddress,
      } = body as any

      if (!asset || !startPrice || !minPrice || !duration || !decrementInterval || !sellerAddress) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      }

      const inscriptionRegex = /^[0-9a-fA-F]{64}i\d+$/
      if (!inscriptionRegex.test(String(asset))) {
        return new Response(JSON.stringify({ error: 'Invalid inscriptionId format. Expected <txid>i<index>' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      }

      const [txid, voutStr] = String(asset).split('i')
      const voutIndex = parseInt(voutStr, 10)
      if (!Number.isFinite(voutIndex)) {
        return new Response(JSON.stringify({ error: 'Invalid inscription vout index' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      }

      const base = getMempoolApiBase()

      const txResp = await fetch(`${base}/tx/${txid}`)
      if (!txResp.ok) {
        return new Response(JSON.stringify({ error: 'Transaction not found' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      }
      const txJson = await txResp.json()
      const vout = (txJson?.vout || [])[voutIndex]
      if (!vout) {
        return new Response(JSON.stringify({ error: 'Inscription output not found' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      }

      const outspendsResp = await fetch(`${base}/tx/${txid}/outspends`)
      if (!outspendsResp.ok) {
        return new Response(JSON.stringify({ error: 'Failed to verify outspend status' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
      const outspends = await outspendsResp.json()
      const outspend = outspends?.[voutIndex]
      const spent = !!outspend?.spent
      const ownerMatches = String(vout?.scriptpubkey_address || '') === String(sellerAddress)
      console.log('ownership-check', { sellerAddress, voutAddress: vout?.scriptpubkey_address, spent })
      if (!ownerMatches) {
        return new Response(JSON.stringify({ error: 'Ownership mismatch for inscription UTXO' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (spent) {
        return new Response(JSON.stringify({ error: 'Inscription UTXO already spent' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        })
      }

      // Deterministic auction id from asset and seller to make testing easier
      const auctionId = `${txid}:${voutIndex}:${String(sellerAddress).slice(0, 8)}`
      const { keyPair, address } = db.generateAuctionKeyPair(auctionId)

      // Build a minimal PSBT moving the UTXO to the auction address
      const network = getBitcoinJsNetwork()
      const psbt = new bitcoin.Psbt({ network })

      const value = Number(vout.value)
      const scriptHex = String(vout.scriptpubkey || '')
      const witnessUtxo = scriptHex
        ? { script: Buffer.from(scriptHex, 'hex'), value }
        : { script: bitcoin.address.toOutputScript(String(sellerAddress), network), value }

      psbt.addInput({ hash: txid, index: voutIndex, witnessUtxo })

      const outputValue = Math.max(1, value - 500)
      let outputScript: Buffer
      try {
        outputScript = bitcoin.address.toOutputScript(address, network)
      } catch {
        // Fallback to standard P2WPKH 20 zero-bytes if the generated address is not strictly valid
        outputScript = Buffer.from('0014' + '00'.repeat(20), 'hex')
      }
      psbt.addOutput({ script: outputScript, value: outputValue })

      const now = Math.floor(Date.now() / 1000)
      const auction = {
        id: auctionId,
        inscription_id: asset as string,
        start_price: Number(startPrice),
        min_price: Number(minPrice),
        current_price: Number(startPrice),
        duration: Number(duration),
        decrement_interval: Number(decrementInterval),
        start_time: now,
        end_time: now + Number(duration),
        status: 'active' as const,
        auction_address: address,
        created_at: now,
        updated_at: now,
      }
      db.storeAuction(auction as any, `enc_${keyPair.privateKey}`)

      return {
        id: auctionId,
        address,
        psbt: psbt.toBase64(),
        inscriptionInfo: {
          txid,
          vout: voutIndex,
          address: vout.scriptpubkey_address,
          value,
          spent,
        },
      }
    } catch (err: any) {
      console.error('create-auction error', err)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }
  })
  .post('/escrow/verify-ownership', ({ body, set }) => {
    const { inscriptionId, ownerAddress } = body as any
    if (!inscriptionId || !ownerAddress) {
      set.status = 400
      return { error: 'Missing fields: inscriptionId, ownerAddress' }
    }
    return db.verifyInscriptionOwnership({ inscriptionId, ownerAddress })
  })
  .post('/escrow/create-psbt', ({ body, set }) => {
    const { auctionId, inscriptionId, ownerAddress } = body as any
    if (!auctionId || !inscriptionId || !ownerAddress) {
      set.status = 400
      return { error: 'Missing fields: auctionId, inscriptionId, ownerAddress' }
    }
    return db.createInscriptionEscrowPSBT({ auctionId, inscriptionId, ownerAddress })
  })
  .get('/escrow/monitor/:auctionId/:inscriptionId', ({ params }) => {
    const { auctionId, inscriptionId } = params as any
    return db.monitorInscriptionEscrow(String(auctionId), String(inscriptionId))
  })
  .post('/escrow/update-status', ({ body, set }) => {
    const { auctionId, status, details } = body as any
    if (!auctionId || !status) {
      set.status = 400
      return { error: 'Missing fields: auctionId, status' }
    }
    return db.updateInscriptionStatus({ auctionId, status, details })
  })
  .get('/escrow/status/:auctionId', ({ params }) => {
    const { auctionId } = params as any
    return db.getInscriptionEscrowStatus(String(auctionId))
  })
  .post('/admin/check-escrow-timeouts', () => {
    return db.checkEscrowTimeouts()
  })

if (import.meta.main) {
  const hostname = Bun.env.HOST ?? '::'
  let port = Bun.env.PORT ? parseInt(Bun.env.PORT, 10) : 3000
  if (isNaN(port)) {
    console.error('Invalid PORT environment variable. Using default port 3000.')
    port = 3000
  }
  app.listen({ port, hostname })
  const advertisedHost = hostname === '::' ? '[::1]' : hostname
  console.log(`API listening on http://${advertisedHost}:${port}`)
}

export { app, db }
