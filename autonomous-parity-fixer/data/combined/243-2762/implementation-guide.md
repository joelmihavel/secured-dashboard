# Pixel-Perfect Implementation Guide

## Screen: Screen 243-2762
## Figma Node: 243:2762
## File Key: HZaVuwWn6B6jOjrmxZ7Kzv

---

## STEP 1: Get Figma Semantic Structure

Call the Figma MCP to get the design context:

```
mcp__figma__get_design_context({
  fileKey: "HZaVuwWn6B6jOjrmxZ7Kzv",
  nodeId: "243:2762"
})
```

This provides:
- Parent-child hierarchy
- Multi-span text structure
- Component relationships

---

## STEP 2: Load Extracted Styles

Use the pre-computed styles from:
`/Users/atrishabh/Documents/Dev/Secured v2-react-native project/autonomous-parity-fixer/data/combined/243-2762/style-map.json`

Total styles available: 242

### Key Styles:
- homeActiveBankUpiOnly: FRAME (Home --active --Bank / UPI only)
- frame2095586343: FRAME (Frame 2095586343)
- frame2095586453: FRAME (Frame 2095586453)
- yourRentIsDueIn10Days: TEXT (Your rent is due in 10 days)
- payingWith: TEXT (Paying with:)
- frame2095586454: FRAME (Frame 2095586454)
- vector45: VECTOR (Vector 45)
- frame2095586448: FRAME (Frame 2095586448)
- frame2095586449: FRAME (Frame 2095586449)
- creditCard: FRAME (Credit Card)

---

## STEP 3: Implement Component

### Generated Component Template:
`/Users/atrishabh/Documents/Dev/Secured v2-react-native project/autonomous-parity-fixer/output/components/243-2762.tsx`

### Target Location:
`/Users/atrishabh/FlentApp/app/(main)`

---

## STEP 4: Verify Implementation

1. Build and run on iOS simulator
2. Navigate to the screen
3. Capture screenshot: `xcrun simctl io booted screenshot`
4. Compare with Figma baseline

---

## Key Colors (from extraction)
- background: #131313
- textSecondary: #BABABA
- textSubtle: #A6A6A6
- cardSurface: #202020
- white: #FFFFFF
- cardBackground: #1A1A1A
- accent: #FF9A6D
- textDisabled: #4D4D4D

## Key Typography
- 28_400: {"fontSize":28,"fontWeight":"400","lineHeight":40,"letterSpacing":-1}
- 14_400: {"fontSize":14,"fontWeight":"400","lineHeight":20}
- 12_400: {"fontSize":12,"fontWeight":"400","lineHeight":20}
- 20_400: {"fontSize":20,"fontWeight":"400","lineHeight":32}
- 16_400: {"fontSize":16,"fontWeight":"400","lineHeight":24}

---

## Text Content (for reference)
- "Your rent is due in 10 days"
- "Paying with:"
- "SELECTED"
- "•••• 2341"
- "EXPIRY 06/26"
- "CVV •••"
- "CREDIT CARD"
- "SELECTED"
- "•••• 2341"
- "ICICI a/c -  xxx23"
- "rishabh@•••"
- "UPI"
- "SELECTED"
- "•••• 2341"
- "EXPIRY 06/26"
