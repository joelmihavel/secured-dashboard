# Figma-to-React-Native Conversion

## Screen: Screen 1-28071 (1-28071)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 1:28071

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 24 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 1:28071

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
- "BETA LAUNCH" → styles.loginPrompt

## Key Frame Dimensions

- Splash / get-started --animation: 393x852
- Battery: 27.228038787841797x13
- Logo Container: 33.375099182128906x40
- Frame 1686557110: 96x28

---

## Style Summary

- Total styles: 24
- TEXT nodes: 2
- FRAME nodes: 4

## Colors Found

- background: #131313
- color000000: #000000
- white: #FFFFFF
- accent: #FF9A6D

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
