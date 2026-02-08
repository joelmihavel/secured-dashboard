# Figma-to-React-Native Conversion

## Screen: Screen 41-9004 (41-9004)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 41:9004

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 135 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 41:9004

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

- "Rent due in 10 days" → styles.rentDueIn10Days
- "December 2025" → styles.december2025
- "₹  32,500 →" → styles.32500
- "Base rent" → styles.baseRent
- "₹ 30,000" → styles.30000
- "Maintenance" → styles.maintenance
- "₹2,000" → styles.2000
- "Other charges" → styles.otherCharges
- "₹500" → styles.500
- "Payable Rent" → styles.payableRent
- "₹  32,500" → styles.325002
- "🔒 ₹350 cashback waiting for you" → styles.350CashbackWaitingForYou
- "Pay ₹32,500 now" → styles.text
- "Complete setup to unlock cashback on payments." → styles.completeSetupToUnlockCashbackOnPayments
- "Choose a   Payment Method" → styles.chooseAPaymentMethod

## Key Frame Dimensions

- Pay Rent / Payment Page --all setup before 7th: 393x852
- Frame 2095586343: 393x587.5441284179688
- Frame 2095586345: 393x265
- Frame 1686557240: 313x209
- Frame 2095586360: 103x124
- Frame 2095586359: 103x76
- Group 58: 20.5x35
- Group 59: 20.5x35
- Frame 2095586361: 270x314
- Frame 2095586361: 269x124

---

## Style Summary

- Total styles: 135
- TEXT nodes: 28
- FRAME nodes: 53

## Colors Found

- background: #131313
- cardSurface: #202020
- textMuted: #878787
- textTertiary: #CBCBCB
- cardBackground: #1A1A1A
- textSubtle: #A6A6A6
- colorDDDDDD: #DDDDDD
- textDisabled: #4D4D4D
- white: #FFFFFF
- colorA9A9A9: #A9A9A9
- color000000: #000000
- colorEEEEEE: #EEEEEE
- accent: #FF9A6D
- colorD2D2D2: #D2D2D2

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
