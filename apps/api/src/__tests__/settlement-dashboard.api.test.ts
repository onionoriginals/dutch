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

describe('Settlement Dashboard API Workflow', () => {
	let app: ReturnType<typeof createApp>
	let db: SecureDutchyDatabase

	beforeAll(() => {
		process.env.BITCOIN_NETWORK = 'testnet'
		db = new SecureDutchyDatabase(':memory:')
		app = createApp(db)
	})

	describe('Complete settlement workflow', () => {
		it('creates auction, places bids, confirms payments, and processes settlement with PSBTs', async () => {
			const auctionId = 'settlement-test-1'
			
			// Step 1: Create clearing auction
			const createRes = await app.handle(
				jsonRequest('http://localhost/api/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-settle-0', 'insc-settle-1', 'insc-settle-2'],
					quantity: 3,
					startPrice: 30000,
					minPrice: 10000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pseller_settlement',
				}),
			)
			expect(createRes.status).toBe(200)
			const createJson: any = await createRes.json()
			expect(createJson.ok).toBe(true)
			expect(createJson.data.success).toBe(true)

			// Step 2: Create bid payment PSBTs for multiple bidders
			const bidder1 = 'tb1qbidder1settlement'
			const bidder2 = 'tb1qbidder2settlement'
			
			const payment1Res = await app.handle(
				jsonRequest('http://localhost/api/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: bidder1,
					bidAmount: 25000,
					quantity: 2,
				}),
			)
			expect(payment1Res.status).toBe(200)
			const payment1Json: any = await payment1Res.json()
			expect(payment1Json.ok).toBe(true)
			const bid1Id = payment1Json.data.bidId

			const payment2Res = await app.handle(
				jsonRequest('http://localhost/api/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: bidder2,
					bidAmount: 20000,
					quantity: 1,
				}),
			)
			expect(payment2Res.status).toBe(200)
			const payment2Json: any = await payment2Res.json()
			expect(payment2Json.ok).toBe(true)
			const bid2Id = payment2Json.data.bidId

			// Step 3: Confirm bid payments
			await app.handle(
				jsonRequest('http://localhost/api/clearing/confirm-bid-payment', 'POST', {
					bidId: bid1Id,
					transactionId: 'tx_payment_1',
				}),
			)
			
			await app.handle(
				jsonRequest('http://localhost/api/clearing/confirm-bid-payment', 'POST', {
					bidId: bid2Id,
					transactionId: 'tx_payment_2',
				}),
			)

			// Step 4: Get all bids for the auction
			const bidsRes = await app.handle(
				new Request(`http://localhost/api/clearing/bids/${auctionId}`),
			)
			expect(bidsRes.status).toBe(200)
			const bidsJson: any = await bidsRes.json()
			expect(bidsJson.ok).toBe(true)
			expect(bidsJson.data.bids).toHaveLength(2)
			expect(bidsJson.data.bids[0].status).toBe('payment_confirmed')
			expect(bidsJson.data.bids[1].status).toBe('payment_confirmed')

			// Step 5: Calculate settlement
			const settlementRes = await app.handle(
				new Request(`http://localhost/api/clearing/settlement/${auctionId}`),
			)
			expect(settlementRes.status).toBe(200)
			const settlementJson: any = await settlementRes.json()
			expect(settlementJson.ok).toBe(true)
			expect(settlementJson.data.auctionId).toBe(auctionId)
			expect(settlementJson.data.clearingPrice).toBeGreaterThan(0)
			expect(settlementJson.data.allocations).toHaveLength(2)
			expect(settlementJson.data.totalQuantity).toBe(3)

			// Step 6: Process settlement to get PSBTs
			const processRes = await app.handle(
				jsonRequest('http://localhost/api/clearing/process-settlement', 'POST', {
					auctionId,
				}),
			)
			expect(processRes.status).toBe(200)
			const processJson: any = await processRes.json()
			expect(processJson.ok).toBe(true)
			expect(processJson.data.psbts).toBeDefined()
			expect(processJson.data.psbts.length).toBeGreaterThan(0)
			
			// Verify PSBT structure
			const psbts = processJson.data.psbts
			for (const psbt of psbts) {
				expect(psbt.bidId).toBeDefined()
				expect(psbt.inscriptionId).toBeDefined()
				expect(psbt.toAddress).toBeDefined()
				expect(psbt.psbt).toBeDefined()
				expect(typeof psbt.psbt).toBe('string')
			}

			// Step 7: Mark bids as settled (simulating after broadcast)
			const markSettledRes = await app.handle(
				jsonRequest('http://localhost/api/clearing/mark-settled', 'POST', {
					auctionId,
					bidIds: [bid1Id, bid2Id],
				}),
			)
			expect(markSettledRes.status).toBe(200)
			const markSettledJson: any = await markSettledRes.json()
			expect(markSettledJson.ok).toBe(true)
			expect(markSettledJson.data.success).toBe(true)
			expect(markSettledJson.data.updated).toBe(2)

			// Step 8: Verify bids are now settled
			const finalBidsRes = await app.handle(
				new Request(`http://localhost/api/clearing/bids/${auctionId}`),
			)
			expect(finalBidsRes.status).toBe(200)
			const finalBidsJson: any = await finalBidsRes.json()
			expect(finalBidsJson.ok).toBe(true)
			expect(finalBidsJson.data.bids[0].status).toBe('settled')
			expect(finalBidsJson.data.bids[1].status).toBe('settled')
		})

		it('prevents settlement of bids without payment confirmation', async () => {
			const auctionId = 'settlement-test-no-payment'
			
			// Create auction
			await app.handle(
				jsonRequest('http://localhost/api/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-nopay-0', 'insc-nopay-1'],
					quantity: 2,
					startPrice: 20000,
					minPrice: 8000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pseller_nopay',
				}),
			)

			// Create bid payment but don't confirm it
			const paymentRes = await app.handle(
				jsonRequest('http://localhost/api/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qbidder_nopay',
					bidAmount: 15000,
					quantity: 1,
				}),
			)
			const paymentJson: any = await paymentRes.json()
			const bidId = paymentJson.data.bidId

			// Try to process settlement without payment confirmation
			const processRes = await app.handle(
				jsonRequest('http://localhost/api/clearing/process-settlement', 'POST', {
					auctionId,
				}),
			)
			expect(processRes.status).toBe(200)
			const processJson: any = await processRes.json()
			expect(processJson.ok).toBe(true)
			// Should return empty PSBTs array since no bids are payment_confirmed
			expect(processJson.data.psbts).toHaveLength(0)

			// Try to mark as settled (should fail)
			const markRes = await app.handle(
				jsonRequest('http://localhost/api/clearing/mark-settled', 'POST', {
					auctionId,
					bidIds: [bidId],
				}),
			)
			const markJson: any = await markRes.json()
			expect(markJson.ok).toBe(true)
			// Should have error for the bid
			expect(markJson.data.errors).toBeDefined()
			expect(markJson.data.errors.length).toBeGreaterThan(0)
			expect(markJson.data.errors[0].error).toContain('Payment must be confirmed')
		})

		it('handles idempotent settlement marking', async () => {
			const auctionId = 'settlement-test-idempotent'
			
			// Create auction and confirm a bid
			await app.handle(
				jsonRequest('http://localhost/api/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-idem-0'],
					quantity: 1,
					startPrice: 15000,
					minPrice: 5000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pseller_idem',
				}),
			)

			const paymentRes = await app.handle(
				jsonRequest('http://localhost/api/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qbidder_idem',
					bidAmount: 12000,
					quantity: 1,
				}),
			)
			const paymentJson: any = await paymentRes.json()
			const bidId = paymentJson.data.bidId

			await app.handle(
				jsonRequest('http://localhost/api/clearing/confirm-bid-payment', 'POST', {
					bidId,
					transactionId: 'tx_idem',
				}),
			)

			// Mark as settled first time
			const mark1Res = await app.handle(
				jsonRequest('http://localhost/api/clearing/mark-settled', 'POST', {
					auctionId,
					bidIds: [bidId],
				}),
			)
			const mark1Json: any = await mark1Res.json()
			expect(mark1Json.ok).toBe(true)
			expect(mark1Json.data.updated).toBe(1)

			// Mark as settled second time (idempotent)
			const mark2Res = await app.handle(
				jsonRequest('http://localhost/api/clearing/mark-settled', 'POST', {
					auctionId,
					bidIds: [bidId],
				}),
			)
			const mark2Json: any = await mark2Res.json()
			expect(mark2Json.ok).toBe(true)
			expect(mark2Json.data.updated).toBe(1) // Still counted as updated (idempotent)

			// Verify bid is still settled
			const bidsRes = await app.handle(
				new Request(`http://localhost/api/clearing/bids/${auctionId}`),
			)
			const bidsJson: any = await bidsRes.json()
			expect(bidsJson.data.bids[0].status).toBe('settled')
		})
	})

	describe('Partial settlement handling', () => {
		it('does not reuse settled inscriptions when generating PSBTs after partial settlement', async () => {
			const auctionId = 'partial-settlement-test'
			
			// Create auction with 5 inscriptions
			await app.handle(
				jsonRequest('http://localhost/api/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: ['insc-partial-0', 'insc-partial-1', 'insc-partial-2', 'insc-partial-3', 'insc-partial-4'],
					quantity: 5,
					startPrice: 50000,
					minPrice: 20000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pseller_partial',
				}),
			)

			// Create and confirm first bid (2 items)
			const payment1Res = await app.handle(
				jsonRequest('http://localhost/api/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qbidder1partial',
					bidAmount: 40000,
					quantity: 2,
				}),
			)
			const payment1Json: any = await payment1Res.json()
			const bid1Id = payment1Json.data.bidId

			await app.handle(
				jsonRequest('http://localhost/api/clearing/confirm-bid-payment', 'POST', {
					bidId: bid1Id,
					transactionId: 'tx_partial_1',
				}),
			)

			// Create and confirm second bid (3 items)
			const payment2Res = await app.handle(
				jsonRequest('http://localhost/api/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qbidder2partial',
					bidAmount: 35000,
					quantity: 3,
				}),
			)
			const payment2Json: any = await payment2Res.json()
			const bid2Id = payment2Json.data.bidId

			await app.handle(
				jsonRequest('http://localhost/api/clearing/confirm-bid-payment', 'POST', {
					bidId: bid2Id,
					transactionId: 'tx_partial_2',
				}),
			)

			// First settlement: Generate PSBTs for all bids
			const process1Res = await app.handle(
				jsonRequest('http://localhost/api/clearing/process-settlement', 'POST', {
					auctionId,
				}),
			)
			const process1Json: any = await process1Res.json()
			expect(process1Json.ok).toBe(true)
			expect(process1Json.data.psbts).toHaveLength(5) // 2 + 3 inscriptions

			// Verify first allocation gets insc-0 and insc-1
			const bid1Psbts = process1Json.data.psbts.filter((p: any) => p.bidId === bid1Id)
			expect(bid1Psbts).toHaveLength(2)
			expect(bid1Psbts[0].inscriptionId).toBe('insc-partial-0')
			expect(bid1Psbts[1].inscriptionId).toBe('insc-partial-1')

			// Verify second allocation gets insc-2, insc-3, insc-4
			const bid2Psbts = process1Json.data.psbts.filter((p: any) => p.bidId === bid2Id)
			expect(bid2Psbts).toHaveLength(3)
			expect(bid2Psbts[0].inscriptionId).toBe('insc-partial-2')
			expect(bid2Psbts[1].inscriptionId).toBe('insc-partial-3')
			expect(bid2Psbts[2].inscriptionId).toBe('insc-partial-4')

			// Settle ONLY the first bid
			await app.handle(
				jsonRequest('http://localhost/api/clearing/mark-settled', 'POST', {
					auctionId,
					bidIds: [bid1Id],
				}),
			)

			// Second settlement: Generate PSBTs again (should only include bid2's inscriptions)
			const process2Res = await app.handle(
				jsonRequest('http://localhost/api/clearing/process-settlement', 'POST', {
					auctionId,
				}),
			)
			const process2Json: any = await process2Res.json()
			expect(process2Json.ok).toBe(true)
			
			// CRITICAL: Should only have 3 PSBTs (for bid2), not 5
			expect(process2Json.data.psbts).toHaveLength(3)
			
			// CRITICAL: Should be for bid2 and use insc-2, insc-3, insc-4 (NOT insc-0, insc-1)
			const bid2PsbtsRound2 = process2Json.data.psbts.filter((p: any) => p.bidId === bid2Id)
			expect(bid2PsbtsRound2).toHaveLength(3)
			expect(bid2PsbtsRound2[0].inscriptionId).toBe('insc-partial-2')
			expect(bid2PsbtsRound2[1].inscriptionId).toBe('insc-partial-3')
			expect(bid2PsbtsRound2[2].inscriptionId).toBe('insc-partial-4')

			// Should have NO PSBTs for bid1 (already settled)
			const bid1PsbtsRound2 = process2Json.data.psbts.filter((p: any) => p.bidId === bid1Id)
			expect(bid1PsbtsRound2).toHaveLength(0)
		})
	})

	describe('Settlement calculation edge cases', () => {
		it('calculates correct clearing price based on fraction sold', async () => {
			const auctionId = 'settlement-price-calc'
			
			// Create auction with 10 items
			await app.handle(
				jsonRequest('http://localhost/api/clearing/create-auction', 'POST', {
					auctionId,
					inscriptionIds: Array.from({ length: 10 }, (_, i) => `insc-calc-${i}`),
					quantity: 10,
					startPrice: 100000,
					minPrice: 50000,
					duration: 3600,
					decrementInterval: 600,
					sellerAddress: 'tb1pseller_calc',
				}),
			)

			// Place and confirm bid for 5 items (50% sold)
			const paymentRes = await app.handle(
				jsonRequest('http://localhost/api/clearing/create-bid-payment', 'POST', {
					auctionId,
					bidderAddress: 'tb1qbidder_calc',
					bidAmount: 75000,
					quantity: 5,
				}),
			)
			const paymentJson: any = await paymentRes.json()
			await app.handle(
				jsonRequest('http://localhost/api/clearing/confirm-bid-payment', 'POST', {
					bidId: paymentJson.data.bidId,
					transactionId: 'tx_calc',
				}),
			)

			// Calculate settlement
			const settlementRes = await app.handle(
				new Request(`http://localhost/api/clearing/settlement/${auctionId}`),
			)
			const settlementJson: any = await settlementRes.json()
			
			// Expected: 50% sold means clearing price halfway between start and min
			// (100000 - 50000) * 0.5 = 25000 drop
			// Clearing price = 100000 - 25000 = 75000
			expect(settlementJson.data.clearingPrice).toBe(75000)
		})
	})
})
