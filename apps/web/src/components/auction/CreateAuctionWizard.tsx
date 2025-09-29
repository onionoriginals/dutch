import React from 'react'
import { Form, FormStep, FormField, FieldLabel, FieldError, useFormWizard, ControlAdapter } from '../form'
import { Input } from '../inputs/Input'
import { NumberInput } from '../inputs/NumberInput'
import { Textarea } from '../inputs/Textarea'
import { DateTimePicker } from '../inputs/DateTimePicker'
import AuctionTypeSelector from './AuctionTypeSelector'
import { EnglishAuctionSchema, DutchAuctionSchema, englishAuctionStepFields, dutchAuctionStepFields } from '../../lib/validation/auction'
import type { AuctionType } from '../../types/auction'
import { normalizeEnglish, normalizeDutch } from '../../utils/normalizeAuction'

type DraftShape = {
  type: AuctionType
  values: any
}

const DRAFT_KEY = 'auction-create-draft-v1'

function useDraftPersistence(type: AuctionType, values: any) {
  const [restored, setRestored] = React.useState<Partial<DraftShape> | null>(null)

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DraftShape
        setRestored(parsed)
      }
    } catch {}
  }, [])

  React.useEffect(() => {
    const data: DraftShape = { type, values }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
    } catch {}
  }, [type, values])

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
  }

  return { restored, clearDraft }
}

function useNavigationGuard(isDirty: boolean) {
  React.useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}

