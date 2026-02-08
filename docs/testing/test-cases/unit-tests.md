# Unit Test Specifications
## Flent Secured - Component & Utility Test Cases

<!-- FIGMA_STATUS: IN_PROGRESS -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: true -->

---

## Overview

This document specifies unit tests for all UI components, hooks, and utilities in the Flent Secured app. Each test case includes the component under test, test scenario, setup requirements, assertions, and priority.

**Target Coverage: 80%+**

---

## 1. Button Components

### 1.1 PrimaryButton

**File:** `src/components/ui/Button/PrimaryButton.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| BTN-001 | Renders with title | `<PrimaryButton title="Get Started" />` | - Text "Get Started" visible<br>- Correct styling applied | P0 |
| BTN-002 | Handles press event | `onPress={mockFn}` | - Mock function called on press<br>- Press animation triggers | P0 |
| BTN-003 | Disabled state | `disabled={true}` | - Button not pressable<br>- Opacity reduced<br>- Gradient muted | P0 |
| BTN-004 | Loading state | `loading={true}` | - Spinner visible<br>- Title hidden<br>- Button not pressable | P0 |
| BTN-005 | Full width variant | `fullWidth={true}` | - Width = 100% of container | P1 |
| BTN-006 | Custom style merge | `style={{ marginTop: 20 }}` | - Custom style applied without overriding base | P2 |
| BTN-007 | TestID accessibility | `testID="submit-btn"` | - testID prop accessible for testing | P0 |
| BTN-008 | Divider variant | `showDivider={true}` | - Divider line above button | P2 |
| BTN-009 | Press animation | Touch down/up | - Scale to 0.96 on press<br>- Scale back to 1 on release | P1 |
| BTN-010 | Opacity animation | Touch down/up | - Opacity 0.9 on press<br>- Opacity 1 on release | P1 |

**Test Template:**
```typescript
describe('PrimaryButton', () => {
  it('BTN-001: renders with title', () => {
    render(<PrimaryButton title="Get Started" onPress={() => {}} />);
    expect(screen.getByText('Get Started')).toBeVisible();
  });

  it('BTN-002: handles press event', () => {
    const onPress = jest.fn();
    render(<PrimaryButton title="Submit" onPress={onPress} />);
    fireEvent.press(screen.getByTestId('primary-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('BTN-003: disabled state prevents press', () => {
    const onPress = jest.fn();
    render(<PrimaryButton title="Submit" onPress={onPress} disabled />);
    fireEvent.press(screen.getByTestId('primary-button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('BTN-004: shows spinner when loading', () => {
    render(<PrimaryButton title="Submit" onPress={() => {}} loading />);
    expect(screen.getByTestId('button-spinner')).toBeVisible();
    expect(screen.queryByText('Submit')).toBeNull();
  });
});
```

### 1.2 TextButton

**File:** `src/components/ui/Button/TextButton.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| TBT-001 | Renders with title | `<TextButton title="Log in" />` | - Text "Log in" visible<br>- No background | P0 |
| TBT-002 | Underline variant | `underline={true}` | - Text decoration: underline | P1 |
| TBT-003 | Disabled state | `disabled={true}` | - Not pressable<br>- Opacity reduced | P1 |
| TBT-004 | Press handler | `onPress={mockFn}` | - Handler called on press | P0 |

---

## 2. Input Components

### 2.1 TextInput

**File:** `src/components/ui/Input/TextInput.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| TIN-001 | Renders with label | `label="Name"` | - Label text visible above input | P0 |
| TIN-002 | Controlled value | `value="John"` | - Input displays value | P0 |
| TIN-003 | Change handler | `onChangeText={mockFn}` | - Handler called with new value | P0 |
| TIN-004 | Error state | `error="Name required"` | - Red border applied<br>- Error message visible | P0 |
| TIN-005 | Disabled state | `disabled={true}` | - Input not editable<br>- Opacity reduced | P1 |
| TIN-006 | Placeholder | `placeholder="Enter name"` | - Placeholder visible when empty | P1 |
| TIN-007 | Focus handling | Focus input | - Border color changes on focus | P1 |
| TIN-008 | Keyboard type | `keyboardType="email"` | - Correct keyboard opens | P2 |

**Test Template:**
```typescript
describe('TextInput', () => {
  it('TIN-001: renders with label', () => {
    render(<TextInput label="Name" value="" onChangeText={() => {}} />);
    expect(screen.getByText('Name')).toBeVisible();
  });

  it('TIN-003: calls onChangeText with new value', () => {
    const onChangeText = jest.fn();
    render(<TextInput label="Name" value="" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByTestId('text-input'), 'John');
    expect(onChangeText).toHaveBeenCalledWith('John');
  });

  it('TIN-004: shows error state', () => {
    render(
      <TextInput label="Name" value="" onChangeText={() => {}} error="Name required" />
    );
    expect(screen.getByText('Name required')).toBeVisible();
    // Check for red border style
  });
});
```

### 2.2 PhoneInput

**File:** `src/components/ui/Input/PhoneInput.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| PHN-001 | Shows +91 prefix | Default render | - "+91" prefix visible | P0 |
| PHN-002 | Formats as 5-5 | `value="9876543210"` | - Displays "98765 43210" | P0 |
| PHN-003 | Numeric only | Type letters | - Letters rejected<br>- Only digits accepted | P0 |
| PHN-004 | Max 10 digits | Type 11 digits | - Truncated to 10 | P0 |
| PHN-005 | Error state | `error="Invalid"` | - Error message shown<br>- Red border | P0 |
| PHN-006 | Country code tap | Tap +91 area | - Country code handler called | P2 |
| PHN-007 | Paste handling | Paste "+91 98765 43210" | - Formats correctly, strips prefix | P1 |

**Test Template:**
```typescript
describe('PhoneInput', () => {
  it('PHN-001: shows +91 prefix', () => {
    render(<PhoneInput value="" onChangeText={() => {}} />);
    expect(screen.getByText('+91')).toBeVisible();
  });

  it('PHN-002: formats phone as 5-5', () => {
    render(<PhoneInput value="9876543210" onChangeText={() => {}} />);
    expect(screen.getByDisplayValue('98765 43210')).toBeVisible();
  });

  it('PHN-003: rejects non-numeric input', () => {
    const onChangeText = jest.fn();
    render(<PhoneInput value="" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByTestId('phone-input'), 'abc123');
    expect(onChangeText).toHaveBeenCalledWith('123');
  });

  it('PHN-004: limits to 10 digits', () => {
    const onChangeText = jest.fn();
    render(<PhoneInput value="9876543210" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByTestId('phone-input'), '98765432101');
    expect(onChangeText).toHaveBeenCalledWith('9876543210');
  });
});
```

### 2.3 OTPInput

**File:** `src/components/ui/Input/OTPInput.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| OTP-001 | Renders 6 boxes | Default render | - 6 input boxes visible | P0 |
| OTP-002 | Auto-advance | Type digit | - Cursor moves to next box | P0 |
| OTP-003 | Backspace behavior | Delete digit | - Cursor moves to previous box | P0 |
| OTP-004 | Complete callback | Enter 6 digits | - onComplete called with code | P0 |
| OTP-005 | Separator visible | Between box 3-4 | - Dash separator visible | P1 |
| OTP-006 | Error state | `error="Invalid"` | - Red border on all boxes | P0 |
| OTP-007 | Disabled state | `disabled={true}` | - Boxes not editable | P1 |
| OTP-008 | Auto focus | `autoFocus={true}` | - First box focused on mount | P1 |
| OTP-009 | Paste 6 digits | Paste "123456" | - All boxes filled<br>- onComplete called | P0 |
| OTP-010 | Cursor animation | Focus on empty box | - Blinking cursor visible | P2 |

**Test Template:**
```typescript
describe('OTPInput', () => {
  it('OTP-001: renders 6 input boxes', () => {
    render(<OTPInput value="" onChangeText={() => {}} />);
    expect(screen.getAllByTestId(/otp-box-/)).toHaveLength(6);
  });

  it('OTP-004: calls onComplete when all digits entered', () => {
    const onComplete = jest.fn();
    render(<OTPInput value="" onChangeText={() => {}} onComplete={onComplete} />);
    fireEvent.changeText(screen.getByTestId('otp-input'), '123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('OTP-006: shows error state on all boxes', () => {
    render(<OTPInput value="123456" onChangeText={() => {}} error="Invalid OTP" />);
    expect(screen.getByText('Invalid OTP')).toBeVisible();
    // Verify red border on boxes
  });
});
```

---

## 3. Typography Components

### 3.1 Text

**File:** `src/components/ui/Typography/Text.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| TXT-001 | Default variant | `<Text>Hello</Text>` | - bodyMd style applied | P0 |
| TXT-002 | H1 variant | `variant="h1"` | - 48px, regular weight | P0 |
| TXT-003 | H2 variant | `variant="h2"` | - 36px, semibold | P0 |
| TXT-004 | H3 variant | `variant="h3"` | - 32px, semibold | P0 |
| TXT-005 | H4 variant | `variant="h4"` | - 28px, semibold | P0 |
| TXT-006 | Body variants | `variant="bodyLg/Md/Sm"` | - Correct sizes | P0 |
| TXT-007 | Label variants | `variant="labelMd/Sm"` | - Correct sizes, weights | P1 |
| TXT-008 | Caption variant | `variant="caption"` | - 10px, regular | P1 |
| TXT-009 | Color prop | `color="brand500"` | - Brand orange applied | P0 |
| TXT-010 | Align prop | `align="center"` | - Text centered | P1 |
| TXT-011 | Custom style merge | `style={{ margin: 10 }}` | - Style merged, not overwritten | P2 |

---

## 4. Layout Components

### 4.1 Screen

**File:** `src/components/ui/Layout/Screen.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| SCR-001 | Renders children | `<Screen><Text>Hi</Text></Screen>` | - Children visible | P0 |
| SCR-002 | Default padding | Default | - 40px horizontal padding | P0 |
| SCR-003 | Compact padding | `paddingVariant="compact"` | - 24px horizontal padding | P1 |
| SCR-004 | No padding | `padded={false}` | - No padding applied | P1 |
| SCR-005 | Safe area top | `safeAreaTop={true}` | - Top inset applied | P0 |
| SCR-006 | Safe area bottom | `safeAreaBottom={true}` | - Bottom inset applied | P0 |
| SCR-007 | Background color | Default | - #131313 background | P0 |
| SCR-008 | TestID | `testID="screen"` | - Accessible for testing | P1 |

### 4.2 Logo

**File:** `src/components/ui/Layout/Logo.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| LGO-001 | Default size | Default | - 40px height | P0 |
| LGO-002 | Small size | `size="small"` | - 32px height | P1 |
| LGO-003 | Image renders | Default | - Logo image visible | P0 |

---

## 5. Composed Components

### 5.1 ConsentToggle

**File:** `src/components/composed/auth/ConsentToggle.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| CST-001 | Renders consent text | Default | - Consent text visible<br>- Cashfree link visible | P0 |
| CST-002 | Toggle off by default | Default | - Toggle in OFF position | P0 |
| CST-003 | Toggle interaction | Tap toggle | - State changes<br>- Handler called | P0 |
| CST-004 | Link opens browser | Tap Cashfree link | - External link handler called | P1 |
| CST-005 | Animation | Toggle on/off | - Smooth slide animation | P2 |

### 5.2 CarouselDots

**File:** `src/components/composed/auth/CarouselDots.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| CDT-001 | Renders correct count | `count={3}` | - 3 dots visible | P0 |
| CDT-002 | Active indicator | `activeIndex={1}` | - Second dot highlighted | P0 |
| CDT-003 | Tap navigation | Tap third dot | - onIndexChange(2) called | P1 |
| CDT-004 | Active color | Active dot | - Brand orange (#FF9A6D) | P1 |
| CDT-005 | Inactive color | Inactive dots | - Neutral (#4D4D4D) | P1 |

---

## 6. Pattern Components

### 6.1 DottedPattern

**File:** `src/components/patterns/DottedPattern.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| DPT-001 | Renders dots | Default | - Pattern visible | P1 |
| DPT-002 | Opacity | Default | - 16% opacity | P2 |
| DPT-003 | Responsive | Different sizes | - Scales appropriately | P2 |

---

## 7. Theme Utilities

### 7.1 Colors

**File:** `src/theme/colors.ts`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| CLR-001 | Black palette | Access colors.black | - All shades defined (700-200) | P0 |
| CLR-002 | Brand palette | Access colors.brand | - 400, 500, 600 defined | P0 |
| CLR-003 | Semantic colors | Access colors.success/error | - Correct hex values | P0 |
| CLR-004 | Neutral palette | Access colors.neutral | - All shades defined | P0 |

### 7.2 Typography

**File:** `src/theme/typography.ts`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| TYP-001 | Font families | Access fontFamily | - PlusJakartaSans variants | P0 |
| TYP-002 | Text styles | Access textStyles | - All variants defined | P0 |
| TYP-003 | Font sizes | Verify sizes | - Match Figma specs | P0 |

### 7.3 Spacing

**File:** `src/theme/spacing.ts`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| SPC-001 | Base scale | Access spacing | - All sizes defined | P0 |
| SPC-002 | Layout aliases | Access layout | - screenHorizontal = 40 | P0 |
| SPC-003 | Form spacing | Access layout.formFieldSpacing | - 24px | P1 |

---

## 8. Hooks (When Implemented)

### 8.1 useAuth (Future)

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| AUT-001 | Initial state | Render hook | - isAuthenticated = false<br>- user = null | P0 |
| AUT-002 | Login success | Call login() | - isAuthenticated = true<br>- user populated | P0 |
| AUT-003 | Login failure | Invalid credentials | - Error state set<br>- isAuthenticated = false | P0 |
| AUT-004 | Logout | Call logout() | - isAuthenticated = false<br>- Storage cleared | P0 |
| AUT-005 | Token refresh | Token expired | - Auto-refresh triggered<br>- Session maintained | P1 |

### 8.2 usePayment (Future)

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| PAY-001 | Load payment | Hook init | - Payment data loaded | P0 |
| PAY-002 | Cashback calc | Before 7th | - Correct 1% amount | P0 |
| PAY-003 | Cashback cap | Large rent | - Capped at 10,000 | P0 |
| PAY-004 | No cashback | After 7th | - Cashback = 0 | P0 |
| PAY-005 | Toggle cashback | Toggle off | - Amount updates | P1 |

### 8.3 useCashback (Future)

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| CSH-001 | Calculate 1% | rentPaise = 3250000 | - Returns 32500 paise | P0 |
| CSH-002 | Cap at 10000 | rentPaise = 1100000000 | - Returns 1000000 paise | P0 |
| CSH-003 | Date check | Day = 7 | - Eligible = true | P0 |
| CSH-004 | Date check | Day = 8 | - Eligible = false | P0 |
| CSH-005 | Edge midnight | 7th 23:59:59 | - Eligible = true | P0 |

---

## 9. Utility Functions

### 9.1 Phone Formatting

**File:** `src/utils/formatters/phone.ts` (when created)

| Test ID | Scenario | Input | Expected Output | Priority |
|---------|----------|-------|-----------------|----------|
| FMT-001 | Format phone | "9876543210" | "98765 43210" | P0 |
| FMT-002 | Strip spaces | "98765 43210" | "9876543210" | P0 |
| FMT-003 | Strip prefix | "+919876543210" | "9876543210" | P1 |
| FMT-004 | Invalid chars | "98765abc" | "98765" | P1 |

### 9.2 Currency Formatting

**File:** `src/utils/formatters/currency.ts` (when created)

| Test ID | Scenario | Input | Expected Output | Priority |
|---------|----------|-------|-----------------|----------|
| CUR-001 | Format paise | 3250000 | "₹32,500" | P0 |
| CUR-002 | With decimals | 3250050 | "₹32,500.50" | P1 |
| CUR-003 | Large amount | 100000000 | "₹10,00,000" | P0 |
| CUR-004 | Zero | 0 | "₹0" | P1 |

### 9.3 Validators

**File:** `src/utils/validators/` (when created)

| Test ID | Scenario | Input | Expected | Priority |
|---------|----------|-------|----------|----------|
| VAL-001 | Valid phone | "9876543210" | true | P0 |
| VAL-002 | Short phone | "987654321" | false | P0 |
| VAL-003 | Invalid start | "1234567890" | false | P0 |
| VAL-004 | Valid email | "test@email.com" | true | P1 |
| VAL-005 | Invalid email | "invalid" | false | P1 |
| VAL-006 | Valid IFSC | "SBIN0001234" | true | P0 |
| VAL-007 | Invalid IFSC | "INVALID" | false | P0 |

---

## Summary

| Category | Test Count | P0 | P1 | P2 |
|----------|------------|----|----|-----|
| Button Components | 14 | 8 | 4 | 2 |
| Input Components | 21 | 15 | 5 | 1 |
| Typography | 11 | 8 | 2 | 1 |
| Layout | 11 | 6 | 4 | 1 |
| Composed Components | 10 | 5 | 4 | 1 |
| Pattern Components | 3 | 0 | 1 | 2 |
| Theme Utilities | 10 | 8 | 1 | 1 |
| Hooks (Future) | 15 | 12 | 3 | 0 |
| Utility Functions | 14 | 10 | 4 | 0 |
| **Total** | **109** | **72** | **28** | **9** |

---

## Jest Configuration Notes

```javascript
// jest.setup.js
import '@testing-library/jest-native/extend-expect';

// Mock Reanimated
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));
```

---

*Document generated: 2026-01-31*
*Next review: When new components added*
