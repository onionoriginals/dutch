/**
 * Auction Status Monitoring Background Job
 * 
 * Automatically monitors and updates auction statuses:
 * - Expires auctions past their end_time
 * - Checks mempool for pending payment confirmations
 * - Updates bid payment statuses
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
      const pendingPayments = this.database.getPendingPayments?.() || []

      if (pendingPayments.length === 0) {
        logger.debug('No pending payments to check')
        return
      }

      logger.debug('Checking pending payments', { count: pendingPayments.length })

      let confirmedCount = 0
      let errorCount = 0

      for (const payment of pendingPayments) {
        try {
          // Check if payment has escrow address (for clearing auctions)
          if (payment.escrowAddress && !payment.transactionId) {
            // Poll mempool API to check if address has received payment
            const hasPayment = await this.checkAddressForPayment(payment.escrowAddress)
            
            if (hasPayment) {
              logger.info('Payment detected for bid', {
                bidId: payment.id,
                escrowAddress: payment.escrowAddress,
                operation: 'payment-detected',
              })
              // Note: In a real implementation, we would extract the actual txId
              // For now, we just mark that payment was detected
            }
          }

          // If we have a transactionId, check if it's confirmed
          if (payment.transactionId) {
            const isConfirmed = await this.checkTransactionConfirmation(payment.transactionId)
            
            if (isConfirmed) {
              // Update bid status to payment_confirmed
              const updateResult = this.database.confirmBidPayment?.(
                payment.id,
                payment.transactionId
              )
              
              if (updateResult?.success) {
                confirmedCount++
                logger.info('Payment confirmed', {
                  bidId: payment.id,
                  transactionId: payment.transactionId,
                  operation: 'payment-confirmed',
                })
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
   * Check if an address has received any payment
   */
  private async checkAddressForPayment(address: string): Promise<boolean> {
    try {
      const apiBase = this.getMempoolApiBase()
      const url = `${apiBase}/address/${address}/txs`
      
      const response = await fetch(url)
      if (!response.ok) {
        logger.warn('Failed to check address', {
          address,
          status: response.status,
          statusText: response.statusText,
        })
        return false
      }

      const txs = await response.json() as any[]
      // Check if address has received any transactions
      return Array.isArray(txs) && txs.length > 0
    } catch (error: any) {
      logger.error('Error checking address for payment', {
        address,
        error: error.message,
      })
      return false
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
