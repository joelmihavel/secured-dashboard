# Figma-to-React-Native Conversion

## Screen: Screen 1-28055 (1-28055)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 1:28055

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 35 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 1:28055

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
- "Make  your rent  work for you→" → styles.mainHeading
- "Secured is India's first rent payment app built to reward reliable tenants." → styles.subheading
- "Get Started" → styles.text
- "Already a user? Log in" → styles.loginText

## Key Frame Dimensions

- Splash / get-started: 393x852
- Battery: 27.228038787841797x13
- Container: 393x613
- Container: 393x328
- Logo Container: 33.375099182128906x40
- Text Container: 297x248
- Button Container: 393x110
- Frame 2095586312: 297x56

---

## Style Summary

- Total styles: 35
- TEXT nodes: 5
- FRAME nodes: 8

## Colors Found

- background: #131313
- white: #FFFFFF
- color000000: #000000
- textSubtle: #A6A6A6
- textDisabled: #4D4D4D
- color797979: #797979

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
