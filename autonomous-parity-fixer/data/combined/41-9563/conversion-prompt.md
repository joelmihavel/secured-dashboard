# Figma-to-React-Native Conversion

## Screen: Screen 41-9563 (41-9563)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 41:9563

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 111 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 41:9563

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

- "Amount paid" → styles.amountPaid
- "₹  32,500" → styles.32500
- "Date" → styles.date
- "4 Nov 2026" → styles.4Nov2026
- "Method" → styles.method
- "UPI (joel@oksbi)" → styles.upiJoeloksbi
- "Transaction ID" → styles.transactionId
- "SEC12345678" → styles.sec12345678
- "Pay by the 7th to earn cashback." → styles.payByThe7thToEarnCashback
- "Payable Rent" → styles.payableRent
- "₹  32,500" → styles.325002
- "paid" → styles.textHere
- "Payment Succesful" → styles.paymentSuccesful
- "Download Receipt" → styles.text
- "Contact Support" → styles.contactSupport

## Key Frame Dimensions

- Pay Rent / Payment Summary Page --Payment Successful --no cashback: 393x852
- Frame 2095586343: 393x354.54412841796875
- Frame 2095586345: 393x32
- Frame 2095586361: 270x481
- Frame 2095586369: 270x286
- Frame 2095586361: 222x176
- Frame 1686557329: 222x20
- Frame 1686557121: 93x20
- Frame: 16x16
- Frame 1686557326: 222x20

---

## Style Summary

- Total styles: 111
- TEXT nodes: 16
- FRAME nodes: 28

## Colors Found

- background: #131313
- cardSurface: #202020
- textSubtle: #A6A6A6
- textMuted: #878787
- textTertiary: #CBCBCB
- cardBackground: #1A1A1A
- colorDDDDDD: #DDDDDD
- textDisabled: #4D4D4D
- color06C270: #06C270
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
