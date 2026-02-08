# Claude Implementation Guide

## Screen: 243-3170
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 243:3170

---

## STEP 1: Get Figma Semantic Structure

```javascript
mcp__figma__get_design_context({
  fileKey: "HZaVuwWn6B6jOjrmxZ7Kzv",
  nodeId: "243:3170"
})
```

## STEP 2: Load Exact Styles

Style map location: `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/autonomous-parity-fixer/data/combined/243-3170/style-map.json`

Total styles: 245

### Sample Styles:
- homeActiveCompleteSetupAllMethodsLatePay: {"width":393,"height":1384,"backgroundColor":"#131313"}...
- frame2095586343: {"width":393,"height":1037,"flexDirection":"column","alignItems":"center","gap":24,"paddingBottom":4...
- frame2095586467: {"width":393,"height":36,"flexDirection":"column","gap":10,"paddingRight":32,"paddingLeft":64}...
- frame2095586455: {"width":297,"height":36,"backgroundColor":"#1A1A1A","borderRadius":12,"flexDirection":"row","alignI...
- CashbackMayBeImpactedIfDelayedFurther: {"width":272,"height":20,"color":"#FF9A6D","fontFamily":"Plus Jakarta Sans","fontSize":12,"fontWeigh...

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
- cardBackground: #1A1A1A
- accent: #FF9A6D
- textSecondary: #BABABA
- textSubtle: #A6A6A6
- cardSurface: #202020
- white: #FFFFFF
- textDisabled: #4D4D4D
- textTertiary: #CBCBCB
- color000000: #000000

## Typography
- 12_400: {"fontSize":12,"fontWeight":"400","lineHeight":20}
- 28_400: {"fontSize":28,"fontWeight":"400","lineHeight":40,"letterSpacing":-1}
- 14_400: {"fontSize":14,"fontWeight":"400","lineHeight":20}
- 20_400: {"fontSize":20,"fontWeight":"400","lineHeight":32}
- 16_400: {"fontSize":16,"fontWeight":"400","lineHeight":24}
