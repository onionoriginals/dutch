import * as React from 'react'

type AuctionType = 'english' | 'dutch'

export interface AuctionTypeSelectorProps {
  value: AuctionType
  onChange: (value: AuctionType) => void
  docsSlot?: React.ReactNode
  className?: string
}

// Accessible radio-group semantics with visually segmented control appearance
export function AuctionTypeSelector(props: AuctionTypeSelectorProps) {
  const { value, onChange, docsSlot, className } = props

  const idBase = React.useId()

  return (
    <fieldset className={className}>
      <legend className="sr-only">Auction type</legend>
      <div className="flex items-center justify-between gap-2">
        <span id={`${idBase}-label`} className="text-sm font-medium">Auction type</span>
        {docsSlot}
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${idBase}-label`}
        className="mt-2 inline-flex overflow-hidden rounded-md border border-[var(--seg-border,#e5e7eb)] bg-[var(--seg-bg,#fff)] shadow-sm dark:border-[var(--seg-border-dark,#374151)] dark:bg-[var(--seg-bg-dark,#111827)]"
      >
        <RadioButton
          id={`${idBase}-english`}
          label="English"
          description="Ascending bids until highest wins"
          checked={value === 'english'}
          onChange={() => onChange('english')}
        />
        <Separator />
        <RadioButton
          id={`${idBase}-dutch`}
          label="Dutch"
          description="Price decays over time until someone buys"
          checked={value === 'dutch'}
          onChange={() => onChange('dutch')}
        />
      </div>

      <div className="mt-2 text-xs text-[color:var(--muted-fg,#6b7280)] dark:text-[color:var(--muted-fg-dark,#9ca3af)]">
        <HelpTooltip />
      </div>
    </fieldset>
  )
}

function Separator() {
  return <div aria-hidden className="w-px bg-[var(--seg-sep,#e5e7eb)] dark:bg-[var(--seg-sep-dark,#374151)]" />
}

function RadioButton(props: { id: string; label: string; description: string; checked: boolean; onChange: () => void }) {
  const { id, label, description, checked, onChange } = props
  return (
    <label
      htmlFor={id}
      className={
        'group flex cursor-pointer items-center gap-3 px-4 py-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 ' +
        (checked ? 'bg-[var(--seg-active-bg,#f9fafb)] dark:bg-[var(--seg-active-bg-dark,#1f2937)]' : '')
      }
    >
      <input
        type="radio"
        id={id}
        name="auction-type"
        className="peer sr-only"
        checked={checked}
        onChange={onChange}
      />
      <span
        aria-hidden
        className={
          'h-4 w-4 rounded-full border transition-colors ' +
          (checked
            ? 'border-blue-600 bg-blue-600'
            : 'border-[var(--seg-border,#d1d5db)] bg-transparent dark:border-[var(--seg-border-dark,#4b5563)]')
        }
      />
      <span className="flex flex-col text-left">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-[color:var(--muted-fg,#6b7280)] dark:text-[color:var(--muted-fg-dark,#9ca3af)]">
          {description}
        </span>
      </span>
    </label>
  )
}

function HelpTooltip() {
  // lightweight tooltip using title attr; slot can provide richer docs
  return (
    <span title="English: ascending bids. Dutch: price drops on a schedule until someone buys." aria-label="Auction type help">
      Need help choosing? Hover for tips.
    </span>
  )
}

export default AuctionTypeSelector

