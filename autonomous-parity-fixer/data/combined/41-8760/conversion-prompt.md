# Figma-to-React-Native Conversion

## Screen: Screen 41-8760 (41-8760)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 41:8760

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 165 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 41:8760

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

- "My  Profile" → styles.myProfile
- "Your payment history" → styles.yourPaymentHistory
- "JAN" → styles.jan
- "on time" → styles.onTime
- "FEB" → styles.feb
- "Paid late" → styles.paidLate
- "MAR" → styles.mar
- "Not Paid" → styles.notPaid
- "APR" → styles.apr
- "MAY" → styles.may
- "JUN" → styles.jun
- "JUL" → styles.jul
- "AUG" → styles.aug
- "SEP" → styles.sep
- "OCT" → styles.oct

## Key Frame Dimensions

- My Profile / Main Screen: 393x1492
- Frame 2095586343: 393x1388
- Frame 2095586345: 393x184
- Frame 2095586377: 393x228
- Frame 2095586393: 313x228
- Frame 1686557297: 313x187
- Frame 1686557285: 345x161
- Frame 1686557282: 24x125
- Frame 1686557297: 58x25
- Frame 1686557283: 24x82

---

## Style Summary

- Total styles: 165
- TEXT nodes: 33
- FRAME nodes: 45

## Colors Found

- background: #131313
- white: #FFFFFF
- textMuted: #878787
- color000000: #000000
- textDisabled: #4D4D4D
- accent: #FF9A6D
- cardSurface: #202020
- textTertiary: #CBCBCB

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
