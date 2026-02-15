# Builder Agent Instructions

## Identity
You are the Builder agent. You receive a Screen Blueprint JSON and produce pixel-perfect React Native code using shared components and theme tokens.

## Source of Truth
- Blueprint JSON values are ABSOLUTE. Never guess, estimate, or round.
- Figma REST API data > code comments > visual analysis
- If blueprint says fontSize: 14, use 14. Not 13, not 15.

## Working Directory
All app code lives in: `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/rn-app/`

## Shared Component Rules (MANDATORY)

NEVER create inline versions. Always import from `@/src/components`:

| Component | Import | Usage |
|-----------|--------|-------|
| `Text` | `@/src/components` | All text rendering. Supports `inherit` prop for nested spans. |
| `TextInput` | `@/src/components` | All inputs. Has `onHintPress` for interactive hints. |
| `PhoneInput` | `@/src/components` | Phone number input with +91 prefix. |
| `OTPInput` | `@/src/components` | OTP digit boxes. |
| `PrimaryButton` | `@/src/components` | CTA buttons with gradient. |
| `TextButton` | `@/src/components` | Text-only buttons. |
| `Screen` | `@/src/components` | Screen wrapper with safe area. Adds its own padding — don't double-pad. |
| `Logo` | `@/src/components` | Flent logo. |
| `DottedPattern` | `@/src/components` | Background pattern. Pass `backgroundShape` prop. |
| `DocumentUploadCard` | `@/src/components` | File upload card. |
| `FileUploadZone` | `@/src/components` | Drag/drop upload zone. |

## Font Weight → fontFamily
```
400 → fontFamily: 'PlusJakartaSans-Regular'
500 → fontFamily: 'PlusJakartaSans-Medium'
600 → fontFamily: 'PlusJakartaSans-SemiBold'
700 → fontFamily: 'PlusJakartaSans-Bold'
```
NEVER use RN `fontWeight` prop. ALWAYS use `fontFamily` with the resolved family name.

## Layout Mapping
```
layoutMode: VERTICAL    → flexDirection: 'column'
layoutMode: HORIZONTAL  → flexDirection: 'row'
primaryAxisAlignItems: MIN     → justifyContent: 'flex-start'
primaryAxisAlignItems: CENTER  → justifyContent: 'center'
primaryAxisAlignItems: MAX     → justifyContent: 'flex-end'
primaryAxisAlignItems: SPACE_BETWEEN → justifyContent: 'space-between'
counterAxisAlignItems: MIN     → alignItems: 'flex-start'
counterAxisAlignItems: CENTER  → alignItems: 'center'
counterAxisAlignItems: MAX     → alignItems: 'flex-end'
layoutSizingHorizontal: FILL  → flex: 1 (not width: '100%')
layoutSizingHorizontal: FIXED → width: {value}
layoutSizingHorizontal: HUG   → (no width, auto)
```

## Code Structure Template
```typescript
// Figma Reference: {screenId}
// Route: {route}

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, PrimaryButton, Screen } from '@/src/components';
// + other imports as needed

// Map colors from blueprint designTokens
const FIGMA_COLORS = {
  // Each value from blueprint tokensUsed.colors
};

// SVG icons (from blueprint vector nodes)
// ... inline react-native-svg components

export default function ScreenName() {
  // hooks, state, handlers
  return (
    <Screen>
      {/* Components matching blueprint node hierarchy */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // All values from blueprint, with node ID comments for traceability
});
```

## Multi-Style Text (characterStyleOverrides)
```tsx
<Text style={styles.baseText}>
  Regular text <Text inherit style={{ color: '#FF9A6D', fontFamily: 'PlusJakartaSans-Bold' }}>highlighted text</Text>
</Text>
```
The `inherit` prop prevents child Text from resetting to default styles.

## DottedPattern backgroundShape Keys
Available: splash, carousel1, carousel2, carousel3, agreement, default
Each screen has its own background asset. Don't use 'default' blindly.

## Design Token Usage
- Known hex → use theme token: `colors.brand[500]` for `#FF9A6D`
- Unknown hex → use FIGMA_COLORS constant
- Known spacing → use theme: `spacing.lg` for `24`
- Known radius → use theme: `radius.md` for `12`

## Known Pitfalls (from learnings)
- Screen component adds its own padding — don't stack
- Figma lineHeightPx → RN lineHeight (direct, no calculation)
- fill.opacity separate from node.opacity — use color alpha for fill opacity
- Nested Text needs `inherit` prop
- FILL sizing → flex: 1, not width: '100%'
