/**
 * Auction Status Monitoring Background Job
 * 
 * Automatically monitors and updates auction statuses:
 * - Expires auctions past their end_time
 * - Polls mempool API to detect payments to escrow addresses
 * - Extracts transaction IDs from detected payments
 * - Confirms bid payments once transactions are detected
 * - Updates bid payment statuses from payment_pending to payment_confirmed
 * - Logs all status changes for audit trail
 */

import { logger } from '../utils/logger'
import { getBitcoinNetwork } from '@originals/dutch'

interface AuctionMonitorOptions {
  /** Database instance to use for operations */
  database: any
  /** Interval in milliseconds between job runs (default: 60000 = 60 seconds) */
  intervalMs?: number
  /** Base URL for mempool API (overrides network-based default) */
  mempoolApiBase?: string
}

interface MempoolTxStatus {
  confirmed: boolean
  block_height?: number
  block_hash?: string
  block_time?: number
}

export class AuctionMonitor {
  private database: any
  private intervalMs: number
  private intervalId?: ReturnType<typeof setInterval>
  private isRunning: boolean = false
  private mempoolApiBase?: string
  private lastRunTime: number = 0
  private successfulRuns: number = 0
  private failedRuns: number = 0

  constructor(options: AuctionMonitorOptions) {
    this.database = options.database
    this.intervalMs = options.intervalMs ?? 60000 // Default: 60 seconds
    this.mempoolApiBase = options.mempoolApiBase
  }

  /**
   * Start the monitoring job
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Auction monitor already running')
      return
    }

    logger.info('Starting auction monitor', {
      intervalMs: this.intervalMs,
      network: getBitcoinNetwork(),
    })

    // Run immediately on start
    this.runMonitorCycle().catch(err => {
      logger.error('Initial monitor cycle failed', { error: err.message })
    })

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runMonitorCycle().catch(err => {
        logger.error('Monitor cycle failed', { error: err.message })
      })
    }, this.intervalMs)
  }

  /**
   * Stop the monitoring job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      logger.info('Auction monitor stopped', {
        successfulRuns: this.successfulRuns,
        failedRuns: this.failedRuns,
      })
    }
  }

  /**
   * Get monitor statistics
   */
  getStats() {
    return {
      isRunning: !!this.intervalId,
      lastRunTime: this.lastRunTime,
      successfulRuns: this.successfulRuns,
      failedRuns: this.failedRuns,
      intervalMs: this.intervalMs,
    }
  }

  /**
   * Main monitoring cycle
   */
  private async runMonitorCycle(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Monitor cycle already running, skipping')
      return
    }

    this.isRunning = true
    const startTime = Date.now()
    this.lastRunTime = startTime

