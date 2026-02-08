# Figma-to-React-Native Conversion

## Screen: Screen 41-9511 (41-9511)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 41:9511

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 91 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 41:9511

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

- "failed" → styles.textHere
- "Payment Failed" → styles.paymentFailed
- "Something didn’t go through this time." → styles.somethingDidntGoThroughThisTime
- "Your money is safe and hasn’t been deducted." → styles.yourMoneyIsSafeAndHasntBeenDeducted
- "If money was debited, it will automatically be refunded within 3-5 business days" → styles.ifMoneyWasDebitedItWillAutomaticallyBeRe
- "Contact Support" → styles.text
- "Try Again" → styles.tryAgain
- "13:13" → styles.time

## Key Frame Dimensions

- Pay Rent / Payment Summary Page --Payment Failed: 393x852
- Frame 2095586343: 393x354.54412841796875
- Frame 2095586345: 393x32
- Frame 2095586361: 270x481
- Stamp: 75.85265026930028x78.65368846254842
- Frame 2095586329: 269x208
- Frame 2095586327: 269x40
- Frame 2095586326: 52.51908493041992x40
- Frame 2095586328: 269x40
- Frame 2095586326: 52.51908493041992x40

---

## Style Summary

- Total styles: 91
- TEXT nodes: 8
- FRAME nodes: 16

## Colors Found

- background: #131313
- cardSurface: #202020
- textDisabled: #4D4D4D
- colorFF8080: #FF8080
- white: #FFFFFF
- colorA9A9A9: #A9A9A9
- color000000: #000000

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
