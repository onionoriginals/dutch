# Task 4: Real-Time Price Updates - Architecture

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  View.tsx (Auction Detail Page)                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ AuctionCard (Basic Info)                              │  │
│  │  - Title, Type, Status                                │  │
│  │  - Static auction information                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Live Price Tracker Section (Dutch Auctions Only)      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ LivePriceDisplay (Full Mode)                    │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │ useLivePrice Hook                        │  │  │  │
│  │  │  │  - requestAnimationFrame loop           │  │  │  │
│  │  │  │  - Price calculation (priceAtTime)      │  │  │  │
│  │  │  │  - Price history management             │  │  │  │
│  │  │  │  - Countdown calculation                │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  │                                                   │  │  │
│  │  │  Components:                                      │  │  │
│  │  │  - Animated Price Display                        │  │  │
│  │  │  - Countdown Timer                               │  │  │
│  │  │  - Live Indicator                                │  │  │
│  │  │  - PriceSparkline (5-min history)               │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  AuctionCard (List View)                                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Basic Auction Info                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Price Section                                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Conditional Render:                             │  │  │
│  │  │                                                  │  │  │
│  │  │ IF type === 'dutch' && isLive && scheduleInput: │  │  │
│  │  │   ┌─────────────────────────────────────────┐   │  │  │
│  │  │   │ LivePriceDisplay (Compact Mode)        │   │  │  │
│  │  │   │  - Live price with animation           │   │  │  │
│  │  │   │  - Countdown timer only                │   │  │  │
│  │  │   │  - No sparkline                        │   │  │  │
│  │  │   └─────────────────────────────────────────┘   │  │  │
│  │  │                                                  │  │  │
│  │  │ ELSE:                                            │  │  │
│  │  │   ┌─────────────────────────────────────────┐   │  │  │
│  │  │   │ Static Price Display                   │   │  │  │
│  │  │   └─────────────────────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/auction/:id                                      │ │
│  │  Returns:                                              │ │
│  │    - auction: AuctionSummary                           │ │
│  │    - rawAuction: ApiAuction (with schedule params)     │ │
│  │    - pricing: { currentPriceLinear, currentPriceStepped│ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  apiAdapter.ts                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  fetchAuction(id)                                      │ │
│  │  - Normalizes API response                             │ │
│  │  - Returns both normalized and raw auction data        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   View.tsx                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Extracts Schedule Parameters:                         │ │
│  │    scheduleInput = {                                   │ │
│  │      startPrice: rawAuction.start_price,               │ │
│  │      floorPrice: rawAuction.min_price,                 │ │
│  │      durationSeconds: rawAuction.duration,             │ │
│  │      intervalSeconds: rawAuction.decrement_interval,   │ │
│  │      decayType: 'linear'                               │ │
│  │    }                                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              LivePriceDisplay Component                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Props:                                                │ │
│  │    - scheduleInput: ScheduleInput                      │ │
│  │    - startTime: ISO string                             │ │
│  │    - endTime: ISO string                               │ │
│  │    - status: auction status                            │ │
│  │    - currency: string                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 useLivePrice Hook                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Every frame (requestAnimationFrame):                  │ │
│  │    1. Check if auction is still active                 │ │
│  │    2. Calculate elapsed time                           │ │
│  │    3. Call priceAtTime(scheduleInput, elapsedSeconds)  │ │
│  │    4. Calculate time to next price drop                │ │
│  │    5. Update price history (trim old entries)          │ │
│  │    6. Update state (throttled to 1s)                   │ │
│  │    7. Schedule next frame                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│            @originals/dutch/schedule                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  priceAtTime(scheduleInput, secondsFromStart)          │ │
│  │    - Linear decay:                                     │ │
│  │        price = start + (floor - start) * (t / duration)│ │
│  │    - Exponential decay:                                │ │
│  │        price = floor + (start - floor) * exp(-k * t)   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   UI Rendering                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Display current price with animation              │ │
│  │  2. Show countdown timer                               │ │
│  │  3. Render price history sparkline                     │ │
│  │  4. Show live indicator                                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## State Management

### Hook State (`useLivePrice`)
```typescript
interface LivePriceState {
  currentPrice: number           // Current auction price
  secondsFromStart: number       // Elapsed time since auction start
  timeToNextDrop: number         // Countdown to next price change
  isActive: boolean              // Whether updates are running
  priceHistory: Array<{          // Rolling 5-minute window
    timestamp: number,
    price: number
  }>
}
```

### Component State (`LivePriceDisplay`)
```typescript
const [previousPrice, setPreviousPrice] = useState(number)
const [priceChanged, setPriceChanged] = useState(boolean)
```

### Refs (No Re-renders)
```typescript
const animationFrameRef = useRef<number | null>(null)
const lastUpdateRef = useRef<number>(Date.now())
const priceHistoryRef = useRef<Array<{timestamp, price}>>([])
```

## Update Cycle

```
┌────────────────────────────────────────────────────────┐
│                Start (Component Mount)                 │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│              Initialize State                          │
│  - Calculate initial price                             │
│  - Set up refs                                         │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│         Schedule First Animation Frame                 │
│  animationFrameRef = requestAnimationFrame(updatePrice)│
└────────────────────────────────────────────────────────┘
                         ↓
         ┌───────────────────────────────┐
         │   Animation Frame Callback    │
         │     (runs at ~60 FPS)         │
         └───────────────────────────────┘
                         ↓
         ┌───────────────────────────────┐
         │   Check if Active             │
         │   (status === 'live' &&       │
         │    now < endTime)             │
         └───────────────────────────────┘
              ↙            ↘
        NO ↙                ↘ YES
          ↙                  ↘
┌────────────────┐    ┌────────────────────────────┐
│  Stop Updates  │    │  Has 1s Elapsed?           │
│  - Cancel RAF  │    └────────────────────────────┘
│  - Set inactive│              ↙       ↘
└────────────────┘        NO ↙           ↘ YES
                            ↙             ↘
                   ┌────────────┐   ┌─────────────────────┐
                   │ Skip       │   │ Update State        │
                   │ (next RAF) │   │ - Calculate price   │
                   └────────────┘   │ - Update history    │
                                    │ - Calculate countdown│
                                    └─────────────────────┘
                                              ↓
                                    ┌─────────────────────┐
                                    │ Schedule Next RAF   │
                                    └─────────────────────┘
                                              ↓
                            ┌─────────────────────────────┐
                            │  Component Unmounts?        │
                            └─────────────────────────────┘
                                       ↙        ↘
                                  NO ↙            ↘ YES
                                    ↙              ↘
                    ┌───────────────┐      ┌──────────────┐
                    │ Continue Loop │      │ Cleanup      │
                    │ (go to RAF)   │      │ - Cancel RAF │
                    └───────────────┘      └──────────────┘
```

## Performance Characteristics

### Update Frequency
- **Animation Frame**: ~60 FPS (every ~16ms)
- **State Updates**: 1 Hz (every 1000ms)
- **Price Calculations**: 1 Hz (only when state updates)

### Memory Usage
- **Price History**: Max 300 entries (5 min × 60 sec)
- **State Size**: ~5KB per auction
- **Cleanup**: Automatic trimming of old data

### CPU Usage
- **RAF Callback**: <1ms per frame (mostly idle checks)
- **Price Calculation**: <1ms per second
- **DOM Updates**: Throttled to 1s intervals

## Browser Compatibility

| Feature | Requirement | Fallback |
|---------|-------------|----------|
| `requestAnimationFrame` | All modern browsers | None needed |
| CSS Transitions | All modern browsers | Degrades gracefully |
| CSS Animations | All modern browsers | Degrades gracefully |
| Array methods | ES6+ | None needed |
| `Date.now()` | All browsers | None needed |

## Error Handling

```typescript
// Invalid schedule parameters
if (startPrice <= 0 || startPrice <= floorPrice) return null

// priceAtTime returns null for invalid input
const price = priceAtTime(scheduleInput, seconds) || scheduleInput.floorPrice

// Component handles null scheduleInput gracefully
{scheduleInput && <LivePriceDisplay ... />}

// Cleanup on unmount prevents memory leaks
useEffect(() => {
  // ... update logic
  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }
}, [deps])
```

## Future Scalability

### Multi-Auction Support
Current implementation can handle multiple auctions simultaneously:
- Each component manages its own RAF loop
- No shared state between instances
- Minimal performance impact per additional auction

### WebSocket Integration (Future)
Easy to extend for real-time sync:
```typescript
// Add to useLivePrice
useEffect(() => {
  const ws = new WebSocket(`wss://api/auction/${id}`)
  ws.onmessage = (event) => {
    // Sync price with server
    const serverPrice = JSON.parse(event.data).price
    // Reconcile with local calculation
  }
  return () => ws.close()
}, [id])
```

### Custom Decay Functions (Future)
Extensible for new pricing models:
```typescript
interface ScheduleInput {
  // ...existing fields
  decayType: 'linear' | 'exponential' | 'step' | 'custom'
  customDecayFn?: (t: number, params: any) => number
}
```
