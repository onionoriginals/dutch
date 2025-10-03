/**
 * Network Badge Component
 * 
 * Displays the current network with appropriate styling
 */

import React from 'react'
import { getNetworkConfig, type AppNetwork } from '../../lib/config/networks'

export interface NetworkBadgeProps {
  network: AppNetwork
  className?: string
  showIcon?: boolean
}

export function NetworkBadge({ network, className = '', showIcon = true }: NetworkBadgeProps) {
  const config = getNetworkConfig(network)
  
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium ${config.badge.color} ${config.badge.bgColor} ${config.badge.borderColor} ${className}`}
      role="status"
      aria-label={`Current network: ${config.displayName}`}
    >
      {showIcon && (
        <span className="inline-block w-2 h-2 rounded-full bg-current opacity-75" aria-hidden="true" />
      )}
      <span>{config.shortName}</span>
    </div>
  )
}
