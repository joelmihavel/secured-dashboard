# Figma-to-React-Native Conversion

## Screen: Screen 41-11410 (41-11410)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 41:11410

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 119 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 41:11410

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
- "We can’t approve you right now" → styles.weCantApproveYouRightNow
- "We're opening access in batches. Stay tuned." → styles.wereOpeningAccessInBatchesStayTuned
- "Application Sent" → styles.applicationSent
- "Submitted on 27 Jan 2026" → styles.submittedOn27Jan2026
- "In Review" → styles.inReview
- "Approximately 24 hrs" → styles.approximately24Hrs
- "Account Status" → styles.accountStatus
- "Rejected" → styles.rejected
- "Why was I Rejected?" → styles.whyWasIRejected
- "You're renting outside Bangalore" → styles.youreRentingOutsideBangalore
- "You did not use an invite code." → styles.youDidNotUseAnInviteCode
- "You rent agreement didn't qualify." → styles.youRentAgreementDidntQualify
- "Contact support" → styles.text
- "Next applications open in 28:24:24" → styles.hintText

## Key Frame Dimensions

- Onboarding / Waitlist Screen -- Rejected: 393x1333
- Frame 2095586324: 393x1223.4000244140625
- Battery: 27.22842788696289x13
- Frame 1686557268: 393x1106.4000244140625
- Frame 1686557318: 313x1106.4000244140625
- Frame 2095586325: 313x314.3999938964844
- Frame 1686557264: 32.040096282958984x38.400001525878906
- Frame 2095586319: 313x228
- Frame 2095586388: 313x228
- Frame 2095586385: 281x44

---

## Style Summary

- Total styles: 119
- TEXT nodes: 20
- FRAME nodes: 46

## Colors Found

- background: #131313
- color000000: #000000
- white: #FFFFFF
- textSubtle: #A6A6A6
- cardSurface: #202020
- accent: #FF9A6D
- textMuted: #878787
- textTertiary: #CBCBCB
- colorE5484D: #E5484D
- colorA9A9A9: #A9A9A9
- textDisabled: #4D4D4D
- color797979: #797979
- cardBackground: #1A1A1A
- colorEEEEEE: #EEEEEE

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
