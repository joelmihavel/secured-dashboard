# Pixel-Perfect Implementation Guide

## Screen: Screen 1-28055
## Figma Node: 1:28055
## File Key: HZaVuwWn6B6jOjrmxZ7Kzv

---

## STEP 1: Get Figma Semantic Structure

Call the Figma MCP to get the design context:

```
mcp__figma__get_design_context({
  fileKey: "HZaVuwWn6B6jOjrmxZ7Kzv",
  nodeId: "1:28055"
})
```

This provides:
- Parent-child hierarchy
- Multi-span text structure
- Component relationships

---

## STEP 2: Load Extracted Styles

Use the pre-computed styles from:
`/Users/atrishabh/Documents/Dev/Secured v2-react-native project/autonomous-parity-fixer/data/combined/1-28055/style-map.json`

Total styles available: 35

### Key Styles:
- splashGetstarted: FRAME (Splash / get-started)
- image149: RECTANGLE (image 149)
- vector1: VECTOR (Vector 1)
- backgroundShape: RECTANGLE (Background Shape)
- hwCutoutSafezone: RECTANGLE (HW Cutout Safezone)
- statusBar: INSTANCE (Status Bar)
- battery: GROUP (Battery)
- border: RECTANGLE (Border)
- cap: VECTOR (Cap)
- capacity: RECTANGLE (Capacity)

---

## STEP 3: Implement Component

### Generated Component Template:
`/Users/atrishabh/Documents/Dev/Secured v2-react-native project/autonomous-parity-fixer/output/components/1-28055.tsx`

### Target Location:
`/Users/atrishabh/FlentApp/app/(auth)`

---

## STEP 4: Verify Implementation

1. Build and run on iOS simulator
2. Navigate to the screen
3. Capture screenshot: `xcrun simctl io booted screenshot`
4. Compare with Figma baseline

---

## Key Colors (from extraction)
- background: #131313
- white: #FFFFFF
- color000000: #000000
- textSubtle: #A6A6A6
- textDisabled: #4D4D4D
- color797979: #797979

## Key Typography
- 17_590: {"fontSize":17,"fontWeight":"590","lineHeight":20.29}
- 48_400: {"fontSize":48,"fontWeight":"400","lineHeight":64,"letterSpacing":-2}
- 14_400: {"fontSize":14,"fontWeight":"400","lineHeight":20}
- 16_500: {"fontSize":16,"fontWeight":"500","lineHeight":24}
- 12_400: {"fontSize":12,"fontWeight":"400","lineHeight":20}

---

## Text Content (for reference)
- "13:13"
- "Make  your rent  work for you→"
- "Secured is India's first rent payment app built to reward reliable tenants."
- "Get Started"
- "Already a user? Log in"
