# Pixel-Perfect Implementation Guide

## Screen: Screen 1-31073
## Figma Node: 1:31073
## File Key: HZaVuwWn6B6jOjrmxZ7Kzv

---

## STEP 1: Get Figma Semantic Structure

Call the Figma MCP to get the design context:

```
mcp__figma__get_design_context({
  fileKey: "HZaVuwWn6B6jOjrmxZ7Kzv",
  nodeId: "1:31073"
})
```

This provides:
- Parent-child hierarchy
- Multi-span text structure
- Component relationships

---

## STEP 2: Load Extracted Styles

Use the pre-computed styles from:
`/Users/atrishabh/Documents/Dev/Secured v2-react-native project/autonomous-parity-fixer/data/combined/1-31073/style-map.json`

Total styles available: 179

### Key Styles:
- authSignUpFilled: FRAME (auth / sign up --filled)
- image149: RECTANGLE (image 149)
- backgroundShape: RECTANGLE (Background Shape)
- backgroundShape2: RECTANGLE (Background Shape)
- vector1: VECTOR (Vector 1)
- hwCutoutSafezone: RECTANGLE (HW Cutout Safezone)
- statusBar: INSTANCE (Status Bar)
- battery: GROUP (Battery)
- border: RECTANGLE (Border)
- cap: VECTOR (Cap)

---

## STEP 3: Implement Component

### Generated Component Template:
`/Users/atrishabh/Documents/Dev/Secured v2-react-native project/autonomous-parity-fixer/output/components/1-31073.tsx`

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
- colorD9D9D9: #D9D9D9
- colorEEEEEE: #EEEEEE
- colorA9A9A9: #A9A9A9
- color70BF73: #70BF73
- textMuted: #878787

## Key Typography
- 17_590: {"fontSize":17,"fontWeight":"590","lineHeight":20.29}
- 28_400: {"fontSize":28,"fontWeight":"400","lineHeight":39.48,"letterSpacing":-0.56}
- 12_500: {"fontSize":12,"fontWeight":"500","lineHeight":21.6}
- 12_600: {"fontSize":12,"fontWeight":"600","lineHeight":16.92,"letterSpacing":-0.48}
- 16_500: {"fontSize":16,"fontWeight":"500","lineHeight":28.8,"letterSpacing":-0.18}

---

## Text Content (for reference)
- "13:13"
- "Pay Rent"
- "Total payable rent"
- "₹  32,175"
- "saved ₹ 325 →"
- "using flent cashback"
- "Paying to"
- "[Landlord Name]"
- "ICICI "
- "XXXX XXXX XXXX 2003"
- "Pay Now"
- "All payments are 100% secure"
- "PAY BY ANY APP INSTEAD"
- "Google Pay"
- "PayTM"
