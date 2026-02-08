# Claude Implementation Guide

## Screen: 243-6731
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 243:6731

---

## STEP 1: Get Figma Semantic Structure

```javascript
mcp__figma__get_design_context({
  fileKey: "HZaVuwWn6B6jOjrmxZ7Kzv",
  nodeId: "243:6731"
})
```

## STEP 2: Load Exact Styles

Style map location: `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/autonomous-parity-fixer/data/combined/243-6731/style-map.json`

Total styles: 280

### Sample Styles:
- homeEmptyStateTransactionPageWithoutCash: {"width":393,"height":853,"backgroundColor":"#131313"}...
- frame2095586357: {"width":393,"height":157,"backgroundColor":"#131313","flexDirection":"column","paddingBottom":24}...
- statusBar: {"width":393,"height":53}...
- battery: {"width":27.23,"height":13}...
- border: {"width":25,"height":13,"borderColor":"#FFFFFF","borderWidth":1,"borderRadius":4.3,"opacity":0.35}...

## STEP 3: Implement Component

1. Use MCP structure for hierarchy (parent-child relationships)
2. Use style-map.json for EXACT numerical values
3. Handle multi-span text with nested <Text> components
4. Use FIGMA constants object for organization

## STEP 4: Test

1. Build and run on simulator
2. Navigate to screen
3. Capture screenshot
4. Compare with Figma baseline

---

## Colors (from extraction)
- background: #131313
- white: #FFFFFF
- color000000: #000000
- textTertiary: #CBCBCB
- colorFFCC8A: #FFCC8A
- cardSurface: #202020
- colorA9A9A9: #A9A9A9
- colorEEEEEE: #EEEEEE
- textDisabled: #4D4D4D
- textSecondary: #BABABA

## Typography
- 17_590: {"fontSize":17,"fontWeight":"590","lineHeight":20.29}
- 14_400: {"fontSize":14,"fontWeight":"400","lineHeight":20}
- 12_400: {"fontSize":12,"fontWeight":"400","lineHeight":20}
- 12_600: {"fontSize":12,"fontWeight":"600","lineHeight":16.92,"letterSpacing":-0.48}
- 14_500: {"fontSize":14,"fontWeight":"500","lineHeight":20}
