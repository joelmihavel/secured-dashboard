# Figma-to-React-Native Conversion

## Screen: Screen 1-31758 (1-31758)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 1:31758

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 2 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 1:31758

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

- "Post Approval Setup" → styles.postApprovalSetup

## Key Frame Dimensions

- Frame 2095586313: 2765x154

---

## Style Summary

- Total styles: 2
- TEXT nodes: 1
- FRAME nodes: 1

## Colors Found

- color000000: #000000
- white: #FFFFFF

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
