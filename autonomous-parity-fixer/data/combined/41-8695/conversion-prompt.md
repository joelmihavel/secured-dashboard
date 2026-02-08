# Figma-to-React-Native Conversion

## Screen: Screen 41-8695 (41-8695)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 41:8695

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 86 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 41:8695

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
- "Complete setup to unlock 1% cashback" → styles.completeSetupToUnlock1Cashback
- "₹350 cashback applied" → styles.350CashbackApplied
- "Base rent" → styles.baseRent
- "₹ 30,000" → styles.30000
- "Maintenance" → styles.maintenance
- "₹2,500" → styles.2500
- "Total Rent" → styles.totalRent
- "₹  32,500" → styles.32500
- "Cashback " → styles.cashback
- "- ₹  325" → styles.325
- "Payable Rent" → styles.payableRent
- "₹  32,500" → styles.325002
- "Pay ₹32,175 now" → styles.text
- "Pay by 7 Dec to earn ₹ 350 cashback on this payment" → styles.payBy7DecToEarn350CashbackOnThisPayment

## Key Frame Dimensions

- Pay Rent / Transaction Page --with cashback: 393x852
- Frame 2095586343: 393x552.5441284179688
- Frame 2095586345: 393x230
- Frame 1686557240: 313x174
- Frame 2095586360: 244x89
- Frame 2095586359: 244x89
- Frame 2095586454: 160x36
- Group 58: 20.5x35
- Group 59: 20.5x35
- Frame 2095586361: 270x347

---

## Style Summary

- Total styles: 86
- TEXT nodes: 16
- FRAME nodes: 31

## Colors Found

- background: #131313
- cardSurface: #202020
- textMuted: #878787
- textTertiary: #CBCBCB
- cardBackground: #1A1A1A
- accent: #FF9A6D
- textSubtle: #A6A6A6
- colorEF9194: #EF9194
- colorDDDDDD: #DDDDDD
- textDisabled: #4D4D4D
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
