# Inscription Content Preview Feature

## Overview
Enhanced the inscription selector to render inscriptions in a visually usable way, displaying images, text, HTML, and other content types with appropriate previews.

## Implementation

### New Component: InscriptionPreview (`/workspace/apps/web/src/components/inputs/InscriptionPreview.tsx`)

A specialized React component that intelligently renders different inscription content types based on MIME type.

## Supported Content Types

### 🖼️ Images (`image/*`)
- **Rendering**: Displays actual image from ordinals.com/content/{inscriptionId}
- **Size**: 64x64px thumbnail
- **Features**:
  - Lazy loading for performance
  - Object-fit cover for proper scaling
  - Error fallback to default icon
- **Example**: JPG, PNG, GIF, WebP inscriptions

### 📄 Plain Text (`text/plain`)
- **Rendering**: Document icon with "TXT" badge
- **Visual**: Gray background with text document SVG icon
- **Use case**: Text-based inscriptions like poems, messages, code

### 🌐 HTML (`text/html`)
- **Rendering**: Sandboxed iframe displaying the actual HTML content
- **Size**: 64x64px thumbnail
- **Features**:
  - Sandbox security with `allow-scripts`
  - Pointer events disabled (preview only)
  - Purple "HTML" badge indicator
  - Lazy loading
- **Use case**: Interactive HTML inscriptions, games, art

### 🎨 SVG (`image/svg+xml`)
- **Rendering**: Displays SVG content with proper scaling
- **Features**:
  - Object-contain for proper aspect ratio
  - White background for visibility
  - Green "SVG" badge
- **Use case**: Vector graphics, generative art

### 📊 JSON (`application/json`)
- **Rendering**: JSON file icon with "JSON" badge
- **Visual**: Document icon with yellow badge
- **Use case**: Metadata, trait files, structured data

### 🎥 Video (`video/*`)
- **Rendering**: Video element with thumbnail
- **Features**:
  - Muted and looped playback
  - playsInline for mobile
  - Red "VIDEO" badge
- **Use case**: Video inscriptions, animations

### 🎵 Audio (`audio/*`)
- **Rendering**: Music icon with "AUDIO" badge
- **Visual**: Musical note icon with pink badge
- **Use case**: Music, sound effects, audio NFTs

### 🎯 Unknown/Default Types
- **Rendering**: Gradient ordinals icon (orange to pink)
- **Features**:
  - Inscription number overlay
  - Ordinals brush/paint icon
- **Use case**: Fallback for unsupported formats

## Technical Details

### Content URL Generation
```typescript
const getContentUrl = (inscriptionId: string): string => {
  const isTestnet = inscriptionId.includes('testnet') || 
                    window.location.hostname.includes('testnet')
  
  const baseUrl = isTestnet 
    ? 'https://testnet.ordinals.com'
    : 'https://ordinals.com'
  
  return `${baseUrl}/content/${inscriptionId}`
}
```

### Preview Component Props
```typescript
interface InscriptionPreviewProps {
  inscriptionId: string
  contentType?: string
  inscriptionNumber?: number
}
```

### Security Considerations

#### HTML Iframes
- Uses `sandbox="allow-scripts"` attribute
- Disables pointer events with CSS
- Loads from trusted ordinals.com domain
- Size-constrained to 64x64px preview

#### Image Loading
- Lazy loading to reduce bandwidth
- Error handling prevents broken images
- Fallback to default icon on load errors

### Performance Optimizations

1. **Lazy Loading**: Images and iframes use native lazy loading
2. **Size Constraints**: All previews fixed at 64x64px
3. **Error Boundaries**: Graceful fallbacks prevent component crashes
4. **Conditional Rendering**: Only loads content type components needed

## Integration

### InscriptionSelector Component
The preview is seamlessly integrated into the selector:

```tsx
<InscriptionPreview
  inscriptionId={inscription.inscriptionId}
  contentType={inscription.contentType}
  inscriptionNumber={inscription.inscriptionNumber}
/>
```

