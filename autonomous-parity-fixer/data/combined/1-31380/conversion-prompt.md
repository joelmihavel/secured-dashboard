# Figma-to-React-Native Conversion

## Screen: Screen 1-31380 (1-31380)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 1:31380

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 171 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 1:31380

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

## Key Frame Dimensions

- auth / sign up --OTP Error 2: 393x852
- Battery: 27.228038787841797x13
- Frame 1686557300: 393x662.7257690429688
- Frame 1686557230: 393x561.5339965820312
- Frame 1686557275: 234.9290008544922x38.966835021972656
- Frame 1686557277: 191.2527313232422x38.966835021972656
- Frame 1686557276: 28.484527587890625x28.484527587890625
- Frame: 12.207653999328613x12.207653999328613
- Frame 1686557311: 393x39
- Frame 1686557308: 393x108

---

## Style Summary

- Total styles: 171
- TEXT nodes: 40
- FRAME nodes: 68

## Colors Found

- background: #131313
- white: #FFFFFF
- color000000: #000000
- colorD9D9D9: #D9D9D9
- colorEEEEEE: #EEEEEE
- colorA9A9A9: #A9A9A9
- color70BF73: #70BF73
- textMuted: #878787
- colorD2D2D2: #D2D2D2
- colorDDDDDD: #DDDDDD
- textDisabled: #4D4D4D
- cardBackground: #1A1A1A
- color222222: #222222
- textTertiary: #CBCBCB
- colorE5484D: #E5484D
- cardSurface: #202020
- color444444: #444444

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
