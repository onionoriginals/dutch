import React from 'react'
import { encodeAuctionToQuery, type Auction } from '../../lib/auction'

export function ShareLink({ auction }: { auction: Auction }) {
  const [copied, setCopied] = React.useState(false)
  const url = React.useMemo(() => {
    if (typeof window === 'undefined') return ''
    const base = new URL(window.location.href)
    base.pathname = '/auctions/preview'
    base.search = `?state=${encodeAuctionToQuery(auction)}`
    return base.toString()
  }, [auction])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input readOnly value={url} style={{ width: 320 }} className="input" />
      <button onClick={onCopy} className="btn btn-primary text-xs">{copied ? 'Copied' : 'Copy link'}</button>
    </div>
  )
}

export default ShareLink

