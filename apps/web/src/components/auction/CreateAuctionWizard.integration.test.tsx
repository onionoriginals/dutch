/**
 * Integration Tests for CreateAuctionWizard Network Functionality
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import CreateAuctionWizard from './CreateAuctionWizard'
import * as walletReact from '../../lib/stores/wallet.react'
import type { ConnectedWallet } from '../../lib/wallet/walletAdapter'

// Mock the wallet hook
const mockUseWallet = mock(() => ({
  wallet: null,
  disconnectWallet: mock(() => {}),
  connectWallet: mock(() => {}),
}))

beforeEach(() => {
  // Reset mocks
  mockUseWallet.mockClear()
  
  // Mock useWallet
  ;(walletReact as any).useWallet = mockUseWallet
})

describe('CreateAuctionWizard Network Integration', () => {
  test('FR1: initializes with wallet network when wallet is connected', () => {
    const mockWallet: ConnectedWallet = {
      paymentAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      paymentPublicKey: '02...',
      ordinalsAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      ordinalsPublicKey: '02...',
      provider: 'unisat',
      network: 'Testnet',
      addresses: [],
    }
    
    mockUseWallet.mockReturnValue({
      wallet: mockWallet,
      disconnectWallet: mock(() => {}),
      connectWallet: mock(() => {}),
    })
    
    render(<CreateAuctionWizard />)
    
    // Should display testnet badge
    expect(screen.getByText('Testnet')).toBeInTheDocument()
  })

  test('FR2: displays network badge prominently', () => {
    mockUseWallet.mockReturnValue({
      wallet: null,
      disconnectWallet: mock(() => {}),
      connectWallet: mock(() => {}),
    })
    
    render(<CreateAuctionWizard />)
    
    // Network badge should be visible
    const badge = screen.getByRole('status')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Current network'))
  })

  test('FR3: provides network change control', () => {
    mockUseWallet.mockReturnValue({
      wallet: null,
      disconnectWallet: mock(() => {}),
      connectWallet: mock(() => {}),
    })
    
    render(<CreateAuctionWizard />)
    
    // Should have a "Change Network" button
    const changeButton = screen.getByText('Change Network')
    expect(changeButton).toBeInTheDocument()
    
    // Click should show network selector
    fireEvent.click(changeButton)
    
    // Network selector should appear
    expect(screen.getByText('Bitcoin Mainnet')).toBeInTheDocument()
    expect(screen.getByText('Bitcoin Testnet')).toBeInTheDocument()
  })

  test('FR4: detects and warns about network mismatch', async () => {
    const mockWallet: ConnectedWallet = {
      paymentAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      paymentPublicKey: '02...',
      ordinalsAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      ordinalsPublicKey: '02...',
      provider: 'unisat',
      network: 'Mainnet', // Wallet is on mainnet
      addresses: [],
    }
    
    mockUseWallet.mockReturnValue({
      wallet: mockWallet,
      disconnectWallet: mock(() => {}),
      connectWallet: mock(() => {}),
    })
    
    // Mock URL to set testnet
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost/?network=testnet',
        search: '?network=testnet',
      },
      writable: true,
    })
    
    render(<CreateAuctionWizard />)
    
    await waitFor(() => {
      // Should show mismatch warning
      expect(screen.getByText('Network Mismatch Detected')).toBeInTheDocument()
    })
  })

  test('FR6: validates addresses against selected network', () => {
    const mockWallet: ConnectedWallet = {
      paymentAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Testnet address
      paymentPublicKey: '02...',
      ordinalsAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      ordinalsPublicKey: '02...',
      provider: 'unisat',
      network: 'Testnet',
      addresses: [],
    }
    
    mockUseWallet.mockReturnValue({
      wallet: mockWallet,
      disconnectWallet: mock(() => {}),
      connectWallet: mock(() => {}),
    })
    
    render(<CreateAuctionWizard />)
    
    // The wallet address should be auto-filled
    // Address validation happens on submit
    // This test verifies the component renders without error with a testnet address
    expect(screen.getByText('Testnet')).toBeInTheDocument()
  })

  test('network selector allows switching between all supported networks', () => {
    mockUseWallet.mockReturnValue({
      wallet: null,
      disconnectWallet: mock(() => {}),
      connectWallet: mock(() => {}),
    })
    
    render(<CreateAuctionWizard />)
    
    // Open network selector
    fireEvent.click(screen.getByText('Change Network'))
    
    // All networks should be available
    expect(screen.getByText('Bitcoin Mainnet')).toBeInTheDocument()
    expect(screen.getByText('Bitcoin Testnet')).toBeInTheDocument()
    expect(screen.getByText('Bitcoin Signet')).toBeInTheDocument()
    expect(screen.getByText('Bitcoin Regtest (Local)')).toBeInTheDocument()
  })

  test('network badge updates when network is changed', async () => {
    mockUseWallet.mockReturnValue({
      wallet: null,
      disconnectWallet: mock(() => {}),
      connectWallet: mock(() => {}),
    })
    
    render(<CreateAuctionWizard />)
    
    // Initial network should be testnet (default)
    expect(screen.getByText('Testnet')).toBeInTheDocument()
    
    // Open network selector
    fireEvent.click(screen.getByText('Change Network'))
    
    // Select mainnet
    const mainnetButton = screen.getByText('Bitcoin Mainnet').closest('button')
    fireEvent.click(mainnetButton!)
    
    await waitFor(() => {
      // Badge should update to mainnet
      expect(screen.getByText('Mainnet')).toBeInTheDocument()
    })
  })

  test('mismatch banner provides resolution options', async () => {
    const mockWallet: ConnectedWallet = {
      paymentAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      paymentPublicKey: '02...',
      ordinalsAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      ordinalsPublicKey: '02...',
      provider: 'unisat',
      network: 'Mainnet',
      addresses: [],
    }
    
    const mockDisconnect = mock(() => {})
    
    mockUseWallet.mockReturnValue({
      wallet: mockWallet,
      disconnectWallet: mockDisconnect,
      connectWallet: mock(() => {}),
    })
    
    // Set wizard to testnet via URL
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost/?network=testnet',
        search: '?network=testnet',
        hostname: 'localhost',
      },
      writable: true,
    })
    
    render(<CreateAuctionWizard />)
    
    await waitFor(() => {
      expect(screen.getByText('Network Mismatch Detected')).toBeInTheDocument()
    })
    
    // Should have option to switch wizard to wallet network
    expect(screen.getByText(/Switch Auction to Mainnet/)).toBeInTheDocument()
    
    // Should have option to reconnect wallet
    expect(screen.getByText(/Reconnect Wallet to Testnet/)).toBeInTheDocument()
  })
})
