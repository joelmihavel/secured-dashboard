# Figma-to-React-Native Conversion

## Screen: Screen 243-4030 (243-4030)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 243:4030

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 28 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 243:4030

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

- "SELECTED" → styles.selected
- "•••• 2341" → styles.2341
- "EXPIRY 06/26" → styles.expiry0626
- "ICICI a/c -  xxx23" → styles.iciciAcXxx23
- "NET BANKING" → styles.netBanking

## Key Frame Dimensions

- Netbanking Card: 270x400
- Frame 2095586440: 270x336
- Frame 2095586441: 222x36
- Logo: 22.161251068115234x24
- Frame 2095586454: 85x36
- Frame 2095586440: 130x132
- Frame 2095586438: 130x72
- Group 58: 20.5x35
- Group 59: 20.5x35
- Frame 2095586341: 270x64

---

## Style Summary

- Total styles: 28
- TEXT nodes: 5
- FRAME nodes: 11

## Colors Found

- cardSurface: #202020
- colorF06321: #F06321
- colorAE282E: #AE282E
- white: #FFFFFF
- cardBackground: #1A1A1A
- accent: #FF9A6D
- textDisabled: #4D4D4D
- textTertiary: #CBCBCB

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
