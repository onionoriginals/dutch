import React from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodSchema } from 'zod'

type FormProps<TValues> = {
  schema: ZodSchema<TValues>
  defaultValues?: Partial<TValues>
  onSubmit: (values: TValues) => void | Promise<void>
  children: React.ReactNode
  className?: string
}

type FormWizardContextValue = {
  stepIndex: number
  stepsCount: number
  next: () => Promise<void>
  back: () => void
  goTo: (index: number) => void
  isFirst: boolean
  isLast: boolean
  currentStepFields: string[]
  form: UseFormReturn<any>
}

const FormWizardContext = React.createContext<FormWizardContextValue | null>(null)

export function useFormWizard() {
  const ctx = React.useContext(FormWizardContext)
  if (!ctx) throw new Error('useFormWizard must be used within <Form>')
  return ctx
}

export type FormStepProps = {
  title?: string
  description?: string
  fields: string[]
  children: React.ReactNode
}

function isFormStep(element: React.ReactNode): element is React.ReactElement<FormStepProps> {
  return Boolean(
    React.isValidElement(element) &&
      (element.type as any)?.__isFormStep === true
  )
}

export function FormStep(props: FormStepProps) {
  return <>{props.children}</>
}

// Internal marker to detect step elements
(FormStep as any).__isFormStep = true

export function Form<TValues extends Record<string, any>>({ schema, defaultValues, onSubmit, children, className }: FormProps<TValues>) {
  const methods = useForm<TValues>({
    resolver: zodResolver(schema as any),
    defaultValues: defaultValues as any,
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: true
  })

  const [stepIndex, setStepIndex] = React.useState(0)

  const allChildren = React.Children.toArray(children)
  const steps = allChildren.filter(isFormStep) as React.ReactElement<FormStepProps>[]

  const currentStep = steps[stepIndex]
  const currentStepFields = currentStep?.props.fields ?? []

  const stepsCount = steps.length
  const isFirst = stepIndex === 0
  const isLast = stepIndex === stepsCount - 1

  async function next() {
    const isValid = await methods.trigger(currentStepFields as any, { shouldFocus: true })
    if (!isValid) return
    if (isLast) {
      await methods.handleSubmit(onSubmit)()
    } else {
      setStepIndex((i) => Math.min(i + 1, stepsCount - 1))
    }
  }

  function back() {
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  function goTo(index: number) {
    setStepIndex(() => Math.min(Math.max(index, 0), stepsCount - 1))
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Enter' && !isLast) {
      // Enter advances step after validating current step fields; prevent full form submit
      event.preventDefault()
      void next()
    }
  }

  const wizardContext: FormWizardContextValue = {
    stepIndex,
    stepsCount,
    next,
    back,
    goTo,
    isFirst,
    isLast,
    currentStepFields,
    form: methods
  }

  return (
    <FormWizardContext.Provider value={wizardContext}>
      <FormProvider {...methods}>
        <form
          className={className}
          onSubmit={methods.handleSubmit(onSubmit)}
          onKeyDown={handleKeyDown}
          noValidate
        >
          {/* Render only the active step and any non-step elements (like a header) */}
          {allChildren.map((child, index) => {
            if (isFormStep(child)) {
              if (steps.indexOf(child) !== stepIndex) return null
              return React.cloneElement(child, { key: `step-${index}` })
            }
            return <React.Fragment key={index}>{child}</React.Fragment>
          })}
        </form>
      </FormProvider>
    </FormWizardContext.Provider>
  )
}

