import React from 'react'
import { Form, FormStep, FormField, FieldLabel, FieldError, useFormWizard } from '../form'
import { Input } from '../inputs/Input'
import { NumberInput } from '../inputs/NumberInput'
import { Textarea } from '../inputs/Textarea'
import { DateTimePicker } from '../inputs/DateTimePicker'
// no external select for type toggle to keep it outside Form context
import { EnglishAuctionSchema, DutchAuctionSchema, englishAuctionStepFields, dutchAuctionStepFields } from '../../lib/validation/auction'

type AuctionType = 'english' | 'dutch'

export default function AuctionFormExample() {
  const [type, setType] = React.useState<AuctionType>('english')
  const schema = type === 'english' ? EnglishAuctionSchema : DutchAuctionSchema
  const steps = type === 'english' ? englishAuctionStepFields : dutchAuctionStepFields

  function onSubmit(values: any) {
    // For demo: eslint-disable-next-line no-console
    console.log('submit', type, values)
    alert(`${type} auction submitted!`)
  }

  return (
    <div>
      <h2>Create Auction</h2>

      {/* Auction type selector outside of the form schema */}
      <fieldset style={{ marginBottom: 16 }}>
        <legend>Auction Type</legend>
        <label style={{ marginRight: 12 }}>
          <input
            type="radio"
            name="auction-type"
            value="english"
            checked={type === 'english'}
            onChange={() => setType('english')}
          />
          English
        </label>
        <label>
          <input
            type="radio"
            name="auction-type"
            value="dutch"
            checked={type === 'dutch'}
            onChange={() => setType('dutch')}
          />
          Dutch
        </label>
      </fieldset>

      <Form<any>
        schema={schema}
        onSubmit={onSubmit}
        defaultValues={{}}
      >
        {/* Step 1: Common details */}
        <FormStep fields={steps[0]}> 
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

        {/* Step 2: Pricing */}
        {type === 'english' ? (
          <FormStep fields={steps[1]}> 
            <FormField name="startingPrice">
              <FieldLabel>Starting price</FieldLabel>
              <NumberInput min={0} step="0.00000001" inputMode="decimal" />
              <FieldError />
            </FormField>
            <FormField name="reservePrice">
              <FieldLabel>Reserve price (optional)</FieldLabel>
              <NumberInput min={0} step="0.00000001" inputMode="decimal" />
              <FieldError />
            </FormField>
            <FormField name="bidIncrement">
              <FieldLabel>Bid increment</FieldLabel>
              <NumberInput min={0} step="0.00000001" inputMode="decimal" />
              <FieldError />
            </FormField>
            <StepNav />
          </FormStep>
        ) : (
          <FormStep fields={steps[1]}> 
            <FormField name="startPrice">
              <FieldLabel>Start price</FieldLabel>
              <NumberInput min={0} step="0.00000001" inputMode="decimal" />
              <FieldError />
            </FormField>
            <FormField name="endPrice">
              <FieldLabel>End price</FieldLabel>
              <NumberInput min={0} step="0.00000001" inputMode="decimal" />
              <FieldError />
            </FormField>
            <FormField name="buyNowPrice">
              <FieldLabel>Buy now price (optional)</FieldLabel>
              <NumberInput min={0} step="0.00000001" inputMode="decimal" />
              <FieldError />
            </FormField>
            <StepNav />
          </FormStep>
        )}

        {/* Step 3: Dutch-only mechanics */}
        {type === 'dutch' && (
          <FormStep fields={steps[2]}> 
            <FormField name="decrementAmount">
              <FieldLabel>Decrement amount</FieldLabel>
              <NumberInput min={0} step="0.00000001" inputMode="decimal" />
              <FieldError />
            </FormField>
            <FormField name="decrementIntervalSeconds">
              <FieldLabel>Decrement interval (seconds)</FieldLabel>
              <NumberInput min={1} step={1} inputMode="numeric" />
              <FieldError />
            </FormField>
            <StepNav />
          </FormStep>
        )}

        {/* Final step: Timing */}
        <FormStep fields={steps[steps.length - 1]}> 
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
      <button type="button" onClick={back} disabled={isFirst} aria-label="Previous step">
        Back
      </button>
      <button type={isLast ? 'submit' : 'button'} onClick={isLast ? undefined : next} aria-label={isLast ? 'Submit form' : 'Next step'}>
        {isLast ? submitLabel : 'Next'}
      </button>
    </div>
  )
}

