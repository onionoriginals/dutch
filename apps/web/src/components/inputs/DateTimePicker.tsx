import React from 'react'
import { useFormContext } from 'react-hook-form'
import { useFieldContext } from '../form/FormField'

export type DateTimePickerProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>

export function DateTimePicker(props: DateTimePickerProps) {
  const { register, setValue, formState } = useFormContext()
  const { name, inputId, errorId } = useFieldContext()
  const hasError = Boolean((formState.errors as any)[name])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setValue(name, value ? new Date(value).toISOString() : undefined, { shouldValidate: true })
  }

  return (
    <input
      id={inputId}
      type="datetime-local"
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? errorId : undefined}
      {...register(name)}
      onChange={onChange}
      {...props}
    />
  )
}

