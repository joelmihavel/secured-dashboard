# Flent Secured App Icon Design Specification

## Overview
Create app icons for the Flent Secured iOS application featuring a keyhole design that represents security and trust.

## Design Requirements

### Visual Elements

1. **Background**
   - Gradient fill from top-left to bottom-right
   - Start color: #FFAE8A (warm peach/orange)
   - End color: #FF9A6D (deeper orange)
   - Smooth linear gradient at approximately 135 degrees

2. **Keyhole Icon**
   - Color: Pure white (#FFFFFF)
   - Position: Centered both horizontally and vertically
   - Size: Approximately 50-55% of the icon width
   - Style: Modern, clean silhouette with soft edges

3. **Keyhole Shape Details**
   - Top portion: Circular shape (represents the key bow area)
   - Bottom portion: Rounded rectangle extending downward (represents the key blade slot)
   - The circle should be approximately 2x the width of the rectangular portion
   - Proportions: The rectangular slot should be about 1.5x the height of the circular top
   - Corners: Slightly rounded for a modern feel (radius ~5% of icon size)

### Icon Sizes Required

Generate PNG files at the following sizes (all must be square):

| Filename | Pixel Size | Usage |
|----------|-----------|-------|
| AppIcon-1024.png | 1024x1024 | App Store |
| AppIcon-60@3x.png | 180x180 | iPhone @3x |
| AppIcon-60@2x.png | 120x120 | iPhone @2x |
| AppIcon-83.5@2x.png | 167x167 | iPad Pro @2x |
| AppIcon-76@2x.png | 152x152 | iPad @2x |
| AppIcon-76.png | 76x76 | iPad @1x |
| AppIcon-40@3x.png | 120x120 | iPhone Spotlight @3x |
| AppIcon-40@2x.png | 80x80 | iPhone Spotlight @2x |
| AppIcon-40@2x-ipad.png | 80x80 | iPad Spotlight @2x |
| AppIcon-40.png | 40x40 | iPad Spotlight @1x |
| AppIcon-29@3x.png | 87x87 | iPhone Settings @3x |
| AppIcon-29@2x.png | 58x58 | iPhone Settings @2x |
| AppIcon-29@2x-ipad.png | 58x58 | iPad Settings @2x |
| AppIcon-29.png | 29x29 | iPad Settings @1x |
| AppIcon-20@3x.png | 60x60 | iPhone Notification @3x |
| AppIcon-20@2x.png | 40x40 | iPhone Notification @2x |
| AppIcon-20@2x-ipad.png | 40x40 | iPad Notification @2x |
| AppIcon-20.png | 20x20 | iPad Notification @1x |

### Design Guidelines

1. **Do NOT include rounded corners** - iOS automatically applies the rounded rectangle mask
2. **Do NOT include drop shadows or gloss** - iOS handles these effects
3. **Keep the design simple and recognizable at small sizes**
4. **Ensure sufficient contrast between the white keyhole and orange background**
5. **The icon should work well in both light and dark mode contexts**

### Color Values

```
Background Gradient:
- Start: #FFAE8A (RGB: 255, 174, 138)
- End: #FF9A6D (RGB: 255, 154, 109)

Keyhole:
- Fill: #FFFFFF (RGB: 255, 255, 255)
```

### Brand Context

The keyhole represents:
- Security and protection (secured deposits)
- Trust and reliability
- Access to safe rental services

The orange gradient aligns with the Flent brand colors, conveying:
- Warmth and approachability
- Energy and confidence
- Modern, fresh aesthetic

## Export Settings

- Format: PNG
- Color space: sRGB
- Bit depth: 8-bit
- Transparency: Not required (solid background)
- Compression: Optimized for quality

## File Placement

Place all generated PNG files in this directory:
`/Resources/Assets.xcassets/AppIcon.appiconset/`

The Contents.json file is already configured to reference these filenames.
