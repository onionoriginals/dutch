import React from 'react'
import { useFormContext, useController } from 'react-hook-form'
import { useFieldContext } from '../form/FormField'

export type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> & {
  step?: string | number
}

export function NumberInput({ step = 'any', ...rest }: NumberInputProps) {
  const { control, formState } = useFormContext()
  const { name, inputId, errorId } = useFieldContext()
  const { field } = useController({ name, control })
  const hasError = Boolean((formState.errors as any)[name])
  
  // Keep track of the raw string value while typing
  const [displayValue, setDisplayValue] = React.useState('')
  const [isFocused, setIsFocused] = React.useState(false)
  
  React.useEffect(() => {
    // Only sync from external changes when not focused (to avoid interfering while typing)
    if (!isFocused) {
      if (field.value !== undefined && field.value !== null) {
        setDisplayValue(String(field.value))
      } else {
        setDisplayValue('')
      }
    }
  }, [field.value, isFocused])
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    setDisplayValue(rawValue)
    
    // Convert to number for validation and storage
    // Allow empty string, minus sign, and decimal point while typing
    if (rawValue === '' || rawValue === '-' || rawValue === '.' || rawValue === '-.') {
      field.onChange(undefined)
    } else {
      const numValue = Number(rawValue)
      field.onChange(isNaN(numValue) ? undefined : numValue)
    }
  }
  
  const handleFocus = () => {
    setIsFocused(true)
  }
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    
    // Clean up trailing decimals on blur
    const rawValue = e.target.value
    if (rawValue && !isNaN(Number(rawValue))) {
      const numValue = Number(rawValue)
      setDisplayValue(String(numValue))
      field.onChange(numValue)
    }
    
    field.onBlur()
  }
  
  return (
    <input 
      className="input"
      id={inputId}
      type="number"
      step={step}
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? errorId : undefined}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      name={field.name}
      ref={field.ref}
      {...rest}
    />
  )
}

