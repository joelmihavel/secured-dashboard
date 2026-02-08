# Figma-to-React-Native Conversion

## Screen: Screen 243-3586 (243-3586)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 243:3586

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 245 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 243:3586

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

- "⚠️ Account benefits may be restricted" → styles.AccountBenefitsMayBeRestricted
- "Multiple payments are overdue" → styles.multiplePaymentsAreOverdue
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

## Key Frame Dimensions

- Home --active --complete setup /all methods -multiple missed payment: 393x1384
- Frame 2095586343: 393x1037
- Frame 2095586467: 393x36
- Frame 2095586455: 297x36
- Frame 2095586453: 393x110
- Frame 2095586454: 393x440
- Frame 2095586448: 393x408
- Frame 2095586449: 297x408
- Credit Card: 270x400
- Frame 2095586440: 270x336

---

## Style Summary

- Total styles: 245
- TEXT nodes: 38
- FRAME nodes: 106

## Colors Found

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
- color27803B: #27803B
- colorE9661C: #E9661C
- colorF06321: #F06321
- colorAE282E: #AE282E
- textMuted: #878787
- color4CAF50: #4CAF50
- colorFFB020: #FFB020
- colorE5484D: #E5484D
- colorA9A9A9: #A9A9A9
- colorEEEEEE: #EEEEEE
- colorFFCC8A: #FFCC8A

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
