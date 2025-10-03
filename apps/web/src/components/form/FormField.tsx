import React from 'react'
import { useController, useFormContext } from 'react-hook-form'

type FieldContextValue = {
  name: string
  inputId: string
  errorId: string
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

export function useFieldContext() {
  const ctx = React.useContext(FieldContext)
  if (!ctx) throw new Error('useFieldContext must be used within <FormField>')
  return ctx
}

export type FormFieldProps<TFieldValues> = {
  name: keyof TFieldValues & string
  children: React.ReactNode
}

export function FormField<TFieldValues extends Record<string, any>>({ name, children }: FormFieldProps<TFieldValues>) {
  const inputId = React.useId()
  const errorId = `${inputId}-error`

  return (
    <FieldContext.Provider value={{ name, inputId, errorId }}>
      <div data-form-field={name} className="space-y-2">
        {children}
      </div>
    </FieldContext.Provider>
  )
}

export type FieldLabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode }

export function FieldLabel({ children, ...rest }: FieldLabelProps) {
  const { inputId } = useFieldContext()
  return (
    <label htmlFor={inputId} className="text-muted-foreground text-[13px] font-medium" {...rest}>
      {children}
    </label>
  )
}

export function FieldError() {
  const { name, errorId } = useFieldContext()
  const { formState: { errors } } = useFormContext()
  const err = (errors as any)[name]
  
  if (!err) return null
  const message = (err?.message ?? String(err)) as string
  return (
    <div id={errorId} role="alert" aria-live="polite" className="text-[13px] text-destructive">
      {message}
    </div>
  )
}

export type ControlAdapterProps = {
  render: (props: ReturnType<typeof useController>['field']) => React.ReactNode
}

export function ControlAdapter({ render }: ControlAdapterProps) {
  const { name } = useFieldContext()
  const methods = useFormContext()
  const { field } = useController({ name, control: methods.control })
  return <>{render(field)}</>
}

