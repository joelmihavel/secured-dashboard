# Figma-to-React-Native Conversion

## Screen: Screen 243-6731 (243-6731)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 243:6731

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 280 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 243:6731

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

- "13:13" → styles.time
- "Hi, Rishabh" → styles.hiRishabh
- "Due in 28 Days" → styles.dueIn28Days
- "₹  32,500" → styles.32500
- "Review" → styles.text
- "Your rent is due in 10 days" → styles.yourRentIsDueIn10Days
- "Paying with:" → styles.payingWith
- "SELECTED" → styles.selected
- "•••• 2341" → styles.2341
- "EXPIRY 06/26" → styles.expiry0626
- "CVV •••" → styles.cvv
- "CREDIT CARD" → styles.creditCard2
- "SELECTED" → styles.selected2
- "•••• 2341" → styles.23412
- "ICICI a/c -  xxx23" → styles.iciciAcXxx23

## Key Frame Dimensions

- Home --Empty State / Transaction Page --without cashbck / before payment: 393x853
- Frame 2095586357: 393x157
- Battery: 27.228038787841797x13
- Frame 2095586349: 393x80
- Frame 1410081070: 393x80
- Frame 1686557045: 329x32
- Frame 2095586341: 115.70008087158203x32
- Frame 1686557235: 68x32
- Frame: 20x20
- Frame 1686557229: 393x118

---

## Style Summary

- Total styles: 280
- TEXT nodes: 43
- FRAME nodes: 124

## Colors Found

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
- textSubtle: #A6A6A6
- cardBackground: #1A1A1A
- accent: #FF9A6D
- color27803B: #27803B
- colorE9661C: #E9661C
- colorF06321: #F06321
- colorAE282E: #AE282E
- textMuted: #878787

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
