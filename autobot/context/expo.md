# Expo Context -- Flent Secured v2 React Native

Authoritative reference for Expo config, build profiles, dependencies, and tooling.

---

## 1. App Configuration (app.json)

- **Name**: Flent Secured | **Slug**: flent-secured | **Version**: 1.0.0
- **Orientation**: Portrait only | **UI Style**: Dark (`userInterfaceStyle: "dark"`)
- **Scheme**: `flentsecured` (deep linking)
- **New Architecture**: Disabled (`newArchEnabled: false`)
- **Splash**: Background #131313 (no custom animation)
- **iOS**: Bundle ID `com.flent.secured`, build 1, tablets disabled
- **Android**: Package `com.flent.secured`, adaptive icon bg #131313
- **Web**: Metro bundler, static output

### Plugins
1. `expo-router` -- file-based routing v4
2. `expo-font` -- custom font loading v13
3. `expo-secure-store` -- secure credential storage v14
4. `expo-splash-screen` -- splash with #131313 bg

### Experiments
- `typedRoutes: true` -- strict type checking for routes
- `router.origin: false` -- disables origin validation

---

## 2. EAS Configuration (eas.json)

- **CLI**: >= 5.0.0
- **development**: dev client, internal distribution, iOS simulator
- **preview**: internal distribution, iOS simulator
- **production**: auto-increment build numbers
- **submit**: `production: {}` (unconfigured)

---

## 3. Dependencies

### Core Expo (18 packages)
```
expo ~52.0.49 | expo-router ~4.0.0 | expo-font ~13.0.0
expo-secure-store ~14.0.0 | expo-splash-screen ~0.29.0 | expo-status-bar ~2.0.0
expo-asset ~11.0.0 | expo-blur ~14.0.3 | expo-constants ~17.0.0
expo-dev-client ~5.0.20 | expo-document-picker ~13.0.3 | expo-file-system ~18.0.12
expo-haptics ~14.0.0 | expo-image ~2.0.0 | expo-image-picker ~16.0.6
expo-linear-gradient ~14.0.0 | expo-linking ~7.0.0 | @expo/metro-runtime ~4.0.1
```

### React & RN
```
react 18.3.1 | react-native 0.76.9 | react-native-web ~0.19.13 | react-dom 18.3.1
```

### Styling & UI
```
nativewind ~4.1.0 | react-native-svg ~15.8.0
```

### Navigation & Animation
```
react-native-gesture-handler ~2.20.0 | react-native-reanimated ~3.16.0
react-native-screens ~4.4.0 | react-native-safe-area-context ~4.12.0
@gorhom/bottom-sheet ~5.0.0 | moti ~0.29.0 | lottie-react-native ~7.1.0
```

### State & Data
```
zustand ~5.0.0 | @tanstack/react-query ~5.60.0 | immer ^11.1.3 | zod ~3.23.0
```

### Backend
```
@supabase/supabase-js ~2.46.0 | date-fns ~4.1.0 | base64-arraybuffer ^1.0.2
```

### Dev Dependencies
```
typescript ~5.6.0 | jest ~29.7.0 | jest-expo ~52.0.0
@testing-library/react-native ~12.8.0 | react-test-renderer 18.3.1
tailwindcss ~3.4.0 | prettier ~3.3.0 | eslint ~9.14.0
@babel/core ^7.25.0 | @types/jest ~29.5.0 | @types/react ~18.3.0
```

---

## 4. Scripts

```json
{
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "lint": "eslint .",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:snapshot": "jest --updateSnapshot"
}
```

---

## 5. TypeScript (tsconfig.json)

- **Base**: `expo/tsconfig.base` | **Strict**: enabled
- **Path aliases**:
  - `@/*` -> `./*`
  - `@/components/*` -> `./src/components/*`
  - `@/theme/*` -> `./src/theme/*`
  - `@/hooks/*` -> `./src/hooks/*`
  - `@/services/*` -> `./src/services/*`
  - `@/stores/*` -> `./src/stores/*`
  - `@/utils/*` -> `./src/utils/*`
  - `@/types/*` -> `./src/types/*`
  - `@/constants/*` -> `./src/constants/*`
  - `@/assets/*` -> `./assets/*`
- **Includes**: `nativewind/types`, `jest`, `.expo/types/**`, `expo-env.d.ts`, `nativewind-env.d.ts`, `global.d.ts`

---

## 6. Build Tooling

### Babel (babel.config.js)
- Preset: `babel-preset-expo` with `jsxImportSource: 'nativewind'`
- Plugin: `nativewind/babel`
- Plugin: `react-native-reanimated/plugin` (must be last)

### Metro (metro.config.js)
- Base: Expo default config
- NativeWind: `withNativeWind(config, { input: './global.css' })`

### Tailwind (tailwind.config.js)
- Preset: `nativewind/preset`
- Content: `./app/**/*.{js,jsx,ts,tsx}`, `./src/**/*.{js,jsx,ts,tsx}`
- Theme extends: colors (black, neutral, brand, semantic), fonts, spacing, radius
- Full token values defined in `autobot/context/ui.md` Section 3

---

## 7. Assets

### Fonts (TTF in `assets/fonts/`)
- PlusJakartaSans: Regular, Medium, SemiBold, Bold
- Inter: Regular, Medium, SemiBold

### Animations (Lottie JSON in `assets/animations/`)
- confetti, empty, error, loading, payment_failed, payment_success, processing, success

### Images (PNG/SVG in `assets/images/`)
- App icons: icon.png, adaptive-icon.png, favicon.png, splash-icon.png
- Branding: banks/bank_logos.svg, logo/flent-logo.svg, upi/upi-logo.svg
- UI: patterns/dotted-pattern.png, icons/benefit_card_icon.png, profile-avatar.png

---

## 8. Route Groups

10 route groups in `app/`:
1. `(auth)` -- splash, beta-splash, carousel, sign-up, OTP
2. `(main)` -- home dashboard
3. `(payment)` -- select-method, initiate, first-rent, add-upi/card/netbanking, processing, success, failed
4. `(waitlist)` -- index, approved
5. `(setup)` -- index, add-bank, add-utility, invite-landlord, pending-steps
6. `(profile)` -- index, edit, payment-methods, notifications, help, about, agreement
7. `(profile-payment)` -- separate payment flow from profile
8. `(agreement)` -- upload, review, success
9. `(transactions)` -- index, [id] detail
10. `(dev)` -- screen-picker (dev-only, hidden when `!__DEV__`)

Deep link format: `flentsecured:///(group)/screen`
