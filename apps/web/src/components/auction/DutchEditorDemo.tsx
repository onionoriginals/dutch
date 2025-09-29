import * as React from 'react'
import DutchPriceScheduleEditor from './DutchPriceScheduleEditor'

export default function DutchEditorDemo() {
  const [output, setOutput] = React.useState<any>(null)
  return (
    <div>
      <DutchPriceScheduleEditor
        startPrice={100}
        floorPrice={10}
        durationSeconds={120}
        intervalSeconds={20}
        decayType={'linear'}
        onChange={setOutput}
      />
      <pre
        style={{
          marginTop: 8,
          background: '#111827',
          color: '#e5e7eb',
          padding: 8,
          borderRadius: 6,
          overflow: 'auto',
          maxHeight: 160,
        }}
      >
{JSON.stringify(output?.points?.slice(0, 6), null, 2)}
      </pre>
    </div>
  )
}
