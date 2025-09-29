import * as React from 'react'
import AuctionTypeSelector from './AuctionTypeSelector'

export default function AuctionTypeSelectorDemo() {
  const [type, setType] = React.useState<'english' | 'dutch'>('english')
  return (
    <div>
      <AuctionTypeSelector
        value={type}
        onChange={setType}
        docsSlot={<a href="/docs/auction-type" style={{ fontSize: 12, textDecoration: 'underline' }}>Docs</a>}
      />
      <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Selected: {type}</p>
    </div>
  )
}
