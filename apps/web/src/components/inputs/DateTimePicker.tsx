import React from 'react'
import { useFormContext } from 'react-hook-form'
import { useFieldContext } from '../form/FormField'

export type DateTimePickerProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>

export function DateTimePicker(props: DateTimePickerProps) {
  const { register, setValue, formState, watch } = useFormContext()
  const { name, inputId, errorId } = useFieldContext()
  const hasError = Boolean((formState.errors as any)[name])

  const raw = watch(name) as string | undefined
  const inputValue = React.useMemo(() => isoToLocalInput(raw), [raw])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Convert local datetime string to ISO UTC string for storage/validation
    setValue(name, value ? new Date(value).toISOString() : undefined, { shouldValidate: true })
  }

  return (
    <input
      id={inputId}
      type="datetime-local"
      value={inputValue}
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? errorId : undefined}
      // still register field for RHF metadata; our onChange controls value
      {...register(name)}
      onChange={onChange}
      {...props}
    />
  )
}

function isoToLocalInput(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

