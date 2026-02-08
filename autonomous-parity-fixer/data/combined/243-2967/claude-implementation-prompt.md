# Claude Implementation Guide

## Screen: 243-2967
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 243:2967

---

## STEP 1: Get Figma Semantic Structure

```javascript
mcp__figma__get_design_context({
  fileKey: "HZaVuwWn6B6jOjrmxZ7Kzv",
  nodeId: "243:2967"
})
```

## STEP 2: Load Exact Styles

Style map location: `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/autonomous-parity-fixer/data/combined/243-2967/style-map.json`

Total styles: 238

### Sample Styles:
- homeActiveCompleteSetupAllMethods: {"width":393,"height":1284,"backgroundColor":"#131313"}...
- frame2095586343: {"width":393,"height":985,"flexDirection":"column","alignItems":"center","gap":24,"paddingBottom":48...
- frame2095586453: {"width":393,"height":110,"flexDirection":"column","justifyContent":"center","alignItems":"center","...
- yourRentIsDueIn10Days: {"width":265,"height":80,"color":"#BABABA","fontFamily":"Plus Jakarta Sans","fontSize":28,"fontWeigh...
- payingWith: {"width":265,"height":20,"color":"#A6A6A6","fontFamily":"Plus Jakarta Sans","fontSize":14,"fontWeigh...

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
- textSecondary: #BABABA
- textSubtle: #A6A6A6
- cardSurface: #202020
- white: #FFFFFF
- cardBackground: #1A1A1A
- accent: #FF9A6D
- textDisabled: #4D4D4D
- textTertiary: #CBCBCB
- color000000: #000000

## Typography
- 28_400: {"fontSize":28,"fontWeight":"400","lineHeight":40,"letterSpacing":-1}
- 14_400: {"fontSize":14,"fontWeight":"400","lineHeight":20}
- 12_400: {"fontSize":12,"fontWeight":"400","lineHeight":20}
- 20_400: {"fontSize":20,"fontWeight":"400","lineHeight":32}
- 16_400: {"fontSize":16,"fontWeight":"400","lineHeight":24}
