# Task 4: Real-Time Price Updates - Quick Reference

## 🚀 Quick Start

### Using LivePriceDisplay Component

```tsx
import LivePriceDisplay from '@/components/auction/LivePriceDisplay'
import type { ScheduleInput } from '@originals/dutch/browser'

// Define your auction schedule
const schedule: ScheduleInput = {
  startPrice: 10000,      // Starting price in sats
  floorPrice: 1000,       // Minimum price (floor)
  durationSeconds: 3600,  // 1 hour auction
  intervalSeconds: 60,    // Price drops every 60 seconds
  decayType: 'linear'     // or 'exponential'
}

// In your component
<LivePriceDisplay
  scheduleInput={schedule}
  startTime="2025-01-01T00:00:00Z"
  endTime="2025-01-01T01:00:00Z"
  status="live"
  currency="BTC"
  showSparkline={true}
  showCountdown={true}
  compact={false}
/>
```

### Using useLivePrice Hook

```tsx
import { useLivePrice } from '@/hooks/useLivePrice'

function MyComponent() {
  const livePrice = useLivePrice({
    scheduleInput: {
      startPrice: 10000,
      floorPrice: 1000,
      durationSeconds: 3600,
      intervalSeconds: 60,
      decayType: 'linear'
    },
    startTime: "2025-01-01T00:00:00Z",
    endTime: "2025-01-01T01:00:00Z",
    status: "live"
  })

  return (
    <div>
      <p>Current Price: {livePrice.currentPrice}</p>
      <p>Next drop in: {livePrice.timeToNextDrop}s</p>
      <p>Status: {livePrice.isActive ? 'Active' : 'Inactive'}</p>
    </div>
  )
}
```

## 📋 Component Props

### LivePriceDisplay

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `scheduleInput` | `ScheduleInput` | ✅ | - | Dutch auction schedule parameters |
| `startTime` | `string` | ✅ | - | ISO 8601 timestamp of auction start |
| `endTime` | `string` | ✅ | - | ISO 8601 timestamp of auction end |
| `status` | `'draft' \| 'scheduled' \| 'live' \| 'ended'` | ✅ | - | Current auction status |
| `currency` | `string` | ✅ | - | Currency code (e.g., 'BTC', 'USD') |
| `className` | `string` | ❌ | `''` | Additional CSS classes |
| `showSparkline` | `boolean` | ❌ | `true` | Show price history chart |
| `showCountdown` | `boolean` | ❌ | `true` | Show countdown timer |
| `compact` | `boolean` | ❌ | `false` | Use compact single-line layout |

### ScheduleInput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `startPrice` | `number` | ✅ | Starting price (must be > floorPrice) |
| `floorPrice` | `number` | ✅ | Minimum price (floor) |
| `durationSeconds` | `number` | ✅ | Total auction duration in seconds |
| `intervalSeconds` | `number` | ✅ | Time between price drops in seconds |
| `decayType` | `'linear' \| 'exponential'` | ✅ | Price decay algorithm |

## 🎯 Common Use Cases

### 1. Auction Detail Page (Full Display)

```tsx
<LivePriceDisplay
  scheduleInput={scheduleInput}
  startTime={auction.startTime}
  endTime={auction.endTime}
  status={auction.status}
  currency="BTC"
  showSparkline={true}
  showCountdown={true}
  compact={false}
/>
```

**Shows:**
- ✅ Large animated price
- ✅ Countdown timer
- ✅ Live indicator
- ✅ 5-minute price history sparkline

---

### 2. Auction List/Card (Compact Display)

```tsx
<LivePriceDisplay
  scheduleInput={scheduleInput}
  startTime={auction.startTime}
  endTime={auction.endTime}
  status={auction.status}
  currency="BTC"
  compact={true}
  showSparkline={false}
  showCountdown={true}
/>
```

**Shows:**
- ✅ Single-line price with animation
- ✅ Compact countdown timer
- ❌ No sparkline (space-saving)

---

### 3. Conditional Rendering (AuctionCard Pattern)

```tsx
{type === 'dutch' && scheduleInput && isLive ? (
  <LivePriceDisplay
    scheduleInput={scheduleInput}
    startTime={startTime}
    endTime={endTime}
    status={status}
    currency={currency}
    compact={true}
  />
) : (
  <div className="text-lg font-semibold">
    {formatCurrency(currentPrice, currency)}
  </div>
)}
```

---

### 4. Custom Hook Usage (Advanced)

```tsx
function CustomPriceDisplay() {
  const { currentPrice, timeToNextDrop, priceHistory, isActive } = useLivePrice({
    scheduleInput,
    startTime,
    endTime,
    status,
    updateInterval: 1000,      // Update every 1 second
    historyDuration: 300000    // Keep 5 minutes of history
  })

  // Build your own UI
  return (
    <div>
      <AnimatedNumber value={currentPrice} />
      <Countdown seconds={timeToNextDrop} />
      <CustomChart data={priceHistory} />
    </div>
  )
}
```

## 🔧 Extracting Schedule from API

### From fetchAuction Response

