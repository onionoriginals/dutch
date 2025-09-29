import React from 'react'
import { useFormContext } from 'react-hook-form'
import { useFieldContext } from '../form/FormField'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export function Input({ type = 'text', ...rest }: InputProps) {
  const { register, formState } = useFormContext()
  const { name, inputId, errorId } = useFieldContext()
  const hasError = Boolean((formState.errors as any)[name])
  return (
    <input
      id={inputId}
      type={type}
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? errorId : undefined}
      {...register(name)}
      {...rest}
    />
  )
}

