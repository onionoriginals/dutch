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
      <div>
        <h2>Success</h2>
        <p>Your auction has been created.</p>
        <pre aria-label="Normalized payload" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(submittedPayload, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2>Create Auction</h2>
      </header>

      {/* Type selection independent of form schema */}
      <AuctionTypeSelector value={type} onChange={setType} />

      <Form<any>
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={onSubmit}
        className="mt-3"
      >
        {/* Progress indicator within wizard context */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <StepProgress total={steps.length + 1} />
        </div>
        <FormAutosave onValuesChange={setFormValues} />

        {/* Step 1: Details */}
        <FormStep fields={steps[0]!}> 
          <FormField name="title">
            <FieldLabel>Title</FieldLabel>
            <Input placeholder="Amazing item" />
            <FieldError />
          </FormField>
          <FormField name="description">
            <FieldLabel>Description</FieldLabel>
            <Textarea placeholder="Optional description" rows={4} />
            <FieldError />
          </FormField>
          <StepNav />
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
    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
      <button type="button" onClick={back} disabled={isFirst} aria-label="Previous step">Back</button>
      <button type={isLast ? 'submit' : 'button'} onClick={isLast ? undefined : next} aria-label={isLast ? 'Submit form' : 'Next step'}>
        {isLast ? submitLabel : 'Next'}
      </button>
    </div>
  )
}

function StepProgress({ total }: { total: number }) {
  const { stepIndex } = useFormWizard()
  const pct = Math.round(((stepIndex + 1) / total) * 100)
  return (
    <div aria-label="Progress" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 160, height: 6, background: 'var(--seg-border,#e5e7eb)', borderRadius: 999 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'dodgerblue', borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 12 }}>{pct}%</span>
    </div>
  )
}

function ReviewBlock({ type }: { type: AuctionType }) {
  const { form } = useFormWizard()
  const values = form.watch()
  const summary = type === 'english' ? normalizeEnglish(values as any) : normalizeDutch(values as any)
  return (
    <section aria-label="Review" style={{ marginTop: 16 }}>
      <h3>Review</h3>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(summary, null, 2)}</pre>
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

