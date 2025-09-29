import React from 'react';
import DutchPriceScheduleEditor from './DutchPriceScheduleEditor';
import type { DecayType } from '@originals/dutch/browser';

export default function DemoDutchEditor() {
  const [value, setValue] = React.useState({
    startPrice: 1000,
    floorPrice: 100,
    durationMs: 60_000,
    intervalMs: 5_000,
    decay: 'linear' as DecayType,
  });
  return (
    <DutchPriceScheduleEditor
      value={value}
      onChange={setValue}
      onValidSchedule={() => {}}
    />
  );
}

