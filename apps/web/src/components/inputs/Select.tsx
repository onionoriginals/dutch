import React from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import { useFormContext } from 'react-hook-form'
import { useFieldContext } from '../form/FormField'

export type SelectProps = {
  children: React.ReactNode
  placeholder?: string
}

export function Select({ children, placeholder }: SelectProps) {
  const { setValue, getValues, formState } = useFormContext()
  const { name, inputId, errorId } = useFieldContext()
  const hasError = Boolean((formState.errors as any)[name])
  const value = String(getValues(name) ?? '')
  return (
    <RadixSelect.Root value={value} onValueChange={(v) => setValue(name, v, { shouldValidate: true })}>
      <RadixSelect.Trigger id={inputId} aria-invalid={hasError || undefined} aria-describedby={hasError ? errorId : undefined} className="input pr-8">
        <RadixSelect.Value placeholder={placeholder} />
      </RadixSelect.Trigger>
      <RadixSelect.Content className="rounded-md border bg-card shadow-md">
        <RadixSelect.Viewport className="p-1">
          {children}
        </RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Root>
  )
}

export const SelectItem = RadixSelect.Item
export const SelectItemText = RadixSelect.ItemText

