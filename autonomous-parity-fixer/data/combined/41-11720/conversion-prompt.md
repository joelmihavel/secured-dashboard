# Figma-to-React-Native Conversion

## Screen: Screen 41-11720 (41-11720)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 41:11720

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 127 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 41:11720

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
- "Welcome,   Rishabh Agnihotri" → styles.welcomeRishabhAgnihotri
- "Your application is in review" → styles.yourApplicationIsInReview
- "Application Sent" → styles.applicationSent
- "Submitted on 27 Jan 2026" → styles.submittedOn27Jan2026
- "In Review" → styles.inReview
- "Approximately 24 hrs" → styles.approximately24Hrs
- "Account Status" → styles.accountStatus
- "Pending" → styles.pending
- "18 / 150  members onboarded" → styles.18150MembersOnboarded
- "This  release" → styles.hintText
- "Be notified" → styles.text
- "Kudos. You’re among Secured’s first members" → styles.kudosYoureAmongSecuredsFirstMembers
- "What do you get with Flent Secured?" → styles.whatDoYouGetWithFlentSecured
- "Earn 1% back for paying rent on time" → styles.earn1BackForPayingRentOnTime

## Key Frame Dimensions

- Onboarding / Waitlist Screen --referral code entry invalid: 393x1634
- Frame 2095586324: 393x1478.4000244140625
- Battery: 27.22842788696289x13
- Frame 1686557268: 393x1361.4000244140625
- Frame 1686557318: 313x1361.4000244140625
- Frame 2095586325: 313x314.3999938964844
- Frame 1686557264: 32.040096282958984x38.400001525878906
- Frame 2095586319: 313x228
- Frame 2095586388: 313x228
- Frame 2095586385: 281x44

---

## Style Summary

- Total styles: 127
- TEXT nodes: 22
- FRAME nodes: 48

## Colors Found

- background: #131313
- color000000: #000000
- white: #FFFFFF
- textSubtle: #A6A6A6
- cardSurface: #202020
- accent: #FF9A6D
- textMuted: #878787
- textTertiary: #CBCBCB
- cardBackground: #1A1A1A
- colorCC7B57: #CC7B57
- color797979: #797979
- textDisabled: #4D4D4D
- colorA9A9A9: #A9A9A9
- colorEEEEEE: #EEEEEE

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
