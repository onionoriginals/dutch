/**
 * Tests for NetworkBadge Component
 */

import { describe, test, expect } from 'bun:test'
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NetworkBadge } from './NetworkBadge'

describe('NetworkBadge', () => {
  test('renders mainnet badge with correct styling', () => {
    const { container } = render(<NetworkBadge network="mainnet" />)
    expect(screen.getByText('Mainnet')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Current network: Bitcoin Mainnet'
    )
    expect(container.querySelector('.text-orange-700')).toBeInTheDocument()
  })

  test('renders testnet badge with correct styling', () => {
    const { container } = render(<NetworkBadge network="testnet" />)
    expect(screen.getByText('Testnet')).toBeInTheDocument()
    expect(container.querySelector('.text-blue-700')).toBeInTheDocument()
  })

  test('renders signet badge with correct styling', () => {
    const { container } = render(<NetworkBadge network="signet" />)
    expect(screen.getByText('Signet')).toBeInTheDocument()
    expect(container.querySelector('.text-purple-700')).toBeInTheDocument()
  })

  test('renders regtest badge with correct styling', () => {
    const { container } = render(<NetworkBadge network="regtest" />)
    expect(screen.getByText('Regtest')).toBeInTheDocument()
    expect(container.querySelector('.text-gray-700')).toBeInTheDocument()
  })

  test('shows icon by default', () => {
    const { container } = render(<NetworkBadge network="mainnet" />)
    expect(container.querySelector('span[aria-hidden="true"]')).toBeInTheDocument()
  })

  test('hides icon when showIcon is false', () => {
    const { container } = render(<NetworkBadge network="mainnet" showIcon={false} />)
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeInTheDocument()
  })

  test('applies custom className', () => {
    const { container } = render(
      <NetworkBadge network="mainnet" className="custom-class" />
    )
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})
