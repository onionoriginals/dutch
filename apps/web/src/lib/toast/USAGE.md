# Toast System Usage

A reusable toast notification system for displaying success, error, warning, and info messages throughout the application.

## Quick Start

The toast system is already set up in the main pages (`index.astro` and `auctions/new.astro`). To use it in any component within these pages:

```tsx
import { useToast } from '../../lib/toast/ToastContext'

function MyComponent() {
  const toast = useToast()
  
  const handleClick = () => {
    toast.success('Operation completed successfully!')
  }
  
  return <button onClick={handleClick}>Click me</button>
}
```

## API Reference

### `useToast()` Hook

Returns an object with the following methods:

#### `success(message, title?, duration?)`
Show a success toast (green theme with checkmark icon)

```tsx
toast.success('Wallet address copied to clipboard', 'Address Copied!')
toast.success('Item saved', undefined, 5000) // Custom 5s duration
```

#### `error(message, title?, duration?)`
Show an error toast (red theme with error icon)

```tsx
toast.error('Failed to connect wallet', 'Connection Error')
toast.error('Something went wrong')
```

#### `warning(message, title?, duration?)`
Show a warning toast (yellow theme with warning icon)

```tsx
toast.warning('This action cannot be undone', 'Are you sure?')
```

#### `info(message, title?, duration?)`
Show an info toast (blue theme with info icon)

```tsx
toast.info('New feature available', 'Update')
```

#### `showToast(options)`
Advanced usage with custom options

```tsx
toast.showToast({
  type: 'success',
  message: 'Custom toast',
  title: 'Title',
  duration: 3000 // milliseconds, 0 = no auto-dismiss
})
```

## Examples

### Form Submission

```tsx
const handleSubmit = async (data) => {
  try {
    await api.submitForm(data)
    toast.success('Form submitted successfully!', 'Success')
  } catch (error) {
    toast.error(error.message, 'Submission Failed')
  }
}
```

### Copy to Clipboard

```tsx
const handleCopy = () => {
  navigator.clipboard.writeText(text)
  toast.success('Text copied to clipboard', 'Copied!')
}
```

### Async Operations

```tsx
const handleDelete = async () => {
  toast.info('Deleting item...', 'Please wait')
  
  try {
    await api.deleteItem(id)
    toast.success('Item deleted successfully')
  } catch (error) {
    toast.error('Failed to delete item', 'Error')
  }
}
```

### Validation Warning

```tsx
const handleValidate = (input) => {
  if (!isValid(input)) {
    toast.warning('Please check your input', 'Validation Warning')
    return false
  }
  return true
}
```

## Customization

### Default Duration
By default, toasts auto-dismiss after 3 seconds. You can customize this:

```tsx
toast.success('Message', 'Title', 5000) // 5 seconds
toast.error('Message', 'Title', 0)     // Never auto-dismiss
```

### Toast Types and Styling
- **Success**: Green theme, checkmark icon
- **Error**: Red theme, X icon  
- **Warning**: Yellow theme, warning triangle icon
- **Info**: Blue theme, info circle icon

All toasts support dark mode automatically.

## Integration in New Pages

If you need to add the toast system to a new Astro page:

```astro
---
import { ToastProvider } from '../lib/toast/ToastContext'
import ToastContainer from '../components/ui/ToastContainer'
// ... other imports
---

<html>
  <body>
    <ToastProvider client:load>
      <!-- Your content -->
      <ToastContainer client:load />
    </ToastProvider>
  </body>
</html>
```

## Architecture

- **ToastContext.tsx**: React Context for managing toast state
- **ToastContainer.tsx**: UI component that renders all active toasts
- **useToast()**: Hook to access toast functions from any component

Toasts are positioned in the top-right corner and automatically stack when multiple toasts are shown.
