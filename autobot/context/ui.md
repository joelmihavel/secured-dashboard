# UI Context -- Flent Secured v2 React Native

Sole UI reference for subagents. All values sourced from code and config, not estimated.

---

## 1. Screen Routes

Figma file key: `HZaVuwWn6B6jOjrmxZ7Kzv` | Base frame: 393x852 (iPhone 14 Pro)

| # | Route Key | Route Path | States | Figma IDs |
|---|-----------|-----------|--------|-----------|
| 1 | splash | `/(auth)/splash` | default, animation | 1-28053, 1-28055 |
| 2 | beta-splash | `/(auth)/beta-splash` | beta | 1-28071 |
| 3 | carousel | `/(auth)/carousel` | page4, page5, page6 | 1-28985, 1-29025, 1-29065 |
| 4 | sign-up | `/(auth)/sign-up` | empty, filled | 1-29108, 1-29914 |
| 5 | otp | `/(auth)/otp` | empty, filled, error1, error2 | 1-31175, 1-31073, 1-31277, 1-31380 |
| 6 | waitlist | `/(waitlist)/index` | default, accepted, rejected, 24hrs, referral, referral-invalid | 41-11206..41-11720 |
| 7 | agreement-upload | `/(agreement)/upload` | default, uploading, expired, too-large, manual-review | 1-30090..1-30358 |
| 8 | agreement-review | `/(agreement)/review` | verify, modify | 1-30448, 1-30820 |
| 9 | setup | `/(setup)/index` | step1, step2, step3 | 41-10712, 41-10859, 41-11006 |
| 10 | add-bank | `/(setup)/add-bank` | default, bescom | 1-31485, 1-31590 |
| 11 | invite-landlord | `/(setup)/invite-landlord` | default | 1-31671 |
| 12 | home-empty | `/(main)/index` | upi-no-cashbacks, setup-payment, setup-upi, no-cashback | 243-6296..243-5689 |
| 13 | home-active | `/(main)/index` | bank-upi, all-methods, late-payment, missed-payment, complete | 243-2762..243-7185 |
| 14 | payment-select | `/(payment)/select-method` | before-7th, after-7th, no-setup | 41-9004, 41-9114, 41-8901 |
| 15 | payment-add-upi | `/(payment)/add-upi` | default | 41-8369 |
| 16 | payment-add-card | `/(payment)/add-card` | default | 41-8450 |
| 17 | payment-add-netbanking | `/(payment)/add-netbanking` | default | 41-8529 |
| 18 | payment-processing | `/(payment)/processing` | default | 41-9460 |
| 19 | payment-success | `/(payment)/success` | with-cashback, no-cashback | 41-9388, 41-9511 |
| 20 | payment-failed | `/(payment)/failed` | failed, refunded | 41-9563, 41-9635 |
| 21 | transactions | `/(transactions)/index` | no-cashback, with-cashback | 243-5870, 243-6083 |
| 22 | profile | `/(profile)/index` | main, edit, payment-upi, payment-credit-card, payment-bank, agreement | 41-8760..41-9811 |
| 23 | payment-cards | `/(payment)/select-method` | credit-un/selected, upi-un/selected, netbanking-un/selected, add-more | 243-3794..243-4052 |

Node ID format: Figma API uses `1:28053`, filenames use `1-28053`. Convert: `id.replace(':', '-')`.

---

## 2. Shared Components

All imports from `@/src/components`. Never create inline versions.

### Screen
```typescript
interface ScreenProps {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;                          // default: true
  paddingVariant?: 'default' | 'compact';    // default: 'default' (40px / 24px)
  safeAreaTop?: boolean;                     // default: true
  safeAreaBottom?: boolean;                  // default: true
  testID?: string;
}
```
Background: `#131313`. Adds its own horizontal padding -- do NOT double-pad.

### Text
```typescript
interface TextProps extends RNTextProps {
  variant?: TypographyVariant;    // default: 'bodyMdRegular'
  color?: 'primary' | 'secondary' | 'muted' | 'disabled' | 'accent' | 'error' | 'success' | 'onAccent';
  align?: 'left' | 'center' | 'right';
  inherit?: boolean;              // default: false -- nested styling
  children: React.ReactNode;
}
```

### PrimaryButton
```typescript
interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;             // flat #202020 bg, #444444 text
  loading?: boolean;              // shows ActivityIndicator
  fullWidth?: boolean;            // default: true
  showDivider?: boolean;          // 24x2 #4D4D4D pill divider above
  style?: ViewStyle;
  testID?: string;
}
```
Active: gradient `#202020 -> #0D0D0D`, hairline `#FF9A6D` border, radius 8.

### TextInput
```typescript
interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
  variant?: 'dark' | 'light';    // default: 'dark'
  hintText?: string;              // right-aligned in label row
  onHintPress?: () => void;
  testID?: string;
}
```

### PhoneInput
```typescript
interface PhoneInputProps {
  label: string; value: string; onChangeText: (text: string) => void;
  countryCode?: string;           // default: '+91'
  error?: string; disabled?: boolean; placeholder?: string; hintText?: string; testID?: string;
}
```

### OTPInput
```typescript
interface OTPInputProps {
  value: string; onChangeText: (text: string) => void;
  onComplete?: (otp: string) => void;
  error?: string; disabled?: boolean; autoFocus?: boolean; testID?: string;
}
```
6 boxes (39x64, gap 8) split 3-dash-3. Supports iOS `textContentType="oneTimeCode"`.

### DottedPattern
```typescript
interface DottedPatternProps {
  showShape?: boolean;            // default: true
  backgroundShape?: BackgroundShapeKey | number;
}
type BackgroundShapeKey = 'splash' | 'carousel1' | 'carousel2' | 'carousel3' | 'agreement' | 'default';
```
Full-screen background. Place as first child inside `<Screen>`, uses `position: absolute` + `zIndex: -1`.