### Layout Structure
```
┌─────────────────────────────────────────┐
│ [✓] [Preview] #12345 image/png         │
│              abc123...def456i0          │
│              546 sats                   │
├─────────────────────────────────────────┤
│ [✓] [Preview] #12346 text/html         │
│              789abc...123def i1         │
│              1000 sats                  │
└─────────────────────────────────────────┘
```

## User Experience

### Visual Feedback
- **Checkboxes**: Select/deselect inscriptions
- **Preview thumbnails**: See actual content
- **Type badges**: Quick content type identification
- **Hover effects**: Highlight on mouse over
- **Selection state**: Blue background when selected

### Content Recognition
Users can now:
1. **See images** before selecting them
2. **Identify text content** by icon
3. **Recognize HTML** interactive content
4. **Distinguish SVG** vector art
5. **Spot multimedia** (video/audio) content

## Examples

### Image Inscription
```
┌────────────────┐
│ [Cat Photo]    │ ← Actual image displays
│ #12345         │ ← Inscription number overlay
└────────────────┘
```

### HTML Inscription  
```
┌────────────────┐
│ [HTML Preview] │ ← Live rendered HTML
│ HTML           │ ← Purple badge
└────────────────┘
```

### Text Inscription
```
┌────────────────┐
│ [📄 Icon]      │ ← Document icon
│ TXT            │ ← Blue badge
└────────────────┘
```

## Browser Compatibility

- ✅ Chrome/Chromium (full support)
- ✅ Firefox (full support)
- ✅ Safari (full support)
- ✅ Edge (full support)
- ✅ Mobile browsers (responsive)

## Testing

### Test Cases

1. **Image Inscriptions**
   - Load inscription with image/png content type
   - Verify image displays correctly
   - Test error fallback with invalid image

2. **HTML Inscriptions**
   - Load inscription with text/html content type
   - Verify iframe renders safely
   - Test sandbox security

3. **Text Inscriptions**
   - Load inscription with text/plain content type
   - Verify icon displays with TXT badge

4. **Unknown Types**
   - Load inscription with no content type
   - Verify default ordinals icon shows
   - Check inscription number displays

5. **Error Handling**
   - Test with unreachable content URLs
   - Verify graceful fallback to default icon
   - Check no console errors occur

### Manual Testing Steps
1. Connect wallet with various inscription types
2. Open create auction page
3. Verify each content type renders appropriately:
   - Images show actual images
   - Text shows document icon
   - HTML shows iframe preview
   - Unknown types show ordinals icon
4. Select inscriptions and verify selection works
5. Test on mobile devices for responsiveness

## Accessibility

- **Alt text**: Images include descriptive alt text
- **ARIA labels**: Interactive elements properly labeled
- **Keyboard navigation**: Checkbox selection works with keyboard
- **Color contrast**: Badges meet WCAG AA standards
- **Screen readers**: Semantic HTML for proper announcement

## Future Enhancements

1. **Zoom on hover**: Expand preview to larger size on mouse hover
2. **Full preview modal**: Click to view full inscription in popup
3. **Animation support**: Animate GIFs and videos in preview
4. **3D model support**: Preview GLB/GLTF inscriptions
5. **PDF preview**: Render first page of PDF inscriptions
6. **Code highlighting**: Syntax highlighting for code inscriptions
7. **Audio waveforms**: Visual waveform for audio inscriptions
8. **Video playback**: Play/pause controls in preview

## Files Modified

1. `/workspace/apps/web/src/components/inputs/InscriptionPreview.tsx` - **NEW**: Preview component
2. `/workspace/apps/web/src/components/inputs/InscriptionSelector.tsx` - Updated to use preview
3. `/workspace/INSCRIPTION_SELECTOR_IMPLEMENTATION.md` - Updated documentation

## Summary

The inscription preview feature transforms the auction creation experience from text-only IDs to rich visual content, making it dramatically easier for users to:

- ✅ **Identify** inscriptions at a glance
- ✅ **Verify** they're selecting the correct content
- ✅ **Distinguish** between different content types
- ✅ **Preview** actual inscription content
- ✅ **Reduce errors** by seeing what they're auctioning

This enhancement significantly improves UX and reduces the likelihood of users accidentally auctioning the wrong inscription.
