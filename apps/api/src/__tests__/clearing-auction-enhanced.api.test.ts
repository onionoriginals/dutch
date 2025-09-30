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

describe('Enhanced clearing auction API workflows', () => {
	let app: ReturnType<typeof createApp>
	let db: SecureDutchyDatabase

	beforeAll(() => {
		process.env.BITCOIN_NETWORK = 'testnet'
		db = new SecureDutchyDatabase(':memory:')
		app = createApp(db)
	})

	describe('Validation error handling', () => {
		it('returns 400 for invalid quantity in place-bid', async () => {
			const auctionId = 'api-invalid-qty-1'
			
			// Create auction first
			await app.handle(
				jsonRequest('http://localhost/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-api-0', 'insc-api-1'],
					quantity: 2,
					startPrice: 20000,
					minPrice: 10000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pseller',
				}),
			)

			// Try to place bid with 0 quantity
			const res = await app.handle(
				jsonRequest('http://localhost/clearing/place-bid', 'POST', {
					auctionId,
					bidderAddress: 'tb1qbidder',
					quantity: 0,
				}),
			)

			expect(res.status).toBe(400)
			const json: any = await res.json()
			expect(json.error).toContain('must be greater than zero')
		})

		it('returns 400 for quantity exceeding available items', async () => {
			const auctionId = 'api-exceed-qty-1'
			
			await app.handle(
				jsonRequest('http://localhost/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-exceed-0'],
					quantity: 1,
					startPrice: 15000,
					minPrice: 8000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pseller2',
				}),
			)

			const res = await app.handle(
				jsonRequest('http://localhost/clearing/place-bid', 'POST', {
					auctionId,
					bidderAddress: 'tb1qbidder2',
					quantity: 5,
				}),
			)

			expect(res.status).toBe(400)
			const json: any = await res.json()
			expect(json.error).toContain('Insufficient items available')
		})

		it('returns 400 for invalid address format', async () => {
			const auctionId = 'api-invalid-addr-1'
			
			await app.handle(
				jsonRequest('http://localhost/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-addr-0'],
					quantity: 1,
					startPrice: 15000,
					minPrice: 8000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pseller3',
				}),
			)

			const res = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'bc1qmainnetaddress', // Mainnet on testnet
					bidAmount: 14000,
					quantity: 1,
				}),
			)

			expect(res.status).toBe(400)
			const json: any = await res.json()
			expect(json.error).toContain('Invalid')
		})
	})

	describe('State transition validation', () => {
		it('returns 400 when confirming payment for non-payment_pending bid', async () => {
			const auctionId = 'api-state-1'
			
			await app.handle(
				jsonRequest('http://localhost/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-state-0'],
					quantity: 1,
					startPrice: 12000,
					minPrice: 6000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pstate',
				}),
			)

			const bidRes = await app.handle(
				jsonRequest('http://localhost/clearing/place-bid', 'POST', {
					auctionId,
					bidderAddress: 'tb1qstatebidder',
					quantity: 1,
				}),
			)
			const bidJson: any = await bidRes.json()
			const bidId = bidJson.bidId

			// Try to confirm payment for a 'placed' bid
			const confirmRes = await app.handle(
				jsonRequest('http://localhost/clearing/confirm-bid-payment', 'POST', {
					bidId,
					transactionId: 'tx_invalid',
				}),
			)

			expect(confirmRes.status).toBe(400)
			const json: any = await confirmRes.json()
			expect(json.error).toContain('Cannot confirm payment')
		})

		it('returns 400 when settling without payment confirmation', async () => {
			const auctionId = 'api-settle-no-confirm-1'
			
			await app.handle(
				jsonRequest('http://localhost/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-settle-0'],
					quantity: 1,
					startPrice: 11000,
					minPrice: 5500,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1psettle',
				}),
			)

			const paymentRes = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qsettlebidder',
					bidAmount: 10500,
					quantity: 1,
				}),
			)
			const paymentJson: any = await paymentRes.json()

			// Try to settle without confirming payment
			const settleRes = await app.handle(
				jsonRequest('http://localhost/clearing/process-settlement', 'POST', {
					auctionId,
				}),
			)

			expect(settleRes.status).toBe(400)
			const json: any = await settleRes.json()
			expect(json.error).toContain('Payment must be confirmed first')
		})
	})

	describe('Idempotency', () => {
		it('allows duplicate payment confirmations with same txId', async () => {
			const auctionId = 'api-idempotent-1'
			
			await app.handle(
				jsonRequest('http://localhost/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-idem-0'],
					quantity: 1,
					startPrice: 13000,
					minPrice: 6500,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pidem',
				}),
			)

			const paymentRes = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qidembidder',
					bidAmount: 12500,
					quantity: 1,
				}),
			)
			const paymentJson: any = await paymentRes.json()
			const bidId = paymentJson.bidId

			// Confirm payment twice with same txId
			const confirm1 = await app.handle(
				jsonRequest('http://localhost/clearing/confirm-bid-payment', 'POST', {
					bidId,
					transactionId: 'tx_same_payment',
				}),
			)
			const confirm2 = await app.handle(
				jsonRequest('http://localhost/clearing/confirm-bid-payment', 'POST', {
					bidId,
					transactionId: 'tx_same_payment',
				}),
			)

			expect(confirm1.status).toBe(200)
			expect(confirm2.status).toBe(200)
			
			const json1: any = await confirm1.json()
			const json2: any = await confirm2.json()
			
			expect(json1.success).toBe(true)
			expect(json2.success).toBe(true)
			expect(json2.alreadyConfirmed).toBe(true)
		})

		it('handles marking settled bids multiple times', async () => {
			const auctionId = 'api-settle-idem-1'
			
			await app.handle(
				jsonRequest('http://localhost/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-settle-idem-0'],
					quantity: 1,
					startPrice: 14000,
					minPrice: 7000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1psettleidem',
				}),
			)

			const paymentRes = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qsettleidembidder',
					bidAmount: 13500,
					quantity: 1,
				}),
			)
			const paymentJson: any = await paymentRes.json()

			await app.handle(
				jsonRequest('http://localhost/clearing/confirm-bid-payment', 'POST', {
					bidId: paymentJson.bidId,
					transactionId: 'tx_settle_idem',
				}),
			)

			// Mark as settled twice
			const settle1 = await app.handle(
				jsonRequest('http://localhost/clearing/mark-settled', 'POST', {
					auctionId,
					bidIds: [paymentJson.bidId],
				}),
			)
			const settle2 = await app.handle(
				jsonRequest('http://localhost/clearing/mark-settled', 'POST', {
					auctionId,
					bidIds: [paymentJson.bidId],
				}),
			)

			expect(settle1.status).toBe(200)
			expect(settle2.status).toBe(200)
			
			const json1: any = await settle1.json()
			const json2: any = await settle2.json()
			
			expect(json1.success).toBe(true)
			expect(json1.updated).toBe(1)
			expect(json2.success).toBe(true)
			expect(json2.updated).toBe(1)
		})
	})

	describe('Full lifecycle E2E', () => {
		it('completes full workflow with status queries at each step', async () => {
			const auctionId = 'api-e2e-full-1'
			
			// Step 1: Create auction
			let res = await app.handle(
				jsonRequest('http://localhost/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-e2e-0', 'insc-e2e-1', 'insc-e2e-2'],
					quantity: 3,
					startPrice: 30000,
					minPrice: 10000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pe2eseller',
				}),
			)
			let json: any = await res.json()
			expect(json.success).toBe(true)

			// Step 2: Query auction status
			res = await app.handle(new Request(`http://localhost/clearing/status/${auctionId}`))
			json = await res.json()
			expect(json.auction.status).toBe('active')
			expect(json.progress.itemsRemaining).toBe(3)

			// Step 3: Create bid payments
			const bid1Res = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qe2ebuyer1',
					bidAmount: 28000,
					quantity: 1,
				}),
			)
			const bid1Json: any = await bid1Res.json()
			expect(bid1Json.escrowAddress).toContain('tb1q')

			const bid2Res = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qe2ebuyer2',
					bidAmount: 27000,
					quantity: 1,
				}),
			)
			const bid2Json: any = await bid2Res.json()

			const bid3Res = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qe2ebuyer3',
					bidAmount: 26000,
					quantity: 1,
				}),
			)
			const bid3Json: any = await bid3Res.json()

			// Step 4: Query bid payment statuses
			res = await app.handle(new Request(`http://localhost/clearing/bid-payment-status/${bid1Json.bidId}`))
			json = await res.json()
			expect(json.status).toBe('payment_pending')

			// Step 5: Confirm payments
			await app.handle(
				jsonRequest('http://localhost/clearing/confirm-bid-payment', 'POST', {
					bidId: bid1Json.bidId,
					transactionId: 'tx_e2e_buyer1',
				}),
			)
			await app.handle(
				jsonRequest('http://localhost/clearing/confirm-bid-payment', 'POST', {
					bidId: bid2Json.bidId,
					transactionId: 'tx_e2e_buyer2',
				}),
			)
			await app.handle(
				jsonRequest('http://localhost/clearing/confirm-bid-payment', 'POST', {
					bidId: bid3Json.bidId,
					transactionId: 'tx_e2e_buyer3',
				}),
			)

			// Step 6: Verify payment confirmed
			res = await app.handle(new Request(`http://localhost/clearing/bid-payment-status/${bid1Json.bidId}`))
			json = await res.json()
			expect(json.status).toBe('payment_confirmed')

			// Step 7: Query settlement calculation
			res = await app.handle(new Request(`http://localhost/clearing/settlement/${auctionId}`))
			json = await res.json()
			expect(json.clearingPrice).toBeGreaterThanOrEqual(10000)
			expect(json.allocations.length).toBe(3)

			// Step 8: Process settlement
			res = await app.handle(
				jsonRequest('http://localhost/clearing/process-settlement', 'POST', {
					auctionId,
				}),
			)
			json = await res.json()
			expect(json.success).toBe(true)
			expect(json.artifacts.length).toBe(3)
			expect(json.artifacts[0].toAddress).toBe('tb1qe2ebuyer1')
			expect(json.artifacts[0].inscriptionId).toBe('insc-e2e-0')

			// Step 9: Query final bid statuses
			res = await app.handle(new Request(`http://localhost/clearing/auction-payments/${auctionId}`))
			json = await res.json()
			expect(json.bids.length).toBe(3)
			expect(json.bids.every((b: any) => b.status === 'settled')).toBe(true)
		})

		it('handles partial fills with mixed payment statuses', async () => {
			const auctionId = 'api-e2e-partial-1'
			
			// Create auction
			await app.handle(
				jsonRequest('http://localhost/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-partial-0', 'insc-partial-1', 'insc-partial-2'],
					quantity: 3,
					startPrice: 25000,
					minPrice: 12000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1ppartialseller',
				}),
			)

			// Create 3 bids but only confirm 2
			const bid1Res = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qpartialbuyer1',
					bidAmount: 24000,
					quantity: 1,
				}),
			)
			const bid1Json: any = await bid1Res.json()

			const bid2Res = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qpartialbuyer2',
					bidAmount: 23000,
					quantity: 1,
				}),
			)
			const bid2Json: any = await bid2Res.json()

			const bid3Res = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qpartialbuyer3',
					bidAmount: 22000,
					quantity: 1,
				}),
			)
			const bid3Json: any = await bid3Res.json()

			// Only confirm first 2 payments
			await app.handle(
				jsonRequest('http://localhost/clearing/confirm-bid-payment', 'POST', {
					bidId: bid1Json.bidId,
					transactionId: 'tx_partial1',
				}),
			)
			await app.handle(
				jsonRequest('http://localhost/clearing/confirm-bid-payment', 'POST', {
					bidId: bid2Json.bidId,
					transactionId: 'tx_partial2',
				}),
			)

			// Settlement should only include confirmed bids
			const settlementRes = await app.handle(new Request(`http://localhost/clearing/settlement/${auctionId}`))
			const settlement: any = await settlementRes.json()
			expect(settlement.allocations.length).toBe(2)

			// Process settlement
			const processRes = await app.handle(
				jsonRequest('http://localhost/clearing/process-settlement', 'POST', {
					auctionId,
				}),
			)
			const process: any = await processRes.json()
			expect(process.success).toBe(true)
			expect(process.artifacts.length).toBe(2)
		})

		it('returns 207 Multi-Status when marking bids with some failures', async () => {
			const auctionId = 'api-e2e-multistatus-1'
			
			await app.handle(
				jsonRequest('http://localhost/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-multi-0', 'insc-multi-1'],
					quantity: 2,
					startPrice: 18000,
					minPrice: 9000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pmultiseller',
				}),
			)

			// Create one confirmed and one unconfirmed bid
			const bid1Res = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qmultibuyer1',
					bidAmount: 17000,
					quantity: 1,
				}),
			)
			const bid1Json: any = await bid1Res.json()

			const bid2Res = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qmultibuyer2',
					bidAmount: 16000,
					quantity: 1,
				}),
			)
			const bid2Json: any = await bid2Res.json()

			// Only confirm first bid
			await app.handle(
				jsonRequest('http://localhost/clearing/confirm-bid-payment', 'POST', {
					bidId: bid1Json.bidId,
					transactionId: 'tx_multi1',
				}),
			)

			// Try to mark both as settled
			const res = await app.handle(
				jsonRequest('http://localhost/clearing/mark-settled', 'POST', {
					auctionId,
					bidIds: [bid1Json.bidId, bid2Json.bidId],
				}),
			)

			expect(res.status).toBe(207) // Multi-Status
			const json: any = await res.json()
			expect(json.success).toBe(true)
			expect(json.updated).toBe(1)
			expect(json.errors).toBeDefined()
			expect(json.errors.length).toBe(1)
			expect(json.errors[0].bidId).toBe(bid2Json.bidId)
			expect(json.errors[0].error).toContain('Payment must be confirmed first')
		})
	})

	describe('Error codes and messages', () => {
		it('returns consistent error structures', async () => {
			// Test various error scenarios and verify error format
			
			// 404 for non-existent auction
			const res404 = await app.handle(new Request('http://localhost/clearing/status/non-existent'))
			expect(res404.status).toBe(404)
			const json404: any = await res404.json()
			expect(json404.error).toBeDefined()

			// 400 for missing required fields
			const res400 = await app.handle(
				jsonRequest('http://localhost/clearing/create-bid-payment', 'POST', {
					auctionId: 'test',
					// Missing bidderAddress and bidAmount
				}),
			)
			expect(res400.status).toBe(400)
			const json400: any = await res400.json()
			expect(json400.error).toBeDefined()
		})
	})
});