export default function CreateAuctionWizard() {
  const [type, setType] = React.useState<AuctionType>('english')
  const schema = type === 'english' ? EnglishAuctionSchema : DutchAuctionSchema
  const steps = type === 'english' ? englishAuctionStepFields : dutchAuctionStepFields

  const [formValues, setFormValues] = React.useState<any>({})
  const { restored, clearDraft } = useDraftPersistence(type, formValues)

  const [submittedPayload, setSubmittedPayload] = React.useState<any | null>(null)

  const defaultValues = React.useMemo<Record<string, unknown>>(() => {
    if (restored?.values) return restored.values as Record<string, unknown>
    return {}
  }, [restored])

  React.useEffect(() => {
    if (restored?.type) setType(restored.type)
  }, [restored])

  // consider any non-empty form values as dirty
  const isDirty = React.useMemo(() => Object.keys(formValues || {}).length > 0, [formValues])
  useNavigationGuard(isDirty)

  async function onSubmit(values: any) {
    const payload = type === 'english' ? normalizeEnglish(values) : normalizeDutch(values)
    await fakeSubmit(payload)
    clearDraft()
    setSubmittedPayload(payload)
  }

  if (submittedPayload) {
    return (
      <div className="rounded-lg bg-green-50 p-8 text-center dark:bg-green-900/20">
        <div className="text-green-600 dark:text-green-400">
          <svg className="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold mb-2">Auction Created Successfully!</h2>
          <p className="text-lg mb-6">Your {submittedPayload.type} auction "{submittedPayload.title}" has been created.</p>
          
          <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 text-left mb-6">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Auction Details:</h3>
            <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <p><strong>Type:</strong> {submittedPayload.type === 'english' ? 'English (Ascending Bid)' : 'Dutch (Descending Price)'}</p>
              <p><strong>Title:</strong> {submittedPayload.title}</p>
              {submittedPayload.description && <p><strong>Description:</strong> {submittedPayload.description}</p>}
              <p><strong>Start Time:</strong> {new Date(submittedPayload.timing.startTime).toLocaleString()}</p>
              <p><strong>End Time:</strong> {new Date(submittedPayload.timing.endTime).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => setSubmittedPayload(null)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Create Another Auction
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
            >
              Back to Home
            </button>
          </div>
          
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm underline">View Raw Payload</summary>
            <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto text-gray-800 dark:text-gray-200" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(submittedPayload, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-gray-200 pb-4 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Auction</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Set up your auction with detailed pricing and timing configuration</p>
      </header>

      {/* Type selection independent of form schema */}
      <AuctionTypeSelector value={type} onChange={setType} className="mb-6" />

      <Form<any>
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={onSubmit}
        className="space-y-6"
      >
        {/* Progress indicator within wizard context */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Auction Details</h3>
          <StepProgress total={steps.length + 1} />
        </div>
        <FormAutosave onValuesChange={setFormValues} />

        {/* Step 1: Details */}
        <FormStep fields={steps[0]!}> 
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Basic Information</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Enter the basic details for your auction</p>
            </div>
            <FormField name="title">
              <FieldLabel>Title</FieldLabel>
              <Input placeholder="Amazing item" />
              <FieldError />
            </FormField>
            <FormField name="description">
              <FieldLabel>Description</FieldLabel>
              <Textarea placeholder="Optional description (max 500 characters)" rows={4} />
              <FieldError />
            </FormField>
            <StepNav />
          </div>
        </FormStep>

        {/* Step 2: Pricing (conditional) */}
        {type === 'english' ? (
          <FormStep fields={steps[1]!}> 
            <FormField name="startingPrice">
              <FieldLabel>Starting price</FieldLabel>
              <NumberInput min={0} inputMode="decimal" />
              <FieldError />
            </FormField>
            <FormField name="reservePrice">
              <FieldLabel>Reserve price (optional)</FieldLabel>
              <NumberInput min={0} inputMode="decimal" />
              <FieldError />
            </FormField>
            <FormField name="bidIncrement">
              <FieldLabel>Bid increment</FieldLabel>
              <NumberInput min={0} inputMode="decimal" />
              <FieldError />
            </FormField>
            <StepNav />
          </FormStep>
        ) : (
          <>
            <FormStep fields={steps[1]!}> 
              <FormField name="startPrice">
                <FieldLabel>Start price</FieldLabel>
                <NumberInput min={0} inputMode="decimal" />
                <FieldError />
              </FormField>
              <FormField name="endPrice">
                <FieldLabel>End price</FieldLabel>
                <NumberInput min={0} inputMode="decimal" />
                <FieldError />
              </FormField>
              <FormField name="buyNowPrice">
                <FieldLabel>Buy now price (optional)</FieldLabel>
                <NumberInput min={0} inputMode="decimal" />
                <FieldError />
              </FormField>
              <StepNav />
            </FormStep>
            <FormStep fields={steps[2]!}> 
              <FormField name="decrementAmount">
                <FieldLabel>Decrement amount</FieldLabel>
                <NumberInput min={0} inputMode="decimal" />
                <FieldError />
              </FormField>
              <FormField name="decrementIntervalSeconds">
                <FieldLabel>Decrement interval (seconds)</FieldLabel>
                <NumberInput min={1} inputMode="numeric" />
                <FieldError />
              </FormField>
              <StepNav />
            </FormStep>
          </>
        )}

        {/* Timing */}
        <FormStep fields={steps[steps.length - 1]!}> 
          <QuickTimingControls />
          <FormField name="startTime">
            <FieldLabel>Start time</FieldLabel>
            <DateTimePicker />
            <FieldError />
          </FormField>
          <FormField name="endTime">
            <FieldLabel>End time</FieldLabel>
            <DateTimePicker />
            <FieldError />
          </FormField>
          <StepNav />
        </FormStep>

        {/* Review */}
        <FormStep fields={[]}> 
          <ReviewBlock type={type} />
          <StepNav submitLabel="Create auction" />
        </FormStep>
      </Form>
    </div>
  )
}

function StepNav({ submitLabel = 'Next' }: { submitLabel?: string }) {
  const { back, next, isFirst, isLast } = useFormWizard()
  return (
    <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
      <button 
        type="button" 
        onClick={back} 
        disabled={isFirst} 
        aria-label="Previous step"
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          isFirst 
            ? 'text-gray-400 cursor-not-allowed dark:text-gray-600' 
            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
        }`}
      >
        ← Back
      </button>
      <button 
        type={isLast ? 'submit' : 'button'} 
        onClick={isLast ? undefined : next} 
        aria-label={isLast ? 'Submit form' : 'Next step'}
        className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      >
        {isLast ? submitLabel : 'Next →'}
      </button>
    </div>
  )
}

function StepProgress({ total }: { total: number }) {
  const { stepIndex } = useFormWizard()
  const current = stepIndex + 1
  return (
    <div aria-label="Progress" className="flex items-center gap-3">
      <div className="w-40 h-2 bg-gray-200 rounded-full dark:bg-gray-700">
        <div 
          className="h-full bg-blue-600 rounded-full transition-all duration-300" 
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
      <span className="text-sm text-gray-600 dark:text-gray-400 min-w-0">
        Step {current} of {total}
      </span>
    </div>
  )
}

function ReviewBlock({ type }: { type: AuctionType }) {
  const { form } = useFormWizard()
  const values = form.watch()
  const summary = type === 'english' ? normalizeEnglish(values as any) : normalizeDutch(values as any)
  return (
    <section aria-label="Review" className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Review Your Auction</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Please review all details before creating your auction.</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Basic Information</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="font-medium">{type === 'english' ? 'English (Ascending Bid)' : 'Dutch (Descending Price)'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Title:</span>
              <span className="font-medium">{values.title || 'Not set'}</span>
            </div>
            {values.description && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Description:</span>
                <span className="font-medium">{values.description}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Timing</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Start:</span>
              <span className="font-medium">{values.startTime ? new Date(values.startTime).toLocaleString() : 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">End:</span>
              <span className="font-medium">{values.endTime ? new Date(values.endTime).toLocaleString() : 'Not set'}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 md:col-span-2">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Pricing Configuration</h4>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            {type === 'english' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Starting Price:</span>
                  <span className="font-medium">${values.startingPrice || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Reserve Price:</span>
                  <span className="font-medium">${values.reservePrice || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Bid Increment:</span>
                  <span className="font-medium">${values.bidIncrement || 0}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Start Price:</span>
                  <span className="font-medium">${values.startPrice || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">End Price:</span>
                  <span className="font-medium">${values.endPrice || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Decrement Amount:</span>
                  <span className="font-medium">${values.decrementAmount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Decrement Interval:</span>
                  <span className="font-medium">{values.decrementIntervalSeconds || 0}s</span>
                </div>
                {values.buyNowPrice && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Buy Now Price:</span>
                    <span className="font-medium">${values.buyNowPrice}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 underline">View Technical Payload</summary>
        <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded overflow-auto text-gray-800 dark:text-gray-200 border" style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(summary, null, 2)}
        </pre>
      </details>
    </section>
  )
}

function FormAutosave({ onValuesChange }: { onValuesChange: (v: any) => void }) {
  const { form } = useFormWizard()
  React.useEffect(() => {
    const sub = form.watch((v: any) => onValuesChange(v))
    return () => sub.unsubscribe()
  }, [form, onValuesChange])
  return null
}

async function fakeSubmit(payload: unknown) {
  await new Promise((r) => setTimeout(r, 300))
  // eslint-disable-next-line no-console
  console.log('Normalized submit payload', payload)
}

function QuickTimingControls() {
  const { form } = useFormWizard()
  const startTime: string | undefined = form.watch('startTime')
  const endTime: string | undefined = form.watch('endTime')

  const nowMs = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  const presets = [
    { key: '1h', label: '1 hour', ms: 1 * 60 * 60 * 1000 },
    { key: '4h', label: '4 hours', ms: 4 * 60 * 60 * 1000 },
    { key: '12h', label: '12 hours', ms: 12 * 60 * 60 * 1000 },
    { key: '1d', label: '1 day', ms: oneDayMs },
    { key: '3d', label: '3 days', ms: 3 * oneDayMs },
    { key: '7d', label: '7 days', ms: 7 * oneDayMs },
  ] as const

  function getInitialDays(): number {
    if (!startTime) return 0
    const diff = new Date(startTime).getTime() - nowMs
    return Math.max(0, Math.round(diff / oneDayMs))
  }

  function getInitialPreset(): string {
    if (!startTime || !endTime) return '1d'
    const dur = new Date(endTime).getTime() - new Date(startTime).getTime()
    const match = presets.find((p) => Math.abs(p.ms - dur) < 60 * 1000)
    return match?.key || '1d'
  }

  const [daysFromNow, setDaysFromNow] = React.useState<number>(getInitialDays())
  const [presetKey, setPresetKey] = React.useState<string>(getInitialPreset())

  React.useEffect(() => {
    // If form fields change externally, keep local UI roughly in sync
    setDaysFromNow(getInitialDays())
    setPresetKey(getInitialPreset())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, endTime])

  function computeStartDate(days: number): Date {
    const start = new Date(nowMs + days * oneDayMs)
    // Snap to the next hour for neatness
    start.setMinutes(0, 0, 0)
    return start
  }

  function getPresetMs(key: string): number {
    return presets.find((p) => p.key === key)?.ms || oneDayMs
  }

  function applyChanges(nextDays: number, nextPresetKey: string) {
    const start = computeStartDate(nextDays)
    const end = new Date(start.getTime() + getPresetMs(nextPresetKey))
    form.setValue('startTime', start.toISOString(), { shouldDirty: true, shouldValidate: true })
    form.setValue('endTime', end.toISOString(), { shouldDirty: true, shouldValidate: true })
  }

  return (
    <div className="mb-4 rounded-lg border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">Quick timing</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Start in (days)</span>
          <input
            className="input"
            type="number"
            min={0}
            max={365}
            value={daysFromNow}
            onChange={(e) => {
              const val = Math.max(0, Math.min(365, Number(e.target.value || 0)))
              setDaysFromNow(val)
              applyChanges(val, presetKey)
            }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Duration</span>
          <select
            className="input"
            value={presetKey}
            onChange={(e) => {
              const key = e.target.value
              setPresetKey(key)
              applyChanges(daysFromNow, key)
            }}
          >
            {presets.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            className="button"
            onClick={() => applyChanges(daysFromNow, presetKey)}
          >
            Apply
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">You can still fine-tune exact times below.</div>
    </div>
  )
}

