# Figma-to-React-Native Conversion

## Screen: Screen 243-3923 (243-3923)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 243:3923

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 87 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 243:3923

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
- "ICICI a/c -  xxx23" → styles.iciciAcXxx23
- "rishabh@•••" → styles.rishabh
- "UPI" → styles.upi

## Key Frame Dimensions

- UPI Card: 270x400
- Frame 2095586440: 270x336
- Frame 2095586441: 222x36
- UPI-Logo-vector 1: 45.289039611816406x16
- g22: 52.87306213378906x26.43653106689453
- Clip path group: 52.87306213378906x26.43653106689453
- clipPath28: 52.87306213378906x26.43653106689453
- g24: 45.284786224365234x15.996792793273926
- g30: 2.0984606742858887x2.2244625091552734
- g34: 2.4071927070617676x2.336695671081543

---

## Style Summary

- Total styles: 87
- TEXT nodes: 5
- FRAME nodes: 44

## Colors Found

- cardSurface: #202020
- color000000: #000000
- white: #FFFFFF
- color27803B: #27803B
- colorE9661C: #E9661C
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
