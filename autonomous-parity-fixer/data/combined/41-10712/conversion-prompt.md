# Figma-to-React-Native Conversion

## Screen: Screen 41-10712 (41-10712)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 41:10712

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 164 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 41:10712

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

- "Pay Rent" → styles.payRent
- "Total payable rent" → styles.totalPayableRent
- "₹  32,175" → styles.32175
- "saved ₹ 325 →" → styles.saved325
- "using flent cashback" → styles.usingFlentCashback
- "Paying to" → styles.payingTo
- "[Landlord Name]" → styles.landlordName
- "ICICI " → styles.icici
- "XXXX XXXX XXXX 2003" → styles.xxxxXxxxXxxx2003
- "Pay Now" → styles.payNow
- "All payments are 100% secure" → styles.allPaymentsAre100Secure
- "PAY BY ANY APP INSTEAD" → styles.payByAnyAppInstead
- "Google Pay" → styles.googlePay
- "PayTM" → styles.paytm
- "PhonePe" → styles.phonepe

## Key Frame Dimensions

- onboarding / post approval 1: 393x852
- Frame 2095586401: 216x256.79998779296875
- Frame 2095586402: 216x256.79998779296875
- Frame 1686557264: 25.632076263427734x30.720001220703125
- Frame 1686557300: 393x662.7257690429688
- Frame 1686557230: 393x561.5339965820312
- Frame 1686557275: 234.9290008544922x38.966835021972656
- Frame 1686557277: 191.2527313232422x38.966835021972656
- Frame 1686557276: 28.484527587890625x28.484527587890625
- Frame: 12.207653999328613x12.207653999328613

---

## Style Summary

- Total styles: 164
- TEXT nodes: 19
- FRAME nodes: 44

## Colors Found

- background: #131313
- cardBackground: #1A1A1A
- accent: #FF9A6D
- textDisabled: #4D4D4D
- colorA9A9A9: #A9A9A9
- color000000: #000000
- white: #FFFFFF
- colorD9D9D9: #D9D9D9
- colorEEEEEE: #EEEEEE
- color70BF73: #70BF73
- textMuted: #878787
- cardSurface: #202020
- color444444: #444444
- textTertiary: #CBCBCB

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
