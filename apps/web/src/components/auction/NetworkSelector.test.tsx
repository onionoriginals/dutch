/**
 * Tests for NetworkSelector Component
 */

import { describe, test, expect, mock } from 'bun:test'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NetworkSelector } from './NetworkSelector'

describe('NetworkSelector', () => {
  test('renders all supported networks', () => {
    const onChange = mock(() => {})
    render(<NetworkSelector value="testnet" onChange={onChange} />)
    
    expect(screen.getByText('Bitcoin Mainnet')).toBeInTheDocument()
    expect(screen.getByText('Bitcoin Testnet')).toBeInTheDocument()
    expect(screen.getByText('Bitcoin Signet')).toBeInTheDocument()
    expect(screen.getByText('Bitcoin Regtest (Local)')).toBeInTheDocument()
  })

  test('highlights selected network', () => {
    const onChange = mock(() => {})
    render(<NetworkSelector value="testnet" onChange={onChange} />)
    
    const testnetButton = screen.getByText('Bitcoin Testnet').closest('button')
    expect(testnetButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('calls onChange when network is clicked', () => {
    const onChange = mock(() => {})
    render(<NetworkSelector value="testnet" onChange={onChange} />)
    
    const mainnetButton = screen.getByText('Bitcoin Mainnet').closest('button')
    fireEvent.click(mainnetButton!)
    
    expect(onChange).toHaveBeenCalledWith('mainnet')
  })

  test('does not call onChange when disabled', () => {
    const onChange = mock(() => {})
    render(<NetworkSelector value="testnet" onChange={onChange} disabled={true} />)
    
    const mainnetButton = screen.getByText('Bitcoin Mainnet').closest('button')
    fireEvent.click(mainnetButton!)
    
    expect(onChange).not.toHaveBeenCalled()
  })

  test('shows custom label when provided', () => {
    const onChange = mock(() => {})
    render(
      <NetworkSelector
        value="testnet"
        onChange={onChange}
        label="Custom Label"
      />
    )
    
    expect(screen.getByText('Custom Label')).toBeInTheDocument()
  })

  test('shows description by default', () => {
    const onChange = mock(() => {})
    render(<NetworkSelector value="testnet" onChange={onChange} />)
    
    expect(
      screen.getByText('Select which Bitcoin network to create this auction on')
    ).toBeInTheDocument()
  })

  test('hides description when showDescription is false', () => {
    const onChange = mock(() => {})
    render(
      <NetworkSelector
        value="testnet"
        onChange={onChange}
        showDescription={false}
      />
    )
    
    expect(
      screen.queryByText('Select which Bitcoin network to create this auction on')
    ).not.toBeInTheDocument()
  })

  test('shows help text for each network', () => {
    const onChange = mock(() => {})
    render(<NetworkSelector value="testnet" onChange={onChange} />)
    
    expect(screen.getByText(/Real Bitcoin network with real value/)).toBeInTheDocument()
    expect(screen.getByText(/Test network with test Bitcoin/)).toBeInTheDocument()
    expect(screen.getByText(/More reliable test network/)).toBeInTheDocument()
    expect(screen.getByText(/Local development network/)).toBeInTheDocument()
  })
})
