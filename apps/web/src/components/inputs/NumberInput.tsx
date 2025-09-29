import React from 'react'
import { useFormContext } from 'react-hook-form'
import { useFieldContext } from '../form/FormField'

export type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  step?: string | number
}

export function NumberInput({ step = 'any', ...rest }: NumberInputProps) {
  const { register, setValue, formState } = useFormContext()
  const { name, inputId, errorId } = useFieldContext()
  const hasError = Boolean((formState.errors as any)[name])
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setValue(name, value === '' ? undefined : Number(value), { shouldValidate: true })
  }
  return (
    <input
      id={inputId}
      type="number"
      step={step}
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? errorId : undefined}
      {...register(name)}
      onChange={onChange}
      {...rest}
    />
  )
}

