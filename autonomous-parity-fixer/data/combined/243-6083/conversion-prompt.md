# Figma-to-React-Native Conversion

## Screen: Screen 243-6083 (243-6083)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 243:6083

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 251 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 243:6083

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

- "You are all paid up" → styles.youAreAllPaidUp
- "Paying with:" → styles.payingWith
- "SELECTED" → styles.selected
- "•••• 2341" → styles.2341
- "EXPIRY 06/26" → styles.expiry0626
- "CVV •••" → styles.cvv
- "CREDIT CARD" → styles.creditCard2
- "SELECTED" → styles.selected2
- "•••• 2341" → styles.23412
- "ICICI a/c -  xxx23" → styles.iciciAcXxx23
- "rishabh@•••" → styles.rishabh
- "UPI" → styles.upi
- "SELECTED" → styles.selected3
- "•••• 2341" → styles.23413
- "EXPIRY 06/26" → styles.expiry06262

## Key Frame Dimensions

- Home --Empty State --with upi / cashbacks --paid rent: 393x1650
- Frame 2095586343: 393x1306
- Frame 2095586453: 393x110
- Frame 2095586452: 393x440
- Frame 2095586448: 393x408
- Frame 2095586449: 297x408
- Credit Card: 270x400
- Frame 2095586440: 270x336
- Frame 2095586437: 222x36
- Frame 2095586454: 85x36

---

## Style Summary

- Total styles: 251
- TEXT nodes: 42
- FRAME nodes: 108

## Colors Found

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
- color27803B: #27803B
- colorE9661C: #E9661C
- colorF06321: #F06321
- colorAE282E: #AE282E
- textMuted: #878787
- colorA9A9A9: #A9A9A9
- colorDDDDDD: #DDDDDD
- colorEEEEEE: #EEEEEE
- colorFFCC8A: #FFCC8A

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
