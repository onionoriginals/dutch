# Visual Preview Guide for Inscription Selector

## Content Type Rendering Examples

This guide shows how different inscription content types are rendered in the selector.

---

### 🖼️ Image Inscriptions (`image/*`)

**Supported formats**: JPG, PNG, GIF, WebP, AVIF

```
┌────────────────────────────────────────┐
│ [✓] ┌──────────┐  #12345 image/png    │
│     │  [Cat]   │  abc123...def456i0    │
│     │  Photo   │  546 sats             │
│     └──────────┘                       │
└────────────────────────────────────────┘
     64x64px actual image thumbnail
```

**Features**:
- Shows the actual inscription image
- Lazy loads for performance
- Object-fit: cover for proper scaling
- Falls back to default icon on error

---

### 🌐 HTML Inscriptions (`text/html`)

**Use cases**: Interactive art, games, generative HTML

```
┌────────────────────────────────────────┐
│ [✓] ┌──────────┐  #12346 text/html    │
│     │ [Live]   │  789abc...123def i1   │
│     │ HTML     │  1000 sats            │
│     └──────HTML─┘                      │
└────────────────────────────────────────┘
     Sandboxed iframe rendering
```

**Features**:
- Renders actual HTML in sandboxed iframe
- Security: `sandbox="allow-scripts"`
- Pointer events disabled (preview only)
- Purple "HTML" badge indicator
- 64x64px window into content

**Security Note**: Iframe is sandboxed and constrained to prevent malicious code execution.

---

### 📄 Text Inscriptions (`text/plain`)

**Use cases**: Poems, messages, code, plain text

```
┌────────────────────────────────────────┐
│ [✓] ┌──────────┐  #12347 text/plain   │
│     │    📄    │  xyz987...654abci0    │
│     │          │  333 sats             │
│     └─────TXT──┘                       │
└────────────────────────────────────────┘
     Document icon with blue badge
```

**Features**:
- Gray background with document SVG icon
- Blue "TXT" badge for quick identification
- No content loading required

---

### 🎨 SVG Inscriptions (`image/svg+xml`)

**Use cases**: Vector art, logos, generative graphics

```
┌────────────────────────────────────────┐
│ [✓] ┌──────────┐  #12348 image/svg    │
│     │ [Vector] │  aaa111...bbb222i0    │
│     │   Art    │  750 sats             │
│     └─────SVG──┘                       │
└────────────────────────────────────────┘
     SVG rendered with proper scaling
```

**Features**:
- Displays SVG with object-contain
- White background for visibility
- Green "SVG" badge
- Maintains aspect ratio

---

### 📊 JSON Inscriptions (`application/json`)

**Use cases**: Metadata, traits, structured data

```
┌────────────────────────────────────────┐
│ [✓] ┌──────────┐  #12349 application/  │
│     │    {}    │  json                 │
│     │          │  ccc333...ddd444i0    │
│     └────JSON──┘  500 sats             │
└────────────────────────────────────────┘
     JSON file icon with yellow badge
```

**Features**:
- File icon representing JSON data
- Yellow "JSON" badge
- Lightweight preview (no parsing)

---

### 🎥 Video Inscriptions (`video/*`)

**Supported formats**: MP4, WebM, OGG

```
┌────────────────────────────────────────┐
│ [✓] ┌──────────┐  #12350 video/mp4    │
│     │ [Video]  │  eee555...fff666i0    │
│     │  Frame   │  2000 sats            │
│     └───VIDEO──┘                       │
└────────────────────────────────────────┘
     Video element (muted, looped)
```

**Features**:
- Shows video thumbnail/first frame
- Muted and looped playback
- Red "VIDEO" badge
- Optimized for mobile (playsInline)

---

### 🎵 Audio Inscriptions (`audio/*`)

**Supported formats**: MP3, WAV, OGG, FLAC

```
┌────────────────────────────────────────┐
│ [✓] ┌──────────┐  #12351 audio/mp3    │
│     │    ♪♫    │  ggg777...hhh888i0    │
│     │          │  1500 sats            │
│     └───AUDIO──┘                       │
└────────────────────────────────────────┘
     Music note icon with pink badge
```

**Features**:
- Musical note SVG icon
- Pink "AUDIO" badge
- No audio playback in preview (icon only)

---

### 🎯 Unknown/Default Type

**Use cases**: Fallback for unsupported formats, binary data

```
┌────────────────────────────────────────┐
│ [✓] ┌──────────┐  #12352 application/  │
│     │ [Paint]  │  octet-stream         │
│     │ Brush    │  iii999...jjj000i0    │
│     └─────#12352┘  800 sats            │
└────────────────────────────────────────┘
     Gradient ordinals icon (orange→pink)
```

**Features**:
- Beautiful gradient background (orange to pink)
- White ordinals brush/paint icon
- Inscription number overlay
- Works for any content type

---

## Layout Examples

### Full Selector View

