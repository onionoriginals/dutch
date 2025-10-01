import { describe, it, expect, beforeAll } from 'bun:test'
import { createApp } from '../index'
import { SecureDutchyDatabase } from '@originals/dutch'

function jsonRequest(url: string, method: string, body?: unknown): Request {
	return new Request(url, {
		method,
		headers: { 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	})
}

describe('Clearing price auction API', () => {
	let app: ReturnType<typeof createApp>
	let db: SecureDutchyDatabase

	beforeAll(() => {
		db = new SecureDutchyDatabase(':memory:')
		app = createApp(db)
	})

	it('end-to-end: create auction -> place bids -> settlement calc -> mark settled', async () => {
		const auctionId = 'auc-e2e-1'
		// Create auction
		let res = await app.handle(
			jsonRequest('http://localhost/api/clearing/create-auction', 'POST', {
				auctionId,
				inscriptionIds: ['insc-a0', 'insc-a1', 'insc-a2'],
				quantity: 3,
				startPrice: 30000,
				minPrice: 10000,
				duration: 3600,
				decrementInterval: 600,
				sellerAddress: 'tb1p_seller',
			}),
		)
		let json: any = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.success).toBe(true)
		expect(json.data.auctionDetails?.id).toBe(auctionId)

		// Place bids until sold
		res = await app.handle(
			jsonRequest('http://localhost/api/clearing/place-bid', 'POST', {
				auctionId,
				bidderAddress: 'tb1p_bidder_1',
				quantity: 1,
			}),
		)
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.success).toBe(true)
		expect(json.data.itemsRemaining).toBe(2)

		res = await app.handle(
			jsonRequest('http://localhost/api/clearing/place-bid', 'POST', {
				auctionId,
				bidderAddress: 'tb1p_bidder_2',
				quantity: 1,
			}),
		)
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.success).toBe(true)
		expect(json.data.itemsRemaining).toBe(1)

		res = await app.handle(
			jsonRequest('http://localhost/api/clearing/place-bid', 'POST', {
				auctionId,
				bidderAddress: 'tb1p_bidder_3',
				quantity: 1,
			}),
		)
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.success).toBe(true)
		expect(json.data.auctionStatus).toBe('sold')

		// Status
		res = await app.handle(new Request(`http://localhost/api/clearing/status/${auctionId}`))
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.auction.status).toBe('sold')
		expect(json.data.progress.itemsRemaining).toBe(0)

		// Settlement calc (no confirmed payments yet -> allocations empty, but clearingPrice computed)
		res = await app.handle(new Request(`http://localhost/api/clearing/settlement/${auctionId}`))
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(typeof json.data.clearingPrice).toBe('number')
		expect(json.data.clearingPrice).toBeGreaterThanOrEqual(10000)
		expect(Array.isArray(json.data.allocations)).toBe(true)

		// Mark bids as settled
		res = await app.handle(new Request(`http://localhost/api/clearing/bids/${auctionId}`))
		const bidsResp: any = await res.json()
		expect(bidsResp.ok).toBe(true)
		expect(Array.isArray(bidsResp.data.bids)).toBe(true)
		expect(bidsResp.data.bids.length).toBe(3)

		res = await app.handle(
			jsonRequest('http://localhost/api/clearing/mark-settled', 'POST', {
				auctionId,
				bidIds: bidsResp.data.bids.map((b: any) => b.id),
			}),
		)
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.success).toBe(true)
		expect(json.data.updated).toBe(3)
	})

	it('payment subflow: create bid payment -> confirm -> process settlement', async () => {
		const auctionId = 'auc-pay-1'
		// Create auction
		let res = await app.handle(
			jsonRequest('http://localhost/clearing/create-auction', 'POST', {
				auctionId,
				inscriptionIds: ['insc-p0', 'insc-p1'],
				quantity: 2,
				startPrice: 20000,
				minPrice: 5000,
				duration: 1800,
				decrementInterval: 300,
				sellerAddress: 'tb1p_seller_2',
			}),
		)
		let json: any = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.success).toBe(true)

		// Create bid payment
		res = await app.handle(
			jsonRequest('http://localhost/api/clearing/create-bid-payment', 'POST', {
				auctionId,
				bidderAddress: 'tb1p_buyer_x',
				bidAmount: 21000,
				quantity: 1,
			}),
		)
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(typeof json.data.escrowAddress).toBe('string')
		expect(json.data.escrowAddress.startsWith('tb1q')).toBe(true)
		expect(typeof json.data.bidId).toBe('string')

		const bidId = json.data.bidId as string

		// Confirm payment
		res = await app.handle(
			jsonRequest('http://localhost/api/clearing/confirm-bid-payment', 'POST', {
				bidId,
				transactionId: 'tx_mock_123',
			}),
		)
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.success).toBe(true)

		// Bid payment status
		res = await app.handle(new Request(`http://localhost/api/clearing/bid-payment-status/${bidId}`))
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.status).toBe('payment_confirmed')

		// Process settlement -> PSBTs generated (new multi-step workflow)
		res = await app.handle(
			jsonRequest('http://localhost/api/clearing/process-settlement', 'POST', {
				auctionId,
			}),
		)
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.auctionId).toBe(auctionId)
		expect(json.data.clearingPrice).toBeGreaterThan(0)
		expect(Array.isArray(json.data.psbts)).toBe(true)
		expect(json.data.psbts.length).toBeGreaterThanOrEqual(1)
		
		// Verify PSBT structure
		expect(json.data.psbts[0].bidId).toBeDefined()
		expect(json.data.psbts[0].inscriptionId).toBeDefined()
		expect(json.data.psbts[0].toAddress).toBeDefined()
		expect(json.data.psbts[0].psbt).toBeDefined()

		// Mark bids as settled (simulating after signing & broadcasting)
		res = await app.handle(
			jsonRequest('http://localhost/api/clearing/mark-settled', 'POST', {
				auctionId,
				bidIds: [bidId],
			}),
		)
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(json.data.success).toBe(true)
		expect(json.data.updated).toBe(1)

		// Auction payments listing - verify bids are now settled
		res = await app.handle(new Request(`http://localhost/api/clearing/auction-payments/${auctionId}`))
		json = await res.json()
		expect(json.ok).toBe(true)
		expect(Array.isArray(json.data.bids)).toBe(true)
		expect(json.data.bids.find((b: any) => b.id === bidId)?.status).toBe('settled')
	})
})

