# Figma-to-React-Native Conversion

## Screen: Screen 243-4052 (243-4052)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 243:4052

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 12 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 243:4052

This provides:
- Parent-child relationships
- Multi-span text structure
- Component hierarchy

---

## Conversion Rules

1. **Use rnStyles directly** - Values are already converted
2. **Multi-color text** - Use nested <Text> components
3. **FRAME containers**:
   - layout.mode=VERTICAL → flexDirection: 'column'
   - layout.mode=HORIZONTAL → flexDirection: 'row'
4. **ScrollView** for tall screens
5. **Download assets** from Figma MCP URLs

---

## Key Text Content

- "+  Setup your payment method to start" → styles.SetupYourPaymentMethodToStart
- "+ NEW PAYMENT" → styles.NewPayment

## Key Frame Dimensions

- Add More Card: 270x408
- Frame 2095586440: 270x344
- Frame 2095586442: 206x296
- Frame 2095586403: 206x128
- Frame 2095586341: 270x64
- Frame 2095586441: 169.97494506835938x20

---

## Style Summary

- Total styles: 12
- TEXT nodes: 2
- FRAME nodes: 6

## Colors Found

- cardSurface: #202020
- textTertiary: #CBCBCB
- cardBackground: #1A1A1A
- accent: #FF9A6D
- white: #FFFFFF

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