    try {
      logger.debug('Running monitor cycle', { timestamp: startTime })

      // Step 1: Expire old auctions
      await this.expireOldAuctions()

      // Step 2: Check pending payments
      await this.checkPendingPayments()

      const duration = Date.now() - startTime
      this.successfulRuns++

      logger.info('Monitor cycle completed', {
        duration,
        successfulRuns: this.successfulRuns,
      })
    } catch (error: any) {
      this.failedRuns++
      logger.error('Monitor cycle error', {
        error: error.message,
        stack: error.stack,
        failedRuns: this.failedRuns,
      })
      // Don't throw - we want the job to continue running
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Step 1: Call the check-expired endpoint to expire ended auctions
   */
  private async expireOldAuctions(): Promise<void> {
    try {
      const result = await this.database.checkAndUpdateExpiredAuctions()
      
      if (result.updatedCount > 0) {
        logger.info('Expired auctions', {
          count: result.updatedCount,
          operation: 'expire-auctions',
        })
      } else {
        logger.debug('No auctions to expire')
      }
    } catch (error: any) {
      logger.error('Failed to expire auctions', {
        error: error.message,
        operation: 'expire-auctions',
      })
      throw error
    }
  }

  /**
   * Step 2: Check mempool for pending payment confirmations
   */
  private async checkPendingPayments(): Promise<void> {
    try {
      // Get all bids with payment_pending status
      const pendingPayments = this.database.getPendingPayments() || []

      if (pendingPayments.length === 0) {
        logger.debug('No pending payments to check')
        return
      }

      logger.debug('Checking pending payments', { count: pendingPayments.length })

      let confirmedCount = 0
      let errorCount = 0

      for (const payment of pendingPayments) {
        try {
          // Check if payment has escrow address but no transaction ID yet
          if (payment.escrowAddress && !payment.transactionId) {
            // Poll mempool API to get the transaction paying to this address
            const txInfo = await this.getAddressPaymentTransaction(payment.escrowAddress, payment.bidAmount)
            
            if (txInfo) {
              // Found a transaction to the escrow address
              logger.info('Payment transaction detected for bid', {
                bidId: payment.id,
                escrowAddress: payment.escrowAddress,
                transactionId: txInfo.txid,
                amount: txInfo.amount,
                operation: 'payment-detected',
              })
              
              // Confirm the payment with the extracted transaction ID
              try {
                const updateResult = this.database.confirmBidPayment(
                  payment.id,
                  txInfo.txid
                )
                
                if (updateResult?.success) {
                  confirmedCount++
                  logger.info('Payment confirmed', {
                    bidId: payment.id,
                    transactionId: txInfo.txid,
                    operation: 'payment-confirmed',
                  })
                }
              } catch (confirmError: any) {
                logger.error('Failed to confirm payment', {
                  bidId: payment.id,
                  transactionId: txInfo.txid,
                  error: confirmError.message,
                })
                errorCount++
              }
            }
          }

          // If we already have a transactionId, just check if it's confirmed
          else if (payment.transactionId) {
            const isConfirmed = await this.checkTransactionConfirmation(payment.transactionId)
            
            if (isConfirmed) {
              // Transaction already has confirmations, ensure it's marked as confirmed
              try {
                const updateResult = this.database.confirmBidPayment(
                  payment.id,
                  payment.transactionId
                )
                
                if (updateResult?.success && !updateResult.alreadyConfirmed) {
                  confirmedCount++
                  logger.info('Payment confirmed', {
                    bidId: payment.id,
                    transactionId: payment.transactionId,
                    operation: 'payment-confirmed',
                  })
                }
              } catch (confirmError: any) {
                logger.error('Failed to confirm payment', {
                  bidId: payment.id,
                  transactionId: payment.transactionId,
                  error: confirmError.message,
                })
                errorCount++
              }
            }
          }
        } catch (error: any) {
          errorCount++
          logger.error('Failed to check payment', {
            bidId: payment.id,
            error: error.message,
            operation: 'check-payment',
          })
          // Continue processing other payments
        }
      }

      if (confirmedCount > 0 || errorCount > 0) {
        logger.info('Payment check summary', {
          total: pendingPayments.length,
          confirmed: confirmedCount,
          errors: errorCount,
        })
      }
    } catch (error: any) {
      logger.error('Failed to check pending payments', {
        error: error.message,
        operation: 'check-pending-payments',
      })
      throw error
    }
  }

  /**
   * Get the transaction that paid to an address
   * Returns the txid and amount if a valid payment is found
   */
  private async getAddressPaymentTransaction(
    address: string,
    expectedAmount: number
  ): Promise<{ txid: string; amount: number } | null> {
    try {
      const apiBase = this.getMempoolApiBase()
      const url = `${apiBase}/address/${address}/txs`
      
      const response = await fetch(url)
      if (!response.ok) {
        logger.warn('Failed to check address for transactions', {
          address,
          status: response.status,
          statusText: response.statusText,
        })
        return null
      }

      const txs = await response.json() as any[]
      
      if (!Array.isArray(txs) || txs.length === 0) {
        return null
      }

      // Find the first transaction that pays to this address
      // We look for outputs (vout) that match the escrow address
      for (const tx of txs) {
        if (!tx.vout || !Array.isArray(tx.vout)) continue
        
        for (const vout of tx.vout) {
          // Check if this output pays to our escrow address
          if (vout.scriptpubkey_address === address) {
            const amountSats = vout.value
            
            // Log the transaction details
            logger.debug('Found payment to escrow address', {
              address,
              txid: tx.txid,
              amount: amountSats,
              expectedAmount,
              vout: vout.n,
            })
            
            // Verify amount matches (with some tolerance for fees)
            // Allow up to 10% variance to account for fee estimation differences
            const tolerance = expectedAmount * 0.1
            const amountMatch = Math.abs(amountSats - expectedAmount) <= tolerance
            
            if (!amountMatch) {
              logger.warn('Payment amount mismatch', {
                address,
                txid: tx.txid,
                expected: expectedAmount,
                received: amountSats,
                difference: amountSats - expectedAmount,
              })
              // Continue looking for a better match
              continue
            }
            
            // Found a matching payment
            return {
              txid: tx.txid,
              amount: amountSats,
            }
          }
        }
      }

      // No matching payment found
      logger.debug('No matching payment found for address', {
        address,
        expectedAmount,
        txCount: txs.length,
      })
      return null
    } catch (error: any) {
      logger.error('Error getting address payment transaction', {
        address,
        error: error.message,
      })
      return null
    }
  }

  /**
   * Check if a transaction is confirmed on the blockchain
   */
  private async checkTransactionConfirmation(txId: string): Promise<boolean> {
    try {
      const apiBase = this.getMempoolApiBase()
      const url = `${apiBase}/tx/${txId}/status`
      
      const response = await fetch(url)
      if (!response.ok) {
        // Transaction not found yet or API error
        logger.debug('Transaction not found or API error', {
          txId,
          status: response.status,
        })
        return false
      }

      const status = await response.json() as MempoolTxStatus
      
      // Consider confirmed if it has a block_height (at least 1 confirmation)
      const isConfirmed = status.confirmed && !!status.block_height
      
      if (isConfirmed) {
        logger.debug('Transaction confirmed', {
          txId,
          blockHeight: status.block_height,
          blockHash: status.block_hash,
        })
      }
      
      return isConfirmed
    } catch (error: any) {
      logger.error('Error checking transaction confirmation', {
        txId,
        error: error.message,
      })
      return false
    }
  }

  /**
   * Get the appropriate mempool API base URL for the current network
   */
  private getMempoolApiBase(): string {
    if (this.mempoolApiBase) {
      return this.mempoolApiBase
    }

    const network = getBitcoinNetwork()
    if (network === 'testnet') return 'https://mempool.space/testnet/api'
    if (network === 'signet') return 'https://mempool.space/signet/api'
    if (network === 'regtest') return 'http://localhost:3002/api'
    return 'https://mempool.space/api'
  }
}

/**
 * Create and start an auction monitor instance
 */
export function startAuctionMonitor(options: AuctionMonitorOptions): AuctionMonitor {
  const monitor = new AuctionMonitor(options)
  monitor.start()
  return monitor
}
