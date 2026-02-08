# Figma-to-React-Native Conversion

## Screen: Screen 41-8880 (41-8880)
## Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
## Node ID: 41:8880

---

## Data Sources

### 1. style-map.json (Exact Values)
Contains 93 pre-computed React Native styles.
Use these values DIRECTLY in StyleSheet.create().

### 2. Figma MCP (Semantic Structure)
Call `mcp__figma__get_design_context` with:
- fileKey: HZaVuwWn6B6jOjrmxZ7Kzv
- nodeId: 41:8880

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
- "Edit Picture" → styles.label
- "User name" → styles.label2
- "edit" → styles.hintText
- "John Smith" → styles.text
- "Email" → styles.label3
- "edit" → styles.hintText2
- "john@email.com" → styles.text2
- "City" → styles.label4
- "This is a hint text to help user." → styles.hintText3
- "Bangalore" → styles.text3
- "Phone Number" → styles.label5
- "hint text to help user." → styles.hintText4
- "+91" → styles.dropdownText
- "+91 98765 43210" → styles.text4

## Key Frame Dimensions

- My Profile / Secured Account --My Profile: 393x1069
- Frame 2095586343: 393x892
- Frame 2095586345: 393x184
- Frame 2095586371: 393x80
- button: 107x36
- Frame 2095586312: 99x28
- Frame 2095586311: 393x408
- _Input field base: 313x90
- Input with label: 313x90
- Frame 2: 313x20

---

## Style Summary

- Total styles: 93
- TEXT nodes: 17
- FRAME nodes: 32

## Colors Found

- background: #131313
- white: #FFFFFF
- colorFFCC8A: #FFCC8A
- colorCC7B57: #CC7B57
- colorA9A9A9: #A9A9A9
- textMuted: #878787
- colorDDDDDD: #DDDDDD
- color222222: #222222
- textDisabled: #4D4D4D
- color000000: #000000

---

## Implementation Steps

1. Read style-map.json for exact values
2. Call mcp__figma__get_design_context for structure
3. Combine both to generate pixel-perfect component
4. Download any image assets from Figma
5. Test against Figma screenshot
