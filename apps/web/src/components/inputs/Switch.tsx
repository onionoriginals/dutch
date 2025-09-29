import React from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import { useFormContext } from 'react-hook-form'
import { useFieldContext } from '../form/FormField'

export function Switch() {
  const { setValue, getValues } = useFormContext()
  const { name, inputId } = useFieldContext()
  const checked = Boolean(getValues(name))
  return (
    <RadixSwitch.Root id={inputId} checked={checked} onCheckedChange={(v) => setValue(name, v, { shouldValidate: true })}>
      <RadixSwitch.Thumb />
    </RadixSwitch.Root>
  )
}