### Other Components
- **TextButton**: `{ title, onPress, underline?, disabled? }` -- 14px secondary text
- **Logo**: `{ size?, color? }` -- SVG "f" logo, aspect 33.375:40
- **DocumentUploadCard**: `{ filename, status, progress?, errorMessage?, onRemove?, onRetry? }`
- **FileUploadZone**: `{ onFileSelected, acceptedTypes?, maxSizeBytes?, disabled? }`
- **ConsentToggle**: `{ value, onValueChange, disabled? }` -- 3D toggle with Cashfree text
- **CarouselDots**: `{ count, activeIndex }` -- 8x8 dots, active: #FF9A6D
- **ErrorBoundary**: `{ children, fallback? }` -- catches render errors

---

## 3. Theme Tokens

### Colors
```
BLACK                    NEUTRAL                  BRAND (ORANGE)
black.800 #0D0D0D       neutral.100 #EEEEEE      brand.300 #FFCC8A
black.700 #131313 bg    neutral.200 #DDDDDD       brand.400 #FFAE8A
black.600 #1A1A1A card  neutral.300 #CBCBCB       brand.500 #FF9A6D accent
black.500 #202020       neutral.500 #A9A9A9       brand.600 #CC7B57
black.400 #4D4D4D       neutral.600 #878787       brand.700 #F06321
black.300 #797979       neutral.800 #444444       brand.800 #E9661C
black.200 #A6A6A6

SEMANTIC: success.default #70BF73 | error.default #FF8080 | error.radix #E5484D | warning.default #FFD580
```

### Typography (fontWeight -> fontFamily -- NEVER use RN fontWeight)
```
400 -> PlusJakartaSans-Regular    500 -> PlusJakartaSans-Medium
600 -> PlusJakartaSans-SemiBold   700 -> PlusJakartaSans-Bold
```

| Token | Size | Line | Weight |
|-------|------|------|--------|
| h1 | 48 | 64 | 400 |
| h2 | 40 | 52 | 400 |
| h4 | 28 | 40 | 400 |
| h5 | 24 | 32 | 600 |
| h6 | 20 | 28 | 600 |
| bodyLg | 20 | 32 | 400 |
| bodyLgMedium | 20 | 32 | 500 |
| bodyMd | 16 | 24 | 600 |
| bodyMdRegular | 16 | 24 | 400 |
| bodyMd2 | 14 | 20 | 400 |
| bodyMd2Medium | 14 | 20 | 500 |
| label | 14 | 20 | 600 |
| bodySm | 12 | 20 | 400 |
| bodySmMedium | 12 | 20 | 500 |
| bodySmSemiBold | 12 | 20 | 600 |

### Spacing
```
zero:0  xxxs:2  xxs:4  xs:8  sm:12  md:16  lg:24  xl:32  xxl:40  xxxl:48  huge:64
```

### Radius
```
none:0  xs:4  sm:8  md:12  lg:16  xl:24  xxl:40  pill:200
```

---

## 4. Figma Interpretation Rules

1. **fontWeight -> fontFamily**: NEVER use RN fontWeight. Map: 400=Regular, 500=Medium, 600=SemiBold, 700=Bold
2. **lineHeightPx**: Direct mapping to RN lineHeight. No conversion.
3. **fill.visible=false**: Skip rendering entirely
4. **Opacity**: `fill.opacity` -> color alpha; `node.opacity` -> RN opacity prop
5. **absoluteBoundingBox**: Subtract parent bbox for relative coords
6. **Text wrapping**: `textAutoResize: HEIGHT` -> use flexShrink, not fixed width
7. **Negative y-offset**: Use position absolute for children with negative y
8. **FILL sizing**: `FILL` -> `flex: 1` (not `width: '100%'`); `FIXED` -> explicit; `HUG` -> omit
9. **Screen padding**: Screen adds padding. Don't double-pad direct children.

---

## 5. RN Patterns

### Layout Mapping
```
VERTICAL   -> flexDirection: 'column'     HORIZONTAL -> flexDirection: 'row'
MIN        -> flex-start                  CENTER     -> center
MAX        -> flex-end                    SPACE_BETWEEN -> space-between
```

### Card-with-Dividers: Single card bg #1A1A1A radius 12, rows separated by 1px #4D4D4D dividers
### Menu-Stack: Individual cards, each bg #202020 radius 12, gap 4
### DottedPattern shapes: `splash`, `carousel1`, `carousel2`, `carousel3`, `agreement`, `default`

---

## 6. BuildBot Commands (run from `buildbot/`)

```bash
npx tsx scripts/extract-screen-blueprint.ts --node 1-28053 --depth 999
npx tsx scripts/check-coverage.ts --screen 1-28053
npx tsx scripts/verify-screen.ts --screen 1-28053
npx tsx scripts/gemini-pixel-feedback.ts --screen 1-28053
npx tsx scripts/export-figma-tokens.ts
```
ODiff thresholds: regular 3%, DottedPattern 18%, dynamic 8%.

---

## 7. Responsive Scaling

Base: 393x852 (iPhone 14 Pro). Import from `@/src/theme`:

| Function | Purpose | Clamping |
|----------|---------|----------|
| `s(value)` | Scale by width ratio | none |
| `sf(size)` | Scale font size | +/-15% |
| `sv(value)` | Scale by height ratio | none |
| `scaled(v, min?, max?)` | Scale with clamp | custom |

All use `PixelRatio.roundToNearestPixel`. Device: `isSmallDevice` (<375), `isMediumDevice` (375-414), `isLargeDevice` (>414).