```
┌───────────────────────────────────────────────────────────┐
│ Inscription IDs                                           │
├───────────────────────────────────────────────────────────┤
│ Your Inscriptions (5)      [Select All] [Deselect All]   │
│                                            [Manual Input] │
├───────────────────────────────────────────────────────────┤
│ [✓] [Cat Image]  #12345 image/png                        │
│                  abc123...def456i0                        │
│                  546 sats                                 │
├───────────────────────────────────────────────────────────┤
│ [✓] [HTML Art]   #12346 text/html                        │
│                  789abc...123def i1                       │
│                  1000 sats                                │
├───────────────────────────────────────────────────────────┤
│ [ ] [Text Doc]   #12347 text/plain                       │
│                  xyz987...654abci0                        │
│                  333 sats                                 │
├───────────────────────────────────────────────────────────┤
│ [ ] [SVG Art]    #12348 image/svg+xml                    │
│                  aaa111...bbb222i0                        │
│                  750 sats                                 │
├───────────────────────────────────────────────────────────┤
│ [ ] [JSON Data]  #12349 application/json                 │
│                  ccc333...ddd444i0                        │
│                  500 sats                                 │
└───────────────────────────────────────────────────────────┘
📦 2 inscriptions selected

Select inscriptions from your wallet or enter them manually
```

---

## Interaction States

### Normal State
```
[ ] [Preview] #12345 image/png
              abc123...def456i0
              546 sats
```
- White/gray background
- Unchecked checkbox
- Default colors

### Hover State
```
[ ] [Preview] #12345 image/png  ← Lighter gray background
              abc123...def456i0
              546 sats
```
- Slight background color change
- Cursor changes to pointer
- Smooth transition

### Selected State
```
[✓] [Preview] #12345 image/png  ← Blue background
              abc123...def456i0
              546 sats
```
- Blue background tint
- Checked checkbox
- Clear visual feedback

---

## Responsive Behavior

### Desktop (1024px+)
- Full width selector
- 64x64px previews
- Full inscription IDs visible
- All metadata shown

### Tablet (768px - 1023px)
- Adjusted width
- 64x64px previews maintained
- Inscription IDs may wrap
- All features available

### Mobile (< 768px)
- Stacked layout
- 64x64px previews (larger relative to screen)
- Inscription IDs truncated with ellipsis
- Touch-friendly checkboxes
- Scrollable list

---

## Loading States

### Fetching Inscriptions
```
┌─────────────────────────────────────┐
│ Loading inscriptions...             │
│                                     │
│        [Spinning Icon]              │
│                                     │
└─────────────────────────────────────┘
```

### No Inscriptions Found
```
┌─────────────────────────────────────┐
│ ⚠️ No inscriptions found in your    │
│    wallet                           │
│                                     │
│    [Enter inscription IDs manually] │
└─────────────────────────────────────┘
```

### Error State
```
┌─────────────────────────────────────┐
│ ⚠️ Failed to fetch inscriptions     │
│                                     │
│    [Enter inscription IDs manually] │
└─────────────────────────────────────┘
```

---

## Dark Mode Support

All previews adapt to dark mode:

- **Backgrounds**: Dark gray instead of white
- **Text**: Light gray instead of dark
- **Badges**: Adjusted contrast
- **Icons**: Lighter colors
- **Borders**: Subtle gray tones
- **Selection**: Dark blue tint

Example in dark mode:
```
[✓] [Preview] #12345 image/png  ← Dark blue background
              abc123...def456i0    ← Light gray text
              546 sats             ← Dimmed gray
```

---

## Accessibility Features

### Keyboard Navigation
- **Tab**: Move between checkboxes
- **Space**: Toggle selection
- **Shift+Tab**: Move backward

### Screen Reader Support
- Semantic HTML structure
- ARIA labels on interactive elements
- Descriptive alt text for images
- Role attributes for custom components

### Visual Accessibility
- High contrast badges
- Clear focus indicators
- Large touch targets (44x44px minimum)
- Color-blind friendly badges

---

## Performance Considerations

### Image Loading
- **Lazy loading**: Images load as scrolled into view
- **Loading="lazy"**: Native browser lazy loading
- **Size optimization**: 64x64px thumbnails only

### Iframe Loading
- **Lazy loading**: Iframes defer until visible
- **Sandbox restrictions**: Limited execution
- **Size constraints**: Fixed 64x64px

### List Rendering
- **Virtualization ready**: Can be extended for 1000+ items
- **Key optimization**: Stable keys prevent re-renders
- **Conditional rendering**: Only active content loads

---

## Example Use Cases

### NFT Collection Auction
Select multiple image inscriptions:
```
[✓] [Punk #1]  #10001
[✓] [Punk #2]  #10002
[✓] [Punk #3]  #10003
📦 3 inscriptions selected
```

### Generative Art Auction
Mix of HTML and SVG:
```
[✓] [HTML Art]  #20001
[✓] [SVG Art]   #20002
📦 2 inscriptions selected
```

### Metadata + Art Bundle
JSON metadata with image:
```
[✓] [Image]     #30001
[✓] [Metadata]  #30002
📦 2 inscriptions selected
```

---

## Browser Testing Matrix

| Browser | Image | HTML | SVG | Video | Audio | Text | JSON |
|---------|-------|------|-----|-------|-------|------|------|
| Chrome  | ✅    | ✅   | ✅  | ✅    | ✅    | ✅   | ✅   |
| Firefox | ✅    | ✅   | ✅  | ✅    | ✅    | ✅   | ✅   |
| Safari  | ✅    | ✅   | ✅  | ✅    | ✅    | ✅   | ✅   |
| Edge    | ✅    | ✅   | ✅  | ✅    | ✅    | ✅   | ✅   |

---

## Summary

The visual preview system provides:
- **Rich content display** for all major inscription types
- **Secure rendering** with sandboxed iframes
- **Performance optimization** with lazy loading
- **Accessibility** for all users
- **Responsive design** for all devices
- **Dark mode** compatibility
- **Error resilience** with graceful fallbacks

This significantly enhances the user experience by letting users **see what they're auctioning** before confirming their selection.
