# Figma-to-React-Native Conversion

## Screen: Screen 243-3794 (243-3794)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 243:3794

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 24 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 243:3794

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
- "CVV •••" → styles.cvv
- "CREDIT CARD" → styles.creditCard

## Key Frame Dimensions

- Credit Card / selected: 270x400
- Frame 2095586440: 270x336
- Frame 2095586437: 222x36
- Frame 2095586454: 85x36
- Frame 2095586439: 130x132
- Frame 2095586438: 130x72
- Group 58: 20.5x35
- Group 59: 20.5x35
- Frame 2095586341: 270x64
- Frame 2095586441: 169.97494506835938x20

---

## Style Summary

- Total styles: 24
- TEXT nodes: 5
- FRAME nodes: 10

## Colors Found

- cardSurface: #202020
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
