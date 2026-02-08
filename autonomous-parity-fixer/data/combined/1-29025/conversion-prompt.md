# Figma-to-React-Native Conversion

## Screen: Screen 1-29025 (1-29025)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 1:29025

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 36 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 1:29025

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
- "More than  just cashback" → styles.moreThanJustCashback
- "Keep paying via Secured to unlock exclusive renting benefits over time" → styles.keepPayingViaSecuredToUnlockExclusiveRen
- "Skip →" → styles.loginText

## Key Frame Dimensions

- Splash / get-started --carousel 5: 393x852
- Battery: 27.228038787841797x13
- Container: 393x765
- Container: 393x621
- Frame 1686557270: 393x2
- Logo Container: 26.7000789642334x32
- Text Container: 297x184
- Frame 2095586316: 32x8

---

## Style Summary

- Total styles: 36
- TEXT nodes: 4
- FRAME nodes: 8

## Colors Found

- background: #131313
- color000000: #000000
- white: #FFFFFF
- textDisabled: #4D4D4D
- colorA9A9A9: #A9A9A9
- cardSurface: #202020
- accent: #FF9A6D

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
