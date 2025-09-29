import React from 'react'
import { useFormContext } from 'react-hook-form'
import { useFieldContext } from '../form/FormField'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea(props: TextareaProps) {
  const { register, formState } = useFormContext()
  const { name, inputId, errorId } = useFieldContext()
  const hasError = Boolean((formState.errors as any)[name])
  return (
    <textarea className="input"
      id={inputId}
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? errorId : undefined}
      {...register(name)}
      {...props}
    />
  )
}