```tsx
const data = await fetchAuction(auctionId)

const scheduleInput: ScheduleInput | null = React.useMemo(() => {
  if (data.auction.type !== 'dutch' || !data.rawAuction) return null
  
  const raw = data.rawAuction
  
  return {
    startPrice: raw.start_price ?? 0,
    floorPrice: raw.min_price ?? 0,
    durationSeconds: raw.duration ?? 3600,
    intervalSeconds: raw.decrement_interval ?? 60,
    decayType: 'linear'
  }
}, [data])

// Use scheduleInput with LivePriceDisplay
```

### Validation

```tsx
// Always validate before using
if (scheduleInput && scheduleInput.startPrice > scheduleInput.floorPrice) {
  // Safe to use
  <LivePriceDisplay scheduleInput={scheduleInput} {...otherProps} />
}
```

## 🎨 Styling & Customization

### Custom Classes

```tsx
<LivePriceDisplay
  className="my-custom-class"
  // ... other props
/>
```

### Animation Customization

The component uses CSS transitions. Override in your stylesheet:

```css
/* Custom animation speed */
.custom-price-display span {
  transition: all 500ms ease-in-out;
}

/* Custom pulse animation */
@keyframes custom-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.15); }
}
```

### Dark Mode

Component automatically supports dark mode via Tailwind classes:
- `dark:bg-gray-900` - Dark background
- `dark:text-white` - Dark text
- `dark:border-gray-700` - Dark borders

## 🧪 Testing

### Test Price Calculations

```typescript
import { priceAtTime } from '@originals/dutch/browser'

const schedule = {
  startPrice: 10000,
  floorPrice: 1000,
  durationSeconds: 3600,
  intervalSeconds: 60,
  decayType: 'linear' as const
}

// Test at start
expect(priceAtTime(schedule, 0)).toBe(10000)

// Test at end
expect(priceAtTime(schedule, 3600)).toBe(1000)

// Test at midpoint
expect(priceAtTime(schedule, 1800)).toBe(5500)
```

### Test Component Rendering

```tsx
import { render, screen } from '@testing-library/react'
import LivePriceDisplay from './LivePriceDisplay'

test('shows current price', () => {
  render(
    <LivePriceDisplay
      scheduleInput={schedule}
      startTime={new Date().toISOString()}
      endTime={new Date(Date.now() + 3600000).toISOString()}
      status="live"
      currency="BTC"
    />
  )
  
  expect(screen.getByText(/Current Price/i)).toBeInTheDocument()
})
```

## 🐛 Common Issues & Solutions

### Issue: Price not updating

**Solution:** Check auction status and timestamps
```tsx
// Ensure status is 'live'
status === 'live' // ✅

// Ensure auction hasn't ended
new Date(endTime).getTime() > Date.now() // ✅

// Ensure auction has started
new Date(startTime).getTime() <= Date.now() // ✅
```

---

### Issue: Countdown shows negative numbers

**Solution:** Price drop interval validation
```tsx
// intervalSeconds must divide durationSeconds evenly
durationSeconds % intervalSeconds === 0 // ✅

// Example: 3600 % 60 = 0 ✅
// Example: 3600 % 70 = 40 ❌ (use 72 or 60 instead)
```

---

### Issue: Sparkline not showing

**Solution:** Check props and data
```tsx
// Must be enabled
showSparkline={true} // ✅

// Must have history data (takes ~30s to populate)
priceHistory.length > 1 // ✅

// Must not be in compact mode
compact={false} // ✅
```

---

### Issue: Memory leak warnings

**Solution:** Ensure proper cleanup (already handled internally)
```tsx
// The hook automatically cleans up on unmount
// If you're seeing warnings, check for:

// 1. Multiple instances of the same auction
// 2. Rapid mount/unmount cycles
// 3. setState called after unmount (shouldn't happen with our implementation)
```

## 📊 Performance Tips

### 1. Memoize Schedule Input
```tsx
const scheduleInput = React.useMemo(() => ({
  startPrice: auction.startPrice,
  floorPrice: auction.floorPrice,
  durationSeconds: auction.duration,
  intervalSeconds: auction.interval,
  decayType: 'linear'
}), [auction]) // Only recalculate when auction changes
```

### 2. Conditional Rendering
```tsx
// Only render for live auctions
{status === 'live' && (
  <LivePriceDisplay {...props} />
)}
```

### 3. Use Compact Mode in Lists
```tsx
// Saves CPU by skipping sparkline
<LivePriceDisplay compact={true} showSparkline={false} {...props} />
```

### 4. Adjust Update Interval
```tsx
// For less critical displays, reduce update frequency
const livePrice = useLivePrice({
  ...options,
  updateInterval: 2000 // Update every 2 seconds instead of 1
})
```

## 🔗 Related Files

- **Hook**: `/apps/web/src/hooks/useLivePrice.ts`
- **Component**: `/apps/web/src/components/auction/LivePriceDisplay.tsx`
- **Price Calculation**: `/packages/dutch/src/schedule.ts`
- **Sparkline**: `/apps/web/src/components/auction/PriceSparkline.tsx`
- **Usage Example**: `/apps/web/src/react/auctions/View.tsx`

## 📚 Further Reading

- [Dutch Auction Schedule Documentation](../packages/dutch/README.md)
- [PriceSparkline Component](../apps/web/src/components/auction/PriceSparkline.tsx)
- [requestAnimationFrame MDN](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [React useEffect Hook](https://react.dev/reference/react/useEffect)
